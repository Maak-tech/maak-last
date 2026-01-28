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
import { healthTimelineService } from "@/lib/observability";
import type { Symptom } from "@/types";
import { offlineService } from "./offlineService";
import { userService } from "./userService";

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
        const currentSymptoms =
          await offlineService.getOfflineCollection<Symptom>("symptoms");
        await offlineService.storeOfflineData("symptoms", [
          ...currentSymptoms,
          newSymptom,
        ]);

        await healthTimelineService.addEvent({
          userId: symptomData.userId,
          eventType: "symptom_logged",
          title: `Symptom logged: ${symptomData.type}`,
          description:
            symptomData.description || `Severity: ${symptomData.severity}/5`,
          timestamp: symptomData.timestamp,
          severity:
            symptomData.severity >= 4
              ? "error"
              : symptomData.severity >= 3
                ? "warn"
                : "info",
          icon: "thermometer",
          metadata: {
            symptomId: docRef.id,
            symptomType: symptomData.type,
            severity: symptomData.severity,
            location: symptomData.location,
            triggers: symptomData.triggers,
          },
          relatedEntityId: docRef.id,
          relatedEntityType: "symptom",
          actorType: "user",
        });

        // Check for concerning trends and create alerts (non-blocking)
        // This will be picked up by the real-time WebSocket service
        import("./trendAlertService")
          .then(({ checkTrendsForNewSymptom }) => {
            checkTrendsForNewSymptom(
              symptomData.userId,
              symptomData.type
            ).catch((error) => {
              // Silently handle errors - trend checking is non-critical
              if (__DEV__) {
                console.error("Error checking trends for symptom:", error);
              }
            });
          })
          .catch(() => {
            // Silently handle import errors
          });

        return docRef.id;
      }
      // Offline - queue the operation
      const operationId = await offlineService.queueOperation({
        type: "create",
        collection: "symptoms",
        data: { ...symptomData, userId: symptomData.userId },
      });
      // Store locally for immediate UI update
      const tempId = `offline_${operationId}`;
      const newSymptom = { id: tempId, ...symptomData };
      const currentSymptoms =
        await offlineService.getOfflineCollection<Symptom>("symptoms");
      await offlineService.storeOfflineData("symptoms", [
        ...currentSymptoms,
        newSymptom,
      ]);
      return tempId;
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
      }
      // Offline - use cached data filtered by userId
      const cachedSymptoms =
        await offlineService.getOfflineCollection<Symptom>("symptoms");
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
          const aTime =
            a.timestamp instanceof Date
              ? a.timestamp.getTime()
              : new Date(a.timestamp).getTime();
          const bTime =
            b.timestamp instanceof Date
              ? b.timestamp.getTime()
              : new Date(b.timestamp).getTime();
          return bTime - aTime;
        })
        .slice(0, limitCount);
    } catch (error) {
      // If online but fails, try offline cache
      if (isOnline) {
        const cachedSymptoms =
          await offlineService.getOfflineCollection<Symptom>("symptoms");
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
            const aTime =
              a.timestamp instanceof Date
                ? a.timestamp.getTime()
                : new Date(a.timestamp).getTime();
            const bTime =
              b.timestamp instanceof Date
                ? b.timestamp.getTime()
                : new Date(b.timestamp).getTime();
            return bTime - aTime;
          })
          .slice(0, limitCount);
      }
      throw error;
    }
  },

  // Check if user has permission to access family data (admin or caregiver)
  async checkFamilyAccessPermission(
    userId: string,
    familyId: string
  ): Promise<boolean> {
    try {
      const user = await userService.getUser(userId);
      return (
        user?.familyId === familyId &&
        (user?.role === "admin" || user?.role === "caregiver")
      );
    } catch (error) {
      return false;
    }
  },

  // Get symptoms for all family members (for admins and caregivers)
  async getFamilySymptoms(
    userId: string,
    familyId: string,
    limitCount = 50
  ): Promise<Symptom[]> {
    try {
      // Check permissions
      const hasPermission = await this.checkFamilyAccessPermission(
        userId,
        familyId
      );
      if (!hasPermission) {
        throw new Error(
          "Access denied: Only admins and caregivers can access family medical data"
        );
      }
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

      // Firestore 'in' queries are limited to 10 items, so we need to batch if needed
      if (memberIds.length > 10) {
        // If more than 10 members, fetch symptoms for each member separately and combine
        const symptomPromises = memberIds.map((memberId) =>
          this.getUserSymptoms(memberId, limitCount).catch(
            () => [] as Symptom[]
          )
        );
        const allSymptomsArrays = await Promise.all(symptomPromises);
        const allSymptoms = allSymptomsArrays.flat();
        // Sort by timestamp descending and limit
        return allSymptoms
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, limitCount);
      }

      // Get symptoms for all family members (works for up to 10 members)
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
    } catch (error: any) {
      // Check if it's an index error
      if (error?.code === "failed-precondition") {
        // Fallback: fetch symptoms for each member separately
        try {
          const familyMembersQuery = query(
            collection(db, "users"),
            where("familyId", "==", familyId)
          );
          const familyMembersSnapshot = await getDocs(familyMembersQuery);
          const memberIds = familyMembersSnapshot.docs.map((doc) => doc.id);

          if (memberIds.length === 0) {
            return [];
          }

          const symptomPromises = memberIds.map((memberId) =>
            this.getUserSymptoms(memberId, limitCount).catch(
              () => [] as Symptom[]
            )
          );
          const allSymptomsArrays = await Promise.all(symptomPromises);
          const allSymptoms = allSymptomsArrays.flat();
          // Sort by timestamp descending and limit
          return allSymptoms
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limitCount);
        } catch (fallbackError) {
          throw new Error(
            `Failed to load family symptoms: ${fallbackError instanceof Error ? fallbackError.message : "Unknown error"}`
          );
        }
      }
      throw error;
    }
  },

  // Get symptom stats for all family members (for admins and caregivers)
  async getFamilySymptomStats(
    userId: string,
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
      // Check permissions
      const hasPermission = await this.checkFamilyAccessPermission(
        userId,
        familyId
      );
      if (!hasPermission) {
        throw new Error(
          "Access denied: Only admins and caregivers can access family medical data"
        );
      }

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
        const data = doc.data();
        membersMap.set(
          doc.id,
          data.name ||
            `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
            "Unknown"
        );
      });

      if (memberIds.length === 0) {
        return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
      }

      // Firestore 'in' queries are limited to 10 items, so we need to batch if needed
      const symptoms: Symptom[] = [];

      if (memberIds.length > 10) {
        // If more than 10 members, fetch stats for each member separately and combine
        const statsPromises = memberIds.map((memberId) =>
          this.getSymptomStats(memberId, days).catch(() => ({
            totalSymptoms: 0,
            avgSeverity: 0,
            commonSymptoms: [] as { type: string; count: number }[],
          }))
        );
        const allStats = await Promise.all(statsPromises);

        // Combine stats
        const totalSymptoms = allStats.reduce(
          (sum, stat) => sum + stat.totalSymptoms,
          0
        );
        const totalSeverity = allStats.reduce(
          (sum, stat) => sum + stat.avgSeverity * stat.totalSymptoms,
          0
        );
        const avgSeverity =
          totalSymptoms > 0 ? totalSeverity / totalSymptoms : 0;

        // Combine common symptoms
        const symptomCounts = new Map<
          string,
          { count: number; users: Set<string> }
        >();
        allStats.forEach((stat, index) => {
          stat.commonSymptoms.forEach((cs) => {
            const key = cs.type;
            if (!symptomCounts.has(key)) {
              symptomCounts.set(key, { count: 0, users: new Set() });
            }
            const entry = symptomCounts.get(key)!;
            entry.count += cs.count;
            entry.users.add(memberIds[index]);
          });
        });

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
      }

      // Get symptoms for all family members (works for up to 10 members)
      const symptomsQuery = query(
        collection(db, "symptoms"),
        where("userId", "in", memberIds),
        where("timestamp", ">=", Timestamp.fromDate(startDate))
      );

      const querySnapshot = await getDocs(symptomsQuery);

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
    } catch (error: any) {
      // Check if it's an index error and use fallback
      if (error?.code === "failed-precondition") {
        try {
          // Fallback: fetch stats for each member separately
          const familyMembersQuery = query(
            collection(db, "users"),
            where("familyId", "==", familyId)
          );
          const familyMembersSnapshot = await getDocs(familyMembersQuery);
          const memberIds = familyMembersSnapshot.docs.map((doc) => doc.id);
          const membersMap = new Map();
          familyMembersSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            membersMap.set(
              doc.id,
              data.name ||
                `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
                "Unknown"
            );
          });

          if (memberIds.length === 0) {
            return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
          }

          const statsPromises = memberIds.map((memberId) =>
            this.getSymptomStats(memberId, days).catch(() => ({
              totalSymptoms: 0,
              avgSeverity: 0,
              commonSymptoms: [] as { type: string; count: number }[],
            }))
          );
          const allStats = await Promise.all(statsPromises);

          // Combine stats
          const totalSymptoms = allStats.reduce(
            (sum, stat) => sum + stat.totalSymptoms,
            0
          );
          const totalSeverity = allStats.reduce(
            (sum, stat) => sum + stat.avgSeverity * stat.totalSymptoms,
            0
          );
          const avgSeverity =
            totalSymptoms > 0 ? totalSeverity / totalSymptoms : 0;

          // Combine common symptoms
          const symptomCounts = new Map<
            string,
            { count: number; users: Set<string> }
          >();
          allStats.forEach((stat, index) => {
            stat.commonSymptoms.forEach((cs) => {
              const key = cs.type;
              if (!symptomCounts.has(key)) {
                symptomCounts.set(key, { count: 0, users: new Set() });
              }
              const entry = symptomCounts.get(key)!;
              entry.count += cs.count;
              entry.users.add(memberIds[index]);
            });
          });

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
        } catch (fallbackError) {
          // Return empty stats if fallback also fails
          return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
        }
      }
      // Return empty stats on other errors
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
    } catch (error: any) {
      // Check if it's an index error and use fallback
      if (error?.code === "failed-precondition") {
        try {
          // Fallback: fetch all user symptoms and filter by date in memory
          // This uses the existing index that works (userId + orderBy timestamp)
          const allSymptoms = await this.getUserSymptoms(userId, 1000); // Get more than needed
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          // Filter by date in memory
          const symptoms = allSymptoms.filter(
            (s) => s.timestamp.getTime() >= startDate.getTime()
          );

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
        } catch (fallbackError) {
          // If fallback also fails, return empty stats
          return { totalSymptoms: 0, avgSeverity: 0, commonSymptoms: [] };
        }
      }
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
