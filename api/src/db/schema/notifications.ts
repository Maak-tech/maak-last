import {
  pgTable,
  text,
  timestamp,
  numeric,
  jsonb,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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

// ── Push Delivery Receipts ─────────────────────────────────────────────────────

export const pushDeliveryReceipts = pgTable(
  "push_delivery_receipts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    token: text("token").notNull(),
    // Expo ticket ID returned from the push send API
    messageId: text("message_id"),
    title: text("title"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
    status: text("status").notNull().default("sent"), // 'sent' | 'delivered' | 'failed' | 'not_registered'
    errorCode: text("error_code"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    // Deduplication key — when set, a unique index prevents duplicate sends
    // for the same logical notification (e.g. same alert cycle).
    idempotencyKey: text("idempotency_key"),
  },
  (t) => [
    index("push_receipts_user_idx").on(t.userId, t.sentAt),
    index("push_receipts_status_idx").on(t.status),
    uniqueIndex("push_receipts_idempotency_idx").on(t.idempotencyKey),
  ]
);

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

// ── Notification Rules ─────────────────────────────────────────────────────────
// Configurable per-user alert thresholds — replaces hardcoded alert logic.

export const notificationRules = pgTable(
  "notification_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    setByUserId: text("set_by_user_id").notNull(),    // self or caregiver/admin
    metricType: text("metric_type").notNull(),         // 'heart_rate' | 'blood_pressure_systolic' | 'blood_glucose' | 'spo2' | 'weight_change'
    condition: text("condition").notNull(),            // 'above' | 'below' | 'change_by' | 'no_reading_for'
    threshold: numeric("threshold").notNull(),
    thresholdUnit: text("threshold_unit"),
    severity: text("severity").notNull().default("warning"),  // 'info' | 'warning' | 'critical'
    notifyPatient: boolean("notify_patient").default(true),
    notifyCaregivers: boolean("notify_caregivers").default(true),
    notifyEmergencyContacts: boolean("notify_emergency_contacts").default(false),
    cooldownMinutes: integer("cooldown_minutes").default(60),  // don't re-alert within this window
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("notification_rules_user_metric_idx").on(t.userId, t.metricType),
    index("notification_rules_active_idx").on(t.isActive, t.userId),
  ]
);

// ── Notification Queue ─────────────────────────────────────────────────────────
// Reliable async notification delivery — replaces synchronous fire-and-forget push.

export const notificationQueue = pgTable(
  "notification_queue",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    channel: text("channel").notNull(),               // 'push' | 'sms' | 'email'
    title: text("title"),
    body: text("body").notNull(),
    dataJson: jsonb("data_json"),                     // screen routing data
    idempotencyKey: text("idempotency_key").unique(), // prevent duplicate sends
    status: text("status").notNull().default("pending"),  // 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("notification_queue_pending_idx").on(t.status, t.scheduledFor),
    uniqueIndex("notification_queue_idempotency_idx").on(t.idempotencyKey),
  ]
);
