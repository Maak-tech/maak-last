import { Elysia, t } from "elysia";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../../middleware/requireAuth.js";
import { logger } from "../../lib/logger.js";
import { symptoms, familyMembers, users, familyHealthSummary } from "../../db/schema.js";
import { assertFamilyAccess, assertFamilyWriteAccess } from "../../services/familyAccessService.js";

// Reusable ISO 8601 date-string type.
const IsoDateString = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}" });

const DateRangeQuery = t.Object({
  from: t.Optional(IsoDateString),
  to: t.Optional(IsoDateString),
  limit: t.Optional(t.Numeric({ maximum: 1000 })),
  type: t.Optional(t.String({ maxLength: 64 })),
});

export const symptomsRoutes = new Elysia()
  .use(requireAuth)

  // ── GET /symptoms ────────────────────────────────────────────────────────────
  .get(
    "/symptoms",
    async ({ db, userId, query }) => {
      const filters = [eq(symptoms.userId, userId)];
      if (query.from) filters.push(gte(symptoms.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(symptoms.recordedAt, new Date(query.to)));
      if (query.type) filters.push(eq(symptoms.type, query.type));

      const data = await db
        .select()
        .from(symptoms)
        .where(and(...filters))
        .orderBy(desc(symptoms.recordedAt))
        .limit(query.limit ?? 50);

      // Staleness check: warn if no symptoms recorded in last 48 hours
      const latestRecordedAt = data.length > 0
        ? new Date(Math.max(...data.map(r => new Date(r.recordedAt ?? 0).getTime())))
        : null;
      const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;
      const isStale = !latestRecordedAt || (Date.now() - latestRecordedAt.getTime()) > STALE_THRESHOLD_MS;
      const stalenessInfo = {
        isStale,
        lastRecordedAt: latestRecordedAt?.toISOString() ?? null,
        staleThresholdHours: 48,
      };

      return { data, ...stalenessInfo };
    },
    { query: DateRangeQuery, detail: { tags: ["health"], summary: "Get symptoms" } }
  )

  // ── POST /symptoms ───────────────────────────────────────────────────────────
  .post(
    "/symptoms",
    async ({ db, userId, body, set }) => {
      const targetUserId = body.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyWriteAccess(db, userId, targetUserId);
        if (authErr) { set.status = 403; return authErr; }
      }
      const id = crypto.randomUUID();
      const [created] = await db
        .insert(symptoms)
        .values({
          id,
          userId: targetUserId,
          type: body.type,
          severity: body.severity,
          location: body.location,
          duration: body.duration,
          notes: body.notes,
          triggers: body.triggers,
          tags: body.tags,
          recordedAt: new Date(body.recordedAt),
        })
        .returning();
      // Non-blocking VHI recompute trigger — fire-and-forget pg_notify
      db.execute(sql`SELECT pg_notify('vhi_recompute', ${JSON.stringify({ userId: targetUserId, triggeredBy: 'symptom_write' })})`)
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
              lastSymptomAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [familyHealthSummary.familyId, familyHealthSummary.userId],
              set: { lastSymptomAt: new Date(), updatedAt: new Date() },
            });
        })
        .catch((err: unknown) => logger.warn({ err }, 'family health summary update failed — non-fatal'));
      return created;
    },
    {
      body: t.Object({
        type: t.String({ maxLength: 100 }),
        userId: t.Optional(t.String({ maxLength: 36 })),
        severity: t.Optional(t.Number({ minimum: 1, maximum: 10 })),
        location: t.Optional(t.String({ maxLength: 200 })),
        duration: t.Optional(t.Number({ minimum: 0, maximum: 43200 })), // max 30 days in minutes
        notes: t.Optional(t.String({ maxLength: 2000 })),
        triggers: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 50 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 50 })),
        recordedAt: IsoDateString,
      }),
      detail: { tags: ["health"], summary: "Log a symptom" },
    }
  )

  // ── PATCH /symptoms/:id ──────────────────────────────────────────────────────
  .patch(
    "/symptoms/:id",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db.select().from(symptoms).where(eq(symptoms.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Symptom not found" }; }

      const [updated] = await db
        .update(symptoms)
        .set({
          ...(body.type !== undefined && { type: body.type }),
          ...(body.severity !== undefined && { severity: body.severity }),
          ...(body.location !== undefined && { location: body.location }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.triggers !== undefined && { triggers: body.triggers }),
          ...(body.tags !== undefined && { tags: body.tags }),
        })
        .where(and(eq(symptoms.id, params.id), eq(symptoms.userId, userId)))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({
        type: t.Optional(t.String({ maxLength: 100 })),
        severity: t.Optional(t.Number({ minimum: 1, maximum: 10 })),
        location: t.Optional(t.String({ maxLength: 255 })),
        notes: t.Optional(t.String({ maxLength: 2000 })),
        triggers: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 50 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 50 })),
      }),
      detail: { tags: ["health"], summary: "Update a symptom" },
    }
  )

  // ── DELETE /symptoms/:id ─────────────────────────────────────────────────────
  .delete(
    "/symptoms/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: symptoms.id, userId: symptoms.userId }).from(symptoms).where(eq(symptoms.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Symptom not found" }; }
      await db.delete(symptoms).where(and(eq(symptoms.id, params.id), eq(symptoms.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Delete a symptom" },
    }
  )

  // ── GET /symptoms/user/:userId (admin/caregiver access) ──────────────────────
  .get(
    "/symptoms/user/:userId",
    async ({ db, userId, params, query, set }) => {
      const authErr = await assertFamilyAccess(db, userId, params.userId, "symptoms");
      if (authErr) { set.status = 403; return authErr; }
      const filters = [eq(symptoms.userId, params.userId)];
      if (query.from) filters.push(gte(symptoms.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(symptoms.recordedAt, new Date(query.to)));
      return db.select().from(symptoms).where(and(...filters)).orderBy(desc(symptoms.recordedAt)).limit(query.limit ?? 50);
    },
    {
      params: t.Object({ userId: t.String({ minLength: 1, maxLength: 36 }) }),
      query: DateRangeQuery,
      detail: { tags: ["health"], summary: "Get symptoms for a specific user (admin/caregiver)" },
    }
  )

  // ── GET /symptoms/family/:familyId (admin/caregiver access) ─────────────────
  .get(
    "/symptoms/family/:familyId",
    async ({ db, userId, params, query, set }) => {
      // Verify the caller belongs to this family with admin or caregiver role
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

      const filters = [inArray(symptoms.userId, memberIds)];
      if (query.from) filters.push(gte(symptoms.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(symptoms.recordedAt, new Date(query.to)));

      return db.select().from(symptoms).where(and(...filters)).orderBy(desc(symptoms.recordedAt)).limit(query.limit ?? 100);
    },
    {
      params: t.Object({ familyId: t.String({ minLength: 1, maxLength: 36 }) }),
      query: DateRangeQuery,
      detail: { tags: ["health"], summary: "Get symptoms for all family members (admin)" },
    }
  );
