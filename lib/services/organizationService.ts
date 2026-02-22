import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
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
  return new Date();
}

function mapOrg(id: string, data: Record<string, unknown>): Organization {
  return {
    id,
    name: data.name as string,
    type: data.type as OrgType,
    plan: data.plan as OrgPlan,
    createdAt: toDate(data.createdAt),
    createdBy: data.createdBy as string,
    settings: data.settings as Organization["settings"],
    billing: data.billing as Organization["billing"],
  };
}

function mapMember(id: string, data: Record<string, unknown>): OrgMember {
  return {
    id,
    orgId: data.orgId as string,
    userId: data.userId as string,
    role: data.role as OrgRole,
    displayName: data.displayName as string,
    email: data.email as string | undefined,
    specialty: data.specialty as string | undefined,
    joinedAt: toDate(data.joinedAt),
    invitedBy: data.invitedBy as string,
    isActive: data.isActive as boolean,
  };
}

function mapCohort(id: string, data: Record<string, unknown>): OrgCohort {
  return {
    id,
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

function mapRoster(id: string, data: Record<string, unknown>): PatientRoster {
  return {
    id,
    orgId: data.orgId as string,
    userId: data.userId as string,
    enrolledAt: toDate(data.enrolledAt),
    enrolledBy: data.enrolledBy as string,
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
  private orgsCol = collection(db, "organizations");
  private rosterCol = collection(db, "patient_roster");

  private membersCol(orgId: string) {
    return collection(db, "organizations", orgId, "members");
  }

  private cohortsCol(orgId: string) {
    return collection(db, "organizations", orgId, "cohorts");
  }

  private rosterId(orgId: string, userId: string) {
    return `${orgId}_${userId}`;
  }

  // ─── Organization CRUD ─────────────────────────────────────────────────────

  async createOrganization(
    data: Omit<Organization, "id" | "createdAt"> & { id?: string }
  ): Promise<Organization> {
    const payload = {
      ...data,
      createdAt: serverTimestamp(),
    };

    let ref: ReturnType<typeof doc>;
    if (data.id) {
      ref = doc(this.orgsCol, data.id);
      await setDoc(ref, payload);
    } else {
      const added = await addDoc(this.orgsCol, payload);
      ref = added;
    }

    const snap = await getDoc(ref);
    return mapOrg(ref.id, snap.data() as Record<string, unknown>);
  }

  async getOrganization(orgId: string): Promise<Organization | null> {
    const snap = await getDoc(doc(this.orgsCol, orgId));
    if (!snap.exists()) return null;
    return mapOrg(snap.id, snap.data());
  }

  async updateOrganization(
    orgId: string,
    updates: Partial<Omit<Organization, "id" | "createdAt" | "createdBy">>
  ): Promise<void> {
    await updateDoc(
      doc(this.orgsCol, orgId),
      updates as Record<string, unknown>
    );
  }

  // ─── Member Management ─────────────────────────────────────────────────────

  async addMember(
    orgId: string,
    member: Omit<OrgMember, "id" | "joinedAt">
  ): Promise<OrgMember> {
    const ref = doc(this.membersCol(orgId), member.userId);
    await setDoc(ref, {
      ...member,
      orgId,
      joinedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapMember(snap.id, snap.data() as Record<string, unknown>);
  }

  async updateMemberRole(
    orgId: string,
    userId: string,
    newRole: OrgRole
  ): Promise<void> {
    await updateDoc(doc(this.membersCol(orgId), userId), { role: newRole });
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    await deleteDoc(doc(this.membersCol(orgId), userId));
  }

  async deactivateMember(orgId: string, userId: string): Promise<void> {
    await updateDoc(doc(this.membersCol(orgId), userId), { isActive: false });
  }

  async getMembers(orgId: string): Promise<OrgMember[]> {
    const q = query(this.membersCol(orgId), where("isActive", "==", true));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapMember(d.id, d.data()));
  }

  async getUserRoleInOrg(
    orgId: string,
    userId: string
  ): Promise<OrgRole | null> {
    const snap = await getDoc(doc(this.membersCol(orgId), userId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data.isActive) return null;
    return data.role as OrgRole;
  }

  async getMemberOrganizations(
    userId: string
  ): Promise<Array<{ org: Organization; member: OrgMember }>> {
    // collectionGroup query across all organizations/{orgId}/members subcollections
    // Requires a composite index: userId ASC + isActive ASC
    const memberSnaps = await getDocs(
      query(
        collectionGroup(db, "members"),
        where("userId", "==", userId),
        where("isActive", "==", true)
      )
    );

    const results: Array<{ org: Organization; member: OrgMember }> = [];
    for (const memberDoc of memberSnaps.docs) {
      const memberData = mapMember(memberDoc.id, memberDoc.data());
      const org = await this.getOrganization(memberData.orgId);
      if (org) {
        results.push({ org, member: memberData });
      }
    }
    return results;
  }

  // ─── Cohort Management ─────────────────────────────────────────────────────

  async createCohort(
    orgId: string,
    data: Omit<OrgCohort, "id" | "createdAt" | "orgId" | "patientCount">
  ): Promise<OrgCohort> {
    const ref = await addDoc(this.cohortsCol(orgId), {
      ...data,
      orgId,
      patientCount: 0,
      createdAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapCohort(snap.id, snap.data() as Record<string, unknown>);
  }

  async getCohorts(orgId: string): Promise<OrgCohort[]> {
    const snap = await getDocs(this.cohortsCol(orgId));
    return snap.docs.map((d) => mapCohort(d.id, d.data()));
  }

  async updateCohort(
    orgId: string,
    cohortId: string,
    updates: Partial<
      Omit<OrgCohort, "id" | "orgId" | "createdAt" | "createdBy">
    >
  ): Promise<void> {
    await updateDoc(
      doc(this.cohortsCol(orgId), cohortId),
      updates as Record<string, unknown>
    );
  }

  // ─── Patient Roster ────────────────────────────────────────────────────────

  async enrollPatient(
    orgId: string,
    userId: string,
    data: {
      enrolledBy: string;
      cohortIds?: string[];
      assignedProviders?: string[];
      consentScope: ConsentScope[];
    }
  ): Promise<PatientRoster> {
    const id = this.rosterId(orgId, userId);
    const ref = doc(this.rosterCol, id);
    await setDoc(ref, {
      orgId,
      userId,
      enrolledBy: data.enrolledBy,
      enrolledAt: serverTimestamp(),
      status: "active" as PatientRosterStatus,
      cohortIds: data.cohortIds ?? [],
      assignedProviders: data.assignedProviders ?? [],
      consentScope: data.consentScope,
      consentGrantedAt: serverTimestamp(),
      riskScore: null,
      lastContact: null,
    });
    const snap = await getDoc(ref);
    return mapRoster(snap.id, snap.data() as Record<string, unknown>);
  }

  async getPatientRoster(
    orgId: string,
    userId: string
  ): Promise<PatientRoster | null> {
    const snap = await getDoc(
      doc(this.rosterCol, this.rosterId(orgId, userId))
    );
    if (!snap.exists()) return null;
    return mapRoster(snap.id, snap.data());
  }

  async updateRosterStatus(
    orgId: string,
    userId: string,
    status: PatientRosterStatus,
    reason?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = { status };
    if (status === "discharged") {
      updates.dischargedAt = serverTimestamp();
      if (reason) updates.dischargeReason = reason;
    }
    await updateDoc(doc(this.rosterCol, this.rosterId(orgId, userId)), updates);
  }

  async listPatientRoster(
    orgId: string,
    options?: {
      status?: PatientRosterStatus;
      cohortId?: string;
      maxResults?: number;
    }
  ): Promise<PatientRoster[]> {
    const constraints = [where("orgId", "==", orgId)];

    if (options?.status) {
      constraints.push(where("status", "==", options.status));
    }
    if (options?.cohortId) {
      constraints.push(where("cohortIds", "array-contains", options.cohortId));
    }

    const q = query(this.rosterCol, ...constraints);
    const snap = await getDocs(q);
    const all = snap.docs.map((d) => mapRoster(d.id, d.data()));

    if (options?.maxResults) {
      return all.slice(0, options.maxResults);
    }
    return all;
  }

  async updateRiskScore(
    orgId: string,
    userId: string,
    riskScore: number
  ): Promise<void> {
    await updateDoc(doc(this.rosterCol, this.rosterId(orgId, userId)), {
      riskScore,
    });
  }

  async updateLastContact(orgId: string, userId: string): Promise<void> {
    await updateDoc(doc(this.rosterCol, this.rosterId(orgId, userId)), {
      lastContact: serverTimestamp(),
    });
  }

  async assignProvider(
    orgId: string,
    userId: string,
    providerUserId: string
  ): Promise<void> {
    const roster = await this.getPatientRoster(orgId, userId);
    if (!roster) return;
    const providers = Array.from(
      new Set([...roster.assignedProviders, providerUserId])
    );
    await updateDoc(doc(this.rosterCol, this.rosterId(orgId, userId)), {
      assignedProviders: providers,
    });
  }
}

export const organizationService = new OrganizationService();
