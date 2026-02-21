import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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

    try {
      if (isOnline) {
        const ref = doc(db, "cycleDailyEntries", entryId);
        const existing = await getDoc(ref);

        const cleanedData = Object.fromEntries(
          Object.entries({
            userId,
            date: Timestamp.fromDate(dateOnly),
            ...entry,
            createdAt: existing.exists()
              ? undefined
              : Timestamp.fromDate(entry.createdAt ?? new Date()),
            updatedAt: Timestamp.now(),
          }).filter(([_, value]) => value !== undefined)
        );

        await setDoc(ref, cleanedData, { merge: true });

        // Also update local cache immediately for better UX
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
        } catch (cacheError) {
          // Ignore cache update errors - not critical
        }

        return entryId;
      }

      // Offline mode - queue operation
      const operationId = await offlineService.queueOperation({
        type: "update",
        collection: "cycleDailyEntries",
        data: {
          id: entryId,
          userId,
          date: dateOnly,
          ...entry,
          updatedAt: new Date(),
        },
      });
      return `offline_${operationId}`;
    } catch (error: any) {
      // If permission denied and we're online, queue for offline sync
      if (
        isOnline &&
        (error?.code === "permission-denied" ||
          error?.message?.includes("permission") ||
          error?.message?.includes("Missing or insufficient permissions"))
      ) {
        console.warn(
          "Permission denied for cycleDailyEntries - queueing for offline sync. Please deploy Firestore rules: firebase deploy --only firestore:rules"
        );
        try {
          // Queue the operation for later sync
          const operationId = await offlineService.queueOperation({
            type: "update",
            collection: "cycleDailyEntries",
            data: {
              id: entryId,
              userId,
              date: dateOnly,
              ...entry,
              updatedAt: new Date(),
            },
          });

          // Also update local cache immediately
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
          } catch (cacheError) {
            // Ignore cache update errors
          }

          return `offline_${operationId}`;
        } catch (queueError) {
          // If queueing also fails, still throw the original error
          throw new Error(`Failed to upsert daily entry: ${error}`);
        }
      }

      // For other errors, throw as before
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
      if (isOnline) {
        const constraints = [
          where("userId", "==", userId),
          orderBy("date", "desc"),
          limit(limitCount),
        ];

        if (options?.startDate) {
          constraints.push(
            where(
              "date",
              ">=",
              Timestamp.fromDate(toDateOnly(options.startDate))
            )
          );
        }
        if (options?.endDate) {
          constraints.push(
            where("date", "<=", Timestamp.fromDate(toDateOnly(options.endDate)))
          );
        }

        const q = query(collection(db, "cycleDailyEntries"), ...constraints);
        const snapshot = await getDocs(q);
        const entries: CycleDailyEntry[] = [];

        for (const itemDoc of snapshot.docs) {
          const data = itemDoc.data();
          entries.push({
            id: itemDoc.id,
            userId: data.userId,
            date: data.date?.toDate() || new Date(),
            flowIntensity: data.flowIntensity,
            crampsSeverity: data.crampsSeverity,
            mood: data.mood,
            sleepQuality: data.sleepQuality,
            energyLevel: data.energyLevel,
            dischargeType: data.dischargeType,
            spotting: data.spotting,
            birthControlMethod: data.birthControlMethod,
            birthControlTaken: data.birthControlTaken,
            birthControlSideEffects: data.birthControlSideEffects || [],
            notes: data.notes,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate(),
          });
        }

        await offlineService.storeOfflineData("cycleDailyEntries", entries);
        return entries;
      }

      // Offline mode - use cached data
      const cached =
        await offlineService.getOfflineCollection<CycleDailyEntry>(
          "cycleDailyEntries"
        );
      let filtered = cached.filter((e) => e.userId === userId);

      // Apply date filters if provided
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
    } catch (error: any) {
      // If index missing (failed-precondition), fall back to cached data
      if (
        isOnline &&
        (error?.code === "failed-precondition" ||
          error?.message?.includes("index") ||
          error?.message?.includes("requires an index"))
      ) {
        console.warn(
          "Firestore index required for cycleDailyEntries - falling back to cached data. Please create the index or run: firebase deploy --only firestore:indexes"
        );
        try {
          return await getCachedEntries();
        } catch (cacheError) {
          // If cache also fails, return empty array instead of crashing
          console.error("Failed to get cached entries:", cacheError);
          return [];
        }
      }

      // If permission denied and we're online, try to fall back to cached data
      if (
        isOnline &&
        (error?.code === "permission-denied" ||
          error?.message?.includes("permission") ||
          error?.message?.includes("Missing or insufficient permissions"))
      ) {
        console.warn(
          "Permission denied for cycleDailyEntries - falling back to cached data. Please deploy Firestore rules: firebase deploy --only firestore:rules"
        );
        try {
          return await getCachedEntries();
        } catch (cacheError) {
          // If cache also fails, return empty array instead of crashing
          console.error("Failed to get cached entries:", cacheError);
          return [];
        }
      }

      // For other errors, throw as before
      throw new Error(`Failed to get daily entries: ${error}`);
    }
  },

  async deleteDailyEntry(entryId: string): Promise<void> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        await deleteDoc(doc(db, "cycleDailyEntries", entryId));

        // Also remove from local cache immediately
        try {
          const cached =
            await offlineService.getOfflineCollection<CycleDailyEntry>(
              "cycleDailyEntries"
            );
          const updated = cached.filter((e) => e.id !== entryId);
          await offlineService.storeOfflineData("cycleDailyEntries", updated);
        } catch (cacheError) {
          // Ignore cache update errors - not critical
        }
      } else {
        // Offline mode - queue deletion
        await offlineService.queueOperation({
          type: "delete",
          collection: "cycleDailyEntries",
          data: { id: entryId },
        });

        // Remove from local cache
        try {
          const cached =
            await offlineService.getOfflineCollection<CycleDailyEntry>(
              "cycleDailyEntries"
            );
          const updated = cached.filter((e) => e.id !== entryId);
          await offlineService.storeOfflineData("cycleDailyEntries", updated);
        } catch (cacheError) {
          // Ignore cache update errors
        }
      }
    } catch (error: any) {
      // If permission denied and we're online, queue for offline sync
      if (
        isOnline &&
        (error?.code === "permission-denied" ||
          error?.message?.includes("permission") ||
          error?.message?.includes("Missing or insufficient permissions"))
      ) {
        console.warn(
          "Permission denied for cycleDailyEntries delete - queueing for offline sync. Please deploy Firestore rules: firebase deploy --only firestore:rules"
        );
        try {
          // Queue the deletion for later sync
          await offlineService.queueOperation({
            type: "delete",
            collection: "cycleDailyEntries",
            data: { id: entryId },
          });

          // Remove from local cache immediately
          try {
            const cached =
              await offlineService.getOfflineCollection<CycleDailyEntry>(
                "cycleDailyEntries"
              );
            const updated = cached.filter((e) => e.id !== entryId);
            await offlineService.storeOfflineData("cycleDailyEntries", updated);
          } catch (cacheError) {
            // Ignore cache update errors
          }

          return; // Successfully queued
        } catch (queueError) {
          // If queueing also fails, still throw the original error
          throw new Error(`Failed to delete daily entry: ${error}`);
        }
      }

      // For other errors, throw as before
      throw new Error(`Failed to delete daily entry: ${error}`);
    }
  },
};
