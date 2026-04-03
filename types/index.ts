export type AvatarType = 'default' | 'custom' | 'initials' | 'man' | 'woman' | 'boy' | 'girl' | 'grandpa' | 'grandma';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  isPrimary?: boolean;
}

export interface User {
  id: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  avatarType?: AvatarType;
  familyId?: string;
  role: 'admin' | 'member' | 'caregiver';
  gender?: string;
  dateOfBirth?: Date;
  bloodType?: string;
  phone?: string;
  createdAt: Date;
  onboardingCompleted: boolean;
  dashboardTourCompleted?: boolean;
  isPremium?: boolean;
  preferences: {
    language: 'en' | 'ar';
    notifications: boolean;
    emergencyContacts: EmergencyContact[];
    careTeam?: Array<{ name: string; role: string; phone?: string }>;
  };
}

export interface Symptom {
  id: string;
  userId: string;
  type: string;
  severity: number;
  description?: string;
  timestamp: Date;
  location?: string;
  triggers?: string[];
  tags?: string[];
}

export interface Mood {
  id: string;
  userId: string;
  mood: 'happy' | 'good' | 'neutral' | 'sad' | 'anxious' | 'stressed' | 'energetic' | 'tired' | 'angry' | 'calm' | 'overwhelmed';
  intensity: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  timestamp: Date;
  activities?: string[];
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
  tags?: string[];
  quantity?: number;
  refillDate?: Date;
  pharmacy?: string;
  prescriber?: string;
  purpose?: string;
}

export interface MedicationReminder {
  id: string;
  time: string;
  taken: boolean;
  takenAt?: Date | string; // ISO string from API or Date object in client
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
  familyMemberId?: string;
  familyMemberName?: string;
  tags?: string[];
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
  type: 'fall' | 'emergency' | 'medication' | 'vitals' | 'caregiver_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  responders?: string[];
  metadata?: Record<string, unknown>;
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

// ─── Organization ────────────────────────────────────────────────────────────

export type OrgPlan = "starter" | "growth" | "enterprise" | "free";

export type OrgType = "clinic" | "hospital" | "pharmacy" | "research" | "other";

export type OrgRole =
  | "org_admin"
  | "provider"
  | "care_coordinator"
  | "viewer";

export interface Organization {
  id: string;
  name: string;
  type?: string;
  plan: OrgPlan;
  createdAt: Date;
  createdBy: string;
  isActive: boolean;
  settings?: Record<string, unknown>;
  billing?: {
    seatCount: number;
    patientCount: number;
  };
}

export interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  displayName: string;
  email?: string;
  role: OrgRole;
  specialty?: string;
  invitedBy: string;
  isActive: boolean;
  joinedAt?: Date;
}

export interface OrgCohort {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  condition?: string;
  program?: string;
  createdAt: Date;
  createdBy: string;
  patientCount: number;
}

// ─── Allergy ─────────────────────────────────────────────────────────────────

export interface Allergy {
  id: string;
  userId?: string;
  name: string;
  substance?: string;
  reaction?: string;
  severity?:
    | "mild"
    | "moderate"
    | "severe"
    | "severe-life-threatening"
    | "life_threatening";
  diagnosedDate?: string | Date;
  discoveredDate?: Date;
  timestamp?: Date;
  status?: string;
  notes?: string;
}

// ─── Clinical Integration ────────────────────────────────────────────────────

export type ClinicalIntegrationType = "clinic" | "lab" | "radiology";

export type ClinicalIntegrationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "connected";

export interface ClinicalIntegrationRequest {
  id: string;
  userId: string;
  type: ClinicalIntegrationType;
  status: ClinicalIntegrationStatus;
  providerName?: string;
  providerAddress?: string;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
}

// ─── Lab Results ─────────────────────────────────────────────────────────────

export interface LabResultValue {
  name: string;
  value: number | string;
  unit?: string;
  referenceRange?: string;
  status?: "normal" | "high" | "low" | "abnormal" | "critical";
}

export interface LabResult {
  id: string;
  userId: string;
  testName: string;
  testType: "blood" | "urine" | "imaging" | "other";
  testDate: Date;
  orderedBy?: string;
  facility?: string;
  results: LabResultValue[];
  notes?: string;
  attachments?: string[];
  tags?: string[];
}

// ─── Cycle Tracking ───────────────────────────────────────────────────────────

export interface CycleDailyEntry {
  id: string;
  userId: string;
  date: Date;
  flowIntensity?: "none" | "light" | "medium" | "heavy" | "spotting";
  crampsSeverity?: 0 | 1 | 2 | 3;
  mood?: 1 | 2 | 3 | 4 | 5;
  sleepQuality?: 1 | 2 | 3 | 4 | 5;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  dischargeType?: "none" | "clear" | "white" | "yellow" | "brown" | "other";
  spotting?: boolean;
  birthControlMethod?:
    | "none"
    | "pill"
    | "condom"
    | "iud"
    | "patch"
    | "ring"
    | "injection"
    | "implant"
    | "other";
  birthControlTaken?: boolean;
  birthControlSideEffects?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Calendar Events ──────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  userId: string;
  familyId?: string;
  title: string;
  type:
    | "appointment"
    | "medication"
    | "reminder"
    | "cycle"
    | "lab"
    | "vaccination"
    | "exercise"
    | "other";
  description?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  location?: string;
  recurrencePattern?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  recurrenceEndDate?: Date;
  recurrenceCount?: number;
  relatedItemId?: string;
  relatedItemType?: string;
  color?: string;
  reminders?: Array<{ minutesBefore: number; sent: boolean }>;
  tags?: string[];
  attendees?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Period Tracking ──────────────────────────────────────────────────────────

export interface PeriodEntry {
  id: string;
  userId: string;
  startDate: Date;
  endDate?: Date;
  flowIntensity?: "none" | "light" | "medium" | "heavy" | "spotting";
  symptoms?: string[];
  notes?: string;
  createdAt: Date;
}

export interface PeriodCycle {
  id: string;
  userId: string;
  averageCycleLength: number;
  averagePeriodLength: number;
  lastPeriodStart: Date;
  nextPeriodPredicted: Date;
  nextPeriodWindowStart: Date;
  nextPeriodWindowEnd: Date;
  ovulationPredicted: Date;
  predictionConfidence: number;
  cycleLengthStdDev?: number;
  updatedAt: Date;
}

export * from "./clinicalNote";
export * from "./vhi";
export * from "./genetics";
