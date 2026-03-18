export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  familyId?: string;
  role: 'admin' | 'member';
  createdAt: Date;
  onboardingCompleted: boolean;
  preferences: {
    language: 'en' | 'ar';
    notifications: boolean;
    emergencyContacts: string[];
  };
}

export interface Symptom {
  id: string;
  userId: string;
  type: string;
  severity: 1 | 2 | 3 | 4 | 5;
  description?: string;
  timestamp: Date;
  location?: string;
  triggers?: string[];
}

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: Date;
  endDate?: Date;
  reminders: MedicationReminder[];
  notes?: string;
  isActive: boolean;
}

export interface MedicationReminder {
  id: string;
  time: string;
  taken: boolean;
  takenAt?: Date | any; // Can be Date or Firestore Timestamp
}

export interface MedicalHistory {
  id: string;
  userId: string;
  condition: string;
  diagnosedDate?: Date;
  severity?: 'mild' | 'moderate' | 'severe';
  notes?: string;
  isFamily: boolean;
  relation?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  avatar?: string;
  userId?: string;
  inviteStatus: 'pending' | 'accepted' | 'none';
  lastActive?: Date;
  healthScore?: number;
}

export interface VitalSign {
  id: string;
  userId: string;
  type: 'heartRate' | 'bloodPressure' | 'temperature' | 'weight' | 'bloodSugar';
  value: number;
  unit: string;
  timestamp: Date;
  source: 'manual' | 'device' | 'clinic';
}

export interface EmergencyAlert {
  id: string;
  userId: string;
  type: 'fall' | 'emergency' | 'medication' | 'vitals';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  responders?: string[];
}

export interface FamilyInvitationCode {
  id: string;
  code: string;
  familyId: string;
  invitedBy: string; // userId who created the invitation
  invitedUserName: string;
  invitedUserRelation: string;
  status: 'pending' | 'used' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
  usedBy?: string; // userId who used the code
}

export interface Family {
  id: string;
  name: string;
  createdBy: string;
  members: string[]; // array of user IDs
  status: 'active' | 'inactive';
  createdAt: Date;
<<<<<<< Updated upstream
}
=======
  createdBy: string;
  patientCount: number;
};

export type PatientRosterStatus =
  | "active"
  | "inactive"
  | "discharged"
  | "revoked";

export type ConsentScope =
  | "vitals"
  | "medications"
  | "symptoms"
  | "lab_results"
  | "ai_analysis"
  | "data_export"
  | "wearable_data";

export type PatientRoster = {
  id: string;
  orgId: string;
  userId: string;
  displayName?: string;
  enrolledAt: Date;
  enrolledBy: string;
  status: PatientRosterStatus;
  cohortIds: string[];
  assignedProviders: string[];
  riskScore?: number;
  lastContact?: Date;
  dischargedAt?: Date;
  dischargeReason?: string;
  consentGrantedAt?: Date;
  consentScope: ConsentScope[];
};

// ─── HIPAA Audit Trail (append-only) ─────────────────────────────────────────

export type AuditAction =
  | "phi_read"
  | "phi_write"
  | "phi_delete"
  | "phi_export"
  | "login"
  | "logout"
  | "api_key_created"
  | "api_key_revoked"
  | "api_key_used"
  | "role_changed"
  | "patient_enrolled"
  | "patient_discharged"
  | "consent_granted"
  | "consent_revoked"
  | "agent_action"
  | "alert_created"
  | "alert_resolved"
  | "webhook_triggered";

export type AuditTrailEntry = {
  id: string;
  timestamp: Date;
  actorId: string;
  actorType: "user" | "system" | "agent" | "api_key";
  actorOrgId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  patientUserId?: string;
  orgId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  outcome: "success" | "failure" | "denied";
  denialReason?: string;
};

// ─── Patient Consent Management ───────────────────────────────────────────────

export type ConsentGrantMethod =
  | "in_app"
  | "provider_initiated"
  | "sms_link"
  | "admin_granted";

export type PatientConsent = {
  id: string;
  userId: string;
  orgId: string;
  grantedAt: Date;
  grantedBy: string;
  grantMethod: ConsentGrantMethod;
  scope: ConsentScope[];
  version: string;
  revokedAt?: Date;
  revokedBy?: string;
  isActive: boolean;
};

// ─── API Keys (Integration Surface) ──────────────────────────────────────────

export type ApiKeyScope =
  | "vitals:read"
  | "vitals:write"
  | "medications:read"
  | "anomalies:read"
  | "alerts:read"
  | "risk:read"
  | "org:read"
  | "patients:read";

export type ApiKey = {
  id: string;
  orgId: string;
  name: string;
  keyPrefix: string; // First 16 chars for display (e.g., "nk_live_a1b2c3d4")
  keyHash: string; // SHA-256 hash stored for server-side lookup
  scopes: ApiKeyScope[];
  rateLimit: number; // requests per minute
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
};

// ─── Outbound Webhooks ────────────────────────────────────────────────────────

export type WebhookEventType =
  | "vital.anomaly"
  | "vital.critical"
  | "alert.created"
  | "alert.resolved"
  | "medication.missed"
  | "patient.risk_escalated"
  | "discovery.new"
  | "wearable.synced";

export type WebhookEndpoint = {
  id: string;
  orgId: string;
  name: string;
  url: string;
  signingSecret: string; // HMAC-SHA256 signing secret
  events: WebhookEventType[];
  isActive: boolean;
  createdAt: Date;
  createdBy: string;
  lastTriggeredAt?: Date;
  failureCount: number;
};

export type WebhookDeliveryStatus = "pending" | "delivered" | "failed" | "dead";

export type WebhookDelivery = {
  id: string;
  webhookId: string;
  orgId: string;
  event: WebhookEventType;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  responseCode?: number;
  responseBody?: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  error?: string;
};

// ─── Task Management (Sprint 4) ───────────────────────────────────────────────

export type TaskType =
  | "follow_up"
  | "medication_review"
  | "vital_check"
  | "call_patient"
  | "escalation_review"
  | "care_plan_update";

export type TaskPriority = "urgent" | "high" | "normal" | "low";

export type TaskStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "escalated"
  | "cancelled";

export type TaskSource = "agent" | "manual" | "pathway" | "alert";

export type Task = {
  id: string;
  orgId: string;
  patientId: string;
  assignedTo?: string; // userId of care coordinator / provider
  assignedBy: string; // userId or "agent"
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  source: TaskSource;
  title: string;
  description?: string;
  context?: {
    patientSummary?: string;
    reasonForTask?: string;
    relatedAnomalyId?: string;
    relatedAlertId?: string;
    riskScore?: number;
  };
  dueAt?: Date;
  completedAt?: Date;
  completedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Agentic State (Sprint 4) ─────────────────────────────────────────────────

export type AgentActionType =
  | "patient_nudge"
  | "task_created"
  | "provider_alert"
  | "escalation_triggered"
  | "webhook_fired"
  | "no_action";

export type AgentAction = {
  id: string;
  type: AgentActionType;
  timestamp: Date;
  reasoning: string;
  outcome?: "success" | "failure" | "pending";
  taskId?: string;
  alertId?: string;
};

export type PatientAgentState = {
  id: string; // "{orgId}_{userId}"
  orgId: string;
  userId: string;
  lastCycleAt: Date;
  nextCycleAt: Date;
  riskScore: number;
  openActionsCount: number;
  agentNotes: string; // rolling narrative
  actionHistory: AgentAction[];
  updatedAt: Date;
};

// ─── Care Pathways (Sprint 6) ─────────────────────────────────────────────────

export type PathwayStepAction =
  | "push_patient"
  | "sms_patient"
  | "email_patient"
  | "create_task"
  | "notify_provider"
  | "webhook"
  | "nora_message"
  | "wait";

export type PathwayStep = {
  id: string;
  delay: string; // "0m" | "2h" | "1d" | "1w"
  condition?: string; // evaluated expression: "riskScore > 70"
  action: PathwayStepAction;
  actionParams: Record<string, unknown>;
  onSuccess?: string; // next step id
  onFailure?: string; // escalation step id
};

export type PathwayDefinition = {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  triggerCondition: string; // "discharge" | "risk_escalated" | "medication_missed"
  isActive: boolean;
  steps: PathwayStep[];
  createdAt: Date;
  createdBy: string;
};

export type PathwayEnrollmentStatus =
  | "active"
  | "completed"
  | "paused"
  | "cancelled";

export type PathwayEnrollment = {
  id: string;
  orgId: string;
  patientId: string;
  pathwayId: string;
  status: PathwayEnrollmentStatus;
  currentStepId: string;
  enrolledAt: Date;
  nextStepAt: Date;
  completedAt?: Date;
  cancelledReason?: string;
};

// ─── Email Notifications (Sprint 6) ──────────────────────────────────────────

export type EmailChannel =
  | "weekly_report"
  | "critical_alert"
  | "patient_digest"
  | "org_summary"
  | "consent_revocation";

export type EmailTemplate = {
  id: string;
  orgId: string;
  channel: EmailChannel;
  subject: string;
  bodyHtml: string;
  language: "en" | "ar";
  isActive: boolean;
  createdAt: Date;
};

export * from "./clinicalNote";
export * from "./vhi";
export * from "./genetics";
>>>>>>> Stashed changes
