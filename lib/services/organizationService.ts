import { api } from "@/lib/apiClient";
import type {
  ConsentScope,
  Organization,
  OrgCohort,
  OrgMember,
  OrgPlan,
  OrgRole,
  OrgType,
  PatientRoster,
  PatientRosterStatus,
} from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date();
}

function mapOrg(data: Record<string, unknown>): Organization {
  return {
    id: data.id as string,
    name: data.name as string,
    type: data.type as OrgType,
    plan: (data.plan as OrgPlan) ?? "free",
    createdAt: toDate(data.createdAt),
    createdBy: (data.createdBy as string) ?? "",
    isActive: (data.isActive as boolean) ?? true,
    settings: data.settings as Organization["settings"],
    billing: data.billing as Organization["billing"],
  };
}

function mapMember(data: Record<string, unknown>): OrgMember {
  return {
    id: data.id as string,
    orgId: data.orgId as string,
    userId: data.userId as string,
    role: data.role as OrgRole,
    displayName: data.displayName as string,
    email: data.email as string | undefined,
    specialty: data.specialty as string | undefined,
    joinedAt: toDate(data.joinedAt),
    invitedBy: (data.invitedBy as string) ?? "",
    isActive: (data.isActive as boolean) ?? true,
  };
}

function mapCohort(data: Record<string, unknown>): OrgCohort {
  return {
    id: data.id as string,
    orgId: data.orgId as string,
    name: data.name as string,
    description: data.description as string | undefined,
    condition: data.condition as string | undefined,
    program: data.program as string | undefined,
    createdAt: toDate(data.createdAt),
    createdBy: data.createdBy as string,
    patientCount: (data.patientCount as number) ?? 0,
  };
}

function mapRoster(data: Record<string, unknown>): PatientRoster {
  return {
    id: data.id as string,
    orgId: data.orgId as string,
    userId: data.userId as string,
    displayName: data.displayName as string | undefined,
    enrolledAt: toDate(data.enrolledAt),
    enrolledBy: (data.enrolledBy as string) ?? "",
    status: data.status as PatientRosterStatus,
    cohortIds: (data.cohortIds as string[]) ?? [],
    assignedProviders: (data.assignedProviders as string[]) ?? [],
    riskScore: data.riskScore as number | undefined,
    lastContact: data.lastContact ? toDate(data.lastContact) : undefined,
    dischargedAt: data.dischargedAt ? toDate(data.dischargedAt) : undefined,
    dischargeReason: data.dischargeReason as string | undefined,
    consentGrantedAt: data.consentGrantedAt
      ? toDate(data.consentGrantedAt)
      : undefined,
    consentScope: (data.consentScope as ConsentScope[]) ?? [],
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

class OrganizationService {
  // ─── Organization CRUD ─────────────────────────────────────────────────────

  async createOrganization(
    data: Omit<Organization, "id" | "createdAt"> & { id?: string }
  ): Promise<Organization> {
    const raw = await api.post<Record<string, unknown>>("/api/org", {
      id: data.id,
      name: data.name,
      type: data.type,
      settings: data.settings,
    });
    return mapOrg(raw);
  }

  async getOrganization(orgId: string): Promise<Organization | null> {
    try {
      const raw = await api.get<Record<string, unknown>>(`/api/org/${orgId}`);
      return raw ? mapOrg(raw) : null;
    } catch (err: unknown) {
      console.warn('[organization] failed to fetch organization:', err);
      return null;
    }
  }

  async updateOrganization(
    orgId: string,
    updates: Partial<Omit<Organization, "id" | "createdAt" | "createdBy">>
  ): Promise<void> {
    await api.patch(`/api/org/${orgId}`, updates);
  }

  // ─── Member Management ─────────────────────────────────────────────────────

  async addMember(
    orgId: string,
    member: Omit<OrgMember, "id" | "joinedAt">
  ): Promise<OrgMember> {
    const raw = await api.post<Record<string, unknown>>(
      `/api/org/${orgId}/members`,
      { userId: member.userId, role: member.role }
    );
    return mapMember({ ...member, orgId, joinedAt: new Date().toISOString(), ...raw });
  }

  async updateMemberRole(
    orgId: string,
    userId: string,
    newRole: OrgRole
  ): Promise<void> {
    await api.patch(`/api/org/${orgId}/members/${userId}`, { role: newRole });
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    await api.delete(`/api/org/${orgId}/members/${userId}`);
  }

  async deactivateMember(orgId: string, userId: string): Promise<void> {
    // Map to role update with a 'deactivated' marker in settings; or remove entirely.
    // Until a dedicated isActive column is added to org_members, use remove.
    await this.removeMember(orgId, userId);
  }

  async getMembers(orgId: string): Promise<OrgMember[]> {
    const rows = await api.get<Record<string, unknown>[]>(`/api/org/${orgId}/members`);
    return (Array.isArray(rows) ? rows : []).map(mapMember);
  }

  async getUserRoleInOrg(
    orgId: string,
    userId: string
  ): Promise<OrgRole | null> {
    try {
      const row = await api.get<{ role: OrgRole } | null>(`/api/org/${orgId}/members/${userId}`);
      return row?.role ?? null;
    } catch (err: unknown) {
      console.warn('[organization] failed to fetch user role in org:', err);
      return null;
    }
  }

  async getMemberOrganizations(
    userId: string
  ): Promise<Array<{ org: Organization; member: OrgMember }>> {
    const rows = await api.get<Array<{ org: Record<string, unknown>; member: Record<string, unknown> }>>(
      "/api/user/organizations"
    );
    return (Array.isArray(rows) ? rows : []).map(({ org, member }) => ({
      org: mapOrg(org),
      member: mapMember(member),
    }));
  }

  // ─── Cohort Management ─────────────────────────────────────────────────────
  // NOTE: Cohorts are not yet backed by a database table.
  // These methods return optimistic local objects until a `cohorts` table is added.

  async createCohort(
    orgId: string,
    data: Omit<OrgCohort, "id" | "createdAt" | "orgId" | "patientCount">
  ): Promise<OrgCohort> {
    const raw = await api.post<Record<string, unknown>>(
      `/api/org/${orgId}/cohorts`,
      {
        name: data.name,
        description: data.description,
        condition: data.condition,
        program: data.program,
      }
    );
    return mapCohort({ ...raw, orgId });
  }

  async getCohorts(orgId: string): Promise<OrgCohort[]> {
    const rows = await api.get<Record<string, unknown>[]>(
      `/api/org/${orgId}/cohorts`
    );
    return (Array.isArray(rows) ? rows : []).map(mapCohort);
  }

  async updateCohort(
    orgId: string,
    cohortId: string,
    updates: Partial<
      Omit<OrgCohort, "id" | "orgId" | "createdAt" | "createdBy">
    >
  ): Promise<void> {
    await api.patch(`/api/org/${orgId}/cohorts/${cohortId}`, {
      name: updates.name,
      description: updates.description,
      condition: updates.condition,
      program: updates.program,
    });
  }

  // ─── Patient Roster ────────────────────────────────────────────────────────

  async enrollPatient(
    orgId: string,
    userId: string,
    data: {
      enrolledBy: string;
      displayName?: string;
      cohortIds?: string[];
      assignedProviders?: string[];
      consentScope: ConsentScope[];
    }
  ): Promise<PatientRoster> {
    const raw = await api.post<Record<string, unknown>>(`/api/org/${orgId}/roster`, { userId });
    return mapRoster({
      orgId,
      userId,
      enrolledBy: data.enrolledBy,
      enrolledAt: new Date().toISOString(),
      status: "active" as PatientRosterStatus,
      ...raw,
    });
  }

  async getPatientRoster(
    orgId: string,
    userId: string
  ): Promise<PatientRoster | null> {
    try {
      const raw = await api.get<Record<string, unknown>>(`/api/org/${orgId}/roster/${userId}`);
      return raw ? mapRoster(raw) : null;
    } catch (err: unknown) {
      console.warn('[organization] failed to fetch patient roster entry:', err);
      return null;
    }
  }

  async updateRosterStatus(
    orgId: string,
    userId: string,
    status: PatientRosterStatus,
    _reason?: string
  ): Promise<void> {
    await api.patch(`/api/org/${orgId}/roster/${userId}`, { status });
  }

  async listPatientRoster(
    orgId: string,
    options?: {
      status?: PatientRosterStatus;
      cohortId?: string;
      maxResults?: number;
    }
  ): Promise<PatientRoster[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.maxResults) params.set("limit", String(options.maxResults));

    const qs = params.toString();
    const rows = await api.get<Record<string, unknown>[]>(
      `/api/org/${orgId}/roster${qs ? `?${qs}` : ""}`
    );
    return (Array.isArray(rows) ? rows : []).map(mapRoster);
  }

  async updateRiskScore(
    orgId: string,
    userId: string,
    riskScore: number
  ): Promise<void> {
    try {
      await api.patch(`/api/org/${orgId}/roster/${userId}`, { riskScore });
    } catch (err: unknown) {
      console.warn('[organizationService] updateRiskScore failed:', err instanceof Error ? err.message : String(err));
    }
  }

  async updateLastContact(orgId: string, userId: string): Promise<void> {
    try {
      await api.patch(`/api/org/${orgId}/roster/${userId}`, {
        lastContactAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      console.warn('[organizationService] updateLastContact failed:', err instanceof Error ? err.message : String(err));
    }
  }

  async assignProvider(
    orgId: string,
    userId: string,
    providerUserId: string
  ): Promise<void> {
    try {
      // Fetch current assigned providers, then add the new one (deduplicated)
      const current = await api.get<{ assignedProviders?: string[] }>(
        `/api/org/${orgId}/roster/${userId}`
      );
      const existing = current?.assignedProviders ?? [];
      const updated = Array.from(new Set([...existing, providerUserId]));
      await api.patch(`/api/org/${orgId}/roster/${userId}`, {
        assignedProviders: updated,
      });
    } catch (err: unknown) {
      console.warn('[organizationService] assignProvider failed:', err instanceof Error ? err.message : String(err));
    }
  }

  // ─── Notification Settings ──────────────────────────────────────────────────

  /**
   * Load organization-level notification preferences.
   */
  async getNotificationSettings(
    orgId: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const rows = await api.get<unknown[]>(`/api/org/${orgId}/notification-settings`);
      return rows ? { templates: rows } : null;
    } catch (err: unknown) {
      console.warn('[organization] failed to fetch notification settings:', err);
      return null;
    }
  }

  /**
   * Save organization-level notification preferences.
   */
  async saveNotificationSettings(
    orgId: string,
    settings: Record<string, unknown>
  ): Promise<void> {
    const templates = Array.isArray(settings.templates) ? settings.templates : [];
    await api.put(`/api/org/${orgId}/notification-settings`, { templates });
  }
}

export const organizationService = new OrganizationService();
