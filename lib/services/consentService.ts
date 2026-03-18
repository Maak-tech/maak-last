import { api } from "@/lib/apiClient";
import type { ConsentGrantMethod, ConsentScope, PatientConsent } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date();
}

function mapConsent(data: Record<string, unknown>): PatientConsent {
  return {
    id: data.id as string,
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
 *
 * All routes are session-authenticated via Better-auth cookie.
 * Consent history is append-only — records are never deleted.
 * Revocations set isActive = false on the server side.
 *
 * Routes (api/src/routes/consent.ts):
 *   POST   /api/consent                      — grant consent
 *   GET    /api/consent/:userId/:orgId        — get active consent
 *   PATCH  /api/consent/:userId/:orgId        — revoke or update scope
 *   GET    /api/consent/:userId               — all consents for a user
 *   GET    /api/org/:orgId/consents           — all active consents for an org (org.ts)
 */
class ConsentService {
  /**
   * Grant consent for an organization to access the patient's data.
   * If a prior consent exists it is superseded — old record set isActive=false,
   * new record inserted. History is preserved for HIPAA audit purposes.
   */
  async grantConsent(params: {
    userId: string;
    orgId: string;
    grantedBy: string;
    grantMethod: ConsentGrantMethod;
    scope: ConsentScope[];
    version?: string;
  }): Promise<PatientConsent> {
    const raw = await api.post<Record<string, unknown>>("/api/consent", {
      userId: params.userId,
      orgId: params.orgId,
      grantedBy: params.grantedBy,
      grantMethod: params.grantMethod,
      scope: params.scope,
      version: params.version ?? "1.0",
    });
    return mapConsent(raw);
  }

  /**
   * Revoke consent. The server sets isActive = false so history is preserved.
   * If no active consent exists, this is a no-op.
   */
  async revokeConsent(
    userId: string,
    orgId: string,
    revokedBy: string
  ): Promise<void> {
    await api.patch(`/api/consent/${userId}/${orgId}`, {
      isActive: false,
      revokedBy,
    });
  }

  /**
   * Get the current active consent record for a user/org pair.
   * Returns null if no active consent exists.
   */
  async getConsent(
    userId: string,
    orgId: string
  ): Promise<PatientConsent | null> {
    try {
      const raw = await api.get<Record<string, unknown>>(
        `/api/consent/${userId}/${orgId}`
      );
      return raw ? mapConsent(raw) : null;
    } catch {
      return null;
    }
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
   * Update the scope of an existing active consent (additive merge).
   * Fetches the current scope, merges in additionalScopes, then PATCHes.
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

    await api.patch(`/api/consent/${userId}/${orgId}`, { scope: merged });
  }

  /**
   * Get all consent records for a user (across all organizations), newest first.
   * Includes both active and revoked records (full audit history).
   * Only the user themselves can call this.
   */
  async getUserConsents(userId: string): Promise<PatientConsent[]> {
    const rows = await api.get<Record<string, unknown>[]>(
      `/api/consent/${userId}`
    );
    return (rows ?? []).map(mapConsent);
  }

  /**
   * Get all active consents granted to an organization.
   * Requires org admin role on the server.
   */
  async getOrgActiveConsents(orgId: string): Promise<PatientConsent[]> {
    const rows = await api.get<Record<string, unknown>[]>(
      `/api/org/${orgId}/consents`
    );
    return (rows ?? []).map(mapConsent);
  }

  /**
   * No-op: server-side relational queries replace the Firestore mirror pattern.
   * The org consents endpoint (GET /api/org/:orgId/consents) queries directly.
   */
  async syncOrgConsentMirror(_consent: PatientConsent): Promise<void> {
    // Intentional no-op — relational DB handles org-level queries natively.
  }

  /**
   * Grant consent and automatically sync the org-level mirror (no-op in new stack).
   */
  async grantConsentWithMirror(params: {
    userId: string;
    orgId: string;
    grantedBy: string;
    grantMethod: ConsentGrantMethod;
    scope: ConsentScope[];
    version?: string;
  }): Promise<PatientConsent> {
    return this.grantConsent(params);
  }

  /**
   * Revoke consent and update the org-level mirror (no-op in new stack).
   */
  async revokeConsentWithMirror(
    userId: string,
    orgId: string,
    revokedBy: string
  ): Promise<void> {
    await this.revokeConsent(userId, orgId, revokedBy);
  }
}

export const consentService = new ConsentService();
