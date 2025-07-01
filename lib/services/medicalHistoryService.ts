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

export const medicalHistoryService = {
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
  },

  // Add new medical history entry
  async addMedicalHistory(
    userId: string,
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
  },

  // Update medical history entry
  async updateMedicalHistory(
    historyId: string,
    updates: Partial<Omit<MedicalHistory, 'id' | 'userId'>>
  ): Promise<void> {
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
  },

  // Delete medical history entry
  async deleteMedicalHistory(historyId: string): Promise<void> {
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
    }
  },

  // Get medical conditions by severity
  async getMedicalHistoryBySeverity(
    userId: string,
    severity: 'mild' | 'moderate' | 'severe'
  ): Promise<MedicalHistory[]> {
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
  },

  // Get summary statistics
  async getMedicalHistorySummary(userId: string) {
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
  },
};
