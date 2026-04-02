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
    if (!(familyId && invitedBy && invitedUserName && invitedUserRelation)) {
      throw new Error(
        `Missing required parameters: familyId=${!!familyId}, invitedBy=${!!invitedBy}, invitedUserName=${!!invitedUserName}, invitedUserRelation=${!!invitedUserRelation}`
      );
    }

    try {
      const result = await api.post<{ code: string }>("/api/family/invitations", {
        familyId,
        invitedUserName,
        invitedUserRelation,
      });
      return result.code;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to create invitation: ${msg}`);
    }
  },

  // Get invitation by code
  async getInvitationByCode(code: string): Promise<FamilyInvitationCode | null> {
    try {
      const raw = await api.get<Record<string, unknown>>(
        `/api/family/invitations/code/${code}`
      );
      if (!raw || (raw as { error?: string }).error) return null;
      return normalizeInvitation(raw);
    } catch {
      return null;
    }
  },

  // Use/claim an invitation code
  async useInvitationCode(
    code: string,
    userId: string
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
    }
  },

  // Clean up expired invitations (best-effort)
  async cleanupExpiredInvitations(): Promise<void> {
    try {
      await api.post("/api/family/invitations/cleanup", {});
    } catch {
      // best-effort — ignore errors
    }
  },

  // Get family by ID
  async getFamily(familyId: string): Promise<Family | null> {
    try {
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
      return null;
    }
  },
};
