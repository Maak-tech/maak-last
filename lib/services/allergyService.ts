/**
 * Allergy service — Firebase-free replacement.
 *
 * Replaced Firestore reads/writes on `allergies` collection with:
 *   POST   /api/health/allergies       → addAllergy
 *   GET    /api/health/allergies       → getUserAllergies (own)
 *   PATCH  /api/health/allergies/:id   → updateAllergy
 *   DELETE /api/health/allergies/:id   → deleteAllergy
 *
 * Schema note: Neon `allergies.substance` maps to client `Allergy.name`.
 *              Neon `allergies.diagnosedDate` maps to client `Allergy.discoveredDate`.
 *              Neon `allergies.createdAt` maps to client `Allergy.timestamp`.
 */

import { api } from "@/lib/apiClient";
import type { Allergy } from "@/types";
import { offlineService } from "./offlineService";

const _allergyCache = new Map<string, { allergies: Allergy[]; timestamp: number }>();
const ALLERGY_CACHE_TTL = 120_000; // 2 minutes

/** Normalize a raw API allergy row to the client Allergy type */
const normalizeAllergy = (raw: Record<string, unknown>): Allergy => ({
  id: raw.id as string,
  userId: raw.userId as string,
  name: (raw.substance ?? raw.name ?? "") as string,
  severity: ((raw.severity ?? "mild") as Allergy["severity"]),
  reaction: raw.reaction as string | undefined,
  notes: raw.notes as string | undefined,
  discoveredDate: raw.diagnosedDate ? new Date(raw.diagnosedDate as string) : undefined,
  timestamp: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
});

export const allergyService = {
  // Add new allergy (offline-first)
  async addAllergy(allergyData: Omit<Allergy, "id">): Promise<string> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        const created = await api.post<Record<string, unknown>>("/api/health/allergies", {
          name: allergyData.name,
          severity: allergyData.severity,
          reaction: allergyData.reaction,
          discoveredDate: allergyData.discoveredDate?.toISOString(),
          notes: allergyData.notes,
        });

        _allergyCache.delete(allergyData.userId);
        const newAllergy = { id: created.id as string, ...allergyData };
        const currentAllergies = await offlineService.getOfflineCollection<Allergy>("allergies");
        await offlineService.storeOfflineData("allergies", [...currentAllergies, newAllergy]);
        return created.id as string;
      }

      // Offline — queue the operation
      const operationId = await offlineService.queueOperation({
        type: "create",
        collection: "allergies",
        data: { ...allergyData, userId: allergyData.userId } as Record<string, unknown>,
      });
      const tempId = `offline_${operationId}`;
      const newAllergy = { id: tempId, ...allergyData };
      const currentAllergies = await offlineService.getOfflineCollection<Allergy>("allergies");
      await offlineService.storeOfflineData("allergies", [...currentAllergies, newAllergy]);
      return tempId;
    } catch (error) {
      if (isOnline) {
        const operationId = await offlineService.queueOperation({
          type: "create",
          collection: "allergies",
          data: { ...allergyData, userId: allergyData.userId } as Record<string, unknown>,
        });
        return `offline_${operationId}`;
      }
      throw error;
    }
  },

  // Get user allergies (offline-first)
  async getUserAllergies(userId: string, limitCount = 50): Promise<Allergy[]> {
    const cached = _allergyCache.get(userId);
    if (cached && Date.now() - cached.timestamp < ALLERGY_CACHE_TTL) {
      return cached.allergies;
    }

    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        const raw = await api.get<Record<string, unknown>[]>("/api/health/allergies");
        const allAllergies = (raw ?? [])
          .map(normalizeAllergy)
          .sort((a, b) => {
            const timeA = a.timestamp?.getTime() || 0;
            const timeB = b.timestamp?.getTime() || 0;
            return timeB - timeA;
          })
          .slice(0, limitCount);

        _allergyCache.set(userId, { allergies: allAllergies, timestamp: Date.now() });
        await offlineService.storeOfflineData("allergies", allAllergies);
        return allAllergies;
      }

      // Offline — use cached data filtered by userId
      const cachedAllergies = await offlineService.getOfflineCollection<Allergy>("allergies");
      return cachedAllergies
        .filter((a) => a.userId === userId)
        .sort((a, b) => {
          const timeA = a.timestamp?.getTime() || 0;
          const timeB = b.timestamp?.getTime() || 0;
          return timeB - timeA;
        })
        .slice(0, limitCount);
    } catch {
      if (isOnline) {
        const cachedAllergies = await offlineService.getOfflineCollection<Allergy>("allergies");
        return cachedAllergies
          .filter((a) => a.userId === userId)
          .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
          .slice(0, limitCount);
      }
      throw new Error("Failed to get allergies");
    }
  },

  // Update allergy
  async updateAllergy(allergyId: string, updates: Partial<Allergy>): Promise<void> {
    await api.patch(`/api/health/allergies/${allergyId}`, {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.reaction !== undefined && { reaction: updates.reaction }),
      ...(updates.severity !== undefined && { severity: updates.severity }),
      ...(updates.discoveredDate !== undefined && {
        discoveredDate: updates.discoveredDate ? updates.discoveredDate.toISOString() : null,
      }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
    });
    if (updates.userId) _allergyCache.delete(updates.userId);
  },

  // Delete allergy
  async deleteAllergy(allergyId: string): Promise<void> {
    await api.delete(`/api/health/allergies/${allergyId}`);
    _allergyCache.clear();
  },
};
