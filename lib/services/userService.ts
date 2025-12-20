import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "@/types";

export const userService = {
  // Get user by ID
  async getUser(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
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
      throw error;
    }
  },

  // Create new user
  async createUser(userId: string, userData: Omit<User, "id">): Promise<void> {
    try {
      const userDocData = {
        ...userData,
        createdAt: Timestamp.fromDate(userData.createdAt),
      };
      await setDoc(doc(db, "users", userId), userDocData);
    } catch (error) {
      throw error;
    }
  },

  // Ensure user document exists (create if it doesn't)
  async ensureUserDocument(
    userId: string,
    email: string,
    firstName: string,
    lastName: string
  ): Promise<User> {
    try {
      const existingUser = await this.getUser(userId);
      if (existingUser) {
        // Migrate old name field if needed
        if (!existingUser.firstName && !existingUser.lastName && (existingUser as any).name) {
          const nameParts = ((existingUser as any).name as string).split(" ");
          const migratedFirstName = nameParts[0] || "User";
          const migratedLastName = nameParts.slice(1).join(" ") || "";
          await this.updateUser(userId, {
            firstName: migratedFirstName,
            lastName: migratedLastName,
          });
          return { ...existingUser, firstName: migratedFirstName, lastName: migratedLastName };
        }
        return existingUser;
      }

      // Create new user document with default values
      const newUserData: Omit<User, "id"> = {
        email,
        firstName,
        lastName,
        role: "admin", // First user in family is admin
        createdAt: new Date(),
        onboardingCompleted: false, // New users should see onboarding flow
        preferences: {
          language: "en",
          notifications: true,
          emergencyContacts: [],
        },
      };

      await this.createUser(userId, newUserData);

      // Return the created user
      const createdUser = await this.getUser(userId);
      if (!createdUser) {
        throw new Error("Failed to create user document");
      }

      return createdUser;
    } catch (error) {
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
      await updateDoc(doc(db, "users", userId), updateData);
    } catch (error) {
      throw error;
    }
  },

  // Get family members
  async getFamilyMembers(familyId: string): Promise<User[]> {
    try {
      // First check if family is active
      const familyDoc = await getDoc(doc(db, "families", familyId));
      if (!familyDoc.exists()) {
        return [];
      }

      const familyData = familyDoc.data();
      if (familyData.status === "inactive") {
        return [];
      }

      const q = query(
        collection(db, "users"),
        where("familyId", "==", familyId)
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
      throw error;
    }
  },

  // Join family
  async joinFamily(userId: string, familyId: string): Promise<void> {
    try {
      // Get current user to check existing family
      const currentUser = await this.getUser(userId);
      const oldFamilyId = currentUser?.familyId;

      if (oldFamilyId && oldFamilyId !== familyId) {
        await this.leavePreviousFamily(userId, oldFamilyId);
      }

      // Check if this user is the creator of the family
      const familyDoc = await getDoc(doc(db, "families", familyId));
      let role: "admin" | "member" = "member"; // Default to member

      if (familyDoc.exists()) {
        const familyData = familyDoc.data();
        if (familyData.createdBy === userId) {
          role = "admin"; // Family creator remains admin
        }
      }

      await updateDoc(doc(db, "users", userId), {
        familyId,
        role,
      });

      if (familyDoc.exists()) {
        const familyData = familyDoc.data();
        const members = familyData.members || [];

        if (!members.includes(userId)) {
          const updatedMembers = [...members, userId];
          await updateDoc(doc(db, "families", familyId), {
            members: updatedMembers,
            status: "active",
          });
        }
      } else {
        throw new Error(`Family ${familyId} not found`);
      }
    } catch (error) {
      throw error;
    }
  },

  // Leave previous family and handle family status
  async leavePreviousFamily(userId: string, familyId: string): Promise<void> {
    try {

      const familyDoc = await getDoc(doc(db, "families", familyId));
      if (familyDoc.exists()) {
        const familyData = familyDoc.data();
        const members = familyData.members || [];
        const updatedMembers = members.filter(
          (memberId: string) => memberId !== userId
        );

        if (updatedMembers.length === 0) {
          // User was the only member - mark family as inactive
          await updateDoc(doc(db, "families", familyId), {
            members: updatedMembers,
            status: "inactive",
          });
        } else {
          // Other members exist - just remove this user
          await updateDoc(doc(db, "families", familyId), {
            members: updatedMembers,
          });
        }
      }
    } catch (error) {
      // Don't throw error here - joining new family is more important
    }
  },

  // Create family
  async createFamily(
    userId: string,
    familyName = "My Family"
  ): Promise<string> {
    try {
      const familyData = {
        name: familyName,
        createdBy: userId,
        members: [userId],
        status: "active" as const,
        createdAt: Timestamp.now(),
      };

      // Create a new family document
      const familyRef = doc(collection(db, "families"));
      await setDoc(familyRef, familyData);

      // Update user with family ID
      await this.updateUser(userId, { familyId: familyRef.id });

      return familyRef.id;
    } catch (error) {
      throw error;
    }
  },

  // Check if user is admin of their family
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      return user?.role === "admin";
    } catch (error) {
      return false;
    }
  },

  // Update user role (only for admins)
  async updateUserRole(
    userId: string,
    newRole: "admin" | "member",
    requestingUserId: string
  ): Promise<void> {
    try {
      // Check if the requesting user is an admin
      const isAdmin = await this.isUserAdmin(requestingUserId);
      if (!isAdmin) {
        throw new Error("Only admins can update user roles");
      }

      await updateDoc(doc(db, "users", userId), { role: newRole });
    } catch (error) {
      throw error;
    }
  },
};
