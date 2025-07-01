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

export const familyInviteService = {
  // Generate a random 6-digit invitation code
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
        familyId,
        invitedBy,
        invitedUserName,
        invitedUserRelation,
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
    }
  },

  // Get invitation by code
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
    }
  },

  // Clean up expired invitations
  async cleanupExpiredInvitations(): Promise<void> {
    try {
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
    }
  },

  // Get family by ID
  async getFamily(familyId: string): Promise<Family | null> {
    try {
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
      return null;
    }
  },
};
