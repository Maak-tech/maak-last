/* biome-ignore-all lint/complexity/noForEach: Legacy period aggregation paths still use forEach and will be migrated in a dedicated cleanup pass. */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { healthTimelineService } from "@/lib/observability";
import type { PeriodCycle, PeriodEntry } from "@/types";
import { offlineService } from "./offlineService";

function toDateOnly(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number | undefined {
  if (!values.length) {
    return;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[], valuesMean: number): number | undefined {
  if (values.length < 2) {
    return;
  }
  const variance =
    values.reduce((sum, value) => sum + (value - valuesMean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
}

function getValidCycleLengths(
  entries: PeriodEntry[],
  maxSamples = 8
): number[] {
  const lengths: number[] = [];
  for (
    let i = 0;
    i < entries.length - 1 && lengths.length < maxSamples;
    i += 1
  ) {
    const current = entries[i];
    const next = entries[i + 1];
    const cycleLength = Math.round(
      (toDateOnly(current.startDate).getTime() -
        toDateOnly(next.startDate).getTime()) /
        86_400_000
    );
    // Keep a permissive range; users can have longer/irregular cycles.
    if (cycleLength >= 15 && cycleLength <= 60) {
      lengths.push(cycleLength);
    }
  }
  return lengths;
}

function getAveragePeriodLength(entries: PeriodEntry[]): number {
  let totalPeriodLength = 0;
  let periodCount = 0;
  for (const entry of entries) {
    if (!entry.endDate) {
      continue;
    }
    const periodLength =
      (entry.endDate.getTime() - entry.startDate.getTime()) /
      (1000 * 60 * 60 * 24);
    if (periodLength > 0 && periodLength < 15) {
      totalPeriodLength += periodLength;
      periodCount += 1;
    }
  }
  return periodCount > 0 ? Math.round(totalPeriodLength / periodCount) : 5;
}

function predictNextPeriodDate(
  lastPeriodStart: Date,
  averageCycleLength: number,
  today: Date
): Date {
  const lastStart = toDateOnly(lastPeriodStart);
  const predictedDate = toDateOnly(
    new Date(lastStart.getTime() + averageCycleLength * 86_400_000)
  );

  if (predictedDate < today) {
    return toDateOnly(
      new Date(predictedDate.getTime() + averageCycleLength * 86_400_000)
    );
  }

  return predictedDate;
}

function predictOvulationDate(nextPeriodPredicted: Date): Date {
  // Ovulation is typically ~14 days before the next period (luteal phase length).
  // We intentionally keep this simple and avoid clamping to a fixed range that
  // would make longer cycles incorrectly predict earlier ovulation.
  const ovulationDaysBeforePeriod = 14;
  return toDateOnly(
    new Date(
      nextPeriodPredicted.getTime() - ovulationDaysBeforePeriod * 86_400_000
    )
  );
}

function computePredictionConfidence(
  cycleLengths: number[],
  cycleLengthStdDev: number | undefined
): number {
  const sampleCount = cycleLengths.length;
  const variancePenalty = cycleLengthStdDev
    ? clampNumber(cycleLengthStdDev / 7, 0, 1)
    : 0.6;
  const sampleBoost = clampNumber(sampleCount / 6, 0, 1);
  return clampNumber(
    (1 - variancePenalty) * (0.3 + 0.7 * sampleBoost),
    0.15,
    0.95
  );
}

function computePredictionWindow(
  nextPeriodPredicted: Date,
  cycleLengthStdDev: number | undefined,
  sampleCount: number
): { start: Date; end: Date } {
  let radius = 3;
  if (cycleLengthStdDev && sampleCount >= 2) {
    radius = clampNumber(Math.round(cycleLengthStdDev), 2, 7);
  } else if (sampleCount < 3) {
    radius = 4;
  }

  return {
    start: toDateOnly(
      new Date(nextPeriodPredicted.getTime() - radius * 86_400_000)
    ),
    end: toDateOnly(
      new Date(nextPeriodPredicted.getTime() + radius * 86_400_000)
    ),
  };
}

function toTimestampOrUndefined(date: Date | undefined): Timestamp | undefined {
  return date ? Timestamp.fromDate(date) : undefined;
}

function roundTo1Decimal(value: number | undefined): number | undefined {
  if (typeof value !== "number") {
    return;
  }
  return Math.round(value * 10) / 10;
}

async function deleteCycleDocIfExists(userId: string): Promise<void> {
  const q = query(
    collection(db, "periodCycles"),
    where("userId", "==", userId),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return;
  }
  await deleteDoc(doc(db, "periodCycles", snapshot.docs[0].id));
}

export const periodService = {
  // Add new period entry
  async addPeriodEntry(
    periodData: Omit<PeriodEntry, "id" | "createdAt">
  ): Promise<string> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      const cleanedData = Object.fromEntries(
        Object.entries({
          ...periodData,
          startDate: Timestamp.fromDate(periodData.startDate),
          endDate: periodData.endDate
            ? Timestamp.fromDate(periodData.endDate)
            : undefined,
          createdAt: Timestamp.now(),
        }).filter(([_, value]) => value !== undefined)
      );

      if (isOnline) {
        const docRef = await addDoc(
          collection(db, "periodEntries"),
          cleanedData
        );

        await healthTimelineService.addEvent({
          userId: periodData.userId,
          eventType: "period_logged",
          title: "Period started",
          description:
            periodData.notes || `Flow: ${periodData.flowIntensity || "medium"}`,
          timestamp: periodData.startDate,
          severity: "info",
          icon: "calendar",
          metadata: {
            periodEntryId: docRef.id,
            flowIntensity: periodData.flowIntensity,
            symptoms: periodData.symptoms,
          },
          relatedEntityId: docRef.id,
          relatedEntityType: "period",
          actorType: "user",
        });

        // Update cycle information
        await this.updateCycleInfo(periodData.userId);

        return docRef.id;
      }

      // Offline - queue the operation
      const operationId = await offlineService.queueOperation({
        type: "create",
        collection: "periodEntries",
        data: { ...periodData, userId: periodData.userId },
      });

      return `offline_${operationId}`;
    } catch (error) {
      throw new Error(`Failed to add period entry: ${error}`);
    }
  },

  // Get user's period entries
  async getUserPeriodEntries(
    userId: string,
    limitCount = 50
  ): Promise<PeriodEntry[]> {
    try {
      const q = query(
        collection(db, "periodEntries"),
        where("userId", "==", userId),
        orderBy("startDate", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const entries: PeriodEntry[] = [];

      querySnapshot.forEach((entryDoc) => {
        const data = entryDoc.data();
        entries.push({
          id: entryDoc.id,
          userId: data.userId,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate(),
          flowIntensity: data.flowIntensity,
          symptoms: data.symptoms || [],
          notes: data.notes,
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });

      return entries;
    } catch (error) {
      throw new Error(`Failed to get period entries: ${error}`);
    }
  },

  // Update period entry
  async updatePeriodEntry(
    entryId: string,
    updates: Partial<Omit<PeriodEntry, "id" | "userId" | "createdAt">>
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {};
      if (updates.startDate) {
        updateData.startDate = Timestamp.fromDate(updates.startDate);
      }
      if (updates.endDate) {
        updateData.endDate = Timestamp.fromDate(updates.endDate);
      }
      if (updates.flowIntensity !== undefined) {
        updateData.flowIntensity = updates.flowIntensity;
      }
      if (updates.symptoms !== undefined) {
        updateData.symptoms = updates.symptoms;
      }
      if (updates.notes !== undefined) {
        updateData.notes = updates.notes;
      }

      await updateDoc(doc(db, "periodEntries", entryId), updateData);

      // Update cycle info if dates changed
      if (updates.startDate || updates.endDate) {
        const entryDoc = await getDoc(doc(db, "periodEntries", entryId));
        if (entryDoc.exists()) {
          const data = entryDoc.data();
          await this.updateCycleInfo(data.userId);
        }
      }
    } catch (error) {
      throw new Error(`Failed to update period entry: ${error}`);
    }
  },

  // Delete period entry
  async deletePeriodEntry(entryId: string): Promise<void> {
    try {
      const entryDoc = await getDoc(doc(db, "periodEntries", entryId));
      const data = entryDoc.exists()
        ? (entryDoc.data() as Record<string, unknown>)
        : null;
      const userId =
        data && typeof data.userId === "string" ? data.userId : null;
      await deleteDoc(doc(db, "periodEntries", entryId));
      if (typeof userId === "string" && userId) {
        await this.updateCycleInfo(userId);
      }
    } catch (error) {
      throw new Error(`Failed to delete period entry: ${error}`);
    }
  },

  // Get or create cycle info
  async getCycleInfo(userId: string): Promise<PeriodCycle | null> {
    try {
      const q = query(
        collection(db, "periodCycles"),
        where("userId", "==", userId),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        return {
          id: querySnapshot.docs[0].id,
          userId: docData.userId,
          averageCycleLength: docData.averageCycleLength,
          averagePeriodLength: docData.averagePeriodLength,
          lastPeriodStart: docData.lastPeriodStart?.toDate(),
          nextPeriodPredicted: docData.nextPeriodPredicted?.toDate(),
          nextPeriodWindowStart: docData.nextPeriodWindowStart?.toDate(),
          nextPeriodWindowEnd: docData.nextPeriodWindowEnd?.toDate(),
          ovulationPredicted: docData.ovulationPredicted?.toDate(),
          predictionConfidence: docData.predictionConfidence,
          cycleLengthStdDev: docData.cycleLengthStdDev,
          updatedAt: docData.updatedAt?.toDate() || new Date(),
        };
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to get cycle info: ${error}`);
    }
  },

  // Update cycle information based on period entries
  async updateCycleInfo(userId: string): Promise<void> {
    try {
      const entries = await this.getUserPeriodEntries(userId, 100);

      if (entries.length === 0) {
        await deleteCycleDocIfExists(userId);
        return;
      }

      const cycleLengths = getValidCycleLengths(entries, 8);
      const averageCycleLength = Math.round(mean(cycleLengths) ?? 28);
      const cycleLengthsMean = mean(cycleLengths);
      const cycleLengthStdDev =
        cycleLengthsMean === undefined
          ? undefined
          : stdDev(cycleLengths, cycleLengthsMean);
      const averagePeriodLength = getAveragePeriodLength(entries);

      // Get last period start (most recent entry)
      const lastPeriodStart = entries[0].startDate;
      const today = toDateOnly(new Date());

      const nextPeriodPredicted = predictNextPeriodDate(
        lastPeriodStart,
        averageCycleLength,
        today
      );

      // Compute a simple confidence score + prediction window for irregular cycles.
      // This is a heuristic (not medical advice): higher variance and fewer cycles -> lower confidence.
      const cycleSampleCount = cycleLengths.length;
      const predictionConfidence = computePredictionConfidence(
        cycleLengths,
        cycleLengthStdDev
      );

      const window = computePredictionWindow(
        nextPeriodPredicted,
        cycleLengthStdDev,
        cycleSampleCount
      );

      // Predict ovulation (approximately 14 days before next period, or mid-cycle)
      const ovulationPredicted = predictOvulationDate(nextPeriodPredicted);

      // Update or create cycle document
      const existingCycle = await this.getCycleInfo(userId);
      const cycleData = {
        userId,
        averageCycleLength,
        averagePeriodLength,
        lastPeriodStart: toTimestampOrUndefined(lastPeriodStart),
        nextPeriodPredicted: toTimestampOrUndefined(nextPeriodPredicted),
        nextPeriodWindowStart: toTimestampOrUndefined(window.start),
        nextPeriodWindowEnd: toTimestampOrUndefined(window.end),
        ovulationPredicted: toTimestampOrUndefined(ovulationPredicted),
        predictionConfidence,
        cycleLengthStdDev: roundTo1Decimal(cycleLengthStdDev),
        updatedAt: Timestamp.now(),
      };

      if (existingCycle) {
        await updateDoc(doc(db, "periodCycles", existingCycle.id), cycleData);
      } else {
        await addDoc(collection(db, "periodCycles"), cycleData);
      }
    } catch (error) {
      throw new Error(`Failed to update cycle info: ${error}`);
    }
  },
};
