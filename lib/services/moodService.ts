/**
 * Mood service — Firebase-free replacement.
 *
 * Replaced Firestore reads/writes on `moods` collection with:
 *   POST  /api/health/moods                   → addMood / addMoodForUser
 *   GET   /api/health/moods                   → getUserMoods (own, with ?from/to/limit)
 *   GET   /api/health/moods/user/:userId       → getMemberMoods
 *   GET   /api/health/moods/family/:familyId   → getFamilyMoods
 *   PATCH /api/health/moods/:id                → updateMood
 *   DELETE /api/health/moods/:id               → deleteMood
 *
 * Field mapping (Neon ↔ client):
 *   `type`       (Neon)  ↔  `mood`      (client Mood type)
 *   `recordedAt` (Neon)  ↔  `timestamp` (client Mood type)
 */

import { api } from "@/lib/apiClient";
import type { Mood } from "@/types";
import { offlineService } from "./offlineService";
import { userService } from "./userService";

// In-memory cache for getUserMoods
const _moodCache = new Map<string, { data: Mood[]; timestamp: number }>();
const MOOD_CACHE_TTL = 2 * 60_000; // 2 minutes

/** Normalize a raw API mood row to the client Mood type */
const normalizeMood = (raw: Record<string, unknown>): Mood => ({
  id: raw.id as string,
  userId: raw.userId as string,
  mood: (raw.type ?? raw.mood) as Mood["mood"],
  intensity: (raw.intensity ?? 3) as Mood["intensity"],
  notes: raw.notes as string | undefined,
  timestamp: raw.recordedAt ? new Date(raw.recordedAt as string) : new Date(),
  activities: raw.activities as string[] | undefined,
});

export const moodService = {
  // Add new mood (offline-first)
  async addMood(moodData: Omit<Mood, "id">): Promise<string> {
    if (!moodData.userId) throw new Error("User ID is required");
    if (!moodData.mood) throw new Error("Mood is required");
    if (!moodData.intensity) throw new Error("Intensity is required");
    if (!moodData.timestamp) throw new Error("Timestamp is required");

    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        const created = await api.post<Record<string, unknown>>("/api/health/moods", {
          type: moodData.mood,
          intensity: moodData.intensity,
          notes: moodData.notes,
          activities: moodData.activities,
          recordedAt: moodData.timestamp.toISOString(),
        });

        // Invalidate cache for this user
        for (const key of _moodCache.keys()) {
          if (key.startsWith(`${moodData.userId}:`)) _moodCache.delete(key);
        }

        const newMood = { id: created.id as string, ...moodData };
        const currentMoods = await offlineService.getOfflineCollection<Mood>("moods");
        await offlineService.storeOfflineData("moods", [...currentMoods, newMood]);
        return created.id as string;
      }

      // Offline — queue the operation
      const operationId = await offlineService.queueOperation({
        type: "create",
        collection: "moods",
        data: { ...moodData, userId: moodData.userId },
      });
      const tempId = `offline_${operationId}`;
      const newMood = { id: tempId, ...moodData };
      const currentMoods = await offlineService.getOfflineCollection<Mood>("moods");
      await offlineService.storeOfflineData("moods", [...currentMoods, newMood]);
      return tempId;
    } catch (error) {
      if (isOnline) {
        const operationId = await offlineService.queueOperation({
          type: "create",
          collection: "moods",
          data: { ...moodData, userId: moodData.userId },
        });
        return `offline_${operationId}`;
      }
      throw error;
    }
  },

  // Add new mood for a specific user (for admins)
  async addMoodForUser(moodData: Omit<Mood, "id">, targetUserId: string): Promise<string> {
    if (!targetUserId) throw new Error("Target user ID is required");
    if (!moodData.mood) throw new Error("Mood is required");
    if (!moodData.intensity) throw new Error("Intensity is required");
    if (!moodData.timestamp) throw new Error("Timestamp is required");

    const created = await api.post<Record<string, unknown>>("/api/health/moods", {
      userId: targetUserId,
      type: moodData.mood,
      intensity: moodData.intensity,
      notes: moodData.notes,
      activities: moodData.activities,
      recordedAt: moodData.timestamp.toISOString(),
    });
    return created.id as string;
  },

  // Get user moods (offline-first)
  async getUserMoods(userId: string, limitCount = 50): Promise<Mood[]> {
    const cacheKey = `${userId}:${limitCount}`;
    const cached = _moodCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MOOD_CACHE_TTL) {
      return cached.data;
    }

    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        const raw = await api.get<Record<string, unknown>[]>(
          `/api/health/moods?limit=${limitCount}`
        );
        const moodsList = (raw ?? []).map(normalizeMood);
        await offlineService.storeOfflineData("moods", moodsList);
        _moodCache.set(cacheKey, { data: moodsList, timestamp: Date.now() });
        return moodsList;
      }

      // Offline — use cached data filtered by userId
      const cachedMoods = await offlineService.getOfflineCollection<Mood>("moods");
      return cachedMoods
        .filter((m) => m.userId === userId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limitCount);
    } catch {
      if (isOnline) {
        const cachedMoods = await offlineService.getOfflineCollection<Mood>("moods");
        return cachedMoods
          .filter((m) => m.userId === userId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limitCount);
      }
      return [];
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

  // Get moods for all family members (for admins and caregivers)
  async getFamilyMoods(userId: string, familyId: string, limitCount = 50): Promise<Mood[]> {
    const hasPermission = await this.checkFamilyAccessPermission(userId, familyId);
    if (!hasPermission) {
      throw new Error("Access denied: Only admins and caregivers can access family medical data");
    }
    const raw = await api.get<Record<string, unknown>[]>(
      `/api/health/moods/family/${familyId}?limit=${limitCount}`
    );
    return (raw ?? []).map(normalizeMood);
  },

  // Get mood stats for all family members (for admins and caregivers)
  async getFamilyMoodStats(
    userId: string,
    familyId: string,
    days = 7
  ): Promise<{
    totalMoods: number;
    avgIntensity: number;
    moodDistribution: { mood: string; count: number; affectedMembers: number; users: { userId: string; userName: string }[] }[];
  }> {
    try {
      const hasPermission = await this.checkFamilyAccessPermission(userId, familyId);
      if (!hasPermission) throw new Error("Access denied");

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [raw, members] = await Promise.all([
        api.get<Record<string, unknown>[]>(
          `/api/health/moods/family/${familyId}?from=${startDate.toISOString()}&limit=500`
        ),
        userService.getFamilyMembers(familyId),
      ]);

      const moodsList = (raw ?? []).map(normalizeMood);
      const membersMap = new Map(
        members.map((m) => [m.id, `${m.firstName} ${m.lastName}`.trim() || "Unknown"])
      );

      const totalMoods = moodsList.length;
      const avgIntensity = totalMoods > 0
        ? moodsList.reduce((sum, m) => sum + m.intensity, 0) / totalMoods
        : 0;

      const moodCounts = new Map<string, { count: number; users: Set<string> }>();
      for (const m of moodsList) {
        if (!moodCounts.has(m.mood)) moodCounts.set(m.mood, { count: 0, users: new Set() });
        const entry = moodCounts.get(m.mood)!;
        entry.count++;
        entry.users.add(m.userId);
      }

      const moodDistribution = Array.from(moodCounts.entries())
        .map(([mood, data]) => ({
          mood,
          count: data.count,
          affectedMembers: data.users.size,
          users: Array.from(data.users).map((uid) => ({
            userId: uid,
            userName: membersMap.get(uid) || "Unknown",
          })),
        }))
        .sort((a, b) => b.count - a.count);

      return { totalMoods, avgIntensity: Math.round(avgIntensity * 10) / 10, moodDistribution };
    } catch {
      return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
    }
  },

  // Update mood
  async updateMood(moodId: string, updates: Partial<Mood>): Promise<void> {
    await api.patch(`/api/health/moods/${moodId}`, {
      ...(updates.mood !== undefined && { type: updates.mood }),
      ...(updates.intensity !== undefined && { intensity: updates.intensity }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.activities !== undefined && { activities: updates.activities }),
    });
    // Invalidate cache if we know the userId
    if (updates.userId) {
      for (const key of _moodCache.keys()) {
        if (key.startsWith(`${updates.userId}:`)) _moodCache.delete(key);
      }
    }
  },

  // Delete mood
  async deleteMood(moodId: string): Promise<void> {
    await api.delete(`/api/health/moods/${moodId}`);
  },

  // Get mood statistics
  async getMoodStats(userId: string, days = 7): Promise<{
    totalMoods: number;
    avgIntensity: number;
    moodDistribution: { mood: string; count: number }[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/moods?from=${startDate.toISOString()}&limit=500`
      );
      const moodsList = (raw ?? []).map(normalizeMood);

      const totalMoods = moodsList.length;
      const avgIntensity = totalMoods > 0
        ? moodsList.reduce((sum, m) => sum + m.intensity, 0) / totalMoods
        : 0;

      const moodCounts: Record<string, number> = {};
      for (const m of moodsList) moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;

      const moodDistribution = Object.entries(moodCounts)
        .map(([mood, count]) => ({ mood, count }))
        .sort((a, b) => b.count - a.count);

      return { totalMoods, avgIntensity: Math.round(avgIntensity * 10) / 10, moodDistribution };
    } catch {
      return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
    }
  },

  // Get moods for a specific family member (for admins)
  async getMemberMoods(memberId: string, limitCount = 50): Promise<Mood[]> {
    const raw = await api.get<Record<string, unknown>[]>(
      `/api/health/moods/user/${memberId}?limit=${limitCount}`
    );
    return (raw ?? []).map(normalizeMood);
  },

  // Get mood stats for a specific family member (for admins)
  async getMemberMoodStats(memberId: string, days = 7): Promise<{
    totalMoods: number;
    avgIntensity: number;
    moodDistribution: { mood: string; count: number }[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/moods/user/${memberId}?from=${startDate.toISOString()}&limit=500`
      );
      const moodsList = (raw ?? []).map(normalizeMood);

      const totalMoods = moodsList.length;
      const avgIntensity = totalMoods > 0
        ? moodsList.reduce((sum, m) => sum + m.intensity, 0) / totalMoods
        : 0;

      const moodCounts = new Map<string, number>();
      for (const m of moodsList) moodCounts.set(m.mood, (moodCounts.get(m.mood) || 0) + 1);

      const moodDistribution = Array.from(moodCounts.entries())
        .map(([mood, count]) => ({ mood, count }))
        .sort((a, b) => b.count - a.count);

      return { totalMoods, avgIntensity: Math.round(avgIntensity * 10) / 10, moodDistribution };
    } catch {
      return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
    }
  },
};
