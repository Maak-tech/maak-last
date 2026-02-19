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

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({
          id: doc.id,
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
      await deleteDoc(doc(db, "periodEntries", entryId));
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
          ovulationPredicted: docData.ovulationPredicted?.toDate(),
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
        return;
      }

      // Calculate average cycle length
      let totalCycleLength = 0;
      let cycleCount = 0;

      for (let i = 0; i < entries.length - 1; i++) {
        const current = entries[i];
        const next = entries[i + 1];
        const cycleLength =
          (current.startDate.getTime() - next.startDate.getTime()) /
          (1000 * 60 * 60 * 24);
        if (cycleLength > 0 && cycleLength < 50) {
          // Reasonable cycle length (between 0 and 50 days)
          totalCycleLength += cycleLength;
          cycleCount++;
        }
      }

      const averageCycleLength =
        cycleCount > 0 ? Math.round(totalCycleLength / cycleCount) : 28; // Default to 28 days

      // Calculate average period length
      let totalPeriodLength = 0;
      let periodCount = 0;

      entries.forEach((entry) => {
        if (entry.endDate) {
          const periodLength =
            (entry.endDate.getTime() - entry.startDate.getTime()) /
            (1000 * 60 * 60 * 24);
          if (periodLength > 0 && periodLength < 15) {
            // Reasonable period length (between 0 and 15 days)
            totalPeriodLength += periodLength;
            periodCount++;
          }
        }
      });

      const averagePeriodLength =
        periodCount > 0 ? Math.round(totalPeriodLength / periodCount) : 5; // Default to 5 days

      // Get last period start (most recent entry)
      const lastPeriodStart = entries[0]?.startDate;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Predict next period based on average cycle length from last period start
      let nextPeriodPredicted: Date | undefined;
      if (lastPeriodStart) {
        const lastStart = new Date(lastPeriodStart);
        lastStart.setHours(0, 0, 0, 0);

        // Calculate days since last period
        const daysSinceLastPeriod = Math.floor(
          (today.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Calculate predicted date based on average cycle length
        const predictedDate = new Date(
          lastStart.getTime() + averageCycleLength * 24 * 60 * 60 * 1000
        );
        predictedDate.setHours(0, 0, 0, 0);

        // If predicted date is in the past, add another cycle
        if (predictedDate < today) {
          nextPeriodPredicted = new Date(
            predictedDate.getTime() + averageCycleLength * 24 * 60 * 60 * 1000
          );
        } else {
          nextPeriodPredicted = predictedDate;
        }
        nextPeriodPredicted.setHours(0, 0, 0, 0);
      }

      // Predict ovulation (approximately 14 days before next period, or mid-cycle)
      let ovulationPredicted: Date | undefined;
      if (nextPeriodPredicted) {
        // Ovulation typically occurs 14 days before period, but can vary
        // Use average cycle length to estimate: ovulation = cycle length - 14 days
        const ovulationDaysBeforePeriod = Math.max(
          10,
          Math.min(16, averageCycleLength - 14)
        );
        ovulationPredicted = new Date(
          nextPeriodPredicted.getTime() -
            ovulationDaysBeforePeriod * 24 * 60 * 60 * 1000
        );
        ovulationPredicted.setHours(0, 0, 0, 0);
      }

      // Update or create cycle document
      const existingCycle = await this.getCycleInfo(userId);
      const cycleData = {
        userId,
        averageCycleLength,
        averagePeriodLength,
        lastPeriodStart: lastPeriodStart
          ? Timestamp.fromDate(lastPeriodStart)
          : undefined,
        nextPeriodPredicted: nextPeriodPredicted
          ? Timestamp.fromDate(nextPeriodPredicted)
          : undefined,
        ovulationPredicted: ovulationPredicted
          ? Timestamp.fromDate(ovulationPredicted)
          : undefined,
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
