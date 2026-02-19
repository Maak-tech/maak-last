import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const patientService = {
  // Get patient data by userId
  async getPatientByUserId(userId: string): Promise<{
    gender?: "male" | "female" | "other";
    dateOfBirth?: Date;
    bloodType?: string;
  } | null> {
    try {
      // Try to find patient document by userId
      const q = query(
        collection(db, "patients"),
        where("userId", "==", userId)
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const patientData = querySnapshot.docs[0].data();
        // Only return if it has a familyId (valid patient record)
        if (patientData.familyId) {
          return {
            gender: patientData.gender,
            dateOfBirth: patientData.dateOfBirth?.toDate(),
            bloodType: patientData.bloodType,
          };
        }
      }

      return null;
    } catch (error) {
      // Silently fail - patient data might not exist yet
      return null;
    }
  },

  // Check if user is female
  async isUserFemale(userId: string): Promise<boolean> {
    const patient = await this.getPatientByUserId(userId);
    return patient?.gender === "female";
  },
};
