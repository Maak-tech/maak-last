import { Elysia, t } from "elysia";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../../middleware/requireAuth.js";
import { logger } from "../../lib/logger.js";
import { moods, familyMembers, users, familyHealthSummary } from "../../db/schema.js";
import { assertFamilyAccess, assertFamilyWriteAccess } from "../../services/familyAccessService.js";

// Reusable ISO 8601 date-string type.
const IsoDateString = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}" });

const DateRangeQuery = t.Object({
  from: t.Optional(IsoDateString),
  to: t.Optional(IsoDateString),
  limit: t.Optional(t.Numeric({ maximum: 1000 })),
  type: t.Optional(t.String({ maxLength: 64 })),
});

export const moodsRoutes = new Elysia()
  .use(requireAuth)

  // ── GET /moods ───────────────────────────────────────────────────────────────
  .get(
    "/moods",
    async ({ db, userId, query }) => {
      const filters = [eq(moods.userId, userId)];
      if (query.from) filters.push(gte(moods.recordedAt, new Date(query.from)));

      return db
        .select()
        .from(moods)
        .where(and(...filters))
        .orderBy(desc(moods.recordedAt))
        .limit(query.limit ?? 50);
    },
    { query: DateRangeQuery, detail: { tags: ["health"], summary: "Get moods" } }
  )

  // ── POST /moods ──────────────────────────────────────────────────────────────
  .post(
    "/moods",
    async ({ db, userId, body, set }) => {
      const targetUserId = body.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyWriteAccess(db, userId, targetUserId);
        if (authErr) { set.status = 403; return authErr; }
      }
      const id = crypto.randomUUID();
      const [created] = await db
        .insert(moods)
        .values({
          id,
          userId: targetUserId,
          type: body.type,
          intensity: body.intensity,
          notes: body.notes,
          activities: body.activities,
          recordedAt: new Date(body.recordedAt),
        })
        .returning();
      // Non-blocking VHI recompute trigger — fire-and-forget pg_notify
      db.execute(sql`SELECT pg_notify('vhi_recompute', ${JSON.stringify({ userId: targetUserId, triggeredBy: 'mood_write' })})`)
        .catch((err: unknown) => logger.warn({ err }, 'pg_notify failed — non-fatal'));
      // Also set dirty flag so the 15-min cron picks this user up as a fallback.
      db.update(users).set({ vhiDirty: true }).where(eq(users.id, targetUserId))
        .catch((err: unknown) => logger.warn({ err }, 'vhi_dirty update failed — non-fatal'));
      // Update family health summary — fire-and-forget (non-blocking).
      db.select({ familyId: users.familyId }).from(users).where(eq(users.id, targetUserId)).limit(1)
        .then(([u]) => {
          if (!u?.familyId) return;
          return db.insert(familyHealthSummary)
            .values({
              id: crypto.randomUUID(),
              familyId: u.familyId,
              userId: targetUserId,
              lastMoodAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [familyHealthSummary.familyId, familyHealthSummary.userId],
              set: { lastMoodAt: new Date(), updatedAt: new Date() },
            });
        })
        .catch((err: unknown) => logger.warn({ err }, 'family health summary update failed — non-fatal'));
      return created;
    },
    {
      body: t.Object({
        type: t.String({ maxLength: 100 }),
        userId: t.Optional(t.String({ maxLength: 36 })),
        intensity: t.Optional(t.Number({ minimum: 1, maximum: 10 })),
        notes: t.Optional(t.String({ maxLength: 2000 })),
        activities: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 50 })),
        recordedAt: IsoDateString,
      }),
      detail: { tags: ["health"], summary: "Log a mood" },
    }
  )

  // ── PATCH /moods/:id ─────────────────────────────────────────────────────────
  .patch(
    "/moods/:id",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db.select({ id: moods.id, userId: moods.userId }).from(moods).where(eq(moods.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Mood not found" }; }
      const [updated] = await db
        .update(moods)
        .set({
          ...(body.type !== undefined && { type: body.type }),
          ...(body.intensity !== undefined && { intensity: body.intensity }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.activities !== undefined && { activities: body.activities }),
        })
        .where(and(eq(moods.id, params.id), eq(moods.userId, userId)))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({
        type: t.Optional(t.String({ maxLength: 100 })),
        intensity: t.Optional(t.Number({ minimum: 1, maximum: 10 })),
        notes: t.Optional(t.String({ maxLength: 2000 })),
        activities: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 50 })),
      }),
      detail: { tags: ["health"], summary: "Update a mood entry" },
    }
  )

  // ── DELETE /moods/:id ────────────────────────────────────────────────────────
  .delete(
    "/moods/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: moods.id, userId: moods.userId }).from(moods).where(eq(moods.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Mood not found" }; }
      await db.delete(moods).where(and(eq(moods.id, params.id), eq(moods.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Delete a mood entry" },
    }
  )

  // ── GET /moods/user/:userId (admin/caregiver) ────────────────────────────────
  .get(
    "/moods/user/:userId",
    async ({ db, userId, params, query, set }) => {
      const authErr = await assertFamilyAccess(db, userId, params.userId, "moods");
      if (authErr) { set.status = 403; return authErr; }
      const filters = [eq(moods.userId, params.userId)];
      if (query.from) filters.push(gte(moods.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(moods.recordedAt, new Date(query.to)));
      return db.select().from(moods).where(and(...filters)).orderBy(desc(moods.recordedAt)).limit(query.limit ?? 50);
    },
    {
      params: t.Object({ userId: t.String({ minLength: 1, maxLength: 36 }) }),
      query: DateRangeQuery,
      detail: { tags: ["health"], summary: "Get moods for a specific user (admin/caregiver)" },
    }
  )

  // ── GET /moods/family/:familyId ──────────────────────────────────────────────
  .get(
    "/moods/family/:familyId",
    async ({ db, userId, params, query, set }) => {
      const [callerMembership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, params.familyId)))
        .limit(1);
      if (!callerMembership || (callerMembership.role !== "admin" && callerMembership.role !== "caregiver")) {
        set.status = 403;
        return { error: "Only family admins and caregivers can access family health data" };
      }
      const memberRows = await db.select({ userId: familyMembers.userId }).from(familyMembers).where(eq(familyMembers.familyId, params.familyId));
      if (memberRows.length === 0) return [];
      const memberIds = memberRows.map((m) => m.userId);
      const filters = [inArray(moods.userId, memberIds)];
      if (query.from) filters.push(gte(moods.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(moods.recordedAt, new Date(query.to)));
      return db.select().from(moods).where(and(...filters)).orderBy(desc(moods.recordedAt)).limit(query.limit ?? 100);
    },
    {
      params: t.Object({ familyId: t.String({ minLength: 1, maxLength: 36 }) }),
      query: DateRangeQuery,
      detail: { tags: ["health"], summary: "Get moods for all family members (admin)" },
    }
  );
