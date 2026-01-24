import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Family, FamilyInvitationCode } from "@/types";

export const familyInviteService = {
  // Generate a random 6-digit invitation code
  generateInviteCode(): string {
    return Math.floor(100_000 + Math.random() * 900_000).toString();
  },

  // Create a new family invitation code
  async createInvitationCode(
    familyId: string,
    invitedBy: string,
    invitedUserName: string,
    invitedUserRelation: string
  ): Promise<string> {
    try {
      // Validate required parameters
      if (!(familyId && invitedBy && invitedUserName && invitedUserRelation)) {
        throw new Error(
          `Missing required parameters: familyId=${!!familyId}, invitedBy=${!!invitedBy}, invitedUserName=${!!invitedUserName}, invitedUserRelation=${!!invitedUserRelation}`
        );
      }

      // Verify user document exists and has correct familyId before attempting to create invitation
      const { getDoc, doc: firestoreDoc } = await import("firebase/firestore");
      const userDocRef = firestoreDoc(db, "users", invitedBy);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error(
          "User document does not exist. Please ensure you're logged in correctly."
        );
      }

      const userData = userDoc.data();
      if (!userData.familyId) {
        throw new Error(
          "User document does not have a familyId. Please join or create a family first."
        );
      }

      if (userData.familyId !== familyId) {
        throw new Error(
          `User's familyId (${userData.familyId}) does not match invitation familyId (${familyId}).`
        );
      }

      const code = this.generateInviteCode();

      // Check if code already exists (very unlikely but good to check)
      const existingCode = await this.getInvitationByCode(code);
      if (existingCode) {
        // Recursively try again with a new code
        return this.createInvitationCode(
          familyId,
          invitedBy,
          invitedUserName,
          invitedUserRelation
        );
      }

      const inviteData: Omit<FamilyInvitationCode, "id"> = {
        code,
        familyId,
        invitedBy,
        invitedUserName,
        invitedUserRelation,
        status: "pending",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };

      const docRef = await addDoc(collection(db, "familyInvitations"), {
        ...inviteData,
        createdAt: Timestamp.fromDate(inviteData.createdAt),
        expiresAt: Timestamp.fromDate(inviteData.expiresAt),
      });

      return code;
    } catch (error) {
      if (__DEV__) {
        console.error("Failed to create invitation code:", error);
      }
      throw error;
    }
  },

  // Get invitation by code
  async getInvitationByCode(
    code: string
  ): Promise<FamilyInvitationCode | null> {
    try {
      const q = query(
        collection(db, "familyInvitations"),
        where("code", "==", code)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        expiresAt: data.expiresAt.toDate(),
        usedAt: data.usedAt?.toDate(),
      } as FamilyInvitationCode;
    } catch (error) {
      // Silently handle error getting invitation by code:", error);
      throw error;
    }
  },

  // Use/claim an invitation code
  async useInvitationCode(
    code: string,
    userId: string
  ): Promise<{
    success: boolean;
    familyId?: string;
    message: string;
  }> {
    try {
      const invitation = await this.getInvitationByCode(code);

      if (!invitation) {
        return { success: false, message: "Invalid invitation code" };
      }

      if (invitation.status === "used") {
        return {
          success: false,
          message: "This invitation code has already been used",
        };
      }

      if (
        invitation.status === "expired" ||
        invitation.expiresAt < new Date()
      ) {
        return { success: false, message: "This invitation code has expired" };
      }

      // Mark invitation as used
      await updateDoc(doc(db, "familyInvitations", invitation.id), {
        status: "used",
        usedAt: Timestamp.now(),
        usedBy: userId,
      });

      return {
        success: true,
        familyId: invitation.familyId,
        message: "Successfully joined family!",
      };
    } catch (error) {
      // Silently handle error using invitation code:", error);
      throw error;
    }
  },

  // Get active invitations for a family
  async getFamilyInvitations(
    familyId: string
  ): Promise<FamilyInvitationCode[]> {
    try {
      const q = query(
        collection(db, "familyInvitations"),
        where("familyId", "==", familyId),
        where("status", "==", "pending")
      );
      const querySnapshot = await getDocs(q);
      const invitations: FamilyInvitationCode[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        invitations.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          expiresAt: data.expiresAt.toDate(),
          usedAt: data.usedAt?.toDate(),
        } as FamilyInvitationCode);
      });

      return invitations;
    } catch (error) {
      // Silently handle error getting family invitations:", error);
      throw error;
    }
  },

  // Clean up expired invitations
  async cleanupExpiredInvitations(): Promise<void> {
    try {
      const q = query(
        collection(db, "familyInvitations"),
        where("expiresAt", "<", Timestamp.now())
      );
      const querySnapshot = await getDocs(q);

      const updatePromises = querySnapshot.docs.map((doc) =>
        updateDoc(doc.ref, { status: "expired" })
      );

      await Promise.all(updatePromises);
    } catch (error) {
      // Silently handle error cleaning up expired invitations:", error);
      throw error;
    }
  },

  // Get family by ID
  async getFamily(familyId: string): Promise<Family | null> {
    try {
      const familyDoc = await getDoc(doc(db, "families", familyId));

      if (!familyDoc.exists()) {
        return null;
      }

      const data = familyDoc.data();
      return {
        id: familyDoc.id,
        name: data.name,
        createdBy: data.createdBy,
        members: data.members || [],
        status: data.status || "active", // Default to active for backward compatibility
        createdAt: data.createdAt?.toDate() || new Date(),
      };
    } catch (error) {
      // Silently handle error getting family:", error);
      return null;
    }
  },
};
