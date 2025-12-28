import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Allergy } from "@/types";

export const allergyService = {
  // Add new allergy
  async addAllergy(allergyData: Omit<Allergy, "id">): Promise<string> {
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

      const docRef = await addDoc(collection(db, "allergies"), cleanedData);
      return docRef.id;
    } catch (error) {
      throw error;
    }
  },

  // Get user allergies
  async getUserAllergies(userId: string, limitCount = 50): Promise<Allergy[]> {
    try {
      const q = query(
        collection(db, "allergies"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const allergies: Allergy[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        try {
          allergies.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
            discoveredDate: data.discoveredDate?.toDate ? data.discoveredDate.toDate() : data.discoveredDate ? new Date(data.discoveredDate) : undefined,
          } as Allergy);
        } catch (error) {
          console.error("Error parsing allergy data:", error);
        }
      });

      return allergies;
    } catch (error) {
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

