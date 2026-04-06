import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
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
  },
  (t) => [
    index("push_receipts_user_idx").on(t.userId, t.sentAt),
    index("push_receipts_status_idx").on(t.status),
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
