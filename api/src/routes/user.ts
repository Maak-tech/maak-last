/**
 * User profile and preferences routes.
 *
 * Own-user routes  (prefix: /api/user)
 *   GET  /api/user/profile      → own profile fields
 *   PATCH /api/user/profile     → update own profile
 *   GET  /api/user/preferences   → JSONB preferences blob
 *   PUT  /api/user/preferences   → replace preferences blob (full overwrite)
 *   PATCH /api/user/preferences  → atomically merge partial keys into preferences blob
 *
 * Cross-user routes  (prefix: /api/users)  — for admin + family operations
 *   GET  /api/users/:userId          → get any user's full profile (own or family admin)
 *   PATCH /api/users/:userId         → update any user's profile (own or family admin)
 *   PATCH /api/users/:userId/role    → update user role (family admin only)
 */

import { Elysia, t } from "elysia";
import { eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { users, familyMembers, orgMembers, organizations } from "../db/schema";

export const userRoutes = new Elysia({ prefix: "/api/user" })
  .use(requireAuth)

  // ── Profile ──────────────────────────────────────────────────────────────────

  .get(
    "/profile",
    async ({ db, userId, set }) => {
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          dateOfBirth: users.dateOfBirth,
          gender: users.gender,
          bloodType: users.bloodType,
          heightCm: users.heightCm,
          weightKg: users.weightKg,
          language: users.language,
          familyId: users.familyId,
          avatarUrl: users.avatarUrl,
          emergencyContactName: users.emergencyContactName,
          emergencyContactPhone: users.emergencyContactPhone,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      return user;
    },
    { detail: { tags: ["user"], summary: "Get current user profile" } }
  )

  .patch(
    "/profile",
    async ({ db, userId, body }) => {
      const updateData: Partial<typeof users.$inferInsert> = {};

      if (body.name !== undefined) updateData.name = body.name;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.dateOfBirth !== undefined)
        updateData.dateOfBirth = new Date(body.dateOfBirth);
      if (body.gender !== undefined) updateData.gender = body.gender;
      if (body.bloodType !== undefined) updateData.bloodType = body.bloodType;
      if (body.heightCm !== undefined)
        updateData.heightCm = body.heightCm?.toString();
      if (body.weightKg !== undefined)
        updateData.weightKg = body.weightKg?.toString();
      if (body.language !== undefined) updateData.language = body.language;
      if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;
      if (body.emergencyContactName !== undefined)
        updateData.emergencyContactName = body.emergencyContactName;
      if (body.emergencyContactPhone !== undefined)
        updateData.emergencyContactPhone = body.emergencyContactPhone;

      updateData.updatedAt = new Date();

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          name: users.name,
          gender: users.gender,
          bloodType: users.bloodType,
          updatedAt: users.updatedAt,
        });

      return updated;
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        dateOfBirth: t.Optional(t.String()),
        gender: t.Optional(t.String()),
        bloodType: t.Optional(t.String()),
        heightCm: t.Optional(t.Number()),
        weightKg: t.Optional(t.Number()),
        language: t.Optional(t.String()),
        avatarUrl: t.Optional(t.String()),
        emergencyContactName: t.Optional(t.String()),
        emergencyContactPhone: t.Optional(t.String()),
      }),
      detail: { tags: ["user"], summary: "Update current user profile" },
    }
  )

  // ── Preferences ───────────────────────────────────────────────────────────────

  .get(
    "/preferences",
    async ({ db, userId }) => {
      const [user] = await db
        .select({ preferences: users.preferences })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return { preferences: user?.preferences ?? {} };
    },
    { detail: { tags: ["user"], summary: "Get user preferences (dashboard layout, UI settings)" } }
  )

  .put(
    "/preferences",
    async ({ db, userId, body }) => {
      await db
        .update(users)
        .set({ preferences: body.preferences, updatedAt: new Date() })
        .where(eq(users.id, userId));

      return { ok: true };
    },
    {
      body: t.Object({
        preferences: t.Record(t.String(), t.Unknown()),
      }),
      detail: { tags: ["user"], summary: "Replace user preferences blob (full overwrite)" },
    }
  )

  // ── Atomic preferences merge ──────────────────────────────────────────────────
  // Uses Postgres jsonb || operator to merge keys without a read-modify-write cycle.
  // Safe for concurrent callers updating different keys (e.g. dashboardWidgetService).
  .patch(
    "/preferences",
    async ({ db, userId, body }) => {
      // jsonb || jsonb merges top-level keys atomically on the server.
      // This avoids the race condition of GET → merge → PUT across concurrent requests.
      await db
        .update(users)
        .set({
          preferences: sql`COALESCE(${users.preferences}, '{}'::jsonb) || ${JSON.stringify(body.updates)}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return { ok: true };
    },
    {
      body: t.Object({
        updates: t.Record(t.String(), t.Unknown()),
      }),
      detail: {
        tags: ["user"],
        summary: "Atomically merge partial keys into preferences blob (race-condition-safe)",
      },
    }
  )

  // User health baseline (computed by client, cached server-side)
  .get(
    "/baseline",
    async ({ db, userId }) => {
      const { userBaselines } = await import("../db/schema");
      const [row] = await db
        .select()
        .from(userBaselines)
        .where(eq(userBaselines.userId, userId))
        .limit(1);
      return row ?? null;
    },
    { detail: { tags: ["user"], summary: "Get cached user health baseline" } }
  )

  .put(
    "/baseline",
    async ({ db, userId, body }) => {
      const { userBaselines } = await import("../db/schema");
      await db
        .insert(userBaselines)
        .values({ userId, data: body as Record<string, unknown>, computedAt: new Date() })
        .onConflictDoUpdate({
          target: userBaselines.userId,
          set: { data: body as Record<string, unknown>, computedAt: new Date() },
        });
    },
    {
      body: t.Any(),
      detail: { tags: ["user"], summary: "Persist user health baseline" },
    }
  )

  .get(
    "/baseline/last-notification",
    async ({ db, userId }) => {
      const { userBaselines } = await import("../db/schema");
      const [row] = await db
        .select({ lastNotificationAt: userBaselines.lastNotificationAt })
        .from(userBaselines)
        .where(eq(userBaselines.userId, userId))
        .limit(1);
      return row ?? null;
    },
    { detail: { tags: ["user"], summary: "Get baseline last notification time" } }
  )

  .post(
    "/baseline/last-notification",
    async ({ db, userId }) => {
      const { userBaselines } = await import("../db/schema");
      await db
        .insert(userBaselines)
        .values({ userId, data: {}, lastNotificationAt: new Date() })
        .onConflictDoUpdate({
          target: userBaselines.userId,
          set: { lastNotificationAt: new Date() },
        });
    },
    { detail: { tags: ["user"], summary: "Record baseline notification sent" } }
  )

  // ── Account deletion ────────────────────────────────────────────────────────
  // Deletes the user's profile, family memberships, and related data from Neon.
  .delete(
    "/me",
    async ({ db, userId, set }) => {
      // Remove family memberships first (FK-safe)
      await db.delete(familyMembers).where(eq(familyMembers.userId, userId));

      // Remove the user row — cascade removes child rows via DB constraints
      // where configured; remaining orphaned rows (vitals, symptoms, etc.)
      // are handled by the userId FK on each table.
      const deleted = await db
        .delete(users)
        .where(eq(users.id, userId))
        .returning({ id: users.id });

      if (!deleted.length) {
        set.status = 404;
        return { error: "User not found" };
      }

      set.status = 200;
      return { ok: true };
    },
    { detail: { tags: ["user"], summary: "Delete authenticated user account and related data" } }
  )

  // ── Notification Preferences ────────────────────────────────────────────────

  /**
   * PATCH /api/user/notification-preferences
   * Merge notification preference keys into the user's preferences JSONB blob.
   * This is a convenience alias for PATCH /api/user/preferences.
   */
  .patch(
    "/notification-preferences",
    async ({ db, userId, body }) => {
      const [current] = await db
        .select({ preferences: users.preferences })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const merged = {
        ...(current?.preferences as Record<string, unknown> ?? {}),
        notifications: {
          ...((current?.preferences as Record<string, unknown>)?.notifications as Record<string, unknown> ?? {}),
          ...(body.preferences as Record<string, unknown> ?? body),
        },
      };

      await db
        .update(users)
        .set({ preferences: merged, updatedAt: new Date() })
        .where(eq(users.id, userId));

      return { ok: true };
    },
    {
      body: t.Object({
        preferences: t.Optional(t.Any()),
      }),
      detail: { tags: ["user"], summary: "Update notification preferences (merges into preferences.notifications)" },
    }
  )

  // ── Organisations ─────────────────────────────────────────────────────────────

  /**
   * GET /api/user/organizations
   * Returns all organisations the authenticated user belongs to,
   * along with their role in each org.
   */
  .get(
    "/organizations",
    async ({ db, userId }) => {
      const memberships = await db
        .select({
          orgId: orgMembers.orgId,
          role: orgMembers.role,
          joinedAt: orgMembers.joinedAt,
        })
        .from(orgMembers)
        .where(eq(orgMembers.userId, userId));

      if (memberships.length === 0) return [];

      const orgIds = memberships.map((m) => m.orgId);
      const orgs = await db
        .select()
        .from(organizations)
        .where(inArray(organizations.id, orgIds));

      return memberships
        .map((m) => ({
          org: orgs.find((o) => o.id === m.orgId),
          member: m,
        }))
        .filter(({ org }) => org !== undefined);
    },
    { detail: { tags: ["user"], summary: "Get organisations the current user belongs to" } }
  );

// ── Cross-user routes (/api/users/:userId) ────────────────────────────────────

/** Reconstruct client User shape from Neon row + familyMember role + preferences JSONB */
function buildUserObject(
  user: typeof users.$inferSelect,
  role?: string | null
) {
  const prefs = (user.preferences ?? {}) as Record<string, unknown>;
  const name = user.name ?? "";
  const nameParts = name.split(" ");

  return {
    id: user.id,
    email: user.email,
    firstName: (prefs.firstName as string | undefined) ?? nameParts[0] ?? "User",
    lastName: (prefs.lastName as string | undefined) ?? nameParts.slice(1).join(" ") ?? "",
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    bloodType: user.bloodType,
    familyId: user.familyId,
    avatarUrl: user.avatarUrl,
    avatarType: prefs.avatarType,
    role: role ?? (prefs.role as string | undefined) ?? "member",
    createdAt: user.createdAt,
    onboardingCompleted: (prefs.onboardingCompleted as boolean | undefined) ?? false,
    dashboardTourCompleted: (prefs.dashboardTourCompleted as boolean | undefined) ?? false,
    isPremium: (prefs.isPremium as boolean | undefined) ?? false,
    preferences: {
      language: (user.language ?? (prefs.language as string | undefined) ?? "en") as "en" | "ar",
      notifications: (prefs.notifications as boolean | undefined) ?? true,
      emergencyContacts: (prefs.emergencyContacts as unknown[]) ?? [],
      careTeam: (prefs.careTeam as unknown[]) ?? [],
    },
  };
}

export const usersRoutes = new Elysia({ prefix: "/api/users" })
  .use(requireAuth)

  // ── GET any user by ID ────────────────────────────────────────────────────────
  .get(
    "/:userId",
    async ({ db, userId, params, set }) => {
      const targetId = params.userId;

      // Allow: own profile, or family admin reading a family member
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, targetId))
        .limit(1);

      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      // Permission check: only self-access, or a family member reading a co-member
      if (targetId !== userId) {
        if (!user.familyId) {
          // Target is not in any family — only the user themselves can read their profile
          set.status = 403;
          return { error: "Access denied" };
        }
        const [myMembership] = await db
          .select({ familyId: familyMembers.familyId })
          .from(familyMembers)
          .where(eq(familyMembers.userId, userId))
          .limit(1);

        if (!myMembership || myMembership.familyId !== user.familyId) {
          set.status = 403;
          return { error: "Access denied" };
        }
      }

      // Get role from familyMembers table
      const [memberRow] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(eq(familyMembers.userId, targetId))
        .limit(1);

      return buildUserObject(user, memberRow?.role);
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["user"], summary: "Get user by ID (own or family admin)" },
    }
  )

  // ── PATCH update any user's profile ──────────────────────────────────────────
  .patch(
    "/:userId",
    async ({ db, userId, params, body, set }) => {
      const targetId = params.userId;

      // Allow own update or family-admin update (admin can only update members of the same family)
      if (targetId !== userId) {
        const [myMembership] = await db
          .select({ role: familyMembers.role, familyId: familyMembers.familyId })
          .from(familyMembers)
          .where(eq(familyMembers.userId, userId))
          .limit(1);

        if (myMembership?.role !== "admin") {
          set.status = 403;
          return { error: "Only family admins can update other users" };
        }

        // Verify target is in the SAME family — prevents cross-family admin writes
        const [targetMembership] = await db
          .select({ familyId: familyMembers.familyId })
          .from(familyMembers)
          .where(eq(familyMembers.userId, targetId))
          .limit(1);

        if (!targetMembership || targetMembership.familyId !== myMembership.familyId) {
          set.status = 403;
          return { error: "You can only update members of your own family" };
        }
      }

      // Separate DB columns from preferences fields
      const dbUpdates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
      if (body.name !== undefined) dbUpdates.name = body.name;
      if (body.email !== undefined) dbUpdates.email = body.email;
      if (body.phone !== undefined) dbUpdates.phone = body.phone;
      if (body.gender !== undefined) dbUpdates.gender = body.gender;
      if (body.dateOfBirth !== undefined) dbUpdates.dateOfBirth = new Date(body.dateOfBirth);
      if (body.language !== undefined) dbUpdates.language = body.language;
      if (body.familyId !== undefined) dbUpdates.familyId = body.familyId;
      if (body.avatarUrl !== undefined) dbUpdates.avatarUrl = body.avatarUrl;

      // Preferences fields go into JSONB.
      // Use atomic jsonb || merge to avoid read-modify-write race conditions
      // when concurrent requests update different preference keys simultaneously.
      const prefsUpdates: Record<string, unknown> = {};
      if (body.firstName !== undefined) prefsUpdates.firstName = body.firstName;
      if (body.lastName !== undefined) prefsUpdates.lastName = body.lastName;
      if (body.role !== undefined) prefsUpdates.role = body.role;
      if (body.onboardingCompleted !== undefined) prefsUpdates.onboardingCompleted = body.onboardingCompleted;
      if (body.dashboardTourCompleted !== undefined) prefsUpdates.dashboardTourCompleted = body.dashboardTourCompleted;
      if (body.isPremium !== undefined) prefsUpdates.isPremium = body.isPremium;
      if (body.notifications !== undefined) prefsUpdates.notifications = body.notifications;
      if (body.emergencyContacts !== undefined) prefsUpdates.emergencyContacts = body.emergencyContacts;
      if (body.avatarType !== undefined) prefsUpdates.avatarType = body.avatarType;

      if (Object.keys(prefsUpdates).length > 0) {
        // Merge atomically — no prior SELECT needed, no overwrite risk
        (dbUpdates as Record<string, unknown>).preferences = sql`COALESCE(${users.preferences}, '{}'::jsonb) || ${JSON.stringify(prefsUpdates)}::jsonb`;
      }

      await db.update(users).set(dbUpdates).where(eq(users.id, targetId));

      // Return updated user
      const [updated] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!updated) { set.status = 404; return { error: "User not found after update" }; }

      const [memberRow] = await db.select({ role: familyMembers.role }).from(familyMembers).where(eq(familyMembers.userId, targetId)).limit(1);
      return buildUserObject(updated, memberRow?.role);
    },
    {
      params: t.Object({ userId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        email: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        firstName: t.Optional(t.String()),
        lastName: t.Optional(t.String()),
        gender: t.Optional(t.String()),
        dateOfBirth: t.Optional(t.String()),
        language: t.Optional(t.String()),
        familyId: t.Optional(t.Nullable(t.String())),
        avatarUrl: t.Optional(t.String()),
        avatarType: t.Optional(t.String()),
        role: t.Optional(t.String()),
        onboardingCompleted: t.Optional(t.Boolean()),
        dashboardTourCompleted: t.Optional(t.Boolean()),
        isPremium: t.Optional(t.Boolean()),
        notifications: t.Optional(t.Boolean()),
        emergencyContacts: t.Optional(t.Any()),
      }),
      detail: { tags: ["user"], summary: "Update user profile (own or admin)" },
    }
  )

  // ── PATCH update user role (family admin only) ────────────────────────────────
  .patch(
    "/:userId/role",
    async ({ db, userId, params, body, set }) => {
      // Verify requester is admin of their own family
      const [myMembership] = await db
        .select({ role: familyMembers.role, familyId: familyMembers.familyId })
        .from(familyMembers)
        .where(eq(familyMembers.userId, userId))
        .limit(1);

      if (myMembership?.role !== "admin") {
        set.status = 403;
        return { error: "Only admins can update user roles" };
      }

      // Verify target user is in the SAME family — prevents cross-family role manipulation
      const [targetMembership] = await db
        .select({ familyId: familyMembers.familyId })
        .from(familyMembers)
        .where(eq(familyMembers.userId, params.userId))
        .limit(1);

      if (!targetMembership || targetMembership.familyId !== myMembership.familyId) {
        set.status = 403;
        return { error: "You can only change roles for members of your own family" };
      }

      // Update role in familyMembers
      await db
        .update(familyMembers)
        .set({ role: body.role })
        .where(eq(familyMembers.userId, params.userId));

      // Also store in preferences for getUser fallback — atomic merge, no SELECT needed
      await db
        .update(users)
        .set({
          preferences: sql`COALESCE(${users.preferences}, '{}'::jsonb) || ${JSON.stringify({ role: body.role })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, params.userId));

      return { ok: true, userId: params.userId, role: body.role };
    },
    {
      params: t.Object({ userId: t.String() }),
      body: t.Object({
        role: t.Union([t.Literal("admin"), t.Literal("member"), t.Literal("caregiver")]),
      }),
      detail: { tags: ["user"], summary: "Update user role (family admin only)" },
    }
  );
