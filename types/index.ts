export type AvatarType =
  | "man"
  | "woman"
  | "boy"
  | "girl"
  | "grandma"
  | "grandpa";

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
};

export type CareTeamMember = {
  id: string;
  name: string;
  specialty: string;
  phone?: string;
  email?: string;
};

export type User = {
  id: string;
  email?: string;
  phoneNumber?: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  avatarType?: AvatarType;
  gender?: "male" | "female" | "other";
  /** Date of birth — used for accurate age-based risk assessment. Optional for backwards compatibility. */
  dateOfBirth?: Date;
  familyId?: string;
  role: "admin" | "member" | "caregiver";
  createdAt: Date;
  onboardingCompleted: boolean;
  dashboardTourCompleted?: boolean;
  isPremium?: boolean;
  preferences: {
    language: "en" | "ar";
    notifications: boolean;
    emergencyContacts: EmergencyContact[];
    careTeam?: CareTeamMember[];
  };
};

export type Symptom = {
  id: string;
  userId: string;
  type: string;
  severity: 1 | 2 | 3 | 4 | 5;
  description?: string;
  timestamp: Date;
  location?: string;
  triggers?: string[];
  tags?: string[]; // User-defined tags for organization
};

export type MoodType =
  // Positive emotions
  | "veryHappy"
  | "happy"
  | "excited"
  | "content"
  | "grateful"
  | "hopeful"
  | "proud"
  | "calm"
  | "peaceful"
  // Negative emotions
  | "sad"
  | "verySad"
  | "anxious"
  | "angry"
  | "frustrated"
  | "overwhelmed"
  | "hopeless"
  | "guilty"
  | "ashamed"
  | "lonely"
  | "irritable"
  | "restless"
  // Neutral/Other mental states
  | "neutral"
  | "confused"
  | "numb"
  | "detached"
  | "empty"
  | "apathetic"
  | "tired"
  | "stressed";

export type Mood = {
  id: string;
  userId: string;
  mood: MoodType;
  intensity: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  timestamp: Date;
  activities?: string[];
};

export type Medication = {
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
  // Refill tracking fields
  quantity?: number; // Current quantity (e.g., number of pills)
  quantityUnit?: string; // Unit of quantity (e.g., "pills", "tablets", "ml", "doses")
  lastRefillDate?: Date; // Date when medication was last refilled
  refillReminderDays?: number; // Days before running out to send reminder (default: 7)
  tags?: string[]; // User-defined tags for organization
};

export type MedicationReminder = {
  id: string;
  time: string;
  taken: boolean;
  takenAt?: Date | unknown; // Can be Date or Firestore Timestamp
  takenBy?: string;
};

export type MedicalHistory = {
  id: string;
  userId: string;
  condition: string;
  diagnosedDate?: Date;
  severity?: "mild" | "moderate" | "severe";
  notes?: string;
  isFamily: boolean;
  relation?: string;
  familyMemberId?: string; // ID of the family member this record belongs to
  familyMemberName?: string; // Name of the family member for display
  tags?: string[]; // User-defined tags for organization
};

export type Allergy = {
  id: string;
  userId: string;
  name: string;
  severity: "mild" | "moderate" | "severe" | "severe-life-threatening";
  reaction?: string;
  notes?: string;
  discoveredDate?: Date;
  timestamp: Date;
};

export type FamilyMember = {
  id: string;
  name: string;
  relation: string;
  avatar?: string;
  userId?: string;
  inviteStatus: "pending" | "accepted" | "none";
  lastActive?: Date;
  healthScore?: number;
};

export type Family = {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  status?: "active" | "inactive" | "archived" | string;
  createdAt: Date;
};

export type FamilyInvitationCodeStatus = "pending" | "used" | "expired";

export type FamilyInvitationCode = {
  id: string;
  code: string;
  familyId: string;
  invitedBy: string;
  invitedUserName: string;
  invitedUserRelation: string;
  status: FamilyInvitationCodeStatus;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
};

export type EmergencyAlertType = "fall" | "medication" | "emergency" | string;
export type EmergencyAlertSeverity =
  | "low"
  | "medium"
  | "high"
  | "warning"
  | "critical"
  | string;

export type EmergencyAlert = {
  id: string;
  userId: string;
  type: EmergencyAlertType;
  severity: EmergencyAlertSeverity;
  message: string;
  timestamp: Date;
  responders?: string[];
  acknowledged?: boolean;
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  metadata?: Record<string, unknown>;
};

export type LabResult = {
  id: string;
  userId: string;
  testName: string;
  testType: "blood" | "urine" | "imaging" | "other";
  testDate: Date;
  orderedBy?: string; // Doctor/clinic name
  facility?: string; // Lab/hospital name
  results: LabResultValue[];
  notes?: string;
  attachments?: string[]; // URLs to PDFs or images
  tags?: string[];
};

export type LabResultValue = {
  name: string; // e.g., "Glucose", "Cholesterol", "Hemoglobin"
  value: number | string; // Can be numeric or text (e.g., "Negative", "Positive")
  unit?: string; // e.g., "mg/dL", "mmol/L", "%"
  referenceRange?: string; // e.g., "70-100 mg/dL"
  status?: "normal" | "high" | "low" | "abnormal" | "critical";
  flagged?: boolean; // Whether this result was flagged by the lab
};

export type VitalSign = {
  id: string;
  userId: string;
  type: "heartRate" | "bloodPressure" | "temperature" | "weight" | "bloodSugar";
  value: number;
  unit: string;
  timestamp: Date;
  source: "manual" | "device" | "clinic";
};

export type ClinicalIntegrationType = "clinic" | "lab" | "radiology";

export type ClinicalIntegrationStatus =
  | "pending"
  | "connected"
  | "error"
  | "disconnected"
  | "approved"
  | "rejected";

export type ClinicalIntegration = {
  id: string;
  userId: string;
  type: ClinicalIntegrationType;
  name: string;
  status: ClinicalIntegrationStatus;
  lastSync?: Date;
  settings?: Record<string, unknown>;
};

export type ClinicalIntegrationRequest = {
  id: string;
  userId: string;
  type: ClinicalIntegrationType;
  providerName: string;
  portalUrl?: string;
  patientId?: string;
  notes?: string;
  status: ClinicalIntegrationStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type RecurrencePattern =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "custom"
  | "asNeeded";

export type CalendarEventType =
  | "appointment"
  | "medication"
  | "symptom"
  | "lab_result"
  | "vaccination"
  | "reminder"
  | "other";

export type CalendarEventReminder = {
  minutesBefore: number;
  sent: boolean;
  sentAt?: Date;
};

export type CalendarEvent = {
  id: string;
  userId: string;
  title: string;
  type: CalendarEventType;
  description?: string;
  startDate: Date;
  endDate?: Date;
  familyId?: string;
  allDay?: boolean;
  location?: string;
  recurrence?: RecurrencePattern;
  recurrencePattern?: RecurrencePattern;
  recurrenceEndDate?: Date;
  recurrenceCount?: number;
  reminderMinutes?: number[];
  reminders?: CalendarEventReminder[];
  color?: string;
  tags?: string[];
  relatedItemId?: string;
  relatedItemType?: string;
  attendees?: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export type MedicationInteractionAlert = {
  id: string;
  userId: string;
  type: "medication_interaction" | "new_medication_interaction" | string;
  severity: "major" | "moderate" | "minor" | string;
  title: string;
  message: string;
  medications: string[];
  effects: string[];
  recommendations: string[];
  timestamp: Date;
  acknowledged?: boolean;
  actionable?: boolean;
};

// Period tracking types
export type PeriodEntry = {
  id: string;
  userId: string;
  startDate: Date;
  endDate?: Date;
  flowIntensity?: "light" | "medium" | "heavy";
  symptoms?: string[]; // e.g., "cramps", "bloating", "headache", "mood swings"
  notes?: string;
  createdAt: Date;
};

export type DischargeType =
  | "none"
  | "dry"
  | "sticky"
  | "creamy"
  | "eggWhite"
  | "watery"
  | "other";

export type BirthControlMethod =
  | "none"
  | "pill"
  | "patch"
  | "ring"
  | "iud"
  | "implant"
  | "injection"
  | "other";

export type CycleDailyEntry = {
  id: string;
  userId: string;
  date: Date; // local date at midnight
  flowIntensity?: "none" | "light" | "medium" | "heavy";
  crampsSeverity?: 0 | 1 | 2 | 3; // 0 none -> 3 severe
  mood?: 1 | 2 | 3 | 4 | 5;
  sleepQuality?: 1 | 2 | 3 | 4 | 5;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  dischargeType?: DischargeType;
  spotting?: boolean;
  birthControlMethod?: BirthControlMethod;
  birthControlTaken?: boolean;
  birthControlSideEffects?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
};

export type PeriodCycle = {
  id: string;
  userId: string;
  averageCycleLength?: number; // Average days between periods
  averagePeriodLength?: number; // Average days of period
  lastPeriodStart?: Date;
  nextPeriodPredicted?: Date;
  nextPeriodWindowStart?: Date;
  nextPeriodWindowEnd?: Date;
  ovulationPredicted?: Date;
  predictionConfidence?: number; // 0..1
  cycleLengthStdDev?: number;
  updatedAt: Date;
};

// ─── Organization Layer (B2B Multi-tenancy) ───────────────────────────────────

export type OrgType =
  | "clinic"
  | "hospital"
  | "employer"
  | "insurer"
  | "homecare";

export type OrgPlan = "starter" | "growth" | "enterprise";

export type OrgRole = "org_admin" | "provider" | "care_coordinator" | "viewer";

export type Organization = {
  id: string;
  name: string;
  type: OrgType;
  plan: OrgPlan;
  createdAt: Date;
  createdBy: string;
  settings: {
    timezone: string;
    language: "en" | "ar";
    branding?: {
      logoUrl?: string;
      primaryColor?: string;
    };
    alertThresholds?: Record<string, number>;
    features: string[];
    dataRegion: "us" | "eu" | "uae";
    /** Number of years to retain patient health data before archiving (GDPR/KSA compliance). */
    retentionYears?: number;
  };
  billing?: {
    seatCount: number;
    patientCount: number;
    subscriptionId?: string;
    currentPeriodEnd?: Date;
  };
};

export type OrgMember = {
  id: string;
  orgId: string;
  userId: string;
  role: OrgRole;
  displayName: string;
  email?: string;
  specialty?: string;
  joinedAt: Date;
  invitedBy: string;
  isActive: boolean;
};

export type OrgCohort = {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  condition?: string;
  program?: string;
  createdAt: Date;
  createdBy: string;
  patientCount: number;
};

export type PatientRosterStatus = "active" | "inactive" | "discharged" | "revoked";

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
  keyPrefix: string; // First 16 chars for display (e.g., "mk_live_a1b2c3d4")
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
  | "zeina_message"
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
