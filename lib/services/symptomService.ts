/* biome-ignore-all lint/complexity/noForEach: Legacy symptom aggregation paths still use forEach and will be migrated in a dedicated cleanup pass. */
/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Family symptom/stat aggregation intentionally combines query and rollup logic in single methods. */
/* biome-ignore-all lint/style/noNonNullAssertion: Existing map-lookup paths guard initialization prior to access in this legacy module. */
/* biome-ignore-all lint/nursery/noIncrementDecrement: Existing counters in this legacy analytics code use increment semantics. */
/* biome-ignore-all lint/style/noNestedTernary: Severity-to-level mappings currently use compact conditional expressions. */
/**
 * Symptom service — Firebase-free replacement.
 *
 * Replaced Firestore reads/writes on `symptoms` collection with:
 *   POST /api/health/symptoms              → addSymptom / addSymptomForUser
 *   GET  /api/health/symptoms              → getUserSymptoms (own user)
 *   GET  /api/health/symptoms/user/:userId → getMemberSymptoms
 *   GET  /api/health/symptoms/family/:fid  → getFamilySymptoms
 *   PATCH /api/health/symptoms/:id         → updateSymptom
 *   DELETE /api/health/symptoms/:id        → deleteSymptom
 */

import { api } from "@/lib/apiClient";
import { healthTimelineService } from "@/lib/observability";
import type { Symptom } from "@/types";
import { offlineService } from "./offlineService";
import { userService } from "./userService";

// In-memory caches for getUserSymptoms and getSymptomStats
const _symptomCache = new Map<string, { data: Symptom[]; timestamp: number }>();
const _symptomStatsCache = new Map<string, { data: { totalSymptoms: number; avgSeverity: number; commonSymptoms: { type: string; count: number }[] }; timestamp: number }>();
const SYMPTOM_CACHE_TTL = 2 * 60_000; // 2 minutes

type SymptomStats = {
  totalSymptoms: number;
  avgSeverity: number;
  commonSymptoms: { type: string; count: number }[];
};

type FamilySymptomStats = {
  totalSymptoms: number;
  avgSeverity: number;
  commonSymptoms: {
    type: string;
    count: number;
    userId?: string;
    userName?: string;
  }[];
};

/** Normalize a raw API symptom row to the client Symptom type */
const normalizeSymptom = (raw: Record<string, unknown>): Symptom => ({
  id: raw.id as string,
  userId: raw.userId as string,
  type: raw.type as string,
  severity: (raw.severity ?? 1) as Symptom["severity"],
  description: raw.notes as string | undefined,
  timestamp: raw.recordedAt ? new Date(raw.recordedAt as string) : new Date(),
  location: raw.location as string | undefined,
  triggers: raw.triggers as string[] | undefined,
  tags: raw.tags as string[] | undefined,
});

export const symptomService = {
  // Add new symptom
  async addSymptom(symptomData: Omit<Symptom, 'id'>): Promise<string> {
    const isOnline = offlineService.isDeviceOnline();
    try {
      if (isOnline) {
        const created = await api.post<Record<string, unknown>>("/api/health/symptoms", {
          type: symptomData.type,
          severity: symptomData.severity,
          location: symptomData.location,
          notes: symptomData.description,
          triggers: symptomData.triggers,
          tags: symptomData.tags,
          recordedAt: symptomData.timestamp.toISOString(),
        });

        const newSymptom = { id: created.id as string, ...symptomData };

        // Cache the result for offline access
        const currentSymptoms = await offlineService.getOfflineCollection<Symptom>("symptoms");
        await offlineService.storeOfflineData("symptoms", [...currentSymptoms, newSymptom]);

        // Invalidate symptom caches for this user
        for (const key of _symptomCache.keys()) {
          if (key.startsWith(`${symptomData.userId}:`)) _symptomCache.delete(key);
        }
        for (const key of _symptomStatsCache.keys()) {
          if (key.startsWith(`${symptomData.userId}:`)) _symptomStatsCache.delete(key);
        }

        await healthTimelineService.addEvent({
          userId: symptomData.userId,
          eventType: "symptom_logged",
          title: `Symptom logged: ${symptomData.type}`,
          description: symptomData.description || `Severity: ${symptomData.severity}/5`,
          timestamp: symptomData.timestamp,
          severity:
            symptomData.severity >= 4
              ? "error"
              : symptomData.severity >= 3
                ? "warn"
                : "info",
          icon: "thermometer",
          metadata: {
            symptomId: created.id,
            symptomType: symptomData.type,
            severity: symptomData.severity,
            location: symptomData.location,
            triggers: symptomData.triggers,
          },
          relatedEntityId: created.id as string,
          relatedEntityType: "symptom",
          actorType: "user",
        });

        // Check for concerning trends (non-blocking)
        import("./trendAlertService")
          .then(({ checkTrendsForNewSymptom }) => {
            checkTrendsForNewSymptom(symptomData.userId, symptomData.type).catch((err: unknown) => {
              console.warn('[symptom] checkTrendsForNewSymptom failed:', err instanceof Error ? err.message : String(err));
            });
          })
          .catch((err: unknown) => {
            console.warn('[symptom] Failed to import trendAlertService:', err instanceof Error ? err.message : String(err));
          });

        return created.id as string;
      }

      // Offline — queue the operation
      const operationId = await offlineService.queueOperation({
        type: "create",
        collection: "symptoms",
        data: { ...symptomData, userId: symptomData.userId },
      });
      const tempId = `offline_${operationId}`;
      const newSymptom = { id: tempId, ...symptomData };
      const currentSymptoms = await offlineService.getOfflineCollection<Symptom>("symptoms");
      await offlineService.storeOfflineData("symptoms", [...currentSymptoms, newSymptom]);
      return tempId;
    } catch (error: unknown) {
      console.error('Error adding symptom:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  // Add new symptom for a specific user (for admins)
  async addSymptomForUser(
    symptomData: Omit<Symptom, 'id'>,
    targetUserId: string
  ): Promise<string> {
    const created = await api.post<Record<string, unknown>>("/api/health/symptoms", {
      userId: targetUserId,
      type: symptomData.type,
      severity: symptomData.severity,
      location: symptomData.location,
      notes: symptomData.description,
      triggers: symptomData.triggers,
      tags: symptomData.tags,
      recordedAt: symptomData.timestamp.toISOString(),
    });
    return created.id as string;
  },

  // Get user symptoms (offline-first)
  async getUserSymptoms(userId: string, limitCount = 50): Promise<Symptom[]> {
    const cacheKey = `${userId}:${limitCount}`;
    const cached = _symptomCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SYMPTOM_CACHE_TTL) {
      return cached.data;
    }

    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        const raw = await api.get<Record<string, unknown>[]>(
          `/api/health/symptoms?limit=${limitCount}`
        );
        const symptoms = (Array.isArray(raw) ? raw : []).map(normalizeSymptom);

        // Cache for offline access and in-memory
        await offlineService.storeOfflineData("symptoms", symptoms);
        _symptomCache.set(cacheKey, { data: symptoms, timestamp: Date.now() });
        return symptoms;
      }

      // Offline — use cached data filtered by userId
      const cachedSymptoms = await offlineService.getOfflineCollection<Symptom>("symptoms");
      return cachedSymptoms
        .filter((s) => {
          if (s.userId !== userId) return false;
          if (!s.timestamp) return false;
          if (!(s.timestamp instanceof Date)) s.timestamp = new Date(s.timestamp);
          return !Number.isNaN(s.timestamp.getTime());
        })
        .sort((a, b) => {
          const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return bTime - aTime;
        })
        .slice(0, limitCount);
    } catch (err: unknown) {
      console.debug('[symptomService] getSymptoms failed, falling back to offline cache:', err instanceof Error ? err.message : String(err));
      // Fallback to offline cache
      if (isOnline) {
        const cachedSymptoms = await offlineService.getOfflineCollection<Symptom>("symptoms");
        return cachedSymptoms
          .filter((s) => {
            if (s.userId !== userId) return false;
            if (!s.timestamp) return false;
            if (!(s.timestamp instanceof Date)) s.timestamp = new Date(s.timestamp);
            return !Number.isNaN(s.timestamp.getTime());
          })
          .sort((a, b) => {
            const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return bTime - aTime;
          })
          .slice(0, limitCount);
      }
      throw err;
    }
  },

  // Check if user has permission to access family data (admin or caregiver)
  async checkFamilyAccessPermission(userId: string, familyId: string): Promise<boolean> {
    try {
      const user = await userService.getUser(userId);
      return user?.familyId === familyId && (user?.role === "admin" || user?.role === "caregiver");
    } catch (err: unknown) {
      console.warn('[symptom] checkFamilyAccessPermission failed:', err instanceof Error ? err.message : String(err));
      return false;
    }
  },

  // Get symptoms for all family members (for admins and caregivers)
  async getFamilySymptoms(
    userId: string,
    familyId: string,
    limitCount = 50
  ): Promise<Symptom[]> {
    const hasPermission = await this.checkFamilyAccessPermission(userId, familyId);
    if (!hasPermission) {
      throw new Error("Access denied: Only admins and caregivers can access family medical data");
    }

    try {
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/symptoms/family/${familyId}?limit=${limitCount}`
      );
      return (Array.isArray(raw) ? raw : []).map(normalizeSymptom);
    } catch (error: unknown) {
      throw error;
    }
  },

  // Update symptom
  async updateSymptom(symptomId: string, updates: Partial<Symptom>): Promise<void> {
    await api.patch(`/api/health/symptoms/${symptomId}`, {
      ...(updates.type !== undefined && { type: updates.type }),
      ...(updates.severity !== undefined && { severity: updates.severity }),
      ...(updates.location !== undefined && { location: updates.location }),
      ...(updates.description !== undefined && { notes: updates.description }),
      ...(updates.triggers !== undefined && { triggers: updates.triggers }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
    });

    // Invalidate cache if we know the userId
    if (updates.userId) {
      for (const key of _symptomCache.keys()) {
        if (key.startsWith(`${updates.userId}:`)) _symptomCache.delete(key);
      }
      for (const key of _symptomStatsCache.keys()) {
        if (key.startsWith(`${updates.userId}:`)) _symptomStatsCache.delete(key);
      }
    }
  },

  // Delete symptom
  async deleteSymptom(symptomId: string): Promise<void> {
    await api.delete(`/api/health/symptoms/${symptomId}`);
  },

  // Get symptom statistics for a user
  async getSymptomStats(userId: string, days = 7): Promise<SymptomStats> {
    const statsCacheKey = `${userId}:${days}`;
    const cachedStats = _symptomStatsCache.get(statsCacheKey);
    if (cachedStats && Date.now() - cachedStats.timestamp < SYMPTOM_CACHE_TTL) {
      return cachedStats.data;
    }

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/symptoms?from=${startDate.toISOString()}&limit=500`
      );
      const symptoms = (Array.isArray(raw) ? raw : []).map(normalizeSymptom);

      const totalSymptoms = symptoms.length;
      const avgSeverity = totalSymptoms > 0
        ? symptoms.reduce((sum, s) => sum + s.severity, 0) / totalSymptoms
        : 0;

      const symptomCounts: Record<string, number> = {};
      for (const s of symptoms) {
        symptomCounts[s.type] = (symptomCounts[s.type] || 0) + 1;
      }

      const commonSymptoms = Object.entries(symptomCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const result: SymptomStats = {
        totalSymptoms,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        commonSymptoms,
      };
      _symptomStatsCache.set(statsCacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (err: unknown) {
      console.warn('[symptom] getSymptomStats failed:', err instanceof Error ? err.message : String(err));
      return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
    }
  },

  // Get symptoms for a specific family member (for admins)
  async getMemberSymptoms(memberId: string, limitCount = 50): Promise<Symptom[]> {
    const raw = await api.get<Record<string, unknown>[]>(
      `/api/health/symptoms/user/${memberId}?limit=${limitCount}`
    );
    return (Array.isArray(raw) ? raw : []).map(normalizeSymptom);
  },

  // Get symptom stats for a specific family member (for admins)
  async getMemberSymptomStats(memberId: string, days = 7): Promise<SymptomStats> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/symptoms/user/${memberId}?from=${startDate.toISOString()}&limit=500`
      );
      const symptoms = (Array.isArray(raw) ? raw : []).map(normalizeSymptom);

      const totalSymptoms = symptoms.length;
      const avgSeverity = totalSymptoms > 0
        ? symptoms.reduce((sum, s) => sum + s.severity, 0) / totalSymptoms
        : 0;

      const symptomCounts = new Map<string, number>();
      for (const symptom of symptoms) {
        symptomCounts.set(symptom.type, (symptomCounts.get(symptom.type) || 0) + 1);
      }

      const commonSymptoms = Array.from(symptomCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return { totalSymptoms, avgSeverity: Math.round(avgSeverity * 10) / 10, commonSymptoms };
    } catch (err: unknown) {
      console.warn('[symptom] getMemberSymptomStats failed:', err instanceof Error ? err.message : String(err));
      return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
    }
  },
};
