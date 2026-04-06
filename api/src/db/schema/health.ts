import {
  pgTable,
  text,
  timestamp,
  numeric,
  jsonb,
  boolean,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core";

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
    updatedAt: timestamp("updated_at").defaultNow(),
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
    updatedAt: timestamp("updated_at").defaultNow(),
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
    updatedAt: timestamp("updated_at").defaultNow(),
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
  // @deprecated: Use medication_reminders table instead. This field is kept for
  // backward compatibility but will be removed in a future migration.
  // Do not write to this field; reads should prefer medication_reminders rows.
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
  // Soft-delete: non-null means the record has been deleted; null means live.
  // Use isNull(medications.deletedAt) in all SELECT queries.
  deletedAt: timestamp("deleted_at"),
});

export const medicationReminders = pgTable(
  "medication_reminders",
  {
    id: text("id").primaryKey(),
    medicationId: text("medication_id").notNull().references(() => medications.id, { onDelete: 'cascade' }),
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

// ── Allergies ──────────────────────────────────────────────────────────────────

export const allergies = pgTable("allergies", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  substance: text("substance").notNull(),
  reaction: text("reaction"),
  severity: text("severity"), // 'mild' | 'moderate' | 'severe' | 'life_threatening'
  diagnosedDate: timestamp("diagnosed_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  // Soft-delete: non-null means the record has been deleted; null means live.
  // Use isNull(allergies.deletedAt) in all SELECT queries.
  deletedAt: timestamp("deleted_at"),
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
    // Soft-delete: non-null means the record has been deleted; null means live.
    // Use isNull(clinicalNotes.deletedAt) in all SELECT queries.
    deletedAt: timestamp("deleted_at"),
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Virtual Health Identity (VHI) ─────────────────────────────────────────────

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

export const vhi = pgTable("vhi", {
  userId: text("user_id").primaryKey(),
  version: integer("version").default(1),
  computedAt: timestamp("computed_at"),
  data: jsonb("data").$type<VirtualHealthIdentityData>(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── VHI Snapshots ──────────────────────────────────────────────────────────────
// Archives every VHI computation result for retrospective analysis and
// HIPAA breach investigation. vhi table only keeps the latest; this keeps all.
export const vhiSnapshots = pgTable(
  "vhi_snapshots",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
    computedAt: timestamp("computed_at").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    triggeredBy: text("triggered_by"), // 'vhiCycle' | 'manual' | 'wearable_sync' etc.
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("vhi_snapshots_user_version_idx").on(t.userId, t.version),
    index("vhi_snapshots_user_time_idx").on(t.userId, t.computedAt),
  ]
);

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
    updatedAt: timestamp("updated_at").defaultNow(),
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
    index("alerts_user_created_idx").on(t.userId, t.createdAt),
  ]
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
    status: text("status").notNull().default("active"),  // DB trigger derives from resolvedAt/acknowledgedAt
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

// ── Patient Agent State (Org) ─────────────────────────────────────────────────

export const patientAgentState = pgTable("patient_agent_state", {
  id: text("id").primaryKey(),  // format: "{orgId}_{userId}"
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
  state: jsonb("state"),
  lastAgentRunAt: timestamp("last_agent_run_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// ── Connected Integrations ─────────────────────────────────────────────────────
// Stores provider user IDs for third-party health integrations (Withings, Fitbit, Oura, etc.)
// so that server-side webhooks can route incoming notifications to the correct Nuralix user.
// The providerUserId is the ID assigned to this user by the external provider (e.g. Withings userid).
export const connectedIntegrations = pgTable(
  "connected_integrations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(), // 'withings' | 'fitbit' | 'oura' | 'garmin' | 'dexcom'
    providerUserId: text("provider_user_id").notNull(), // provider-assigned user ID
    isActive: boolean("is_active").notNull().default(true),
    connectedAt: timestamp("connected_at").defaultNow().notNull(),
    disconnectedAt: timestamp("disconnected_at"),
    metadata: jsonb("metadata"), // provider-specific data (scopes, region, etc.)
  },
  (t) => [
    index("connected_integrations_user_idx").on(t.userId),
    index("connected_integrations_provider_idx").on(t.provider, t.providerUserId),
    unique("connected_integrations_unique_provider").on(t.userId, t.provider),
  ]
);
