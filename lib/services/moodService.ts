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

export const moodService = {
  // Add new mood
  async addMood(moodData: Omit<Mood, "id">): Promise<string> {
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

      const docRef = await addDoc(collection(db, "moods"), cleanedData);
      return docRef.id;
    } catch (error) {
      console.error("Error adding mood:", error);
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
      console.error("Error adding mood for user:", error);
      throw error;
    }
  },

  // Get user moods
  async getUserMoods(userId: string, limitCount = 50): Promise<Mood[]> {
    try {
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

      return moods;
    } catch (error) {
      // Silently handle error getting moods
      throw error;
    }
  },

  // Get moods for all family members (for admins)
  async getFamilyMoods(
    familyId: string,
    limitCount = 50
  ): Promise<Mood[]> {
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

      // Get moods for all family members
      const moodsQuery = query(
        collection(db, "moods"),
        where("userId", "in", memberIds),
        orderBy("timestamp", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(moodsQuery);
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
      // Silently handle error getting family moods
      throw error;
    }
  },

  // Get mood stats for all family members (for admins)
  async getFamilyMoodStats(
    familyId: string,
    days = 7
  ): Promise<{
    totalMoods: number;
    avgIntensity: number;
    moodDistribution: {
      mood: string;
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
        return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
      }

      // Get moods for all family members
      const moodsQuery = query(
        collection(db, "moods"),
        where("userId", "in", memberIds),
        where("timestamp", ">=", Timestamp.fromDate(startDate))
      );

      const querySnapshot = await getDocs(moodsQuery);
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

      // Count mood distribution
      const moodCounts = new Map<
        string,
        { count: number; users: Set<string> }
      >();
      moods.forEach((mood) => {
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
    } catch (error) {
      // Silently handle error getting family mood stats
      return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
    }
  },

  // Update mood
  async updateMood(
    moodId: string,
    updates: Partial<Mood>
  ): Promise<void> {
    try {
      const updateData: any = { ...updates };
      if (updates.timestamp) {
        updateData.timestamp = Timestamp.fromDate(updates.timestamp);
      }
      await updateDoc(doc(db, "moods", moodId), updateData);
    } catch (error) {
      // Silently handle error updating mood
      throw error;
    }
  },

  // Delete mood
  async deleteMood(moodId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "moods", moodId));
    } catch (error) {
      // Silently handle error deleting mood
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
    } catch (error) {
      // Silently handle error getting mood stats
      throw error;
    }
  },

  // Get moods for a specific family member (for admins)
  async getMemberMoods(
    memberId: string,
    limitCount = 50
  ): Promise<Mood[]> {
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
      // Silently handle error getting member moods
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
    } catch (error) {
      // Silently handle error getting member mood stats
      return { totalMoods: 0, avgIntensity: 0, moodDistribution: [] };
    }
  },
};

