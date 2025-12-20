import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MedicalHistory } from "@/types";

export const medicalHistoryService = {
  async getUserMedicalHistory(userId: string): Promise<MedicalHistory[]> {
    try {
      const q = query(
        collection(db, "medicalHistory"),
        where("userId", "==", userId),
        orderBy("diagnosedDate", "desc")
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
      // Silently handle error
      throw error;
    }
  },

  async getFamilyMedicalHistory(userId: string): Promise<MedicalHistory[]> {
    try {
      const q = query(
        collection(db, "medicalHistory"),
        where("userId", "==", userId),
        where("isFamily", "==", true),
        orderBy("diagnosedDate", "desc")
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
      // Silently handle error getting family medical history:", error);
      throw error;
    }
  },

  async addMedicalHistory(
    userId: string,
    medicalHistoryData: Omit<MedicalHistory, "id" | "userId">
  ): Promise<string> {
    try {
      const cleanedData: any = {
        userId,
        condition: medicalHistoryData.condition,
        severity: medicalHistoryData.severity,
        isFamily: medicalHistoryData.isFamily,
        diagnosedDate: medicalHistoryData.diagnosedDate
          ? Timestamp.fromDate(medicalHistoryData.diagnosedDate)
          : null,
      };

      if (
        medicalHistoryData.notes &&
        typeof medicalHistoryData.notes === "string" &&
        medicalHistoryData.notes.trim() !== ""
      ) {
        cleanedData.notes = medicalHistoryData.notes.trim();
      }
      if (
        medicalHistoryData.relation &&
        typeof medicalHistoryData.relation === "string" &&
        medicalHistoryData.relation.trim() !== ""
      ) {
        cleanedData.relation = medicalHistoryData.relation.trim();
      }
      if (
        medicalHistoryData.familyMemberId &&
        typeof medicalHistoryData.familyMemberId === "string" &&
        medicalHistoryData.familyMemberId.trim() !== ""
      ) {
        cleanedData.familyMemberId = medicalHistoryData.familyMemberId.trim();
      }
      if (
        medicalHistoryData.familyMemberName &&
        typeof medicalHistoryData.familyMemberName === "string" &&
        medicalHistoryData.familyMemberName.trim() !== ""
      ) {
        cleanedData.familyMemberName = medicalHistoryData.familyMemberName.trim();
      }

      const docRef = await addDoc(
        collection(db, "medicalHistory"),
        cleanedData
      );
      return docRef.id;
    } catch (error) {
      // Silently handle error adding medical history:", error);
      throw error;
    }
  },

  async updateMedicalHistory(
    historyId: string,
    updates: Partial<Omit<MedicalHistory, "id" | "userId">>
  ): Promise<void> {
    try {
      const updateData: any = {};

      if (updates.condition !== undefined) {
        updateData.condition = updates.condition;
      }
      if (updates.severity !== undefined) {
        updateData.severity = updates.severity;
      }
      if (updates.isFamily !== undefined) {
        updateData.isFamily = updates.isFamily;
      }
      if (updates.diagnosedDate !== undefined) {
        updateData.diagnosedDate = updates.diagnosedDate
          ? Timestamp.fromDate(updates.diagnosedDate)
          : null;
      }
      if (updates.notes !== undefined) {
        updateData.notes =
          updates.notes &&
          typeof updates.notes === "string" &&
          updates.notes.trim() !== ""
            ? updates.notes.trim()
            : null;
      }
      if (updates.relation !== undefined) {
        updateData.relation =
          updates.relation &&
          typeof updates.relation === "string" &&
          updates.relation.trim() !== ""
            ? updates.relation.trim()
            : null;
      }
      if (updates.familyMemberId !== undefined) {
        updateData.familyMemberId =
          updates.familyMemberId &&
          typeof updates.familyMemberId === "string" &&
          updates.familyMemberId.trim() !== ""
            ? updates.familyMemberId.trim()
            : null;
      }
      if (updates.familyMemberName !== undefined) {
        updateData.familyMemberName =
          updates.familyMemberName &&
          typeof updates.familyMemberName === "string" &&
          updates.familyMemberName.trim() !== ""
            ? updates.familyMemberName.trim()
            : null;
      }

      await updateDoc(doc(db, "medicalHistory", historyId), updateData);
    } catch (error) {
      // Silently handle error updating medical history:", error);
      throw error;
    }
  },

  async deleteMedicalHistory(historyId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "medicalHistory", historyId));
    } catch (error) {
      // Silently handle error deleting medical history:", error);
      throw error;
    }
  },

  async getMedicalHistoryById(
    historyId: string
  ): Promise<MedicalHistory | null> {
    try {
      const docSnap = await getDoc(doc(db, "medicalHistory", historyId));

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
      // Silently handle error getting medical history by ID:", error);
      throw error;
    }
  },

  async getMedicalHistoryBySeverity(
    userId: string,
    severity: "mild" | "moderate" | "severe"
  ): Promise<MedicalHistory[]> {
    try {
      const q = query(
        collection(db, "medicalHistory"),
        where("userId", "==", userId),
        where("severity", "==", severity),
        orderBy("diagnosedDate", "desc")
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
      // Silently handle error getting medical history by severity:", error);
      throw error;
    }
  },

  async searchMedicalHistory(
    userId: string,
    searchTerm: string
  ): Promise<MedicalHistory[]> {
    try {
      const allHistory = await this.getUserMedicalHistory(userId);

      return allHistory.filter(
        (history) =>
          history.condition.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (history.notes &&
            history.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    } catch (error) {
      // Silently handle error searching medical history:", error);
      throw error;
    }
  },

  async getMedicalHistorySummary(userId: string) {
    try {
      const allHistory = await this.getUserMedicalHistory(userId);
      const familyHistory = allHistory.filter((h) => h.isFamily);
      const personalHistory = allHistory.filter((h) => !h.isFamily);

      const severityCounts = {
        mild: allHistory.filter((h) => h.severity === "mild").length,
        moderate: allHistory.filter((h) => h.severity === "moderate").length,
        severe: allHistory.filter((h) => h.severity === "severe").length,
      };

      return {
        totalEntries: allHistory.length,
        personalEntries: personalHistory.length,
        familyEntries: familyHistory.length,
        severityCounts,
        conditions: allHistory.map((h) => h.condition),
      };
    } catch (error) {
      // Silently handle error getting medical history summary:", error);
      throw error;
    }
  },
};
