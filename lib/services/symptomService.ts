<<<<<<< Updated upstream
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Symptom } from '@/types';
=======
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
>>>>>>> Stashed changes

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
    try {
<<<<<<< Updated upstream
      // Filter out undefined values to prevent Firebase errors
      const cleanedData = Object.fromEntries(
        Object.entries({
          ...symptomData,
          timestamp: Timestamp.fromDate(symptomData.timestamp),
        }).filter(([_, value]) => value !== undefined)
      );

      const docRef = await addDoc(collection(db, 'symptoms'), cleanedData);
      return docRef.id;
=======
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
            checkTrendsForNewSymptom(symptomData.userId, symptomData.type).catch(() => {
              // Silently handle errors — trend checking is non-critical
            });
          })
          .catch(() => {
            // Silently handle import errors
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
>>>>>>> Stashed changes
    } catch (error) {
      console.error('Error adding symptom:', error);
      throw error;
    }
  },

  // Add new symptom for a specific user (for admins)
  async addSymptomForUser(
    symptomData: Omit<Symptom, 'id'>,
    targetUserId: string
  ): Promise<string> {
<<<<<<< Updated upstream
    try {
      // Override the userId to the target user
      const dataWithTargetUser = {
        ...symptomData,
        userId: targetUserId,
      };

      // Filter out undefined values to prevent Firebase errors
      const cleanedData = Object.fromEntries(
        Object.entries({
          ...dataWithTargetUser,
          timestamp: Timestamp.fromDate(dataWithTargetUser.timestamp),
        }).filter(([_, value]) => value !== undefined)
      );

      const docRef = await addDoc(collection(db, 'symptoms'), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error('Error adding symptom for user:', error);
      throw error;
    }
  },

  // Get user symptoms
  async getUserSymptoms(
    userId: string,
    limitCount: number = 50
=======
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
        const symptoms = (raw ?? []).map(normalizeSymptom);

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
    } catch (_error) {
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
      throw _error;
    }
  },

  // Check if user has permission to access family data (admin or caregiver)
  async checkFamilyAccessPermission(userId: string, familyId: string): Promise<boolean> {
    try {
      const user = await userService.getUser(userId);
      return user?.familyId === familyId && (user?.role === "admin" || user?.role === "caregiver");
    } catch {
      return false;
    }
  },

  // Get symptoms for all family members (for admins and caregivers)
  async getFamilySymptoms(
    userId: string,
    familyId: string,
    limitCount = 50
>>>>>>> Stashed changes
  ): Promise<Symptom[]> {
    const hasPermission = await this.checkFamilyAccessPermission(userId, familyId);
    if (!hasPermission) {
      throw new Error("Access denied: Only admins and caregivers can access family medical data");
    }

    try {
<<<<<<< Updated upstream
      const q = query(
        collection(db, 'symptoms'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const symptoms: Symptom[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        symptoms.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Symptom);
      });

      return symptoms;
    } catch (error) {
      console.error('Error getting symptoms:', error);
=======
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/symptoms/family/${familyId}?limit=${limitCount}`
      );
      return (raw ?? []).map(normalizeSymptom);
    } catch (error) {
>>>>>>> Stashed changes
      throw error;
    }
  },

  // Get symptoms for all family members (for admins)
  async getFamilySymptoms(
    familyId: string,
<<<<<<< Updated upstream
    limitCount: number = 50
  ): Promise<Symptom[]> {
    try {
      // First get all family members
      const familyMembersQuery = query(
        collection(db, 'users'),
        where('familyId', '==', familyId)
      );
      const familyMembersSnapshot = await getDocs(familyMembersQuery);
      const memberIds = familyMembersSnapshot.docs.map((doc) => doc.id);

      if (memberIds.length === 0) {
        return [];
      }

      // Get symptoms for all family members
      const symptomsQuery = query(
        collection(db, 'symptoms'),
        where('userId', 'in', memberIds),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(symptomsQuery);
      const symptoms: Symptom[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        symptoms.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Symptom);
      });

      return symptoms;
    } catch (error) {
      console.error('Error getting family symptoms:', error);
      throw error;
    }
  },

  // Get symptom stats for all family members (for admins)
  async getFamilySymptomStats(
    familyId: string,
    days: number = 7
  ): Promise<{
    totalSymptoms: number;
    avgSeverity: number;
    commonSymptoms: {
      type: string;
      count: number;
      userId?: string;
      userName?: string;
    }[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // First get all family members
      const familyMembersQuery = query(
        collection(db, 'users'),
        where('familyId', '==', familyId)
      );
      const familyMembersSnapshot = await getDocs(familyMembersQuery);
      const memberIds = familyMembersSnapshot.docs.map((doc) => doc.id);
      const membersMap = new Map();
      familyMembersSnapshot.docs.forEach((doc) => {
        membersMap.set(doc.id, doc.data().name);
      });
=======
    days = 7
  ): Promise<FamilySymptomStats> {
    try {
      const hasPermission = await this.checkFamilyAccessPermission(userId, familyId);
      if (!hasPermission) {
        throw new Error("Access denied: Only admins and caregivers can access family medical data");
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/symptoms/family/${familyId}?from=${startDate.toISOString()}&limit=500`
      );
      const symptoms = (raw ?? []).map(normalizeSymptom);
>>>>>>> Stashed changes

      // Get family members for name lookup
      const members = await userService.getFamilyMembers(familyId);
      const membersMap = new Map(members.map((m) => [m.id, `${m.firstName} ${m.lastName}`.trim() || "Unknown"]));

<<<<<<< Updated upstream
      // Get symptoms for all family members
      const symptomsQuery = query(
        collection(db, 'symptoms'),
        where('userId', 'in', memberIds),
        where('timestamp', '>=', Timestamp.fromDate(startDate))
      );

      const querySnapshot = await getDocs(symptomsQuery);
      const symptoms: Symptom[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        symptoms.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Symptom);
      });

      // Calculate stats
=======
      // Aggregate stats
>>>>>>> Stashed changes
      const totalSymptoms = symptoms.length;
      const avgSeverity = totalSymptoms > 0
        ? symptoms.reduce((sum, s) => sum + s.severity, 0) / totalSymptoms
        : 0;

      const symptomCounts = new Map<string, { count: number; users: Set<string> }>();
      for (const symptom of symptoms) {
        if (!symptomCounts.has(symptom.type)) {
          symptomCounts.set(symptom.type, { count: 0, users: new Set() });
        }
        const entry = symptomCounts.get(symptom.type)!;
        entry.count++;
        entry.users.add(symptom.userId);
      }

      const commonSymptoms = Array.from(symptomCounts.entries())
        .map(([type, data]) => ({
          type,
          count: data.count,
          affectedMembers: data.users.size,
          users: Array.from(data.users).map((userId) => ({
            userId,
            userName: membersMap.get(userId) || 'Unknown',
          })),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

<<<<<<< Updated upstream
      return {
        totalSymptoms,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        commonSymptoms,
      };
    } catch (error) {
      console.error('Error getting family symptom stats:', error);
=======
      return { totalSymptoms, avgSeverity: Math.round(avgSeverity * 10) / 10, commonSymptoms };
    } catch {
>>>>>>> Stashed changes
      return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
    }
  },

  // Update symptom
<<<<<<< Updated upstream
  async updateSymptom(
    symptomId: string,
    updates: Partial<Symptom>
  ): Promise<void> {
    try {
      const updateData: any = { ...updates };
      if (updates.timestamp) {
        updateData.timestamp = Timestamp.fromDate(updates.timestamp);
      }
      await updateDoc(doc(db, 'symptoms', symptomId), updateData);
    } catch (error) {
      console.error('Error updating symptom:', error);
      throw error;
=======
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
>>>>>>> Stashed changes
    }
  },

  // Delete symptom
  async deleteSymptom(symptomId: string): Promise<void> {
<<<<<<< Updated upstream
    try {
      await deleteDoc(doc(db, 'symptoms', symptomId));
    } catch (error) {
      console.error('Error deleting symptom:', error);
      throw error;
    }
  },

  // Get symptom statistics
  async getSymptomStats(
    userId: string,
    days = 7
  ): Promise<{
    totalSymptoms: number;
    avgSeverity: number;
    commonSymptoms: { type: string; count: number }[];
  }> {
=======
    await api.delete(`/api/health/symptoms/${symptomId}`);
  },

  // Get symptom statistics for a user
  async getSymptomStats(userId: string, days = 7): Promise<SymptomStats> {
    const statsCacheKey = `${userId}:${days}`;
    const cachedStats = _symptomStatsCache.get(statsCacheKey);
    if (cachedStats && Date.now() - cachedStats.timestamp < SYMPTOM_CACHE_TTL) {
      return cachedStats.data;
    }

>>>>>>> Stashed changes
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

<<<<<<< Updated upstream
      const q = query(
        collection(db, 'symptoms'),
        where('userId', '==', userId),
        where('timestamp', '>=', Timestamp.fromDate(startDate))
      );

      const querySnapshot = await getDocs(q);
      const symptoms: Symptom[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        symptoms.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Symptom);
      });
=======
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/symptoms?from=${startDate.toISOString()}&limit=500`
      );
      const symptoms = (raw ?? []).map(normalizeSymptom);
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
      return {
=======
      const result: SymptomStats = {
>>>>>>> Stashed changes
        totalSymptoms,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        commonSymptoms,
      };
<<<<<<< Updated upstream
    } catch (error) {
      console.error('Error getting symptom stats:', error);
      throw error;
=======
      _symptomStatsCache.set(statsCacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch {
      return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
>>>>>>> Stashed changes
    }
  },

  // Get symptoms for a specific family member (for admins)
<<<<<<< Updated upstream
  async getMemberSymptoms(
    memberId: string,
    limitCount: number = 50
  ): Promise<Symptom[]> {
    try {
      const q = query(
        collection(db, 'symptoms'),
        where('userId', '==', memberId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const symptoms: Symptom[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        symptoms.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Symptom);
      });

      return symptoms;
    } catch (error) {
      console.error('Error getting member symptoms:', error);
      throw error;
    }
  },

  // Get symptom stats for a specific family member (for admins)
  async getMemberSymptomStats(
    memberId: string,
    days: number = 7
  ): Promise<{
    totalSymptoms: number;
    avgSeverity: number;
    commonSymptoms: { type: string; count: number }[];
  }> {
=======
  async getMemberSymptoms(memberId: string, limitCount = 50): Promise<Symptom[]> {
    const raw = await api.get<Record<string, unknown>[]>(
      `/api/health/symptoms/user/${memberId}?limit=${limitCount}`
    );
    return (raw ?? []).map(normalizeSymptom);
  },

  // Get symptom stats for a specific family member (for admins)
  async getMemberSymptomStats(memberId: string, days = 7): Promise<SymptomStats> {
>>>>>>> Stashed changes
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

<<<<<<< Updated upstream
      const q = query(
        collection(db, 'symptoms'),
        where('userId', '==', memberId),
        where('timestamp', '>=', Timestamp.fromDate(startDate))
=======
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/symptoms/user/${memberId}?from=${startDate.toISOString()}&limit=500`
>>>>>>> Stashed changes
      );
      const symptoms = (raw ?? []).map(normalizeSymptom);

<<<<<<< Updated upstream
      const querySnapshot = await getDocs(q);
      const symptoms: Symptom[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        symptoms.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Symptom);
      });

      // Calculate stats
=======
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
      return {
        totalSymptoms,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        commonSymptoms,
      };
    } catch (error) {
      console.error('Error getting member symptom stats:', error);
=======
      return { totalSymptoms, avgSeverity: Math.round(avgSeverity * 10) / 10, commonSymptoms };
    } catch {
>>>>>>> Stashed changes
      return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
    }
  },
};
