import { and, eq, sql } from "drizzle-orm";
import { familyMembers, users, patientConsents } from "../db/schema.js";
import type { Database } from "../db/index.js";

/**
 * assertFamilyAccess — READ access: admin OR caregiver may read another member's data.
 *
 * Authorized when:
 *   - callerId === targetUserId (own data), OR
 *   - callerId is a family admin or caregiver in the same family as targetUserId.
 *
 * @param dataCategory  Optional health data category (e.g. 'vitals', 'medications').
 *   When provided, the caller's sharingScope is checked: if scope is not ['all'] and
 *   does not include dataCategory, access is denied for caregiver-role callers.
 *   Admins always have unrestricted access regardless of sharingScope.
 *
 * Returns null when authorized, or an error object `{ error: string }` when not.
 */
export async function assertFamilyAccess(
  db: Database,
  callerId: string,
  targetUserId: string,
  dataCategory?: string
): Promise<{ error: string } | null> {
  if (callerId === targetUserId) return null;

  const [targetMembership] = await db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, targetUserId))
    .limit(1);

  if (!targetMembership) return { error: "Target user is not in any family" };

  const [callerMembership] = await db
    .select({ role: familyMembers.role, sharingScope: familyMembers.sharingScope })
    .from(familyMembers)
    .where(and(eq(familyMembers.userId, callerId), eq(familyMembers.familyId, targetMembership.familyId)))
    .limit(1);

  if (!callerMembership || (callerMembership.role !== "admin" && callerMembership.role !== "caregiver")) {
    return { error: "Only family admins and caregivers can access health data for other users" };
  }

  // Scope enforcement: only restrict non-admin roles (admins always see everything)
  if (callerMembership.role !== "admin" && dataCategory) {
    const scope = (callerMembership.sharingScope as string[] | null) ?? ["all"];
    if (!scope.includes("all") && !scope.includes(dataCategory)) {
      return { error: `Your access to this family member does not include ${dataCategory} data` };
    }
  }

  // Minor protection: if target user has a guardian assigned, require guardian consent
  const [targetUser] = await db
    .select({ dateOfBirth: users.dateOfBirth, guardianId: users.guardianId })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (targetUser?.guardianId) {
    // Target has a designated guardian
    if (callerId !== targetUser.guardianId) {
      // Caller is not the guardian — check for explicit guardian consent
      const [guardianConsent] = await db
        .select({ id: patientConsents.id })
        .from(patientConsents)
        .where(
          and(
            eq(patientConsents.userId, targetUserId),
            eq(patientConsents.grantedBy, targetUser.guardianId),
            eq(patientConsents.isActive, true),
            sql`${patientConsents.scope} @> ARRAY['family_data_sharing']`
          )
        )
        .limit(1);
      if (!guardianConsent) {
        return { error: "Guardian consent required to access health data for this minor" };
      }
    }
  }

  return null;
}

/**
 * assertFamilyWriteAccess — WRITE access: admin-only.
 *
 * Caregivers have read access to family member health data but must NOT be able
 * to create or modify health records on behalf of another person. Allowing
 * caregivers to write would let a malicious caregiver forge symptoms, medications,
 * or vitals entries that feed directly into VHI scoring and Nora's clinical context.
 */
export async function assertFamilyWriteAccess(
  db: Database,
  callerId: string,
  targetUserId: string
): Promise<{ error: string } | null> {
  if (callerId === targetUserId) return null;

  const [targetMembership] = await db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, targetUserId))
    .limit(1);

  if (!targetMembership) return { error: "Target user is not in any family" };

  const [callerMembership] = await db
    .select({ role: familyMembers.role })
    .from(familyMembers)
    .where(and(eq(familyMembers.userId, callerId), eq(familyMembers.familyId, targetMembership.familyId)))
    .limit(1);

  if (!callerMembership || callerMembership.role !== "admin") {
    return { error: "Only family admins can create or modify health records for other family members" };
  }

  return null;
}
