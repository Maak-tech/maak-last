import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";

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
    riskScore: integer("risk_score"),                           // 0-100 composite VHI risk score
    lastContactAt: timestamp("last_contact_at"),                // last time a provider contacted the patient
    assignedProviders: text("assigned_providers").array(),      // array of org_member user IDs assigned to this patient
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
  keyHash: text("key_hash").notNull().unique(), // hashed, never stored plain; unique for O(1) lookup
  keyPrefix: text("key_prefix").notNull(), // e.g. 'nk_live_abc123...' for display
  name: text("name"),
  scopes: text("scopes").array(), // ['vhi:read', 'fhir:export', 'webhook:write']
  // Per-key rate limit (requests per minute). Defaults to 100.
  // The ApiKey type references this field — it must exist in the schema.
  rateLimit: integer("rate_limit").default(100).notNull(),
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
  // Tracks consecutive delivery failures for circuit-breaker logic.
  // The WebhookEndpoint type references this field — it must exist in the schema.
  failureCount: integer("failure_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    endpointId: text("endpoint_id").notNull(),
    event: text("event").notNull(),
    payload: jsonb("payload"),
    // Canonical body string used to compute HMAC signature.
    // Storing the exact JSON string used for the original delivery ensures that
    // retries sign the same bytes — re-serializing from JSONB can produce a
    // different key order which would invalidate the signature.
    canonicalBody: text("canonical_body"),
    status: text("status").default("pending"), // 'pending' | 'delivered' | 'failed'
    attempts: integer("attempts").default(0),
    lastError: text("last_error"),
    nextRetryAt: timestamp("next_retry_at"),
    deliveredAt: timestamp("delivered_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("webhook_deliveries_endpoint_idx").on(t.endpointId)]
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
