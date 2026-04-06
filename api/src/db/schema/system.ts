import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  uuid,
  varchar,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";

// ── Job Heartbeats ─────────────────────────────────────────────────────────────
//
// Each cron job upserts a row here on every successful run.
// The /health endpoint (and external monitors like Better Uptime) can query
// this table to detect jobs that have stopped firing.
//
// Expected interval is stored so a monitoring tool can compute "last seen X
// minutes ago vs expected every Y minutes" without hardcoding schedules.
export const jobHeartbeats = pgTable("job_heartbeats", {
  // Stable job identifier — matches the name in railway.json
  jobName: text("job_name").primaryKey(),
  lastRunAt: timestamp("last_run_at").notNull(),
  // How often the job is expected to run (seconds). Allows automated staleness checks.
  expectedIntervalSeconds: integer("expected_interval_seconds").notNull(),
  // Optional: last known exit status ('ok' | 'error') and error message
  status: text("status").notNull().default("ok"), // 'ok' | 'error'
  errorMessage: text("error_message"),
  // Total successful runs since the row was first inserted
  runCount: integer("run_count").notNull().default(1),
});

// ── Job Locks ──────────────────────────────────────────────────────────────────
// Distributed locking for cron jobs that may run on multiple Railway instances.
// Uses an atomic INSERT + PK conflict instead of pg_try_advisory_lock, which is
// session-scoped and therefore does not work with the Neon HTTP driver.
export const jobLocks = pgTable('job_locks', {
  jobName: text('job_name').primaryKey(),
  lockedAt: timestamp('locked_at').notNull().defaultNow(),
  lockedUntil: timestamp('locked_until').notNull(),
  instanceId: text('instance_id').notNull(),
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
    index("audit_user_created_at_idx").on(t.userId, t.createdAt),
  ]
);

// ── i18n Content ───────────────────────────────────────────────────────────────
// Server-managed translations for dynamic content (alert messages, medication
// reminders, etc.).  The mobile app fetches these via GET /api/v1/i18n/:locale/:namespace
// so translated content can be updated without a new app release.
//
// Namespaces: 'alerts' | 'medications' | 'vitals' | 'nora' | 'common'
// Locales:    'en' | 'ar' | 'fr' | 'ur'
// Template vars use {{placeholder}} syntax — interpolated at runtime.
export const i18nContent = pgTable(
  "i18n_content",
  {
    id: text("id").primaryKey(),
    contentKey: text("content_key").notNull(),   // e.g. 'alert.heart_rate.above_threshold'
    locale: text("locale").notNull(),            // 'en' | 'ar' | 'fr' | 'ur'
    value: text("value").notNull(),              // translated string (may contain {{placeholders}})
    namespace: text("namespace").notNull().default("common"), // 'alerts' | 'medications' | 'vitals' | 'nora' | 'common'
    placeholders: jsonb("placeholders"),         // { "value": "number", "unit": "string" } — describes template vars
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("i18n_content_key_locale_idx").on(t.contentKey, t.locale),
    index("i18n_content_namespace_locale_idx").on(t.namespace, t.locale),
  ]
);

// ── Nora Message Feedback ──────────────────────────────────────────────────────

export const noraMessageFeedback = pgTable(
  'nora_message_feedback',
  {
    id:              uuid('id').primaryKey().defaultRandom(),
    userId:          uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    conversationId:  varchar('conversation_id', { length: 100 }).notNull(),
    messageId:       varchar('message_id', { length: 100 }).notNull(),
    rating:          integer('rating').notNull(), // 1-5
    flag:            varchar('flag', { length: 30 }),
    // 'wrong', 'harmful', 'unhelpful', 'helpful'
    reviewedByTeam:  boolean('reviewed_by_team').notNull().default(false),
    createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('idx_nora_feedback_user').on(t.userId, t.createdAt),
    reviewIdx: index('idx_nora_feedback_unreviewed').on(t.reviewedByTeam).where(sql`reviewed_by_team = false`),
  }),
)

// ── Population Norms ───────────────────────────────────────────────────────────

export const populationNorms = pgTable(
  'population_norms',
  {
    id:            uuid('id').primaryKey().defaultRandom(),
    metricType:    varchar('metric_type', { length: 50 }).notNull(),
    ageBand:       varchar('age_band', { length: 20 }).notNull(), // '18-29', '30-44', '45-59', '60-74', '75+'
    biologicalSex: varchar('biological_sex', { length: 10 }).notNull(), // 'M', 'F', 'all'
    p5:   numeric('p5',  { precision: 10, scale: 4 }),
    p25:  numeric('p25', { precision: 10, scale: 4 }),
    p50:  numeric('p50', { precision: 10, scale: 4 }),
    p75:  numeric('p75', { precision: 10, scale: 4 }),
    p95:  numeric('p95', { precision: 10, scale: 4 }),
    source:    varchar('source', { length: 200 }).notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  },
  (t) => ({
    lookupIdx: index('idx_pop_norms_lookup').on(t.metricType, t.ageBand, t.biologicalSex),
  }),
)
