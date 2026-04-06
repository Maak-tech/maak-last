import {
  pgTable,
  text,
  timestamp,
  jsonb,
  numeric,
  integer,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Families ───────────────────────────────────────────────────────────────────

export const families = pgTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
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
    // 'all' (default) means unrestricted access.
    // Any other entries are allowlist: ['vitals','symptoms','medications','moods','labs','allergies','medical_history']
    sharingScope: jsonb("sharing_scope")
      .$type<string[]>()
      .default(["all"]),
  },
  (t) => [
    index("family_members_family_idx").on(t.familyId),
    // Prevent a user from being added to the same family twice.
    // All auth queries use .limit(1); duplicate rows would make them non-deterministic.
    unique("family_members_unique_member").on(t.familyId, t.userId),
  ]
);

// ── Family Health Summary ──────────────────────────────────────────────────────
// Materialized denormalization updated on every health write.
// Allows a caregiver to load all family members' health status in a single query
// instead of N×8 queries (one per member per data type).

export const familyHealthSummary = pgTable(
  'family_health_summary',
  {
    id: text('id').primaryKey(),
    familyId: text('family_id').notNull(),
    userId: text('user_id').notNull(),
    // Latest readings snapshot (updated on each health write)
    lastVitalAt: timestamp('last_vital_at', { withTimezone: true }),
    lastSymptomAt: timestamp('last_symptom_at', { withTimezone: true }),
    lastMoodAt: timestamp('last_mood_at', { withTimezone: true }),
    lastMedicationTakenAt: timestamp('last_medication_taken_at', { withTimezone: true }),
    // VHI summary
    vhiScore: numeric('vhi_score'),
    vhiRisk: text('vhi_risk'),                        // 'low' | 'moderate' | 'high' | 'critical'
    vhiUpdatedAt: timestamp('vhi_updated_at', { withTimezone: true }),
    // Active alert counts
    activeAlertCount: integer('active_alert_count').default(0),
    criticalAlertCount: integer('critical_alert_count').default(0),
    // Medication adherence (rolling 7 days)
    medicationAdherenceRate: numeric('medication_adherence_rate'),
    // Last update
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex('family_health_summary_family_user_idx').on(t.familyId, t.userId),
    index('family_health_summary_family_updated_idx').on(t.familyId, t.updatedAt.desc()),
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
  // notNull: an invitation without an expiry would be permanently valid —
  // every issued code must have an explicit TTL enforced at the DB level.
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  usedBy: text("used_by"),
  emailSentAt: timestamp("email_sent_at"),  // null = email not yet sent or delivery unknown
  createdAt: timestamp("created_at").defaultNow(),
});
