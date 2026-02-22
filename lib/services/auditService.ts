import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AuditAction, AuditTrailEntry } from "@/types";

type LogParams = Omit<AuditTrailEntry, "id" | "timestamp">;

/**
 * HIPAA-compliant audit trail service.
 * All writes are append-only — never update or delete audit entries.
 * Failures are swallowed so audit logging never breaks the calling code.
 */
class AuditService {
  private readonly COLLECTION = "audit_trail";

  async log(entry: LogParams): Promise<void> {
    try {
      await addDoc(collection(db, this.COLLECTION), {
        ...entry,
        timestamp: serverTimestamp(),
      });
    } catch {
      // Audit logging must never throw or break calling code
    }
  }

  async logPHIRead(params: {
    actorId: string;
    actorType: AuditTrailEntry["actorType"];
    actorOrgId?: string;
    resourceType: string;
    resourceId: string;
    patientUserId: string;
    orgId?: string;
  }): Promise<void> {
    await this.log({
      ...params,
      action: "phi_read",
      outcome: "success",
    });
  }

  async logPHIWrite(params: {
    actorId: string;
    actorType: AuditTrailEntry["actorType"];
    actorOrgId?: string;
    resourceType: string;
    resourceId: string;
    patientUserId: string;
    orgId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log({
      ...params,
      action: "phi_write",
      outcome: "success",
    });
  }

  async logPHIDelete(params: {
    actorId: string;
    actorType: AuditTrailEntry["actorType"];
    actorOrgId?: string;
    resourceType: string;
    resourceId: string;
    patientUserId: string;
    orgId?: string;
  }): Promise<void> {
    await this.log({
      ...params,
      action: "phi_delete",
      outcome: "success",
    });
  }

  async logPHIExport(params: {
    actorId: string;
    actorOrgId: string;
    resourceType: string;
    resourceId: string;
    patientUserId: string;
    orgId: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log({
      actorId: params.actorId,
      actorType: "user",
      actorOrgId: params.actorOrgId,
      action: "phi_export",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientUserId: params.patientUserId,
      orgId: params.orgId,
      details: params.details,
      outcome: "success",
    });
  }

  async logAgentAction(params: {
    orgId: string;
    patientUserId: string;
    resourceType: string;
    resourceId: string;
    details: Record<string, unknown>;
    outcome?: AuditTrailEntry["outcome"];
  }): Promise<void> {
    await this.log({
      actorId: "system_agent",
      actorType: "agent",
      actorOrgId: params.orgId,
      action: "agent_action",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientUserId: params.patientUserId,
      orgId: params.orgId,
      details: params.details,
      outcome: params.outcome ?? "success",
    });
  }

  async logPatientEnrolled(params: {
    actorId: string;
    orgId: string;
    patientUserId: string;
  }): Promise<void> {
    await this.log({
      actorId: params.actorId,
      actorType: "user",
      actorOrgId: params.orgId,
      action: "patient_enrolled",
      resourceType: "patient_roster",
      resourceId: `${params.orgId}_${params.patientUserId}`,
      patientUserId: params.patientUserId,
      orgId: params.orgId,
      outcome: "success",
    });
  }

  async logPatientDischarged(params: {
    actorId: string;
    orgId: string;
    patientUserId: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log({
      actorId: params.actorId,
      actorType: "user",
      actorOrgId: params.orgId,
      action: "patient_discharged",
      resourceType: "patient_roster",
      resourceId: `${params.orgId}_${params.patientUserId}`,
      patientUserId: params.patientUserId,
      orgId: params.orgId,
      details: params.details,
      outcome: "success",
    });
  }

  async logConsentGranted(params: {
    actorId: string;
    userId: string;
    orgId: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.log({
      actorId: params.actorId,
      actorType: "user",
      actorOrgId: params.orgId,
      action: "consent_granted",
      resourceType: "consent",
      resourceId: `${params.userId}_${params.orgId}`,
      patientUserId: params.userId,
      orgId: params.orgId,
      details: params.details,
      outcome: "success",
    });
  }

  async logConsentRevoked(params: {
    actorId: string;
    userId: string;
    orgId: string;
  }): Promise<void> {
    await this.log({
      actorId: params.actorId,
      actorType: "user",
      actorOrgId: params.orgId,
      action: "consent_revoked",
      resourceType: "consent",
      resourceId: `${params.userId}_${params.orgId}`,
      patientUserId: params.userId,
      orgId: params.orgId,
      outcome: "success",
    });
  }

  async logRoleChanged(params: {
    actorId: string;
    orgId: string;
    targetUserId: string;
    details: { previousRole: string; newRole: string };
  }): Promise<void> {
    await this.log({
      actorId: params.actorId,
      actorType: "user",
      actorOrgId: params.orgId,
      action: "role_changed",
      resourceType: "org_member",
      resourceId: `${params.orgId}_${params.targetUserId}`,
      orgId: params.orgId,
      details: params.details,
      outcome: "success",
    });
  }

  async logApiKeyUsed(params: {
    apiKeyId: string;
    orgId: string;
    resourceType: string;
    resourceId: string;
    patientUserId?: string;
    outcome: AuditTrailEntry["outcome"];
    denialReason?: string;
  }): Promise<void> {
    await this.log({
      actorId: params.apiKeyId,
      actorType: "api_key",
      actorOrgId: params.orgId,
      action: "api_key_used",
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      patientUserId: params.patientUserId,
      orgId: params.orgId,
      outcome: params.outcome,
      denialReason: params.denialReason,
    });
  }

  async logWebhookTriggered(params: {
    orgId: string;
    patientUserId: string;
    details: Record<string, unknown>;
    outcome: AuditTrailEntry["outcome"];
  }): Promise<void> {
    await this.log({
      actorId: "system",
      actorType: "system",
      actorOrgId: params.orgId,
      action: "webhook_triggered",
      resourceType: "webhook",
      resourceId: params.orgId,
      patientUserId: params.patientUserId,
      orgId: params.orgId,
      details: params.details,
      outcome: params.outcome,
    });
  }

  /**
   * Generic action log for any AuditAction not covered by the convenience methods.
   */
  async logAction(params: {
    actorId: string;
    actorType: AuditTrailEntry["actorType"];
    action: AuditAction;
    resourceType: string;
    resourceId: string;
    patientUserId?: string;
    orgId?: string;
    actorOrgId?: string;
    details?: Record<string, unknown>;
    outcome: AuditTrailEntry["outcome"];
    denialReason?: string;
  }): Promise<void> {
    await this.log(params);
  }
}

export const auditService = new AuditService();
