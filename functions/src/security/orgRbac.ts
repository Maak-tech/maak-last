/**
 * Organization-level Role-Based Access Control (RBAC)
 *
 * Extends the existing family RBAC with org-level roles:
 *   org_admin       — full organization management
 *   provider        — read assigned patient cohort, clinical actions
 *   care_coordinator — patient outreach, task management
 *   viewer          — read-only dashboards
 *
 * These server-side checks are used by Cloud Functions that handle
 * org-scoped API calls. Firestore Rules enforce the same logic on
 * the client SDK path.
 */

/* biome-ignore-all lint/performance/noNamespaceImport: firebase-functions v1 https.HttpsError is consumed through namespace API here. */
import * as functions from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { AuthContext } from "./authContext";
import type { OrgRole, ConsentScope } from "../../../types";

const db = () => getFirestore();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrgMember(
  orgId: string,
  userId: string
): Promise<{ role: OrgRole; isActive: boolean } | null> {
  const snap = await db()
    .collection("organizations")
    .doc(orgId)
    .collection("members")
    .doc(userId)
    .get();

  if (!snap.exists) return null;
  const data = snap.data() as { role: OrgRole; isActive: boolean };
  return data;
}

async function hasActiveConsent(
  orgId: string,
  patientUserId: string,
  requiredScopes?: ConsentScope[]
): Promise<boolean> {
  const snap = await db()
    .collection("consents")
    .doc(patientUserId)
    .collection("organizations")
    .doc(orgId)
    .get();

  if (!snap.exists) return false;
  const data = snap.data() as {
    isActive: boolean;
    scope: ConsentScope[];
  };
  if (!data.isActive) return false;

  if (requiredScopes && requiredScopes.length > 0) {
    return requiredScopes.every((s) => data.scope.includes(s));
  }
  return true;
}

// ─── Role Checks ──────────────────────────────────────────────────────────────

export async function getOrgRole(
  orgId: string,
  userId: string
): Promise<OrgRole | null> {
  const member = await getOrgMember(orgId, userId);
  if (!member || !member.isActive) return null;
  return member.role;
}

export async function isOrgAdmin(
  orgId: string,
  userId: string
): Promise<boolean> {
  const role = await getOrgRole(orgId, userId);
  return role === "org_admin";
}

export async function isOrgProvider(
  orgId: string,
  userId: string
): Promise<boolean> {
  const role = await getOrgRole(orgId, userId);
  return (
    role === "org_admin" ||
    role === "provider" ||
    role === "care_coordinator"
  );
}

export async function isOrgMember(
  orgId: string,
  userId: string
): Promise<boolean> {
  const role = await getOrgRole(orgId, userId);
  return role !== null;
}

// ─── Permission Checks (with consent gate for PHI) ───────────────────────────

/**
 * Returns true if actor can read PHI for a patient in the context of an org.
 * Requires:
 * 1. Actor is an active org member with at least provider-level role
 * 2. Patient has granted active consent to the org
 */
export async function canReadPatientInOrg(
  orgId: string,
  actor: AuthContext,
  patientUserId: string,
  requiredScopes?: ConsentScope[]
): Promise<boolean> {
  // Actor reading their own data is always allowed
  if (actor.uid === patientUserId) return true;

  const providerOk = await isOrgProvider(orgId, actor.uid);
  if (!providerOk) return false;

  return hasActiveConsent(orgId, patientUserId, requiredScopes);
}

/**
 * Returns true if actor can write/modify PHI for a patient in the org.
 * Same consent + provider-level requirement, but write operations
 * require the consent scope to include the specific PHI type.
 */
export async function canWritePatientInOrg(
  orgId: string,
  actor: AuthContext,
  patientUserId: string,
  requiredScopes?: ConsentScope[]
): Promise<boolean> {
  if (actor.uid === patientUserId) return true;

  const providerOk = await isOrgProvider(orgId, actor.uid);
  if (!providerOk) return false;

  return hasActiveConsent(orgId, patientUserId, requiredScopes);
}

/**
 * Returns true if actor can manage org settings, members, and billing.
 */
export async function canManageOrg(
  orgId: string,
  actor: AuthContext
): Promise<boolean> {
  return isOrgAdmin(orgId, actor.uid);
}

/**
 * Returns true if actor can view the population health dashboard for the org.
 */
export async function canViewOrgDashboard(
  orgId: string,
  actor: AuthContext
): Promise<boolean> {
  return isOrgMember(orgId, actor.uid);
}

// ─── Assert Helpers (throw on denial) ────────────────────────────────────────

export async function assertOrgAdmin(
  orgId: string,
  actor: AuthContext
): Promise<void> {
  if (!(await canManageOrg(orgId, actor))) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only org admins can perform this action"
    );
  }
}

export async function assertOrgProvider(
  orgId: string,
  actor: AuthContext
): Promise<void> {
  if (!(await isOrgProvider(orgId, actor.uid))) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only org providers or admins can perform this action"
    );
  }
}

export async function assertCanReadPatientInOrg(
  orgId: string,
  actor: AuthContext,
  patientUserId: string,
  requiredScopes?: ConsentScope[]
): Promise<void> {
  if (!(await canReadPatientInOrg(orgId, actor, patientUserId, requiredScopes))) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Access denied: insufficient role or missing patient consent"
    );
  }
}

export async function assertCanWritePatientInOrg(
  orgId: string,
  actor: AuthContext,
  patientUserId: string,
  requiredScopes?: ConsentScope[]
): Promise<void> {
  if (
    !(await canWritePatientInOrg(orgId, actor, patientUserId, requiredScopes))
  ) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Access denied: insufficient role or missing patient consent"
    );
  }
}

// ─── Audit Trail Integration ──────────────────────────────────────────────────

/**
 * Record an org action to the HIPAA audit trail.
 * Uses the admin SDK (bypasses Firestore Rules, always append-only).
 */
export async function recordOrgAudit(params: {
  actorId: string;
  actorType: "user" | "system" | "agent" | "api_key";
  actorOrgId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  patientUserId?: string;
  orgId: string;
  details?: Record<string, unknown>;
  outcome: "success" | "failure" | "denied";
  denialReason?: string;
}): Promise<void> {
  try {
    await db().collection("audit_trail").add({
      ...params,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch {
    // Audit logging must never throw
  }
}
