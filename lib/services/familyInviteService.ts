<<<<<<< Updated upstream
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  Timestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FamilyInvitationCode, Family } from '@/types';
=======
/**
 * Family invite service — Firebase-free replacement.
 *
 * Replaced Firestore reads/writes on `familyInvitations` collection with:
 *   POST /api/family/invitations                → createInvitationCode
 *   GET  /api/family/invitations/code/:code     → getInvitationByCode
 *   POST /api/family/invitations/code/:code/use → useInvitationCode
 *   GET  /api/family/:familyId/invitations      → getFamilyInvitations
 *   POST /api/family/invitations/cleanup        → cleanupExpiredInvitations
 *   GET  /api/family/:familyId                  → getFamily
 *
 * Column mapping (Neon ↔ client):
 *   `inviteCode` (Neon) ↔ `code` (FamilyInvitationCode)
 *   `memberIds`  (API)  ↔ `members` (Family)
 */

import { api } from "@/lib/apiClient";
import type { Family, FamilyInvitationCode } from "@/types";
>>>>>>> Stashed changes

/** Normalize a raw API invitation row to the client FamilyInvitationCode type */
const normalizeInvitation = (raw: Record<string, unknown>): FamilyInvitationCode => ({
  id: raw.id as string,
  code: (raw.inviteCode ?? raw.code) as string,
  familyId: raw.familyId as string,
  invitedBy: raw.invitedBy as string,
  invitedUserName: (raw.invitedUserName ?? "") as string,
  invitedUserRelation: (raw.invitedUserRelation ?? "") as string,
  status: (raw.status ?? "pending") as FamilyInvitationCode["status"],
  createdAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
  expiresAt: raw.expiresAt ? new Date(raw.expiresAt as string) : new Date(),
  usedAt: raw.usedAt ? new Date(raw.usedAt as string) : undefined,
});

export const familyInviteService = {
  // Generate a random 6-digit invitation code (client-side only; server generates the real one)
  generateInviteCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // Create a new family invitation code
  async createInvitationCode(
    familyId: string,
    invitedBy: string,
    invitedUserName: string,
    invitedUserRelation: string
  ): Promise<string> {
<<<<<<< Updated upstream
    try {
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

      const inviteData: Omit<FamilyInvitationCode, 'id'> = {
        code,
=======
    if (!(familyId && invitedBy && invitedUserName && invitedUserRelation)) {
      throw new Error(
        `Missing required parameters: familyId=${!!familyId}, invitedBy=${!!invitedBy}, invitedUserName=${!!invitedUserName}, invitedUserRelation=${!!invitedUserRelation}`
      );
    }

    try {
      const result = await api.post<{ code: string }>("/api/family/invitations", {
>>>>>>> Stashed changes
        familyId,
        invitedUserName,
        invitedUserRelation,
<<<<<<< Updated upstream
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };

      const docRef = await addDoc(collection(db, 'familyInvitations'), {
        ...inviteData,
        createdAt: Timestamp.fromDate(inviteData.createdAt),
        expiresAt: Timestamp.fromDate(inviteData.expiresAt),
      });

      console.log('✅ Family invitation code created:', code);
      return code;
    } catch (error) {
      console.error('Error creating invitation code:', error);
      throw error;
=======
      });
      return result.code;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to create invitation: ${msg}`);
>>>>>>> Stashed changes
    }
  },

  // Get invitation by code
<<<<<<< Updated upstream
  async getInvitationByCode(
    code: string
  ): Promise<FamilyInvitationCode | null> {
    try {
      const q = query(
        collection(db, 'familyInvitations'),
        where('code', '==', code)
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
      console.error('Error getting invitation by code:', error);
      throw error;
=======
  async getInvitationByCode(code: string): Promise<FamilyInvitationCode | null> {
    try {
      const raw = await api.get<Record<string, unknown>>(
        `/api/family/invitations/code/${code}`
      );
      if (!raw || (raw as { error?: string }).error) return null;
      return normalizeInvitation(raw);
    } catch {
      return null;
>>>>>>> Stashed changes
    }
  },

  // Use/claim an invitation code
  async useInvitationCode(
    code: string,
    userId: string
<<<<<<< Updated upstream
  ): Promise<{
    success: boolean;
    familyId?: string;
    message: string;
  }> {
    try {
      const invitation = await this.getInvitationByCode(code);

      if (!invitation) {
        return { success: false, message: 'Invalid invitation code' };
      }

      if (invitation.status === 'used') {
        return {
          success: false,
          message: 'This invitation code has already been used',
        };
      }

      if (
        invitation.status === 'expired' ||
        invitation.expiresAt < new Date()
      ) {
        return { success: false, message: 'This invitation code has expired' };
      }

      // Mark invitation as used
      await updateDoc(doc(db, 'familyInvitations', invitation.id), {
        status: 'used',
        usedAt: Timestamp.now(),
        usedBy: userId,
      });

      console.log('✅ Invitation code used successfully');
      return {
        success: true,
        familyId: invitation.familyId,
        message: 'Successfully joined family!',
      };
    } catch (error) {
      console.error('Error using invitation code:', error);
      throw error;
    }
  },

  // Get active invitations for a family
  async getFamilyInvitations(
    familyId: string
  ): Promise<FamilyInvitationCode[]> {
    try {
      const q = query(
        collection(db, 'familyInvitations'),
        where('familyId', '==', familyId),
        where('status', '==', 'pending')
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
      console.error('Error getting family invitations:', error);
      throw error;
=======
  ): Promise<{ success: boolean; familyId?: string; message: string }> {
    try {
      const result = await api.post<{
        ok: boolean;
        familyId?: string;
        message?: string;
      }>(`/api/family/invitations/code/${code}/use`, {});

      if (result.ok) {
        return {
          success: true,
          familyId: result.familyId,
          message: result.message ?? "Successfully joined family!",
        };
      }
      return {
        success: false,
        message: result.message ?? "Failed to use invitation code",
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to use invitation code";
      return { success: false, message: msg };
    }
  },

  // Get active (pending) invitations for a family
  async getFamilyInvitations(familyId: string): Promise<FamilyInvitationCode[]> {
    try {
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/family/${familyId}/invitations`
      );
      return (raw ?? []).map(normalizeInvitation);
    } catch {
      return [];
>>>>>>> Stashed changes
    }
  },

  // Clean up expired invitations (best-effort)
  async cleanupExpiredInvitations(): Promise<void> {
    try {
<<<<<<< Updated upstream
      const q = query(
        collection(db, 'familyInvitations'),
        where('expiresAt', '<', Timestamp.now())
      );
      const querySnapshot = await getDocs(q);

      const updatePromises = querySnapshot.docs.map((doc) =>
        updateDoc(doc.ref, { status: 'expired' })
      );

      await Promise.all(updatePromises);
      console.log('✅ Cleaned up expired invitations');
    } catch (error) {
      console.error('Error cleaning up expired invitations:', error);
      throw error;
=======
      await api.post("/api/family/invitations/cleanup", {});
    } catch {
      // best-effort — ignore errors
>>>>>>> Stashed changes
    }
  },

  // Get family by ID
  async getFamily(familyId: string): Promise<Family | null> {
    try {
<<<<<<< Updated upstream
      const familyDoc = await getDoc(doc(db, 'families', familyId));

      if (!familyDoc.exists()) {
        return null;
      }

      const data = familyDoc.data();
      return {
        id: familyDoc.id,
        name: data.name,
        createdBy: data.createdBy,
        members: data.members || [],
        status: data.status || 'active', // Default to active for backward compatibility
        createdAt: data.createdAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting family:', error);
=======
      const raw = await api.get<Record<string, unknown>>(`/api/family/${familyId}`);
      if (!raw || (raw as { error?: string }).error) return null;
      return {
        id: raw.id as string,
        name: (raw.name ?? "") as string,
        createdBy: raw.createdBy as string,
        members: (raw.memberIds as string[] | undefined) ?? [],
        status: (raw.status ?? "active") as Family["status"],
        createdAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
      };
    } catch {
>>>>>>> Stashed changes
      return null;
    }
  },
};
