import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Allergy } from "@/types";
import { offlineService } from "./offlineService";

export const allergyService = {
  // Add new allergy (offline-first)
  async addAllergy(allergyData: Omit<Allergy, "id">): Promise<string> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      // Filter out undefined values to prevent Firebase errors
      const cleanedData = Object.fromEntries(
        Object.entries({
          ...allergyData,
          timestamp: Timestamp.fromDate(allergyData.timestamp),
          discoveredDate: allergyData.discoveredDate
            ? Timestamp.fromDate(allergyData.discoveredDate)
            : undefined,
        }).filter(([_, value]) => value !== undefined)
      );

      if (isOnline) {
        const docRef = await addDoc(collection(db, "allergies"), cleanedData);
        // Cache the result for offline access
        const newAllergy = { id: docRef.id, ...allergyData };
        const currentAllergies = await offlineService.getOfflineCollection<Allergy>("allergies");
        await offlineService.storeOfflineData("allergies", [...currentAllergies, newAllergy]);
        return docRef.id;
      } else {
        // Offline - queue the operation
        const operationId = await offlineService.queueOperation({
          type: "create",
          collection: "allergies",
          data: { ...allergyData, userId: allergyData.userId },
        });
        // Store locally for immediate UI update
        const tempId = `offline_${operationId}`;
        const newAllergy = { id: tempId, ...allergyData };
        const currentAllergies = await offlineService.getOfflineCollection<Allergy>("allergies");
        await offlineService.storeOfflineData("allergies", [...currentAllergies, newAllergy]);
        return tempId;
      }
    } catch (error) {
      // If online but fails, queue for retry
      if (isOnline) {
        const operationId = await offlineService.queueOperation({
          type: "create",
          collection: "allergies",
          data: { ...allergyData, userId: allergyData.userId },
        });
        return `offline_${operationId}`;
      }
      throw error;
    }
  },

  // Get user allergies (offline-first)
  async getUserAllergies(userId: string, limitCount = 50): Promise<Allergy[]> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        // Query without orderBy to avoid index requirement, then sort in memory
        const q = query(
          collection(db, "allergies"),
          where("userId", "==", userId)
        );

        const querySnapshot = await getDocs(q);
        const allergies: Allergy[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          try {
            // Safely convert timestamp
            let timestamp: Date;
            if (data.timestamp?.toDate && typeof data.timestamp.toDate === "function") {
              timestamp = data.timestamp.toDate();
            } else if (data.timestamp instanceof Date) {
              timestamp = data.timestamp;
            } else if (data.timestamp) {
              timestamp = new Date(data.timestamp);
            } else {
              timestamp = new Date();
            }

            // Safely convert discoveredDate
            let discoveredDate: Date | undefined;
            if (data.discoveredDate) {
              if (data.discoveredDate?.toDate && typeof data.discoveredDate.toDate === "function") {
                discoveredDate = data.discoveredDate.toDate();
              } else if (data.discoveredDate instanceof Date) {
                discoveredDate = data.discoveredDate;
              } else {
                const parsed = new Date(data.discoveredDate);
                discoveredDate = isNaN(parsed.getTime()) ? undefined : parsed;
              }
            }

            allergies.push({
              id: doc.id,
              ...data,
              timestamp,
              discoveredDate,
            } as Allergy);
          } catch (error) {
            // Silently handle parsing error
          }
        });

        // Sort by timestamp descending and limit results
        allergies.sort((a, b) => {
          const timeA = a.timestamp?.getTime() || 0;
          const timeB = b.timestamp?.getTime() || 0;
          return timeB - timeA;
        });

        const result = allergies.slice(0, limitCount);
        // Cache for offline access
        await offlineService.storeOfflineData("allergies", result);
        return result;
      } else {
        // Offline - use cached data filtered by userId
        const cachedAllergies = await offlineService.getOfflineCollection<Allergy>("allergies");
        return cachedAllergies
          .filter((a) => a.userId === userId)
          .sort((a, b) => {
            const timeA = a.timestamp?.getTime() || 0;
            const timeB = b.timestamp?.getTime() || 0;
            return timeB - timeA;
          })
          .slice(0, limitCount);
      }
    } catch (error) {
      // If online but fails, try offline cache
      if (isOnline) {
        const cachedAllergies = await offlineService.getOfflineCollection<Allergy>("allergies");
        return cachedAllergies
          .filter((a) => a.userId === userId)
          .sort((a, b) => {
            const timeA = a.timestamp?.getTime() || 0;
            const timeB = b.timestamp?.getTime() || 0;
            return timeB - timeA;
          })
          .slice(0, limitCount);
      }
      throw error;
    }
  },

  // Update allergy
  async updateAllergy(
    allergyId: string,
    updates: Partial<Allergy>
  ): Promise<void> {
    try {
      const updateData: any = { ...updates };
      if (updates.timestamp) {
        const timestamp = updates.timestamp instanceof Date ? updates.timestamp : new Date(updates.timestamp);
        updateData.timestamp = Timestamp.fromDate(timestamp);
      }
      if (updates.discoveredDate) {
        const discoveredDate = updates.discoveredDate instanceof Date ? updates.discoveredDate : new Date(updates.discoveredDate);
        updateData.discoveredDate = Timestamp.fromDate(discoveredDate);
      }
      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      await updateDoc(doc(db, "allergies", allergyId), updateData);
    } catch (error) {
      throw error;
    }
  },

  // Delete allergy
  async deleteAllergy(allergyId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "allergies", allergyId));
    } catch (error) {
      throw error;
    }
  },
};

