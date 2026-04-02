/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: User/family lifecycle workflows intentionally combine validation, migration, and fallback handling. */
/* biome-ignore-all lint/nursery/useMaxParams: Legacy user bootstrap APIs preserve established multi-parameter call signatures. */
/**
 * User service — Firebase-free replacement.
 *
 * Replaced Firestore reads/writes on `users` and `families` collections with:
 *   GET  /api/users/:userId               → getUser
 *   PATCH /api/users/:userId              → updateUser
 *   GET  /api/family/:familyId/users      → getFamilyMembers + getFamilyCaregivers
 *   POST /api/family/create               → createFamily
 *   POST /api/family/:familyId/join       → joinFamily
 *   POST /api/family/:familyId/leave      → leavePreviousFamily
 *   DELETE /api/family/:familyId/members/:memberId → removeFamilyMember
 *   PATCH /api/users/:userId/role         → updateUserRole
 */

import { api } from "@/lib/apiClient";
import type { AvatarType, EmergencyContact, User } from "@/types";

const normalizeEmergencyContacts = (
  rawContacts: unknown
): EmergencyContact[] => {
  if (!Array.isArray(rawContacts)) return [];

  const contacts: EmergencyContact[] = [];

  for (const [index, contact] of rawContacts.entries()) {
    if (typeof contact === "string" && contact.trim()) {
      contacts.push({ id: `legacy-${index}`, name: "Emergency Contact", phone: contact.trim() });
      continue;
    }

    if (contact && typeof contact === "object") {
      const name =
        typeof (contact as { name?: string }).name === "string"
          ? (contact as { name?: string }).name?.trim()
          : "";
      const phone =
        typeof (contact as { phone?: string }).phone === "string"
          ? (contact as { phone?: string }).phone?.trim()
          : "";
      const id =
        typeof (contact as { id?: string }).id === "string"
          ? (contact as { id?: string }).id?.trim()
          : "";

      if (name && phone) {
        contacts.push({ id: id || `normalized-${index}`, name, phone });
      }
    }
  }

  return contacts;
};

/** Ensure User response from server has proper Date objects and normalized preferences */
const normalizeUserFromApi = (raw: Record<string, unknown>): User => {
  const prefs = (raw.preferences ?? {}) as Record<string, unknown>;
  return {
    id: raw.id as string,
    email: raw.email as string | undefined,
    firstName: (raw.firstName as string | undefined) ?? "User",
    lastName: (raw.lastName as string | undefined) ?? "",
    gender: raw.gender as User["gender"],
    dateOfBirth: raw.dateOfBirth ? new Date(raw.dateOfBirth as string) : undefined,
    familyId: raw.familyId as string | undefined,
    avatar: raw.avatar as string | undefined,
    avatarType: raw.avatarType as AvatarType | undefined,
    role: (raw.role as User["role"]) ?? "admin",
    createdAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
    onboardingCompleted: (raw.onboardingCompleted as boolean | undefined) ?? false,
    dashboardTourCompleted: raw.dashboardTourCompleted as boolean | undefined,
    isPremium: raw.isPremium as boolean | undefined,
    preferences: {
      language: ((prefs.language as string | undefined) ?? "en") as "en" | "ar",
      notifications: (prefs.notifications as boolean | undefined) ?? true,
      emergencyContacts: normalizeEmergencyContacts(prefs.emergencyContacts),
      careTeam: (prefs.careTeam as User["preferences"]["careTeam"]) ?? [],
    },
  };
};

// Short-lived cache for getFamilyMembers to avoid redundant reads across screens
const _familyMembersCache = new Map<string, { members: User[]; timestamp: number }>();
const FAMILY_MEMBERS_CACHE_TTL = 60_000; // 1 minute

export const userService = {
  /** Get user by ID */
  async getUser(userId: string): Promise<User | null> {
    try {
      const raw = await api.get<Record<string, unknown>>(`/api/users/${userId}`);
      if (!raw || (raw as { error?: string }).error) return null;
      return normalizeUserFromApi(raw);
    } catch {
      return null;
    }
  },

  /** Create new user — in the new stack, Better-auth creates the row.
   *  This enriches it with app-level profile fields. */
  async createUser(userId: string, userData: Omit<User, "id">): Promise<void> {
    await api.patch(`/api/users/${userId}`, {
      name: userData.firstName && userData.lastName
        ? `${userData.firstName} ${userData.lastName}`
        : userData.firstName || "",
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      gender: userData.gender,
      dateOfBirth: userData.dateOfBirth?.toISOString(),
      familyId: userData.familyId,
      role: userData.role,
      onboardingCompleted: userData.onboardingCompleted,
      notifications: userData.preferences?.notifications,
      emergencyContacts: userData.preferences?.emergencyContacts,
    });
  },

  /** Ensure user document exists — get or create/update profile */
  async ensureUserDocument(
    userId: string,
    email: string,
    name: string
  ): Promise<User> {
    const existingUser = await this.getUser(userId);

    if (existingUser) {
      let needsUpdate = false;
      const updates: Partial<Record<string, unknown>> = {};

      // Migrate legacy combined name field
      const legacyName = (existingUser as { name?: unknown }).name;
      if (
        !(existingUser.firstName || existingUser.lastName) &&
        typeof legacyName === "string" && legacyName
      ) {
        const nameParts = legacyName.split(" ");
        updates.firstName = nameParts[0] || "User";
        updates.lastName = nameParts.slice(1).join(" ") || "";
        needsUpdate = true;
      } else {
        const currentFirstName = existingUser.firstName || "";
        if (
          firstName &&
          firstName !== "User" &&
          (!currentFirstName || currentFirstName === "User" || firstName !== currentFirstName)
        ) {
          updates.firstName = firstName;
          needsUpdate = true;
        }

        const currentLastName = existingUser.lastName || "";
        if (lastName && lastName !== currentLastName) {
          updates.lastName = lastName;
          needsUpdate = true;
        }
      }

      if (avatarType && existingUser.avatarType !== avatarType) {
        updates.avatarType = avatarType;
        needsUpdate = true;
      }

      if (gender && existingUser.gender !== gender) {
        updates.gender = gender;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await this.updateUser(userId, updates as Partial<User>);
        return { ...existingUser, ...(updates as Partial<User>) };
      }

      return existingUser;
    }

    // Race condition guard for placeholder names
    if (firstName === "User" || !firstName) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const retryUser = await this.getUser(userId);
      if (retryUser) return retryUser;
    }

    // Create new profile
    const newUserData: Omit<User, "id"> = {
      ...(email && { email }),
      firstName,
      lastName,
      ...(avatarType && { avatarType }),
      ...(gender && { gender }),
      role: "admin",
      createdAt: new Date(),
      onboardingCompleted: false,
      dashboardTourCompleted: false,
      preferences: {
        language: "en",
        notifications: true,
        emergencyContacts: [],
      },
    };

    await this.createUser(userId, newUserData);

    const created = await this.getUser(userId);
    if (!created) throw new Error("Failed to create user document");
    return created;
  },

  /** Update user profile fields */
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const payload: Record<string, unknown> = {};

    if (updates.firstName !== undefined) payload.firstName = updates.firstName;
    if (updates.lastName !== undefined) payload.lastName = updates.lastName;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.dateOfBirth !== undefined)
      payload.dateOfBirth = updates.dateOfBirth?.toISOString();
    if (updates.familyId !== undefined) payload.familyId = updates.familyId;
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.avatarType !== undefined) payload.avatarType = updates.avatarType;
    if (updates.avatar !== undefined) payload.avatar = updates.avatar;
    if (updates.onboardingCompleted !== undefined)
      payload.onboardingCompleted = updates.onboardingCompleted;
    if (updates.dashboardTourCompleted !== undefined)
      payload.dashboardTourCompleted = updates.dashboardTourCompleted;
    if (updates.isPremium !== undefined) payload.isPremium = updates.isPremium;
    if (updates.preferences?.language !== undefined)
      payload.language = updates.preferences.language;
    if (updates.preferences?.notifications !== undefined)
      payload.notifications = updates.preferences.notifications;
    if (updates.preferences?.emergencyContacts !== undefined)
      payload.emergencyContacts = updates.preferences.emergencyContacts;

    // Composite name field for backward compat
    const first = (payload.firstName as string | undefined) ?? updates.firstName;
    const last = (payload.lastName as string | undefined) ?? updates.lastName;
    if (first !== undefined || last !== undefined) {
      payload.name = `${first ?? ""} ${last ?? ""}`.trim();
    }

    await api.patch(`/api/users/${userId}`, payload);
  },

  /** Get all members of a family */
  async getFamilyMembers(familyId: string): Promise<User[]> {
    const cached = _familyMembersCache.get(familyId);
    if (cached && Date.now() - cached.timestamp < FAMILY_MEMBERS_CACHE_TTL) {
      return cached.members;
    }

    try {
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/family/${familyId}/users`
      );
      const members = (raw ?? []).map(normalizeUserFromApi);
      _familyMembersCache.set(familyId, { members, timestamp: Date.now() });
      return members;
    } catch {
      return [];
    }
  },

  /** Join a family */
  async joinFamily(userId: string, familyId: string): Promise<void> {
    const currentUser = await this.getUser(userId);
    const oldFamilyId = currentUser?.familyId;

      // Get current user to check existing family
      const currentUser = await this.getUser(userId);
      console.log('📋 Current user data:', {
        userId,
        currentFamilyId: currentUser?.familyId,
        userName: currentUser?.name,
      });
      const oldFamilyId = currentUser?.familyId;

    await api.post(`/api/family/${familyId}/join`, { userId });
    _familyMembersCache.delete(familyId);
  },

  /** Leave a family — called before joining a new one */
  async leavePreviousFamily(userId: string, familyId: string): Promise<void> {
    try {
      await api.post(`/api/family/${familyId}/leave`, { userId });
      _familyMembersCache.delete(familyId);
    } catch {
      // Non-critical — joining new family is more important
    }
  },

  /** Create a new family and return its ID */
  async createFamily(userId: string, familyName = "My Family"): Promise<string> {
    const result = await api.post<{ id: string }>("/api/family/create", {
      name: familyName,
    });
    _familyMembersCache.clear();
    return result.id;
  },

  /** Check if user is admin of their family */
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      return user?.role === "admin";
    } catch {
      return false;
    }
  },

  /** Check if user is caregiver or admin */
  async isUserCaregiverOrAdmin(userId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      return user?.role === "admin" || user?.role === "caregiver";
    } catch {
      return false;
    }
  },

  /** Update user role (admin only) */
  async updateUserRole(
    userId: string,
    newRole: 'admin' | 'member',
    requestingUserId: string
  ): Promise<void> {
    const isAdmin = await this.isUserAdmin(requestingUserId);
    if (!isAdmin) throw new Error("Only admins can update user roles");
    await api.patch(`/api/users/${userId}/role`, { role: newRole });
  },

  /** Set a user as caregiver (admin only) */
  async setUserAsCaregiver(userId: string, requestingUserId: string): Promise<void> {
    await this.updateUserRole(userId, "caregiver", requestingUserId);
  },

  /** Get all caregivers in a family */
  async getFamilyCaregivers(familyId: string): Promise<User[]> {
    try {
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/family/${familyId}/users?role=caregiver`
      );
      return (raw ?? []).map(normalizeUserFromApi);
    } catch {
      return [];
    }
  },

  /** Remove a family member (admin only) */
  async removeFamilyMember(
    memberUserId: string,
    familyId: string,
    requestingUserId: string
  ): Promise<void> {
    const isAdmin = await this.isUserAdmin(requestingUserId);
    if (!isAdmin) throw new Error("Only admins can remove family members");
    await api.delete(`/api/family/${familyId}/members/${memberUserId}`);
    _familyMembersCache.delete(familyId);
  },
};
