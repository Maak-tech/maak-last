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
import type { AvatarType, EmergencyContact, User } from "@/types";

const normalizeEmergencyContacts = (
  rawContacts: unknown
): EmergencyContact[] => {
  if (!Array.isArray(rawContacts)) return [];

  const contacts: EmergencyContact[] = [];

  for (const [index, contact] of rawContacts.entries()) {
    if (typeof contact === "string" && contact.trim()) {
      contacts.push({
        id: `legacy-${index}`,
        name: "Emergency Contact",
        phone: contact.trim(),
      });
      continue;
    }

    if (contact && typeof contact === "object") {
      const name =
        typeof (contact as { name?: string }).name === "string"
          ? (contact as { name?: string }).name!.trim()
          : "";
      const phone =
        typeof (contact as { phone?: string }).phone === "string"
          ? (contact as { phone?: string }).phone!.trim()
          : "";
      const id =
        typeof (contact as { id?: string }).id === "string"
          ? (contact as { id?: string }).id!.trim()
          : "";

      if (name && phone) {
        contacts.push({
          id: id || `normalized-${index}`,
          name,
          phone,
        });
      }
    }
  }

  return contacts;
};

export const userService = {
  // Get user by ID
  async getUser(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const preferences = data.preferences || {};
        const normalizedContacts = normalizeEmergencyContacts(
          preferences.emergencyContacts
        );
        return {
          id: userDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          preferences: {
            language: preferences.language || "en",
            notifications:
              preferences.notifications !== undefined
                ? preferences.notifications
                : true,
            emergencyContacts: normalizedContacts,
          },
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
    } catch (error: any) {
      // Provide more specific error messages
      if (error?.code === "permission-denied") {
        throw new Error(
          "Permission denied. Please check your Firestore security rules."
        );
      }
      if (error?.code === "unavailable") {
        throw new Error(
          "Firestore is unavailable. Please check your internet connection."
        );
      }
      if (error?.message) {
        throw new Error(`Failed to create user: ${error.message}`);
      }
      throw error;
    }
  },

  // Ensure user document exists (create if it doesn't)
  async ensureUserDocument(
    userId: string,
    email: string | undefined,
    firstName: string,
    lastName: string,
    avatarType?: AvatarType
  ): Promise<User> {
    try {
      const existingUser = await this.getUser(userId);
      if (existingUser) {
        let needsUpdate = false;
        const updates: Partial<User> = {};

        // Migrate old name field if needed
        if (
          !(existingUser.firstName || existingUser.lastName) &&
          (existingUser as any).name
        ) {
          const nameParts = ((existingUser as any).name as string).split(" ");
          const migratedFirstName = nameParts[0] || "User";
          const migratedLastName = nameParts.slice(1).join(" ") || "";
          updates.firstName = migratedFirstName;
          updates.lastName = migratedLastName;
          needsUpdate = true;
        } else {
          // Update firstName if it's missing, set to default "User", or if we have a better value
          const currentFirstName = existingUser.firstName || "";
          const shouldUpdateFirstName =
            !currentFirstName ||
            currentFirstName === "User" ||
            (firstName &&
              firstName !== "User" &&
              firstName !== currentFirstName);

          if (shouldUpdateFirstName && firstName && firstName !== "User") {
            updates.firstName = firstName;
            needsUpdate = true;
          }

          // Update lastName if it's missing or if we have a better value
          // Don't overwrite existing lastName with empty string unless it's currently empty
          const currentLastName = existingUser.lastName || "";
          const shouldUpdateLastName =
            !currentLastName || (lastName && lastName !== currentLastName);

          if (shouldUpdateLastName && lastName) {
            updates.lastName = lastName;
            needsUpdate = true;
          }
        }

        // Update avatarType if provided and different
        if (avatarType && existingUser.avatarType !== avatarType) {
          updates.avatarType = avatarType;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await this.updateUser(userId, updates);
          return {
            ...existingUser,
            ...updates,
          };
        }

        return existingUser;
      }

      // Before creating a new user, check again to handle race conditions
      // (e.g., if signUp just created the user but it wasn't visible yet)
      // Only do this if we're about to create with defaults - real names should create immediately
      if (firstName === "User" || !firstName) {
        // Wait a bit and check again - user might have been created by signUp
        await new Promise((resolve) => setTimeout(resolve, 100));
        const retryUser = await this.getUser(userId);
        if (retryUser) {
          // User exists now - return it (don't call ensureUserDocument again to avoid recursion)
          // The existing user should have the correct name from signUp
          return retryUser;
        }
      }

      // Create new user document with default values
      const newUserData: Omit<User, "id"> = {
        ...(email && { email }), // Include email only if provided
        firstName,
        lastName,
        ...(avatarType && { avatarType }), // Include avatar type if provided
        role: "admin", // First user in family is admin
        createdAt: new Date(),
        onboardingCompleted: false, // New users should see onboarding flow
        dashboardTourCompleted: false,
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
        const preferences = data.preferences || {};
        const normalizedContacts = normalizeEmergencyContacts(
          preferences.emergencyContacts
        );
        members.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          preferences: {
            language: preferences.language || "en",
            notifications:
              preferences.notifications !== undefined
                ? preferences.notifications
                : true,
            emergencyContacts: normalizedContacts,
          },
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
      let role: "admin" | "member" | "caregiver" = "member"; // Default to member

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

  // Check if user is caregiver or admin (has family access)
  async isUserCaregiverOrAdmin(userId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      return user?.role === "admin" || user?.role === "caregiver";
    } catch (error) {
      return false;
    }
  },

  // Update user role (only for admins)
  async updateUserRole(
    userId: string,
    newRole: "admin" | "member" | "caregiver",
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

  // Set a user as caregiver (admin only)
  async setUserAsCaregiver(
    userId: string,
    requestingUserId: string
  ): Promise<void> {
    try {
      // Check if the requesting user is an admin
      const isAdmin = await this.isUserAdmin(requestingUserId);
      if (!isAdmin) {
        throw new Error("Only admins can assign caregiver role");
      }

      await this.updateUserRole(userId, "caregiver", requestingUserId);
    } catch (error) {
      throw error;
    }
  },

  // Get caregivers for a family
  async getFamilyCaregivers(familyId: string): Promise<User[]> {
    try {
      const q = query(
        collection(db, "users"),
        where("familyId", "==", familyId),
        where("role", "==", "caregiver")
      );
      const querySnapshot = await getDocs(q);
      const caregivers: User[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        caregivers.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as User);
      });

      return caregivers;
    } catch (error) {
      throw error;
    }
  },

  // Remove a member from family (admin only)
  async removeFamilyMember(
    memberUserId: string,
    familyId: string,
    requestingUserId: string
  ): Promise<void> {
    try {
      // Verify the requesting user is an admin
      const isAdmin = await this.isUserAdmin(requestingUserId);
      if (!isAdmin) {
        throw new Error("Only admins can remove family members");
      }

      // Remove from family members array first
      try {
        const familyDoc = await getDoc(doc(db, "families", familyId));
        if (familyDoc.exists()) {
          const familyData = familyDoc.data();
          const members = familyData.members || [];
          const updatedMembers = members.filter(
            (memberId: string) => memberId !== memberUserId
          );

          await updateDoc(doc(db, "families", familyId), {
            members: updatedMembers,
          });
        }
      } catch (familyError: any) {
        throw new Error(
          `Failed to update family: ${familyError?.code || familyError?.message}`
        );
      }

      // Update the user's document to remove family association
      try {
        // Use null instead of deleteField() for better compatibility with Firestore rules
        await updateDoc(doc(db, "users", memberUserId), {
          familyId: null,
          role: "admin", // They become admin of their own (empty) account
        });
      } catch (userError: any) {
        // If permission denied, provide more context
        if (userError?.code === "permission-denied") {
          throw new Error(
            "Permission denied: Admin cannot update family member. Check Firestore rules."
          );
        }
        throw new Error(
          `Failed to update user: ${userError?.code || userError?.message}`
        );
      }
    } catch (error) {
      throw error;
    }
  },
};
