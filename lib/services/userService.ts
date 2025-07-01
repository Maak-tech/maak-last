import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types';

export const userService = {
  // Get user by ID
  async getUser(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          id: userDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as User;
      }
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  },

  // Create new user
  async createUser(userId: string, userData: Omit<User, 'id'>): Promise<void> {
    try {
      const userDocData = {
        ...userData,
        createdAt: Timestamp.fromDate(userData.createdAt),
      };
      await setDoc(doc(db, 'users', userId), userDocData);
      console.log('✅ User document created successfully in Firestore');
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Ensure user document exists (create if it doesn't)
  async ensureUserDocument(
    userId: string,
    email: string,
    name: string
  ): Promise<User> {
    try {
      console.log('🔍 Checking if user document exists for:', userId);

      // First try to get existing user
      const existingUser = await this.getUser(userId);
      if (existingUser) {
        console.log('✅ User document already exists');
        return existingUser;
      }

      console.log('📝 Creating new user document...');

      // Create new user document with default values
      const newUserData: Omit<User, 'id'> = {
        email,
        name,
        role: 'admin', // First user in family is admin
        createdAt: new Date(),
        onboardingCompleted: true, // Set to true since they've signed up
        preferences: {
          language: 'en',
          notifications: true,
          emergencyContacts: [],
        },
      };

      await this.createUser(userId, newUserData);

      // Return the created user
      const createdUser = await this.getUser(userId);
      if (!createdUser) {
        throw new Error('Failed to create user document');
      }

      console.log('✅ User document created and verified');
      return createdUser;
    } catch (error) {
      console.error('Error ensuring user document:', error);
      throw error;
    }
  },

  // Update user
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const updateData: any = { ...updates };
      if (updates.createdAt) {
        updateData.createdAt = Timestamp.fromDate(updates.createdAt);
      }
      await updateDoc(doc(db, 'users', userId), updateData);
      console.log('✅ User document updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Get family members
  async getFamilyMembers(familyId: string): Promise<User[]> {
    try {
      // First check if family is active
      const familyDoc = await getDoc(doc(db, 'families', familyId));
      if (!familyDoc.exists()) {
        console.log('Family not found:', familyId);
        return [];
      }

      const familyData = familyDoc.data();
      if (familyData.status === 'inactive') {
        console.log('Family is inactive:', familyId);
        return [];
      }

      const q = query(
        collection(db, 'users'),
        where('familyId', '==', familyId)
      );
      const querySnapshot = await getDocs(q);
      const members: User[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        members.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as User);
      });

      return members;
    } catch (error) {
      console.error('Error getting family members:', error);
      throw error;
    }
  },

  // Join family
  async joinFamily(userId: string, familyId: string): Promise<void> {
    try {
      console.log(`🔄 User ${userId} joining family ${familyId}`);

      // Get current user to check existing family
      const currentUser = await this.getUser(userId);
      console.log('📋 Current user data:', {
        userId,
        currentFamilyId: currentUser?.familyId,
        userName: currentUser?.name,
      });
      const oldFamilyId = currentUser?.familyId;

      // Handle leaving previous family if exists
      if (oldFamilyId && oldFamilyId !== familyId) {
        console.log(`🚪 Leaving previous family: ${oldFamilyId}`);
        await this.leavePreviousFamily(userId, oldFamilyId);
        console.log(`✅ Left previous family: ${oldFamilyId}`);
      }

      // Update user with new family ID and member role (unless they're creating their own family)
      console.log(`📝 Updating user ${userId} with new familyId: ${familyId}`);

      // Check if this user is the creator of the family
      const familyDoc = await getDoc(doc(db, 'families', familyId));
      let role: 'admin' | 'member' = 'member'; // Default to member

      if (familyDoc.exists()) {
        const familyData = familyDoc.data();
        if (familyData.createdBy === userId) {
          role = 'admin'; // Family creator remains admin
        }
      }

      await updateDoc(doc(db, 'users', userId), {
        familyId,
        role, // Set appropriate role
      });
      console.log(
        `✅ User document updated with familyId: ${familyId} and role: ${role}`
      );

      // Add user to the new family's members list
      console.log(`👥 Getting family document: ${familyId}`);
      if (familyDoc.exists()) {
        const familyData = familyDoc.data();
        console.log('📋 Current family data:', {
          familyId,
          familyName: familyData.name,
          currentMembers: familyData.members,
          status: familyData.status,
        });
        const members = familyData.members || [];

        // Add user to members if not already there
        if (!members.includes(userId)) {
          console.log(`➕ Adding user ${userId} to family members list`);
          const updatedMembers = [...members, userId];
          await updateDoc(doc(db, 'families', familyId), {
            members: updatedMembers,
            status: 'active', // Ensure family is active when someone joins
          });
          console.log(`✅ User added to family. New members:`, updatedMembers);
        } else {
          console.log(`ℹ️ User ${userId} already in family members list`);
        }
      } else {
        console.error(`❌ Family document ${familyId} does not exist!`);
        throw new Error(`Family ${familyId} not found`);
      }

      console.log('✅ User joined family successfully');
    } catch (error) {
      console.error('❌ Error joining family:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  },

  // Leave previous family and handle family status
  async leavePreviousFamily(userId: string, familyId: string): Promise<void> {
    try {
      console.log(`🚪 User ${userId} leaving family ${familyId}`);

      const familyDoc = await getDoc(doc(db, 'families', familyId));
      if (familyDoc.exists()) {
        const familyData = familyDoc.data();
        const members = familyData.members || [];
        const updatedMembers = members.filter(
          (memberId: string) => memberId !== userId
        );

        if (updatedMembers.length === 0) {
          // User was the only member - mark family as inactive
          await updateDoc(doc(db, 'families', familyId), {
            members: updatedMembers,
            status: 'inactive',
          });
          console.log(
            `👨‍👩‍👧‍👦 Family ${familyId} marked as inactive (no members left)`
          );
        } else {
          // Other members exist - just remove this user
          await updateDoc(doc(db, 'families', familyId), {
            members: updatedMembers,
          });
          console.log(
            `👥 User removed from family ${familyId} (${updatedMembers.length} members remain)`
          );
        }
      }
    } catch (error) {
      console.error('Error leaving previous family:', error);
      // Don't throw error here - joining new family is more important
    }
  },

  // Create family
  async createFamily(
    userId: string,
    familyName: string = 'My Family'
  ): Promise<string> {
    try {
      const familyData = {
        name: familyName,
        createdBy: userId,
        members: [userId],
        status: 'active' as const,
        createdAt: Timestamp.now(),
      };

      // Create a new family document
      const familyRef = doc(collection(db, 'families'));
      await setDoc(familyRef, familyData);

      // Update user with family ID
      await this.updateUser(userId, { familyId: familyRef.id });

      console.log('✅ Family created successfully with ID:', familyRef.id);
      return familyRef.id;
    } catch (error) {
      console.error('Error creating family:', error);
      throw error;
    }
  },

  // Check if user is admin of their family
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      return user?.role === 'admin';
    } catch (error) {
      console.error('Error checking if user is admin:', error);
      return false;
    }
  },

  // Update user role (only for admins)
  async updateUserRole(
    userId: string,
    newRole: 'admin' | 'member',
    requestingUserId: string
  ): Promise<void> {
    try {
      // Check if the requesting user is an admin
      const isAdmin = await this.isUserAdmin(requestingUserId);
      if (!isAdmin) {
        throw new Error('Only admins can update user roles');
      }

      await updateDoc(doc(db, 'users', userId), { role: newRole });
      console.log(`✅ User ${userId} role updated to ${newRole}`);
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },
};
