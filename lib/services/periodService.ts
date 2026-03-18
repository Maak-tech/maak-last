/* biome-ignore-all lint/complexity/noForEach: Legacy period aggregation paths still use forEach and will be migrated in a dedicated cleanup pass. */
/**
 * Period service — Firebase-free replacement.
 *
 * Replaced Firestore reads/writes with REST API calls:
 *   POST   /api/health/period-entries           → addPeriodEntry
 *   GET    /api/health/period-entries?limit=N   → getUserPeriodEntries
 *   PATCH  /api/health/period-entries/:id       → updatePeriodEntry
 *   DELETE /api/health/period-entries/:id       → deletePeriodEntry
 *
 * getCycleInfo / updateCycleInfo no longer write a separate document.
 * Cycle stats are computed client-side from period entries on every call.
 */
import { api } from "@/lib/apiClient";
import { healthTimelineService } from "@/lib/observability";
import type { PeriodCycle, PeriodEntry } from "@/types";
import { offlineService } from "./offlineService";

// ── Pure helper functions (no I/O) ────────────────────────────────────────────

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

function roundTo1Decimal(value: number | undefined): number | undefined {
  if (typeof value !== "number") {
    return;
  }
  return Math.round(value * 10) / 10;
}

/** Normalize a raw API row to a typed PeriodEntry */
function normalizeEntry(raw: Record<string, unknown>): PeriodEntry {
  return {
    id: raw.id as string,
    userId: raw.userId as string,
    startDate: raw.startDate ? new Date(raw.startDate as string) : new Date(),
    endDate: raw.endDate ? new Date(raw.endDate as string) : undefined,
    flowIntensity: raw.flowIntensity as PeriodEntry["flowIntensity"] | undefined,
    symptoms: (raw.symptoms as string[] | undefined) ?? [],
    notes: raw.notes as string | undefined,
    createdAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
  };
}

// ── Exported service ──────────────────────────────────────────────────────────

export const periodService = {
  // Add new period entry
  async addPeriodEntry(
    periodData: Omit<PeriodEntry, "id" | "createdAt">
  ): Promise<string> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        const result = await api.post<{ id: string }>(
          "/api/health/period-entries",
          {
            userId: periodData.userId,
            startDate: periodData.startDate.toISOString(),
            endDate: periodData.endDate?.toISOString(),
            flowIntensity: periodData.flowIntensity,
            symptoms: periodData.symptoms,
            notes: periodData.notes,
          }
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
            periodEntryId: result.id,
            flowIntensity: periodData.flowIntensity,
            symptoms: periodData.symptoms,
          },
          relatedEntityId: result.id,
          relatedEntityType: "period",
          actorType: "user",
        });

        return result.id;
      }

      // Offline — queue the operation
      const operationId = await offlineService.queueOperation({
        type: "create",
        collection: "periodEntries",
        data: {
          ...periodData,
          startDate: periodData.startDate,
          endDate: periodData.endDate,
        },
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
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/period-entries?limit=${limitCount}`
      );
      return (raw ?? []).map(normalizeEntry);
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
      const body: Record<string, unknown> = {};
      if (updates.startDate) body.startDate = updates.startDate.toISOString();
      if (updates.endDate) body.endDate = updates.endDate.toISOString();
      if (updates.flowIntensity !== undefined)
        body.flowIntensity = updates.flowIntensity;
      if (updates.symptoms !== undefined) body.symptoms = updates.symptoms;
      if (updates.notes !== undefined) body.notes = updates.notes;

      await api.patch(`/api/health/period-entries/${entryId}`, body);
    } catch (error) {
      throw new Error(`Failed to update period entry: ${error}`);
    }
  },

  // Delete period entry
  async deletePeriodEntry(entryId: string): Promise<void> {
    try {
      await api.delete(`/api/health/period-entries/${entryId}`);
    } catch (error) {
      throw new Error(`Failed to delete period entry: ${error}`);
    }
  },

  /**
   * Compute cycle info from period entries.
   *
   * Previously this read a separate `periodCycles` Firestore document.
   * Now it is a pure derivation from the period entries — no extra DB round-trip.
   */
  async getCycleInfo(userId: string): Promise<PeriodCycle | null> {
    try {
      const entries = await this.getUserPeriodEntries(userId, 100);
      if (entries.length === 0) return null;

      const cycleLengths = getValidCycleLengths(entries, 8);
      const averageCycleLength = Math.round(mean(cycleLengths) ?? 28);
      const cycleLengthsMean = mean(cycleLengths);
      const cycleLengthStdDev =
        cycleLengthsMean === undefined
          ? undefined
          : stdDev(cycleLengths, cycleLengthsMean);
      const averagePeriodLength = getAveragePeriodLength(entries);

      const lastPeriodStart = entries[0].startDate;
      const today = toDateOnly(new Date());
      const nextPeriodPredicted = predictNextPeriodDate(
        lastPeriodStart,
        averageCycleLength,
        today
      );

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
      const ovulationPredicted = predictOvulationDate(nextPeriodPredicted);

      return {
        id: `${userId}_computed`,
        userId,
        averageCycleLength,
        averagePeriodLength,
        lastPeriodStart,
        nextPeriodPredicted,
        nextPeriodWindowStart: window.start,
        nextPeriodWindowEnd: window.end,
        ovulationPredicted,
        predictionConfidence,
        cycleLengthStdDev: roundTo1Decimal(cycleLengthStdDev),
        updatedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to get cycle info: ${error}`);
    }
  },

  /**
   * Update cycle info — now a no-op.
   *
   * Cycle statistics are derived on demand in getCycleInfo(); there is no
   * separate persisted document to keep in sync.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateCycleInfo(_userId: string): Promise<void> {
    // No-op: callers that previously relied on a side-effect write should
    // switch to reading the computed result from getCycleInfo() directly.
  },
};
