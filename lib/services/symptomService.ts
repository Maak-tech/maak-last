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
import type { Symptom } from "@/types";
import { offlineService } from "./offlineService";

export const symptomService = {
  // Add new symptom (offline-first)
  async addSymptom(symptomData: Omit<Symptom, "id">): Promise<string> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      // Filter out undefined values to prevent Firebase errors
      const cleanedData = Object.fromEntries(
        Object.entries({
          ...symptomData,
          timestamp: Timestamp.fromDate(symptomData.timestamp),
        }).filter(([_, value]) => value !== undefined)
      );

      if (isOnline) {
        const docRef = await addDoc(collection(db, "symptoms"), cleanedData);
        // Cache the result for offline access
        const newSymptom = { id: docRef.id, ...symptomData };
        const currentSymptoms = await offlineService.getOfflineCollection<Symptom>("symptoms");
        await offlineService.storeOfflineData("symptoms", [...currentSymptoms, newSymptom]);
        return docRef.id;
      } else {
        // Offline - queue the operation
        const operationId = await offlineService.queueOperation({
          type: "create",
          collection: "symptoms",
          data: { ...symptomData, userId: symptomData.userId },
        });
        // Store locally for immediate UI update
        const tempId = `offline_${operationId}`;
        const newSymptom = { id: tempId, ...symptomData };
        const currentSymptoms = await offlineService.getOfflineCollection<Symptom>("symptoms");
        await offlineService.storeOfflineData("symptoms", [...currentSymptoms, newSymptom]);
        return tempId;
      }
    } catch (error) {
      // If online but fails, queue for retry
      if (isOnline) {
        const operationId = await offlineService.queueOperation({
          type: "create",
          collection: "symptoms",
          data: { ...symptomData, userId: symptomData.userId },
        });
        return `offline_${operationId}`;
      }
      throw error;
    }
  },

  // Add new symptom for a specific user (for admins)
  async addSymptomForUser(
    symptomData: Omit<Symptom, "id">,
    targetUserId: string
  ): Promise<string> {
    try {
      // Override the userId to the target user
      const dataWithTargetUser = {
        ...symptomData,
        userId: targetUserId,
      };

      // Filter out undefined values to prevent Firebase errors
      const cleanedData = Object.fromEntries(
        Object.entries({
          ...dataWithTargetUser,
          timestamp: Timestamp.fromDate(dataWithTargetUser.timestamp),
        }).filter(([_, value]) => value !== undefined)
      );

      const docRef = await addDoc(collection(db, "symptoms"), cleanedData);
      return docRef.id;
    } catch (error) {
      // Silently handle error adding symptom for user:", error);
      throw error;
    }
  },

  // Get user symptoms (offline-first)
  async getUserSymptoms(userId: string, limitCount = 50): Promise<Symptom[]> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        const q = query(
          collection(db, "symptoms"),
          where("userId", "==", userId),
          orderBy("timestamp", "desc"),
          limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        const symptoms: Symptom[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          symptoms.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp.toDate(),
          } as Symptom);
        });

        // Cache for offline access
        await offlineService.storeOfflineData("symptoms", symptoms);
        return symptoms;
      } else {
        // Offline - use cached data filtered by userId
        const cachedSymptoms = await offlineService.getOfflineCollection<Symptom>("symptoms");
        return cachedSymptoms
          .filter((s) => {
            if (s.userId !== userId) return false;
            if (!s.timestamp) return false;
            // Ensure timestamp is a Date object
            if (!(s.timestamp instanceof Date)) {
              s.timestamp = new Date(s.timestamp);
            }
            return !isNaN(s.timestamp.getTime());
          })
          .sort((a, b) => {
            const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return bTime - aTime;
          })
          .slice(0, limitCount);
      }
    } catch (error) {
      // If online but fails, try offline cache
      if (isOnline) {
        const cachedSymptoms = await offlineService.getOfflineCollection<Symptom>("symptoms");
        return cachedSymptoms
          .filter((s) => {
            if (s.userId !== userId) return false;
            if (!s.timestamp) return false;
            // Ensure timestamp is a Date object
            if (!(s.timestamp instanceof Date)) {
              s.timestamp = new Date(s.timestamp);
            }
            return !isNaN(s.timestamp.getTime());
          })
          .sort((a, b) => {
            const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
            const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
            return bTime - aTime;
          })
          .slice(0, limitCount);
      }
      throw error;
    }
  },

  // Get symptoms for all family members (for admins)
  async getFamilySymptoms(
    familyId: string,
    limitCount = 50
  ): Promise<Symptom[]> {
    try {
      // First get all family members
      const familyMembersQuery = query(
        collection(db, "users"),
        where("familyId", "==", familyId)
      );
      const familyMembersSnapshot = await getDocs(familyMembersQuery);
      const memberIds = familyMembersSnapshot.docs.map((doc) => doc.id);

      if (memberIds.length === 0) {
        return [];
      }

      // Get symptoms for all family members
      const symptomsQuery = query(
        collection(db, "symptoms"),
        where("userId", "in", memberIds),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(symptomsQuery);
      const symptoms: Symptom[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        symptoms.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Symptom);
      });

      return symptoms;
    } catch (error) {
      // Silently handle error getting family symptoms:", error);
      throw error;
    }
  },

  // Get symptom stats for all family members (for admins)
  async getFamilySymptomStats(
    familyId: string,
    days = 7
  ): Promise<{
    totalSymptoms: number;
    avgSeverity: number;
    commonSymptoms: {
      type: string;
      count: number;
      userId?: string;
      userName?: string;
    }[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // First get all family members
      const familyMembersQuery = query(
        collection(db, "users"),
        where("familyId", "==", familyId)
      );
      const familyMembersSnapshot = await getDocs(familyMembersQuery);
      const memberIds = familyMembersSnapshot.docs.map((doc) => doc.id);
      const membersMap = new Map();
      familyMembersSnapshot.docs.forEach((doc) => {
        membersMap.set(doc.id, doc.data().name);
      });

      if (memberIds.length === 0) {
        return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
      }

      // Get symptoms for all family members
      const symptomsQuery = query(
        collection(db, "symptoms"),
        where("userId", "in", memberIds),
        where("timestamp", ">=", Timestamp.fromDate(startDate))
      );

      const querySnapshot = await getDocs(symptomsQuery);
      const symptoms: Symptom[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        symptoms.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Symptom);
      });

      // Calculate stats
      const totalSymptoms = symptoms.length;
      const avgSeverity =
        totalSymptoms > 0
          ? symptoms.reduce((sum, s) => sum + s.severity, 0) / totalSymptoms
          : 0;

      // Count common symptoms by type and user
      const symptomCounts = new Map<
        string,
        { count: number; users: Set<string> }
      >();
      symptoms.forEach((symptom) => {
        const key = symptom.type;
        if (!symptomCounts.has(key)) {
          symptomCounts.set(key, { count: 0, users: new Set() });
        }
        const entry = symptomCounts.get(key)!;
        entry.count++;
        entry.users.add(symptom.userId);
      });

      // Convert to array and sort by count
      const commonSymptoms = Array.from(symptomCounts.entries())
        .map(([type, data]) => ({
          type,
          count: data.count,
          affectedMembers: data.users.size,
          users: Array.from(data.users).map((userId) => ({
            userId,
            userName: membersMap.get(userId) || "Unknown",
          })),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalSymptoms,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        commonSymptoms,
      };
    } catch (error) {
      // Silently handle error getting family symptom stats:", error);
      return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
    }
  },

  // Update symptom
  async updateSymptom(
    symptomId: string,
    updates: Partial<Symptom>
  ): Promise<void> {
    try {
      const updateData: any = { ...updates };
      if (updates.timestamp) {
        updateData.timestamp = Timestamp.fromDate(updates.timestamp);
      }
      await updateDoc(doc(db, "symptoms", symptomId), updateData);
    } catch (error) {
      // Silently handle error updating symptom:", error);
      throw error;
    }
  },

  // Delete symptom
  async deleteSymptom(symptomId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "symptoms", symptomId));
    } catch (error) {
      // Silently handle error deleting symptom:", error);
      throw error;
    }
  },

  // Get symptom statistics
  async getSymptomStats(
    userId: string,
    days = 7
  ): Promise<{
    totalSymptoms: number;
    avgSeverity: number;
    commonSymptoms: { type: string; count: number }[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const q = query(
        collection(db, "symptoms"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(startDate))
      );

      const querySnapshot = await getDocs(q);
      const symptoms: Symptom[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        symptoms.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Symptom);
      });

      const totalSymptoms = symptoms.length;
      const avgSeverity =
        totalSymptoms > 0
          ? symptoms.reduce((sum, s) => sum + s.severity, 0) / totalSymptoms
          : 0;

      // Count symptom types
      const symptomCounts: { [key: string]: number } = {};
      symptoms.forEach((s) => {
        symptomCounts[s.type] = (symptomCounts[s.type] || 0) + 1;
      });

      const commonSymptoms = Object.entries(symptomCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalSymptoms,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        commonSymptoms,
      };
    } catch (error) {
      // Silently handle error getting symptom stats:", error);
      throw error;
    }
  },

  // Get symptoms for a specific family member (for admins)
  async getMemberSymptoms(
    memberId: string,
    limitCount = 50
  ): Promise<Symptom[]> {
    try {
      const q = query(
        collection(db, "symptoms"),
        where("userId", "==", memberId),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const symptoms: Symptom[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        symptoms.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Symptom);
      });

      return symptoms;
    } catch (error) {
      // Silently handle error getting member symptoms:", error);
      throw error;
    }
  },

  // Get symptom stats for a specific family member (for admins)
  async getMemberSymptomStats(
    memberId: string,
    days = 7
  ): Promise<{
    totalSymptoms: number;
    avgSeverity: number;
    commonSymptoms: { type: string; count: number }[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const q = query(
        collection(db, "symptoms"),
        where("userId", "==", memberId),
        where("timestamp", ">=", Timestamp.fromDate(startDate))
      );

      const querySnapshot = await getDocs(q);
      const symptoms: Symptom[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        symptoms.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Symptom);
      });

      // Calculate stats
      const totalSymptoms = symptoms.length;
      const avgSeverity =
        totalSymptoms > 0
          ? symptoms.reduce((sum, s) => sum + s.severity, 0) / totalSymptoms
          : 0;

      // Count common symptoms by type
      const symptomCounts = new Map<string, number>();
      symptoms.forEach((symptom) => {
        const count = symptomCounts.get(symptom.type) || 0;
        symptomCounts.set(symptom.type, count + 1);
      });

      // Convert to array and sort by count
      const commonSymptoms = Array.from(symptomCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalSymptoms,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        commonSymptoms,
      };
    } catch (error) {
      // Silently handle error getting member symptom stats:", error);
      return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
    }
  },
};
