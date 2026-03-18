<<<<<<< Updated upstream
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MedicalHistory } from '@/types';
=======
/**
 * Medical history service — Firebase-free replacement.
 *
 * Replaced Firestore reads/writes on `medicalHistory` collection with:
 *   POST   /api/health/medical-history        → addMedicalHistory
 *   GET    /api/health/medical-history        → getUserMedicalHistory (own)
 *   GET    /api/health/medical-history/:id    → getMedicalHistoryById
 *   PATCH  /api/health/medical-history/:id    → updateMedicalHistory
 *   DELETE /api/health/medical-history/:id    → deleteMedicalHistory
 */

import { api } from "@/lib/apiClient";
import type { MedicalHistory } from "@/types";

const _medHistoryCache = new Map<string, { history: MedicalHistory[]; timestamp: number }>();
const MED_HISTORY_CACHE_TTL = 120_000; // 2 minutes
>>>>>>> Stashed changes

/** Normalize a raw API medical history row to the client MedicalHistory type */
const normalizeMedicalHistory = (raw: Record<string, unknown>): MedicalHistory => ({
  id: raw.id as string,
  userId: raw.userId as string,
  condition: raw.condition as string,
  diagnosedDate: raw.diagnosedDate ? new Date(raw.diagnosedDate as string) : undefined,
  severity: raw.severity as MedicalHistory["severity"] | undefined,
  notes: raw.notes as string | undefined,
  isFamily: (raw.isFamily as boolean | undefined) ?? false,
  relation: raw.relation as string | undefined,
  familyMemberId: raw.familyMemberId as string | undefined,
  familyMemberName: raw.familyMemberName as string | undefined,
  tags: raw.tags as string[] | undefined,
});

export const medicalHistoryService = {
<<<<<<< Updated upstream
  // Get all medical history for a user
  async getUserMedicalHistory(userId: string): Promise<MedicalHistory[]> {
    try {
      const q = query(
        collection(db, 'medicalHistory'),
        where('userId', '==', userId),
        orderBy('diagnosedDate', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const medicalHistory: MedicalHistory[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        medicalHistory.push({
          id: doc.id,
          ...data,
          diagnosedDate: data.diagnosedDate?.toDate() || null,
        } as MedicalHistory);
      });

      return medicalHistory;
    } catch (error) {
      console.error('Error getting medical history:', error);
      throw error;
    }
  },

  // Get family medical history for a user
  async getFamilyMedicalHistory(userId: string): Promise<MedicalHistory[]> {
    try {
      const q = query(
        collection(db, 'medicalHistory'),
        where('userId', '==', userId),
        where('isFamily', '==', true),
        orderBy('diagnosedDate', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const familyHistory: MedicalHistory[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        familyHistory.push({
          id: doc.id,
          ...data,
          diagnosedDate: data.diagnosedDate?.toDate() || null,
        } as MedicalHistory);
      });

      return familyHistory;
    } catch (error) {
      console.error('Error getting family medical history:', error);
      throw error;
    }
=======
  async getUserMedicalHistory(userId: string, limitCount?: number): Promise<MedicalHistory[]> {
    const cached = _medHistoryCache.get(userId);
    if (cached && Date.now() - cached.timestamp < MED_HISTORY_CACHE_TTL) {
      return cached.history;
    }

    const url = limitCount
      ? `/api/health/medical-history?limit=${limitCount}`
      : "/api/health/medical-history";

    const raw = await api.get<Record<string, unknown>[]>(url);
    const history = (raw ?? []).map(normalizeMedicalHistory);

    _medHistoryCache.set(userId, { history, timestamp: Date.now() });
    return history;
  },

  // Returns own medical history entries that are marked as family history
  async getFamilyMedicalHistory(userId: string): Promise<MedicalHistory[]> {
    const all = await this.getUserMedicalHistory(userId);
    return all.filter((h) => h.isFamily);
>>>>>>> Stashed changes
  },

  // Add new medical history entry
  async addMedicalHistory(
    userId: string,
<<<<<<< Updated upstream
    medicalHistoryData: Omit<MedicalHistory, 'id' | 'userId'>
  ): Promise<string> {
    try {
      const docData = {
        userId,
        ...medicalHistoryData,
        diagnosedDate: medicalHistoryData.diagnosedDate
          ? Timestamp.fromDate(medicalHistoryData.diagnosedDate)
          : null,
      };

      const docRef = await addDoc(collection(db, 'medicalHistory'), docData);
      console.log('✅ Medical history entry added successfully');
      return docRef.id;
    } catch (error) {
      console.error('Error adding medical history:', error);
      throw error;
    }
=======
    data: Omit<MedicalHistory, "id" | "userId">
  ): Promise<string> {
    const created = await api.post<Record<string, unknown>>("/api/health/medical-history", {
      condition: data.condition,
      severity: data.severity,
      diagnosedDate: data.diagnosedDate?.toISOString(),
      notes: data.notes?.trim() || undefined,
      isFamily: data.isFamily,
      relation: data.relation?.trim() || undefined,
      familyMemberId: data.familyMemberId?.trim() || undefined,
      familyMemberName: data.familyMemberName?.trim() || undefined,
      tags: data.tags,
    });
    _medHistoryCache.delete(userId);
    return created.id as string;
>>>>>>> Stashed changes
  },

  // Update medical history entry
  async updateMedicalHistory(
    historyId: string,
    updates: Partial<Omit<MedicalHistory, 'id' | 'userId'>>
  ): Promise<void> {
<<<<<<< Updated upstream
    try {
      const updateData: any = { ...updates };

      if (updates.diagnosedDate) {
        updateData.diagnosedDate = Timestamp.fromDate(updates.diagnosedDate);
      }

      await updateDoc(doc(db, 'medicalHistory', historyId), updateData);
      console.log('✅ Medical history entry updated successfully');
    } catch (error) {
      console.error('Error updating medical history:', error);
      throw error;
    }
=======
    const body: Record<string, unknown> = {};

    if (updates.condition !== undefined) body.condition = updates.condition;
    if (updates.severity !== undefined) body.severity = updates.severity;
    if (updates.isFamily !== undefined) body.isFamily = updates.isFamily;
    if (updates.diagnosedDate !== undefined) {
      body.diagnosedDate = updates.diagnosedDate ? updates.diagnosedDate.toISOString() : null;
    }
    if (updates.notes !== undefined) {
      body.notes = updates.notes?.trim() || null;
    }
    if (updates.relation !== undefined) {
      body.relation = updates.relation?.trim() || null;
    }
    if (updates.familyMemberId !== undefined) {
      body.familyMemberId = updates.familyMemberId?.trim() || null;
    }
    if (updates.familyMemberName !== undefined) {
      body.familyMemberName = updates.familyMemberName?.trim() || null;
    }
    if (updates.tags !== undefined) body.tags = updates.tags;

    await api.patch(`/api/health/medical-history/${historyId}`, body);
>>>>>>> Stashed changes
  },

  // Delete medical history entry
  async deleteMedicalHistory(historyId: string): Promise<void> {
<<<<<<< Updated upstream
    try {
      await deleteDoc(doc(db, 'medicalHistory', historyId));
      console.log('✅ Medical history entry deleted successfully');
    } catch (error) {
      console.error('Error deleting medical history:', error);
      throw error;
    }
  },

  // Get single medical history entry
  async getMedicalHistoryById(
    historyId: string
  ): Promise<MedicalHistory | null> {
    try {
      const docSnap = await getDoc(doc(db, 'medicalHistory', historyId));

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          diagnosedDate: data.diagnosedDate?.toDate() || null,
        } as MedicalHistory;
      }

      return null;
    } catch (error) {
      console.error('Error getting medical history by ID:', error);
      throw error;
=======
    await api.delete(`/api/health/medical-history/${historyId}`);
    _medHistoryCache.clear();
  },

  async getMedicalHistoryById(historyId: string): Promise<MedicalHistory | null> {
    try {
      const raw = await api.get<Record<string, unknown>>(`/api/health/medical-history/${historyId}`);
      if (!raw || (raw as { error?: string }).error) return null;
      return normalizeMedicalHistory(raw);
    } catch {
      return null;
>>>>>>> Stashed changes
    }
  },

  // Get medical conditions by severity
  async getMedicalHistoryBySeverity(
    userId: string,
    severity: 'mild' | 'moderate' | 'severe'
  ): Promise<MedicalHistory[]> {
<<<<<<< Updated upstream
    try {
      const q = query(
        collection(db, 'medicalHistory'),
        where('userId', '==', userId),
        where('severity', '==', severity),
        orderBy('diagnosedDate', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const medicalHistory: MedicalHistory[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        medicalHistory.push({
          id: doc.id,
          ...data,
          diagnosedDate: data.diagnosedDate?.toDate() || null,
        } as MedicalHistory);
      });

      return medicalHistory;
    } catch (error) {
      console.error('Error getting medical history by severity:', error);
      throw error;
    }
  },

  // Search medical history by condition name
  async searchMedicalHistory(
    userId: string,
    searchTerm: string
  ): Promise<MedicalHistory[]> {
    try {
      // Note: This is a simple client-side search since Firestore doesn't support
      // text search without additional setup. For production, consider using
      // Algolia or implementing compound queries.
      const allHistory = await this.getUserMedicalHistory(userId);

      return allHistory.filter(
        (history) =>
          history.condition.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (history.notes &&
            history.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } catch (error) {
      console.error('Error searching medical history:', error);
      throw error;
    }
=======
    const all = await this.getUserMedicalHistory(userId);
    return all.filter((h) => h.severity === severity);
  },

  async searchMedicalHistory(userId: string, searchTerm: string): Promise<MedicalHistory[]> {
    const all = await this.getUserMedicalHistory(userId);
    return all.filter(
      (h) =>
        h.condition.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );
>>>>>>> Stashed changes
  },

  // Get summary statistics
  async getMedicalHistorySummary(userId: string) {
<<<<<<< Updated upstream
    try {
      const allHistory = await this.getUserMedicalHistory(userId);
      const familyHistory = allHistory.filter((h) => h.isFamily);
      const personalHistory = allHistory.filter((h) => !h.isFamily);

      const severityCounts = {
        mild: allHistory.filter((h) => h.severity === 'mild').length,
        moderate: allHistory.filter((h) => h.severity === 'moderate').length,
        severe: allHistory.filter((h) => h.severity === 'severe').length,
      };

      return {
        totalEntries: allHistory.length,
        personalEntries: personalHistory.length,
        familyEntries: familyHistory.length,
        severityCounts,
        conditions: allHistory.map((h) => h.condition),
      };
    } catch (error) {
      console.error('Error getting medical history summary:', error);
      throw error;
    }
=======
    const all = await this.getUserMedicalHistory(userId);
    const familyHistory = all.filter((h) => h.isFamily);
    const personalHistory = all.filter((h) => !h.isFamily);

    const severityCounts = {
      mild: all.filter((h) => h.severity === "mild").length,
      moderate: all.filter((h) => h.severity === "moderate").length,
      severe: all.filter((h) => h.severity === "severe").length,
    };

    return {
      totalEntries: all.length,
      personalEntries: personalHistory.length,
      familyEntries: familyHistory.length,
      severityCounts,
      conditions: all.map((h) => h.condition),
    };
>>>>>>> Stashed changes
  },
};
