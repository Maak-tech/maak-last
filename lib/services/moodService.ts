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
import type { Mood } from "@/types";
import { offlineService } from "./offlineService";
import { userService } from "./userService";

export const moodService = {
  // Add new mood (offline-first)
  async addMood(moodData: Omit<Mood, "id">): Promise<string> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      // Validate required fields
      if (!moodData.userId) {
        throw new Error("User ID is required");
      }
      if (!moodData.mood) {
        throw new Error("Mood is required");
      }
      if (!moodData.intensity) {
        throw new Error("Intensity is required");
      }
      if (!moodData.timestamp) {
        throw new Error("Timestamp is required");
      }

      // Filter out undefined values to prevent Firebase errors
      const cleanedData = Object.fromEntries(
        Object.entries({
          ...moodData,
          timestamp: Timestamp.fromDate(moodData.timestamp),
        }).filter(([_, value]) => value !== undefined)
      );

      if (isOnline) {
        const docRef = await addDoc(collection(db, "moods"), cleanedData);
        // Cache the result for offline access
        const newMood = { id: docRef.id, ...moodData };
        const currentMoods =
          await offlineService.getOfflineCollection<Mood>("moods");
        await offlineService.storeOfflineData("moods", [
          ...currentMoods,
          newMood,
        ]);
        return docRef.id;
      }
      // Offline - queue the operation
      const operationId = await offlineService.queueOperation({
        type: "create",
        collection: "moods",
        data: { ...moodData, userId: moodData.userId },
      });
      // Store locally for immediate UI update
      const tempId = `offline_${operationId}`;
      const newMood = { id: tempId, ...moodData };
      const currentMoods =
        await offlineService.getOfflineCollection<Mood>("moods");
      await offlineService.storeOfflineData("moods", [
        ...currentMoods,
        newMood,
      ]);
      return tempId;
    } catch (error) {
      // If online but fails, queue for retry
      if (isOnline) {
        const operationId = await offlineService.queueOperation({
          type: "create",
          collection: "moods",
          data: { ...moodData, userId: moodData.userId },
        });
        return `offline_${operationId}`;
      }
      throw error;
    }
  },

  // Add new mood for a specific user (for admins)
  async addMoodForUser(
    moodData: Omit<Mood, "id">,
    targetUserId: string
  ): Promise<string> {
    try {
      // Validate required fields
      if (!targetUserId) {
        throw new Error("Target user ID is required");
      }
      if (!moodData.mood) {
        throw new Error("Mood is required");
      }
      if (!moodData.intensity) {
        throw new Error("Intensity is required");
      }
      if (!moodData.timestamp) {
        throw new Error("Timestamp is required");
      }

      // Override the userId to the target user
      const dataWithTargetUser = {
        ...moodData,
        userId: targetUserId,
      };

      // Filter out undefined values to prevent Firebase errors
      const cleanedData = Object.fromEntries(
        Object.entries({
          ...dataWithTargetUser,
          timestamp: Timestamp.fromDate(dataWithTargetUser.timestamp),
        }).filter(([_, value]) => value !== undefined)
      );

      const docRef = await addDoc(collection(db, "moods"), cleanedData);
      return docRef.id;
    } catch (error) {
      throw error;
    }
  },

  // Get user moods (offline-first)
  async getUserMoods(userId: string, limitCount = 50): Promise<Mood[]> {
    const isOnline = offlineService.isDeviceOnline();

    try {
      if (isOnline) {
        const q = query(
          collection(db, "moods"),
          where("userId", "==", userId),
          orderBy("timestamp", "desc"),
          limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        const moods: Mood[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          moods.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp.toDate(),
          } as Mood);
        });

        // Cache for offline access
        await offlineService.storeOfflineData("moods", moods);
        return moods;
      }
      // Offline - use cached data filtered by userId
      const cachedMoods =
        await offlineService.getOfflineCollection<Mood>("moods");
      return cachedMoods
        .filter((m) => m.userId === userId)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limitCount);
    } catch (error) {
      // If online but fails, try offline cache
      if (isOnline) {
        const cachedMoods =
          await offlineService.getOfflineCollection<Mood>("moods");
        return cachedMoods
          .filter((m) => m.userId === userId)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
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

  // Get moods for all family members (for admins and caregivers)
  async getFamilyMoods(
    userId: string,
    familyId: string,
    limitCount = 50
  ): Promise<Mood[]> {
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

      // Firestore 'in' operator has a limit of 10 items, so we need to chunk
      const chunkSize = 10;
      const chunks: string[][] = [];
      for (let i = 0; i < memberIds.length; i += chunkSize) {
        chunks.push(memberIds.slice(i, i + chunkSize));
      }

      // Get moods for all family members (query each chunk)
      // Note: We don't limit individual chunks since we need to combine and sort all results
      const allMoods: Mood[] = [];
      for (const chunk of chunks) {
        const moodsQuery = query(
          collection(db, "moods"),
          where("userId", "in", chunk),
          orderBy("timestamp", "desc")
        );

        const querySnapshot = await getDocs(moodsQuery);
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          allMoods.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp.toDate(),
          } as Mood);
        });
      }

      // Sort by timestamp descending and limit results
      return allMoods
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limitCount);
    } catch (error) {
      throw error;
    }
  },

  // Get mood stats for all family members (for admins and caregivers)
  async getFamilyMoodStats(
    userId: string,
    familyId: string,
    days = 7
  ): Promise<{
    totalMoods: number;
    avgIntensity: number;
    moodDistribution: {
      mood: string;
      count: number;
      affectedMembers: number;
      users: {
        userId: string;
        userName: string;
      }[];
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
      const membersMap = new Map<string, string>();
      familyMembersSnapshot.docs.forEach((doc) => {
        const userData = doc.data();
        const userName =
          userData.firstName && userData.lastName
            ? `${userData.firstName} ${userData.lastName}`
            : userData.firstName || userData.lastName || "Unknown";
        membersMap.set(doc.id, userName);
      });

      if (memberIds.length === 0) {
        return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
      }

      // Firestore 'in' operator has a limit of 10 items, so we need to chunk
      const chunkSize = 10;
      const chunks: string[][] = [];
      for (let i = 0; i < memberIds.length; i += chunkSize) {
        chunks.push(memberIds.slice(i, i + chunkSize));
      }

      // Get moods for all family members (query each chunk)
      const moods: Mood[] = [];
      for (const chunk of chunks) {
        try {
          const moodsQuery = query(
            collection(db, "moods"),
            where("userId", "in", chunk),
            where("timestamp", ">=", Timestamp.fromDate(startDate))
          );

          const querySnapshot = await getDocs(moodsQuery);
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            moods.push({
              id: doc.id,
              ...data,
              timestamp: data.timestamp.toDate(),
            } as Mood);
          });
        } catch (chunkError: any) {
          // If chunk query fails (e.g., index error), fallback to individual member queries
          if (chunkError?.code === "failed-precondition") {
            // Fetch moods for each member separately
            const moodPromises = chunk.map((memberId) =>
              this.getUserMoods(memberId, 1000).catch(() => [] as Mood[])
            );
            const allMoodsArrays = await Promise.all(moodPromises);
            const chunkMoods = allMoodsArrays.flat();
            // Filter by date
            const filteredChunkMoods = chunkMoods.filter(
              (m) => m.timestamp.getTime() >= startDate.getTime()
            );
            moods.push(...filteredChunkMoods);
          } else {
            throw chunkError;
          }
        }
      }

      // Filter moods by date (in case fallback was used)
      const filteredMoods = moods.filter(
        (m) => m.timestamp.getTime() >= startDate.getTime()
      );

      // Calculate stats
      const totalMoods = filteredMoods.length;
      const avgIntensity =
        totalMoods > 0
          ? filteredMoods.reduce((sum, m) => sum + m.intensity, 0) / totalMoods
          : 0;

      // Count mood distribution
      const moodCounts = new Map<
        string,
        { count: number; users: Set<string> }
      >();
      filteredMoods.forEach((mood) => {
        const key = mood.mood;
        if (!moodCounts.has(key)) {
          moodCounts.set(key, { count: 0, users: new Set() });
        }
        const entry = moodCounts.get(key)!;
        entry.count++;
        entry.users.add(mood.userId);
      });

      // Convert to array and sort by count
      const moodDistribution = Array.from(moodCounts.entries())
        .map(([mood, data]) => ({
          mood,
          count: data.count,
          affectedMembers: data.users.size,
          users: Array.from(data.users).map((userId) => ({
            userId,
            userName: membersMap.get(userId) || "Unknown",
          })),
        }))
        .sort((a, b) => b.count - a.count);

      return {
        totalMoods,
        avgIntensity: Math.round(avgIntensity * 10) / 10,
        moodDistribution,
      };
    } catch (error: any) {
      // Check if it's an index error and use fallback
      if (error?.code === "failed-precondition") {
        try {
          // Fallback: fetch stats for each member separately and combine
          const familyMembersQuery = query(
            collection(db, "users"),
            where("familyId", "==", familyId)
          );
          const familyMembersSnapshot = await getDocs(familyMembersQuery);
          const memberIds = familyMembersSnapshot.docs.map((doc) => doc.id);
          const membersMap = new Map<string, string>();
          familyMembersSnapshot.docs.forEach((doc) => {
            const userData = doc.data();
            const userName =
              userData.firstName && userData.lastName
                ? `${userData.firstName} ${userData.lastName}`
                : userData.firstName || userData.lastName || "Unknown";
            membersMap.set(doc.id, userName);
          });

          if (memberIds.length === 0) {
            return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
          }

          const statsPromises = memberIds.map((memberId) =>
            this.getMoodStats(memberId, days).catch(() => ({
              totalMoods: 0,
              avgIntensity: 0,
              moodDistribution: [] as { mood: string; count: number }[],
            }))
          );
          const allStats = await Promise.all(statsPromises);

          // Combine stats
          const totalMoods = allStats.reduce(
            (sum, stat) => sum + stat.totalMoods,
            0
          );
          const totalIntensity = allStats.reduce(
            (sum, stat) => sum + stat.avgIntensity * stat.totalMoods,
            0
          );
          const avgIntensity = totalMoods > 0 ? totalIntensity / totalMoods : 0;

          // Combine mood distribution
          const moodCounts = new Map<
            string,
            { count: number; users: Set<string> }
          >();
          allStats.forEach((stat, index) => {
            stat.moodDistribution.forEach((dist) => {
              const key = dist.mood;
              if (!moodCounts.has(key)) {
                moodCounts.set(key, { count: 0, users: new Set() });
              }
              const entry = moodCounts.get(key)!;
              entry.count += dist.count;
              entry.users.add(memberIds[index]);
            });
          });

          const moodDistribution = Array.from(moodCounts.entries())
            .map(([mood, data]) => ({
              mood,
              count: data.count,
              affectedMembers: data.users.size,
              users: Array.from(data.users).map((userId) => ({
                userId,
                userName: membersMap.get(userId) || "Unknown",
              })),
            }))
            .sort((a, b) => b.count - a.count);

          return {
            totalMoods,
            avgIntensity: Math.round(avgIntensity * 10) / 10,
            moodDistribution,
          };
        } catch (fallbackError) {
          // Return default values if fallback also fails
          return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
        }
      }
      // Return default values on other errors
      return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
    }
  },

  // Update mood
  async updateMood(moodId: string, updates: Partial<Mood>): Promise<void> {
    try {
      const updateData: any = { ...updates };
      if (updates.timestamp) {
        updateData.timestamp = Timestamp.fromDate(updates.timestamp);
      }
      await updateDoc(doc(db, "moods", moodId), updateData);
    } catch (error) {
      throw error;
    }
  },

  // Delete mood
  async deleteMood(moodId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "moods", moodId));
    } catch (error) {
      throw error;
    }
  },

  // Get mood statistics
  async getMoodStats(
    userId: string,
    days = 7
  ): Promise<{
    totalMoods: number;
    avgIntensity: number;
    moodDistribution: { mood: string; count: number }[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const q = query(
        collection(db, "moods"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(startDate))
      );

      const querySnapshot = await getDocs(q);
      const moods: Mood[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        moods.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Mood);
      });

      const totalMoods = moods.length;
      const avgIntensity =
        totalMoods > 0
          ? moods.reduce((sum, m) => sum + m.intensity, 0) / totalMoods
          : 0;

      // Count mood types
      const moodCounts: { [key: string]: number } = {};
      moods.forEach((m) => {
        moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
      });

      const moodDistribution = Object.entries(moodCounts)
        .map(([mood, count]) => ({ mood, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalMoods,
        avgIntensity: Math.round(avgIntensity * 10) / 10,
        moodDistribution,
      };
    } catch (error: any) {
      // Check if it's an index error and use fallback
      if (error?.code === "failed-precondition") {
        try {
          // Fallback: fetch all user moods and filter by date in memory
          // This uses the existing index that works (userId + orderBy timestamp)
          const allMoods = await this.getUserMoods(userId, 1000); // Get more than needed
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          // Filter by date in memory
          const moods = allMoods.filter(
            (m) => m.timestamp.getTime() >= startDate.getTime()
          );

          const totalMoods = moods.length;
          const avgIntensity =
            totalMoods > 0
              ? moods.reduce((sum, m) => sum + m.intensity, 0) / totalMoods
              : 0;

          // Count mood types
          const moodCounts: { [key: string]: number } = {};
          moods.forEach((m) => {
            moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1;
          });

          const moodDistribution = Object.entries(moodCounts)
            .map(([mood, count]) => ({ mood, count }))
            .sort((a, b) => b.count - a.count);

          return {
            totalMoods,
            avgIntensity: Math.round(avgIntensity * 10) / 10,
            moodDistribution,
          };
        } catch (fallbackError) {
          // If fallback also fails, return empty stats
          return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
        }
      }
      throw error;
    }
  },

  // Get moods for a specific family member (for admins)
  async getMemberMoods(memberId: string, limitCount = 50): Promise<Mood[]> {
    try {
      const q = query(
        collection(db, "moods"),
        where("userId", "==", memberId),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const moods: Mood[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        moods.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Mood);
      });

      return moods;
    } catch (error) {
      throw error;
    }
  },

  // Get mood stats for a specific family member (for admins)
  async getMemberMoodStats(
    memberId: string,
    days = 7
  ): Promise<{
    totalMoods: number;
    avgIntensity: number;
    moodDistribution: { mood: string; count: number }[];
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const q = query(
        collection(db, "moods"),
        where("userId", "==", memberId),
        where("timestamp", ">=", Timestamp.fromDate(startDate))
      );

      const querySnapshot = await getDocs(q);
      const moods: Mood[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        moods.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as Mood);
      });

      // Calculate stats
      const totalMoods = moods.length;
      const avgIntensity =
        totalMoods > 0
          ? moods.reduce((sum, m) => sum + m.intensity, 0) / totalMoods
          : 0;

      // Count mood types
      const moodCounts = new Map<string, number>();
      moods.forEach((mood) => {
        const count = moodCounts.get(mood.mood) || 0;
        moodCounts.set(mood.mood, count + 1);
      });

      // Convert to array and sort by count
      const moodDistribution = Array.from(moodCounts.entries())
        .map(([mood, count]) => ({ mood, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalMoods,
        avgIntensity: Math.round(avgIntensity * 10) / 10,
        moodDistribution,
      };
    } catch (error: any) {
      // Check if it's an index error and use fallback
      if (error?.code === "failed-precondition") {
        try {
          // Fallback: use getMoodStats which has its own fallback
          return await this.getMoodStats(memberId, days);
        } catch (fallbackError) {
          // Return default values if fallback also fails
          return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
        }
      }
      // Return default values on other errors
      return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
    }
  },
};
