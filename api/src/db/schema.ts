import {
  pgTable,
  text,
  timestamp,
  numeric,
  jsonb,
  boolean,
  integer,
  index,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

// ── Users ──────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name"),
  phone: text("phone"),
  dateOfBirth: timestamp("date_of_birth"),
  gender: text("gender"),
  bloodType: text("blood_type"),
  heightCm: numeric("height_cm"),
  weightKg: numeric("weight_kg"),
  language: text("language").default("en"),
  familyId: text("family_id"),
  avatarUrl: text("avatar_url"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  // User preferences (dashboard widget layout, notification prefs, UI settings)
  preferences: jsonb("preferences").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Families ───────────────────────────────────────────────────────────────────

export const families = pgTable("families", {
  id: text("id").primaryKey(),
  name: text("name"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const familyMembers = pgTable(
  "family_members",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").default("member"), // 'admin' | 'member' | 'caregiver'
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (t) => [
    index("family_members_family_idx").on(t.familyId),
    // Prevent a user from being added to the same family twice.
    // All auth queries use .limit(1); duplicate rows would make them non-deterministic.
    unique("family_members_unique_member").on(t.familyId, t.userId),
  ]
);

export const familyInvitations = pgTable("family_invitations", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull(),
  invitedBy: text("invited_by").notNull(),
  inviteCode: text("invite_code").unique().notNull(),
  email: text("email"),
  invitedUserName: text("invited_user_name"),
  invitedUserRelation: text("invited_user_relation"),
  status: text("status").default("pending"), // 'pending' | 'used' | 'expired'
  expiresAt: timestamp("expires_at"),
  usedAt: timestamp("used_at"),
  usedBy: text("used_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Vitals ─────────────────────────────────────────────────────────────────────

export const vitals = pgTable(
  "vitals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(), // 'heart_rate' | 'blood_pressure' | 'weight' | 'temperature' | etc.
    value: numeric("value"),
    valueSecondary: numeric("value_secondary"), // diastolic for blood_pressure
    unit: text("unit"),
    source: text("source"), // 'manual' | 'healthkit' | 'health_connect' | 'fitbit' | 'oura' | 'garmin' | 'withings' | 'dexcom'
    recordedAt: timestamp("recorded_at").notNull(),
    metadata: jsonb("metadata").$type<{
      device?: string;
      accuracy?: "high" | "medium" | "low";
      heartRateVariability?: number;
      sleepStage?: string;
    }>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("vitals_user_time_idx").on(t.userId, t.recordedAt),
    index("vitals_user_type_idx").on(t.userId, t.type),
  ]
);

// ── Symptoms ───────────────────────────────────────────────────────────────────

export const symptoms = pgTable(
  "symptoms",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    severity: integer("severity"), // 1-5
    location: text("location"),
    duration: integer("duration"), // minutes
    triggers: text("triggers").array(),
    notes: text("notes"),
    tags: text("tags").array(),
    recordedAt: timestamp("recorded_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("symptoms_user_time_idx").on(t.userId, t.recordedAt)]
);

// ── Moods ──────────────────────────────────────────────────────────────────────

export const moods = pgTable(
  "moods",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(), // 'happy' | 'sad' | 'anxious' | 'overwhelmed' | etc.
    intensity: integer("intensity"), // 1-5
    activities: text("activities").array(),
    notes: text("notes"),
    recordedAt: timestamp("recorded_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("moods_user_time_idx").on(t.userId, t.recordedAt)]
);

// ── Medications ────────────────────────────────────────────────────────────────

export const medications = pgTable("medications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  dosage: text("dosage"),
  frequency: text("frequency"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  instructions: text("instructions"),
  prescribedBy: text("prescribed_by"),
  refillDate: timestamp("refill_date"),
  quantity: integer("quantity"),
  notes: text("notes"),
  // Embedded reminders array (client format: [{id, time, taken, takenAt?, takenBy?}])
  // Mirrors Firestore's embedded sub-array pattern for backward compatibility.
  reminders: jsonb("reminders").$type<
    Array<{
      id: string;
      time: string; // "HH:MM"
      taken: boolean;
      takenAt?: string | null; // ISO date string
      takenBy?: string;
    }>
  >(),
  // User-defined tags for organisation / filtering
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const medicationReminders = pgTable(
  "medication_reminders",
  {
    id: text("id").primaryKey(),
    medicationId: text("medication_id").notNull(),
    userId: text("user_id").notNull(),
    scheduledAt: timestamp("scheduled_at").notNull(),
    status: text("status").default("pending"), // 'pending' | 'taken' | 'missed' | 'snoozed'
    takenAt: timestamp("taken_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("reminders_user_scheduled_idx").on(t.userId, t.scheduledAt),
    index("reminders_medication_idx").on(t.medicationId),
  ]
);

// ── Medical History ────────────────────────────────────────────────────────────

export const medicalHistory = pgTable("medical_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  condition: text("condition").notNull(),
  diagnosedDate: timestamp("diagnosed_date"),
  severity: text("severity"), // 'mild' | 'moderate' | 'severe'
  notes: text("notes"),
  isFamily: boolean("is_family").default(false),
  relation: text("relation"),
  familyMemberId: text("family_member_id"),
  familyMemberName: text("family_member_name"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const allergies = pgTable("allergies", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  substance: text("substance").notNull(),
  reaction: text("reaction"),
  severity: text("severity"), // 'mild' | 'moderate' | 'severe' | 'life_threatening'
  diagnosedDate: timestamp("diagnosed_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Lab Results ────────────────────────────────────────────────────────────────

export const labResults = pgTable("lab_results", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  testName: text("test_name").notNull(),
  testType: text("test_type"), // 'blood' | 'urine' | 'imaging' | 'other'
  testDate: timestamp("test_date").notNull(),
  orderedBy: text("ordered_by"),
  facility: text("facility"),
  results: jsonb("results").$type<
    Array<{
      name: string;
      value: string | number;
      unit?: string;
      referenceRange?: string;
      flag?: "high" | "low" | "critical" | "normal";
    }>
  >(),
  notes: text("notes"),
  attachmentKey: text("attachment_key"), // Tigris object key
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Clinical Notes (Doctor Notes) ─────────────────────────────────────────────

export const clinicalNotes = pgTable(
  "clinical_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    noteDate: timestamp("note_date").notNull(),
    source: text("source"), // 'manual' | 'fhir_import' | 'pdf_upload' | 'provider_typed'
    providerName: text("provider_name"),
    specialty: text("specialty"),
    facility: text("facility"),
    noteType: text("note_type").default("progress"), // 'soap' | 'progress' | 'discharge' | 'referral' | 'other'
    soap: jsonb("soap").$type<{
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
    }>(),
    content: text("content"), // free-text fallback
    extractedData: jsonb("extracted_data").$type<{
      mentionedConditions?: string[];
      mentionedMedications?: string[];
      mentionedAllergies?: string[];
      recommendedActions?: string[];
      followUpDate?: string;
      riskMentions?: string[];
    }>(),
    attachmentKey: text("attachment_key"), // Tigris object key for PDF
    isProcessed: boolean("is_processed").default(false),
    tags: text("tags").array(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("clinical_notes_user_date_idx").on(t.userId, t.noteDate)]
);

// ── Women's Health ─────────────────────────────────────────────────────────────

// period_cycles: one row per individual period (start/end dates + flow data)
export const periodCycles = pgTable("period_cycles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  cycleLength: integer("cycle_length"),
  flowIntensity: text("flow_intensity"), // 'light' | 'medium' | 'heavy'
  symptoms: text("symptoms").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cycleDailyEntries = pgTable("cycle_daily_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  cycleId: text("cycle_id"),
  date: timestamp("date").notNull(),
  flow: text("flow"),                   // 'none' | 'spotting' | 'light' | 'medium' | 'heavy' (flowIntensity)
  cramps: integer("cramps"),            // 0-3 (crampsSeverity)
  mood: integer("mood"),                // 1-5
  energy: integer("energy"),            // 1-5 (energyLevel)
  sleepQuality: integer("sleep_quality"), // 1-5
  dischargeType: text("discharge_type"),
  spotting: boolean("spotting"),
  birthControlMethod: text("birth_control_method"),
  birthControlTaken: boolean("birth_control_taken"),
  birthControlSideEffects: text("birth_control_side_effects").array(),
  symptoms: text("symptoms").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// ── Genetics ───────────────────────────────────────────────────────────────────

export const genetics = pgTable("genetics", {
  userId: text("user_id").primaryKey(),
  provider: text("provider"), // '23andme' | 'ancestry' | 'raw_vcf' | 'manual'
  processingStatus: text("processing_status").default("pending"), // 'pending' | 'processing' | 'processed' | 'failed'
  prsScores: jsonb("prs_scores").$type<
    Array<{
      condition: string;
      prsScore: number;
      percentile: number;
      snpCount: number;
      ancestryGroup: string;
      level: "low" | "average" | "elevated" | "high";
    }>
  >(),
  clinvarVariants: jsonb("clinvar_variants").$type<
    Array<{
      rsid: string;
      gene: string;
      condition: string;
      pathogenicity: "benign" | "likely_benign" | "vus" | "likely_pathogenic" | "pathogenic";
      clinicalSignificance: string;
      evidenceLevel: "strong" | "moderate" | "exploratory";
    }>
  >(),
  pharmacogenomics: jsonb("pharmacogenomics").$type<
    Array<{
      gene: string;
      drug: string;
      interaction: "standard" | "reduced_efficacy" | "increased_toxicity" | "contraindicated";
      clinicalAnnotation: string;
    }>
  >(),
  twinRelevantConditions: text("twin_relevant_conditions").array(),
  familySharingConsent: boolean("family_sharing_consent").default(false),
  familySharingConsentTimestamp: timestamp("family_sharing_consent_timestamp"),
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  uploadedAt: timestamp("uploaded_at"),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
});

// ── Virtual Health Identity (VHI) ─────────────────────────────────────────────

export const vhi = pgTable("vhi", {
  userId: text("user_id").primaryKey(),
  version: integer("version").default(1),
  computedAt: timestamp("computed_at"),
  data: jsonb("data").$type<VirtualHealthIdentityData>(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// VHI data type — stored as JSONB for flexibility
export type VirtualHealthIdentityData = {
  baselineConfidence: number;
  baselineWindowDays: number;
  currentState: {
    overallScore: number;
    dimensions: Record<
      string,
      {
        currentValue: number | null;
        baselineValue: number | null;
        zScore: number | null;
        direction: "above" | "below" | "stable" | "unknown";
        deviation: "none" | "mild" | "moderate" | "significant";
        trend7d: "worsening" | "stable" | "improving" | "insufficient";
        lastDataAt: string | null;
        isStale: boolean;
      }
    >;
    riskScores: {
      fallRisk: { score: number; drivers: string[]; confidence: number };
      adherenceRisk: { score: number; drivers: string[]; confidence: number };
      deteriorationRisk: { score: number; drivers: string[]; confidence: number };
      geneticRiskLoad: { score: number; drivers: string[]; confidence: number };
      compositeRisk: number;
      trajectory: "worsening" | "stable" | "improving";
    };
  };
  geneticBaseline: {
    hasGeneticData: boolean;
    prsScores: Array<{ condition: string; percentile: number; level: string }>;
    protectiveVariants: string[];
    riskVariants: string[];
    pharmacogenomics: Array<{ drug: string; interaction: string; gene: string }>;
    ancestryGroup: string;
  } | null;
  careContext: {
    activeConditions: string[];
    activeAllergies: Array<{ substance: string; severity: string }>;
    activeMedications: Array<{ name: string; adherence: number }>;
    labAbnormalities: Array<{ test: string; value: string; flag: string }>;
    recentDoctorNotes: Array<{
      date: string;
      provider: string;
      keyPoints: string[];
    }>;
    lastClinicianVisit?: string;
    pendingFollowUps: string[];
  };
  elevatingFactors: Array<{
    factor: string;
    category: "genetic" | "behavioral" | "clinical" | "environmental";
    impact: "high" | "medium" | "low";
    source: string[];
    explanation: string;
  }>;
  decliningFactors: Array<{
    factor: string;
    category: "genetic" | "behavioral" | "clinical" | "environmental";
    impact: "high" | "medium" | "low";
    source: string[];
    explanation: string;
    recommendation: string;
  }>;
  pendingActions: Array<{
    id: string;
    target: "patient" | "caregiver" | "provider";
    priority: "urgent" | "high" | "normal" | "low";
    actionType: "nudge" | "caregiver_alert" | "provider_alert" | "follow_up_reminder";
    title: string;
    rationale: string;
    dispatched: boolean;
    dispatchedAt?: string;
    acknowledged: boolean;
    acknowledgedAt?: string;
  }>;
  noraContextBlock: string;
};

// ── Health Timeline ────────────────────────────────────────────────────────────

export const healthTimeline = pgTable(
  "health_timeline",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    ingestedAt: timestamp("ingested_at").defaultNow(),
    source: text("source").notNull(), // event type
    domain: text("domain"), // 'vitals' | 'behavior' | 'symptoms' | 'clinical' | 'twin'
    value: numeric("value"),
    unit: text("unit"),
    zScoreAtIngestion: numeric("z_score_at_ingestion"),
    vhiVersion: integer("vhi_version"),
    sourceDocId: text("source_doc_id"),
    sourceTable: text("source_table"),
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("timeline_user_time_idx").on(t.userId, t.occurredAt),
    index("timeline_user_domain_idx").on(t.userId, t.domain),
    index("timeline_user_source_idx").on(t.userId, t.source),
  ]
);

// ── Alerts ─────────────────────────────────────────────────────────────────────

export const alerts = pgTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    familyId: text("family_id"),
    type: text("type").notNull(), // 'fall' | 'medication' | 'vital' | 'vhi' | 'emergency'
    severity: text("severity").notNull(), // 'low' | 'medium' | 'high' | 'critical'
    title: text("title").notNull(),
    body: text("body"),
    isAcknowledged: boolean("is_acknowledged").default(false),
    acknowledgedBy: text("acknowledged_by"),
    acknowledgedAt: timestamp("acknowledged_at"),
    resolvedAt: timestamp("resolved_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("alerts_user_idx").on(t.userId),
    index("alerts_family_idx").on(t.familyId),
  ]
);

// ── Push Tokens ────────────────────────────────────────────────────────────────

export const pushTokens = pgTable("push_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  // unique() is required — notifications.ts uses onConflictDoUpdate({ target: [pushTokens.token] })
  // which needs a DB-level unique constraint to resolve the conflict target.
  token: text("token").notNull().unique(),
  platform: text("platform"), // 'ios' | 'android' | 'web'
  deviceId: text("device_id"),
  deviceName: text("device_name"),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Organizations (B2B) ────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type"), // 'clinic' | 'employer' | 'insurer' | 'telehealth' | 'wellness'
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  logoKey: text("logo_key"),
  settings: jsonb("settings"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").default("coordinator"), // 'admin' | 'coordinator' | 'provider' | 'viewer'
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (t) => [
    // Prevent duplicate org membership rows — auth queries rely on .limit(1)
    unique("org_members_unique_member").on(t.orgId, t.userId),
  ]
);

export const patientRosters = pgTable(
  "patient_rosters",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    enrolledBy: text("enrolled_by"),
    status: text("status").default("active"), // 'active' | 'inactive' | 'pending'
    enrolledAt: timestamp("enrolled_at").defaultNow(),
  },
  (t) => [
    // Prevent duplicate roster entries — duplicate rows cause webhookDispatcher
    // to fire multiple deliveries for the same patient/org pair.
    unique("patient_rosters_unique_enrollment").on(t.orgId, t.userId),
  ]
);

// ── SDK: API Keys & Webhooks ───────────────────────────────────────────────────

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  keyHash: text("key_hash").notNull(), // hashed, never stored plain
  keyPrefix: text("key_prefix").notNull(), // e.g. 'nk_live_abc123...' for display
  name: text("name"),
  scopes: text("scopes").array(), // ['vhi:read', 'fhir:export', 'webhook:write']
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  url: text("url").notNull(),
  events: text("events").array(), // ['vhi.risk_elevated', 'alert.fall_detected', 'medication.missed']
  secret: text("secret").notNull(), // for HMAC webhook signature verification
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: text("id").primaryKey(),
  endpointId: text("endpoint_id").notNull(),
  event: text("event").notNull(),
  payload: jsonb("payload"),
  status: text("status").default("pending"), // 'pending' | 'delivered' | 'failed'
  attempts: integer("attempts").default(0),
  lastError: text("last_error"),
  nextRetryAt: timestamp("next_retry_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Nora Conversations ─────────────────────────────────────────────────────────

export const noraConversations = pgTable(
  "nora_conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    messages: jsonb("messages").$type<
      Array<{
        role: "user" | "assistant" | "system";
        content: string;
        timestamp: string;
      }>
    >(),
    vhiVersionAtStart: integer("vhi_version_at_start"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("nora_conversations_user_idx").on(t.userId)]
);

// ── Subscriptions ──────────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  plan: text("plan").default("free"), // 'free' | 'individual' | 'family' | 'org'
  status: text("status").default("active"), // 'active' | 'expired' | 'cancelled' | 'trial'
  revenueCatCustomerId: text("revenue_cat_customer_id"),
  autumnCustomerId: text("autumn_customer_id"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Audit Trail ────────────────────────────────────────────────────────────────

export const auditTrail = pgTable(
  "audit_trail",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    actorId: text("actor_id"), // who performed the action
    actorType: text("actor_type"), // 'user' | 'caregiver' | 'org_member' | 'system' | 'api_key'
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("audit_user_idx").on(t.userId),
    index("audit_actor_idx").on(t.actorId),
  ]
);

// ── Caregiver Notes ────────────────────────────────────────────────────────────

export const caregiverNotes = pgTable("caregiver_notes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  memberId: text("member_id").notNull(),
  caregiverId: text("caregiver_id").notNull(),
  caregiverName: text("caregiver_name"),
  note: text("note").notNull(),
  tags: text("tags").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Calendar Events ────────────────────────────────────────────────────────────

export const calendarEvents = pgTable("calendar_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  familyId: text("family_id"),
  title: text("title").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  allDay: boolean("all_day").default(false),
  location: text("location"),
  recurrencePattern: text("recurrence_pattern"),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  recurrenceCount: integer("recurrence_count"),
  relatedItemId: text("related_item_id"),
  relatedItemType: text("related_item_type"),
  color: text("color"),
  reminders: jsonb("reminders").$type<Array<{ minutesBefore: number; sent: boolean }>>(),
  tags: text("tags").array().default([]),
  attendees: jsonb("attendees").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("cal_events_user_idx").on(t.userId, t.startDate)]);

// ── Tasks ──────────────────────────────────────────────────────────────────────

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text("org_id").notNull(),
  patientId: text("patient_id").notNull(),
  assignedBy: text("assigned_by").notNull(),
  assignedTo: text("assigned_to"),
  type: text("type").notNull(),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("open"),
  source: text("source").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  context: jsonb("context"),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  completedBy: text("completed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("tasks_org_idx").on(t.orgId, t.status)]);

// ── User Health Baselines ──────────────────────────────────────────────────────

export const userBaselines = pgTable("user_baselines", {
  userId: text("user_id").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  computedAt: timestamp("computed_at").defaultNow(),
  lastNotificationAt: timestamp("last_notification_at"),
});

// ── Notification Templates ─────────────────────────────────────────────────────
// Org-branded push / SMS notification templates.
// Key: orgId + type + channel — upserted on save, deleted on reset.

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    orgId: text("org_id").notNull(),
    type: text("type").notNull(), // critical_alert | medication_missed | vital_stale | risk_nudge | task_assigned
    channel: text("channel").notNull(), // push | sms
    titleTemplate: text("title_template").notNull(),
    bodyTemplate: text("body_template").notNull(),
    language: text("language").notNull().default("en"),
    isActive: boolean("is_active").notNull().default(true),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("notification_templates_org_idx").on(t.orgId)]
);

// ── PPG Embeddings ─────────────────────────────────────────────────────────────

export const ppgEmbeddings = pgTable(
  "ppg_embeddings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    embeddings: jsonb("embeddings").$type<number[]>().notNull(),
    heartRate: numeric("heart_rate"),
    hrv: numeric("hrv"),
    respiratoryRate: numeric("respiratory_rate"),
    signalQuality: numeric("signal_quality").notNull(),
    confidence: numeric("confidence"),
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
  },
  (t) => [index("ppg_embeddings_user_idx").on(t.userId)]
);

// ── Escalations ────────────────────────────────────────────────────────────────

export const escalations = pgTable(
  "escalations",
  {
    id: text("id").primaryKey(),
    alertId: text("alert_id"),
    userId: text("user_id").notNull(),
    familyId: text("family_id"),
    type: text("type").notNull(),          // 'fall' | 'medication' | 'vital' | 'vhi'
    severity: text("severity").notNull(),  // 'low' | 'medium' | 'high' | 'critical'
    status: text("status").default("active"),  // 'active' | 'acknowledged' | 'resolved'
    currentLevel: integer("current_level").default(1),
    acknowledgedBy: text("acknowledged_by"),
    acknowledgedAt: timestamp("acknowledged_at"),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at"),
    resolutionNotes: text("resolution_notes"),
    notificationsSent: jsonb("notifications_sent").$type<string[]>().default([]),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("escalations_user_idx").on(t.userId),
    index("escalations_family_idx").on(t.familyId),
  ]
);

// ── Anomalies ─────────────────────────────────────────────────────────────────

export const anomalies = pgTable(
  "anomalies",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    vitalType: text("vital_type").notNull(),
    value: numeric("value"),
    baselineValue: numeric("baseline_value"),
    zScore: numeric("z_score"),
    severity: text("severity").default("warning"),  // 'warning' | 'critical'
    isAcknowledged: boolean("is_acknowledged").default(false),
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("anomalies_user_idx").on(t.userId),
    index("anomalies_user_detected_idx").on(t.userId, t.detectedAt),
  ]
);

// ── Patient Agent State (Org) ─────────────────────────────────────────────────

export const patientAgentState = pgTable("patient_agent_state", {
  id: text("id").primaryKey(),  // format: "{orgId}_{userId}"
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
  state: jsonb("state"),
  lastAgentRunAt: timestamp("last_agent_run_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Medication Adherence ───────────────────────────────────────────────────────

export const medicationAdherence = pgTable(
  "medication_adherence",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    medicationId: text("medication_id"),
    reminderId: text("reminder_id"),
    status: text("status").notNull(),         // 'taken' | 'missed' | 'skipped'
    scheduledAt: timestamp("scheduled_at"),
    takenAt: timestamp("taken_at"),
    dose: text("dose"),
    notes: text("notes"),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (t) => [
    index("medication_adherence_user_idx").on(t.userId),
    index("medication_adherence_med_idx").on(t.medicationId),
  ]
);

// ── Clinical Integration Requests ─────────────────────────────────────────────

export const clinicalIntegrationRequests = pgTable(
  "clinical_integration_requests",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    requesterId: text("requester_id"),
    patientId: text("patient_id"),
    integrationType: text("integration_type").notNull(),  // 'ehr' | 'lab' | 'pharmacy'
    status: text("status").default("pending"),             // 'pending' | 'approved' | 'rejected'
    requestData: jsonb("request_data"),
    responseData: jsonb("response_data"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("clinical_integration_org_idx").on(t.orgId),
    index("clinical_integration_patient_idx").on(t.patientId),
  ]
);

// ── Care Pathways ──────────────────────────────────────────────────────────────

export const carePathways = pgTable(
  "care_pathways",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    triggerCondition: text("trigger_condition"),
    steps: jsonb("steps").$type<unknown[]>().default([]),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("care_pathways_org_idx").on(t.orgId)]
);

export const pathwayEnrollments = pgTable(
  "pathway_enrollments",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    pathwayId: text("pathway_id").notNull(),
    patientId: text("patient_id").notNull(),
    status: text("status").default("active"),   // 'active' | 'completed' | 'paused' | 'discontinued'
    currentStepId: text("current_step_id"),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    nextStepAt: timestamp("next_step_at"),
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("pathway_enrollments_org_idx").on(t.orgId),
    index("pathway_enrollments_patient_idx").on(t.patientId),
  ]
);

// ── Patient Consents ──────────────────────────────────────────────────────────
// Append-only audit trail for HIPAA compliance.
// Revocations set isActive = false — records are never deleted.

export const patientConsents = pgTable(
  "patient_consents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    orgId: text("org_id").notNull(),
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
    grantedBy: text("granted_by").notNull(),
    grantMethod: text("grant_method").notNull(), // 'in_app' | 'provider_initiated' | 'sms_link' | 'admin_granted'
    scope: text("scope").array().default([]),     // ConsentScope[]
    version: text("version").notNull().default("1.0"),
    isActive: boolean("is_active").notNull().default(true),
    revokedAt: timestamp("revoked_at"),
    revokedBy: text("revoked_by"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("patient_consents_user_idx").on(t.userId),
    index("patient_consents_org_idx").on(t.orgId),
    index("patient_consents_user_org_idx").on(t.userId, t.orgId),
  ]
);

// ── Cohorts ───────────────────────────────────────────────────────────────────
// Org-scoped patient groupings by condition, program, or custom criteria.
// patientCount is computed at query time — no denormalised counter column.

export const cohorts = pgTable(
  "cohorts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    condition: text("condition"),
    program: text("program"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("cohorts_org_idx").on(t.orgId)]
);

// Join table: which patients belong to which cohort.
// One patient can belong to multiple cohorts within the same org.
export const cohortMembers = pgTable(
  "cohort_members",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    cohortId: text("cohort_id").notNull(),
    orgId: text("org_id").notNull(),
    userId: text("user_id").notNull(),
    enrolledBy: text("enrolled_by").notNull(),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  },
  (t) => [
    index("cohort_members_cohort_idx").on(t.cohortId),
    index("cohort_members_org_idx").on(t.orgId),
    // Each patient can only appear once per cohort.
    unique("cohort_members_unique_member").on(t.cohortId, t.userId),
  ]
);
