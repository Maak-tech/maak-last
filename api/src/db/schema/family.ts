import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  unique,
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
