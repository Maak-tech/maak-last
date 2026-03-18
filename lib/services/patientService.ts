/**
 * Patient service — Firebase-free replacement.
 *
 * Replaced Firestore query on `patients` collection with GET /api/user/profile.
 * The `users` Neon table has gender, dateOfBirth, bloodType fields directly.
 */

import { api } from "@/lib/apiClient";

type UserProfile = {
  id: string;
  gender?: string;
  dateOfBirth?: string;
  bloodType?: string;
  familyId?: string;
};

export const patientService = {
  // Get patient profile data for the current user (userId param ignored — server resolves via session)
  async getPatientByUserId(_userId: string): Promise<{
    gender?: "male" | "female" | "other";
    dateOfBirth?: Date;
    bloodType?: string;
  } | null> {
    try {
      const profile = await api.get<UserProfile>("/api/user/profile");

      if (!profile) return null;

      return {
        gender: profile.gender as "male" | "female" | "other" | undefined,
        dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth) : undefined,
        bloodType: profile.bloodType,
      };
    } catch {
      return null;
    }
  },

  // Check if the current user is female
  async isUserFemale(_userId: string): Promise<boolean> {
    const patient = await this.getPatientByUserId(_userId);
    return patient?.gender === "female";
  },
};
