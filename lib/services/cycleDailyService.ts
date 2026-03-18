/**
 * Cycle daily service — Firebase-free replacement.
 *
 * Replaced Firestore reads/writes with REST API calls:
 *   POST   /api/health/cycle-daily              → upsertDailyEntry (server does onConflictDoUpdate)
 *   GET    /api/health/cycle-daily?from=&to=&limit= → getUserDailyEntries
 *   DELETE /api/health/cycle-daily/:id          → deleteDailyEntry
 *
 * The deterministic entry ID (${userId}_YYYY-MM-DD) is preserved for offline
 * queue deduplication and local-cache keying.
 */
import { api } from "@/lib/apiClient";
import type { CycleDailyEntry } from "@/types";
import { offlineService } from "./offlineService";

function toDateOnly(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getDailyEntryId(userId: string, date: Date): string {
  const d = toDateOnly(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${userId}_${y}-${m}-${day}`;
}

/** Normalize a raw API row to a typed CycleDailyEntry */
function normalizeEntry(raw: Record<string, unknown>): CycleDailyEntry {
  return {
    id: raw.id as string,
    userId: raw.userId as string,
    date: raw.date ? new Date(raw.date as string) : new Date(),
    // Accept both canonical and aliased column names from the API
    flowIntensity: (raw.flowIntensity ?? raw.flow) as
      | CycleDailyEntry["flowIntensity"]
      | undefined,
    crampsSeverity: (raw.crampsSeverity ?? raw.cramps) as 0 | 1 | 2 | 3 | undefined,
    mood: raw.mood as 1 | 2 | 3 | 4 | 5 | undefined,
    sleepQuality: raw.sleepQuality as 1 | 2 | 3 | 4 | 5 | undefined,
    energyLevel: (raw.energyLevel ?? raw.energy) as 1 | 2 | 3 | 4 | 5 | undefined,
    dischargeType: raw.dischargeType as CycleDailyEntry["dischargeType"],
    spotting: raw.spotting as boolean | undefined,
    birthControlMethod: raw.birthControlMethod as CycleDailyEntry["birthControlMethod"],
    birthControlTaken: raw.birthControlTaken as boolean | undefined,
    birthControlSideEffects:
      (raw.birthControlSideEffects as string[] | undefined) ?? [],
    notes: raw.notes as string | undefined,
    createdAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt as string) : undefined,
  };
}

export const cycleDailyService = {
  async upsertDailyEntry(
    userId: string,
    date: Date,
    entry: Omit<CycleDailyEntry, "id" | "userId" | "date" | "createdAt"> & {
      createdAt?: Date;
    }
  ): Promise<string> {
    const isOnline = offlineService.isDeviceOnline();
    const dateOnly = toDateOnly(date);
    const entryId = getDailyEntryId(userId, dateOnly);

    // Helper to update local cache immediately for better offline UX
    const updateCache = async () => {
      try {
        const cached =
          await offlineService.getOfflineCollection<CycleDailyEntry>(
            "cycleDailyEntries"
          );
        const updated = cached.filter((e) => e.id !== entryId);
        updated.push({
          id: entryId,
          userId,
          date: dateOnly,
          ...entry,
          createdAt: entry.createdAt ?? new Date(),
          updatedAt: new Date(),
        } as CycleDailyEntry);
        await offlineService.storeOfflineData("cycleDailyEntries", updated);
      } catch {
        // Cache update errors are not critical
      }
    };

    try {
      if (isOnline) {
        await api.post("/api/health/cycle-daily", {
          userId,
          date: dateOnly.toISOString(),
          flowIntensity: entry.flowIntensity,
          crampsSeverity: entry.crampsSeverity,
          mood: entry.mood,
          sleepQuality: entry.sleepQuality,
          energyLevel: entry.energyLevel,
          dischargeType: entry.dischargeType,
          spotting: entry.spotting,
          birthControlMethod: entry.birthControlMethod,
          birthControlTaken: entry.birthControlTaken,
          birthControlSideEffects: entry.birthControlSideEffects,
          notes: entry.notes,
        });

        await updateCache();
        return entryId;
      }

      // Offline — queue as "create"; server POST endpoint does an upsert
      const operationId = await offlineService.queueOperation({
        type: "create",
        collection: "cycleDailyEntries",
        data: {
          userId,
          date: dateOnly,
          ...entry,
          updatedAt: new Date(),
        },
      });

      await updateCache();
      return `offline_${operationId}`;
    } catch (error) {
      throw new Error(`Failed to upsert daily entry: ${error}`);
    }
  },

  async getUserDailyEntries(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limitCount?: number;
    }
  ): Promise<CycleDailyEntry[]> {
    const isOnline = offlineService.isDeviceOnline();
    const limitCount = options?.limitCount ?? 90;

    // Filter cached entries (used both for offline and as the index-missing fallback)
    const getCachedEntries = async (): Promise<CycleDailyEntry[]> => {
      const cached =
        await offlineService.getOfflineCollection<CycleDailyEntry>(
          "cycleDailyEntries"
        );
      let filtered = cached.filter((e) => e.userId === userId);

      if (options?.startDate) {
        const start = toDateOnly(options.startDate);
        filtered = filtered.filter(
          (e) =>
            toDateOnly(
              e.date instanceof Date ? e.date : new Date(e.date)
            ).getTime() >= start.getTime()
        );
      }
      if (options?.endDate) {
        const end = toDateOnly(options.endDate);
        filtered = filtered.filter(
          (e) =>
            toDateOnly(
              e.date instanceof Date ? e.date : new Date(e.date)
            ).getTime() <= end.getTime()
        );
      }

      return filtered
        .map((e) => ({
          ...e,
          date: e.date instanceof Date ? e.date : new Date(e.date),
          createdAt:
            e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt),
          updatedAt:
            e.updatedAt && !(e.updatedAt instanceof Date)
              ? new Date(e.updatedAt)
              : e.updatedAt,
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, limitCount);
    };

    try {
      if (!isOnline) {
        return getCachedEntries();
      }

      // Build query string
      const params = new URLSearchParams({ limit: String(limitCount) });
      if (options?.startDate) {
        params.set("from", toDateOnly(options.startDate).toISOString());
      }
      if (options?.endDate) {
        params.set("to", toDateOnly(options.endDate).toISOString());
      }

      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/cycle-daily?${params.toString()}`
      );
      const entries = (raw ?? []).map(normalizeEntry);

      // Refresh local cache
      await offlineService.storeOfflineData("cycleDailyEntries", entries);

      return entries;
    } catch (error) {
      // API unreachable — serve from cache rather than crashing
      try {
        return await getCachedEntries();
      } catch {
        return [];
      }
    }
  },

  async deleteDailyEntry(entryId: string): Promise<void> {
    const isOnline = offlineService.isDeviceOnline();

    // Helper to remove from local cache
    const removeFromCache = async () => {
      try {
        const cached =
          await offlineService.getOfflineCollection<CycleDailyEntry>(
            "cycleDailyEntries"
          );
        const updated = cached.filter((e) => e.id !== entryId);
        await offlineService.storeOfflineData("cycleDailyEntries", updated);
      } catch {
        // Cache update errors are not critical
      }
    };

    try {
      if (isOnline) {
        await api.delete(`/api/health/cycle-daily/${entryId}`);
      } else {
        await offlineService.queueOperation({
          type: "delete",
          collection: "cycleDailyEntries",
          data: { id: entryId },
        });
      }
      await removeFromCache();
    } catch (error) {
      throw new Error(`Failed to delete daily entry: ${error}`);
    }
  },
};
