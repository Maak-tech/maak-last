import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  collection,
  orderBy,
  Timestamp,
  where,
  limit,
  setDoc,
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
        return entryId;
      }

      const operationId = await offlineService.queueOperation({
        type: "update",
        collection: "cycleDailyEntries",
        docId: entryId,
        data: {
          userId,
          date: dateOnly,
          ...entry,
          updatedAt: new Date(),
        },
      });
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

    try {
      if (isOnline) {
        const constraints = [
          where("userId", "==", userId),
          orderBy("date", "desc"),
          limit(limitCount),
        ];

        if (options?.startDate) {
          constraints.push(
            where("date", ">=", Timestamp.fromDate(toDateOnly(options.startDate)))
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

        snapshot.forEach((itemDoc) => {
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
        });

        return entries;
      }

      const cached =
        await offlineService.getOfflineCollection<CycleDailyEntry>(
          "cycleDailyEntries"
        );
      return cached
        .filter((e) => e.userId === userId)
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
    } catch (error) {
      throw new Error(`Failed to get daily entries: ${error}`);
    }
  },

  async deleteDailyEntry(entryId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "cycleDailyEntries", entryId));
    } catch (error) {
      throw new Error(`Failed to delete daily entry: ${error}`);
    }
  },
};

