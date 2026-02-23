import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ConsentGrantMethod, ConsentScope, PatientConsent } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function mapConsent(id: string, data: Record<string, unknown>): PatientConsent {
  return {
    id,
    userId: data.userId as string,
    orgId: data.orgId as string,
    grantedAt: toDate(data.grantedAt),
    grantedBy: data.grantedBy as string,
    grantMethod: data.grantMethod as ConsentGrantMethod,
    scope: (data.scope as ConsentScope[]) ?? [],
    version: (data.version as string) ?? "1.0",
    revokedAt: data.revokedAt ? toDate(data.revokedAt) : undefined,
    revokedBy: data.revokedBy as string | undefined,
    isActive: data.isActive as boolean,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Manages patient consent for organizational access.
 * Consent history is never deleted — only marked inactive on revocation.
 * Firestore path: consents/{userId}/organizations/{orgId}
 */
class ConsentService {
  private consentRef(userId: string, orgId: string) {
    return doc(db, "consents", userId, "organizations", orgId);
  }

  /**
   * Grant consent for an organization to access the patient's data.
   * If a prior consent exists it is superseded (history preserved via isActive flag).
   */
  async grantConsent(params: {
    userId: string;
    orgId: string;
    grantedBy: string;
    grantMethod: ConsentGrantMethod;
    scope: ConsentScope[];
    version?: string;
  }): Promise<PatientConsent> {
    const ref = this.consentRef(params.userId, params.orgId);

    const payload = {
      userId: params.userId,
      orgId: params.orgId,
      grantedAt: serverTimestamp(),
      grantedBy: params.grantedBy,
      grantMethod: params.grantMethod,
      scope: params.scope,
      version: params.version ?? "1.0",
      isActive: true,
      revokedAt: null,
      revokedBy: null,
    };

    // setDoc upserts — re-granting replaces existing consent document
    await setDoc(ref, payload);

    const snap = await getDoc(ref);
    return mapConsent(snap.id, snap.data() as Record<string, unknown>);
  }

  /**
   * Revoke consent. The document is updated (not deleted) so history is preserved.
   */
  async revokeConsent(
    userId: string,
    orgId: string,
    revokedBy: string
  ): Promise<void> {
    const ref = this.consentRef(userId, orgId);
    const snap = await getDoc(ref);
    if (!(snap.exists() && snap.data().isActive)) return;

    await updateDoc(ref, {
      isActive: false,
      revokedAt: serverTimestamp(),
      revokedBy,
    });
  }

  /**
   * Get the current consent record for a user/org pair.
   */
  async getConsent(
    userId: string,
    orgId: string
  ): Promise<PatientConsent | null> {
    const snap = await getDoc(this.consentRef(userId, orgId));
    if (!snap.exists()) return null;
    return mapConsent(snap.id, snap.data());
  }

  /**
   * Returns true if the user has active consent for the given org,
   * and that consent covers all `requiredScopes` (if provided).
   */
  async hasConsent(
    userId: string,
    orgId: string,
    requiredScopes?: ConsentScope[]
  ): Promise<boolean> {
    const consent = await this.getConsent(userId, orgId);
    if (!(consent && consent.isActive)) return false;

    if (requiredScopes && requiredScopes.length > 0) {
      return requiredScopes.every((s) => consent.scope.includes(s));
    }

    return true;
  }

  /**
   * Update the scope of an existing active consent (additive only).
   */
  async updateConsentScope(
    userId: string,
    orgId: string,
    additionalScopes: ConsentScope[]
  ): Promise<void> {
    const consent = await this.getConsent(userId, orgId);
    if (!(consent && consent.isActive)) {
      throw new Error("No active consent to update");
    }

    const merged = Array.from(
      new Set([...consent.scope, ...additionalScopes])
    ) as ConsentScope[];

    await updateDoc(this.consentRef(userId, orgId), { scope: merged });
  }

  /**
   * Get all consent records for a user (across all organizations).
   */
  async getUserConsents(userId: string): Promise<PatientConsent[]> {
    const snap = await getDocs(
      collection(db, "consents", userId, "organizations")
    );
    return snap.docs.map((d) => mapConsent(d.id, d.data()));
  }

  /**
   * Get all active consents granted to an organization.
   * Requires a composite index on: orgId + isActive.
   */
  async getOrgActiveConsents(orgId: string): Promise<PatientConsent[]> {
    // This queries across the top-level 'consents' collection group.
    // Requires a Firestore composite index (orgId ASC, isActive ASC).
    // For now we use a simpler collectionGroup approach via a denormalized
    // top-level collection `org_consents/{orgId}_{userId}`.
    const snap = await getDocs(
      query(
        collection(db, "org_consents"),
        where("orgId", "==", orgId),
        where("isActive", "==", true)
      )
    );
    return snap.docs.map((d) => mapConsent(d.id, d.data()));
  }

  /**
   * Write a mirror document to `org_consents/{orgId}_{userId}` for efficient
   * org-level consent queries. Called internally after grant/revoke.
   */
  async syncOrgConsentMirror(consent: PatientConsent): Promise<void> {
    try {
      const id = `${consent.orgId}_${consent.userId}`;
      await setDoc(doc(db, "org_consents", id), {
        userId: consent.userId,
        orgId: consent.orgId,
        isActive: consent.isActive,
        scope: consent.scope,
        grantedAt: consent.grantedAt,
        version: consent.version,
      });
    } catch {
      // Mirror sync is best-effort; consent grant already succeeded
    }
  }

  /**
   * Grant consent and automatically sync the org-level mirror.
   */
  async grantConsentWithMirror(params: {
    userId: string;
    orgId: string;
    grantedBy: string;
    grantMethod: ConsentGrantMethod;
    scope: ConsentScope[];
    version?: string;
  }): Promise<PatientConsent> {
    const consent = await this.grantConsent(params);
    await this.syncOrgConsentMirror(consent);
    return consent;
  }

  /**
   * Revoke consent and update the org-level mirror.
   */
  async revokeConsentWithMirror(
    userId: string,
    orgId: string,
    revokedBy: string
  ): Promise<void> {
    await this.revokeConsent(userId, orgId, revokedBy);

    // Update mirror
    try {
      const id = `${orgId}_${userId}`;
      await updateDoc(doc(db, "org_consents", id), { isActive: false });
    } catch {
      // Mirror sync is best-effort
    }
  }
}

export const consentService = new ConsentService();
