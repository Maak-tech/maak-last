import {
  pgTable,
  text,
  timestamp,
  numeric,
  jsonb,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
// NOTE: families is imported here solely to attach the FK reference on users.familyId.
// Drizzle resolves table references lazily via the () => ... thunk, so this import does
// NOT create a runtime circular dependency as long as family.ts does not import users.ts
// at the top level (it doesn't — family.ts has no imports from this file).
import { families } from "./family.js";

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
  // FK → families.id; SET NULL when the family is deleted so the user record survives.
  familyId: text("family_id").references(() => families.id, { onDelete: "set null" }),
  // Self-referential FK for minor patients whose account is managed by a guardian.
  // SET NULL rather than CASCADE so a minor's record is not deleted if the guardian
  // account is removed — the clinical history must be retained.
  // eslint-disable-next-line @typescript-eslint/no-use-before-define -- self-referential FK; Drizzle resolves lazily
  guardianId: text("guardian_id").references((): any => users.id, { onDelete: "set null" }), // null for adults; references another users.id for minors
  avatarUrl: text("avatar_url"),
  // Legacy single-contact fields — kept for backward compatibility.
  // New code should use emergencyContacts (JSONB array) instead.
  // These will be dropped in migration 0008 after full deploy.
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  // Ordered list of emergency contacts.  Primary contact first.
  // Shape: [{ name, phone, relation, isPrimary }]
  emergencyContacts: jsonb("emergency_contacts")
    .$type<Array<{ name: string; phone: string; relation: string; isPrimary: boolean }>>()
    .default([]),
  // User preferences (dashboard widget layout, notification prefs, UI settings)
  preferences: jsonb("preferences").$type<Record<string, unknown>>(),
  // Set to true whenever health data changes (vitals/symptoms/moods writes, realtime notify).
  // vhiCycle reads only dirty users instead of all users, then clears the flag after recompute.
  vhiDirty: boolean("vhi_dirty").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
},
(t) => [
  // Partial index: only indexes rows where vhi_dirty = true.
  // vhiCycle scans this index to find users needing recompute — keeps the scan
  // O(dirty_count) instead of O(total_users).
  index('users_vhi_dirty_idx').on(t.vhiDirty).where(sql`vhi_dirty = true`),
]);

// ── Consent Policies ──────────────────────────────────────────────────────────
// Defines the current required version for each policy type.
// When CURRENT_VERSION changes, users who accepted an older version are
// flagged as needing to re-consent before accessing gated features.
//
// Policy types:
//   'terms_of_service'   — general app terms
//   'privacy_policy'     — data handling and HIPAA authorization
//   'genetic_data'       — consent to process and store DNA data
//   'caregiver_sharing'  — consent to share health data with family admins
//   'research_opt_in'    — optional consent to contribute de-identified data to research
//
// Gated consent: routes can call `isConsentCurrent(userId, policyType)` before
// returning sensitive data, and return 451 (Unavailable For Legal Reasons) if
// the user needs to re-consent.
export const consentPolicies = pgTable("consent_policies", {
  // e.g. 'privacy_policy', 'terms_of_service', 'genetic_data'
  policyType: text("policy_type").primaryKey(),
  // Semantic version string, e.g. '2.1' — increment MINOR for non-material changes,
  // MAJOR for changes that require explicit re-consent.
  currentVersion: text("current_version").notNull(),
  // Human-readable summary of what changed in this version
  changesSummary: text("changes_summary"),
  // URL to the full policy document
  documentUrl: text("document_url"),
  effectiveAt: timestamp("effective_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

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
    // Which policy this consent covers (links to consentPolicies.policyType)
    policyType: text("policy_type").default("privacy_policy"),
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

// ── Feature Flags ──────────────────────────────────────────────────────────────
//
// Simple server-side feature flags for gradual rollout of new capabilities.
//
// A flag can be:
//   - globally on/off (enabledForAll)
//   - on for a % of users (rolloutPercent, 0–100)
//   - on for specific user IDs (enabledUserIds JSONB array)
//   - on for specific org IDs (enabledOrgIds JSONB array)
//
// Evaluation order (first matching rule wins):
//   1. If enabledUserIds contains the userId → ON
//   2. If enabledOrgIds contains the orgId → ON
//   3. If enabledForAll → ON
//   4. If rolloutPercent > 0 → ON for deterministic % based on hash(userId + flagName)
//   5. Otherwise → OFF
export const featureFlags = pgTable("feature_flags", {
  // Stable kebab-case identifier, e.g. 'ddi-warnings', 'vhi-genetics-tab'
  name: text("name").primaryKey(),
  description: text("description"),
  enabledForAll: boolean("enabled_for_all").notNull().default(false),
  // 0 = off, 100 = on for everyone in rollout
  rolloutPercent: integer("rollout_percent").notNull().default(0),
  // JSONB arrays of user IDs / org IDs to enable individually
  enabledUserIds: jsonb("enabled_user_ids").$type<string[]>().default([]),
  enabledOrgIds: jsonb("enabled_org_ids").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── User Health Baselines ──────────────────────────────────────────────────────

export const userBaselines = pgTable("user_baselines", {
  userId: text("user_id").primaryKey(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  computedAt: timestamp("computed_at").defaultNow(),
  lastNotificationAt: timestamp("last_notification_at"),
});

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
