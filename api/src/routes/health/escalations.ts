import { Elysia, t } from "elysia";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../../middleware/requireAuth.js";
import { escalations, anomalies } from "../../db/schema.js";
import { assertFamilyAccess, assertFamilyWriteAccess } from "../../services/familyAccessService.js";

export const escalationsRoutes = new Elysia()
  .use(requireAuth)

  // ── POST /escalations ────────────────────────────────────────────────────────
  .post(
    "/escalations",
    async ({ db, userId, body }) => {
      const id = crypto.randomUUID();
      const [created] = await db.insert(escalations).values({
        id,
        userId,
        alertId: body.alertId,
        familyId: body.familyId,
        type: body.type,
        severity: body.severity,
        status: "active",
        currentLevel: 1,
        metadata: body.metadata,
        createdAt: new Date(),
      }).returning();
      return created;
    },
    {
      body: t.Object({
        alertId: t.Optional(t.String({ maxLength: 36 })),
        familyId: t.Optional(t.String({ maxLength: 36 })),
        type: t.String({ maxLength: 100 }),
        severity: t.String({ maxLength: 50 }),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
      detail: { tags: ["health"], summary: "Start a new escalation" },
    }
  )

  // ── GET /escalations ─────────────────────────────────────────────────────────
  .get(
    "/escalations",
    async ({ db, userId, query }) => {
      const filters = [eq(escalations.userId, userId)];
      if (query.familyId) filters.push(eq(escalations.familyId, query.familyId));
      if (query.status) filters.push(eq(escalations.status, query.status));
      return db
        .select()
        .from(escalations)
        .where(and(...filters))
        .orderBy(desc(escalations.createdAt))
        .limit(50);
    },
    {
      query: t.Object({
        familyId: t.Optional(t.String({ minLength: 1, maxLength: 36 })),
        status: t.Optional(t.String({ minLength: 1, maxLength: 36 })),
      }),
      detail: { tags: ["health"], summary: "Query escalations" },
    }
  )

  // ── PATCH /escalations/:id ───────────────────────────────────────────────────
  .patch(
    "/escalations/:id",
    async ({ db, userId, body, params, set }) => {
      const updates: Record<string, unknown> = {};
      // status is intentionally omitted — the DB trigger derives it from
      // acknowledgedAt / resolvedAt automatically.
      if (body.acknowledgedBy) {
        updates.acknowledgedBy = body.acknowledgedBy;
        updates.acknowledgedAt = new Date();
      }
      if (body.resolvedBy) {
        updates.resolvedBy = body.resolvedBy;
        updates.resolvedAt = new Date();
      }
      if (body.resolutionNotes) updates.resolutionNotes = body.resolutionNotes;
      if (body.currentLevel != null) updates.currentLevel = body.currentLevel;
      if (body.notificationsSentAppend) {
        // Authorization check
        const [current] = await db.select({ userId: escalations.userId })
          .from(escalations).where(eq(escalations.id, params.id)).limit(1);
        if (!current) { set.status = 404; return { error: "Not found" }; }
        // Only the escalation owner or a family admin may update it
        if (current.userId !== userId) {
          const authErr = await assertFamilyWriteAccess(db, userId, current.userId);
          if (authErr) { set.status = 403; return authErr; }
        }
        // Atomic jsonb append — avoids fetch-merge-write race condition
        if (body.notificationsSentAppend.length > 0) {
          await db.execute(sql`
            UPDATE escalations
            SET metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{notificationsSent}',
              COALESCE(metadata->'notificationsSent', '[]'::jsonb) || ${JSON.stringify(body.notificationsSentAppend)}::jsonb
            )
            WHERE id = ${params.id}
          `)
        }
      } else {
        // Authorization check when notificationsSentAppend is not set
        const [existing] = await db.select({ userId: escalations.userId })
          .from(escalations).where(eq(escalations.id, params.id)).limit(1);
        if (!existing) { set.status = 404; return { error: "Not found" }; }
        if (existing.userId !== userId) {
          const authErr = await assertFamilyWriteAccess(db, userId, existing.userId);
          if (authErr) { set.status = 403; return authErr; }
        }
      }
      const [updated] = await db.update(escalations)
        .set(updates as never)
        .where(eq(escalations.id, params.id))
        .returning();
      return updated ?? { error: "Not found" };
    },
    {
      body: t.Object({
        // `status` is intentionally absent — the DB trigger derives it from
        // acknowledgedAt / resolvedAt. Callers should set acknowledgedBy /
        // resolvedBy to trigger the status transition.
        acknowledgedBy: t.Optional(t.String({ maxLength: 36 })),
        resolvedBy: t.Optional(t.String({ maxLength: 36 })),
        resolutionNotes: t.Optional(t.String({ maxLength: 2000 })),
        currentLevel: t.Optional(t.Number({ minimum: 1, maximum: 10 })),
        notificationsSentAppend: t.Optional(t.Array(t.String({ maxLength: 36 }), { maxItems: 100 })),
      }),
      detail: { tags: ["health"], summary: "Update an escalation record" },
    }
  )

  // ── POST /escalations/resolve-by-alert ───────────────────────────────────────
  .post(
    "/escalations/resolve-by-alert",
    async ({ db, userId, body, set }) => {
      // Verify at least one active escalation for this alertId belongs to the calling user
      const [sample] = await db
        .select({ escalUserId: escalations.userId })
        .from(escalations)
        .where(and(eq(escalations.alertId, body.alertId), eq(escalations.status, "active")))
        .limit(1);
      if (!sample) return { ok: true }; // nothing to resolve
      if (sample.escalUserId !== userId) {
        const authErr = await assertFamilyWriteAccess(db, userId, sample.escalUserId);
        if (authErr) { set.status = 403; return authErr; }
      }
      await db.update(escalations)
        .set({
          // status is intentionally omitted — the DB trigger sets it to 'resolved'
          // automatically when resolvedAt is non-null.
          resolvedBy: userId,
          resolvedAt: new Date(),
          resolutionNotes: body.notes ?? null,
        } as never)
        .where(and(eq(escalations.alertId, body.alertId), eq(escalations.status, "active"), eq(escalations.userId, sample.escalUserId)));
      return { ok: true };
    },
    {
      body: t.Object({
        alertId: t.String({ maxLength: 36 }),
        notes: t.Optional(t.String({ maxLength: 2000 })),
      }),
      detail: { tags: ["health"], summary: "Bulk-resolve escalations by alertId" },
    }
  )

  // ── POST /escalations/process ────────────────────────────────────────────────
  .post(
    "/escalations/process",
    async () => ({ ok: true, message: "Escalation processing is handled by the server cycle job." }),
    { detail: { tags: ["health"], summary: "Trigger escalation processing (no-op)" } }
  )

  // ── GET /anomalies ───────────────────────────────────────────────────────────
  .get(
    "/anomalies",
    async ({ db, userId, query, set }) => {
      const targetUserId = query.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyAccess(db, userId, targetUserId);
        if (authErr) { set.status = 403; return authErr; }
      }
      const filters = [eq(anomalies.userId, targetUserId)];
      if (query.from) filters.push(gte(anomalies.detectedAt, new Date(query.from)));
      return db
        .select()
        .from(anomalies)
        .where(and(...filters))
        .orderBy(desc(anomalies.detectedAt))
        .limit(query.limit ?? 50);
    },
    {
      query: t.Object({
        userId: t.Optional(t.String({ minLength: 1, maxLength: 36 })),
        from: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}" })),
        limit: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["health"], summary: "Get anomalies for the current user (or a patient if org admin)" },
    }
  )

  // ── PATCH /anomalies/:anomalyId/acknowledge ──────────────────────────────────
  .patch(
    "/anomalies/:anomalyId/acknowledge",
    async ({ db, userId, params, set }) => {
      const row = await db
        .select({ id: anomalies.id, userId: anomalies.userId })
        .from(anomalies)
        .where(eq(anomalies.id, params.anomalyId))
        .limit(1);

      if (!row.length) { set.status = 404; return { error: "Anomaly not found" }; }

      const anomaly = row[0];
      // Allow the owner or a family admin to acknowledge (caregivers may not acknowledge anomalies)
      if (anomaly.userId !== userId) {
        const authErr = await assertFamilyWriteAccess(db, userId, anomaly.userId);
        if (authErr) { set.status = 403; return authErr; }
      }

      await db
        .update(anomalies)
        .set({ isAcknowledged: true })
        .where(eq(anomalies.id, params.anomalyId));

      return { success: true };
    },
    {
      params: t.Object({ anomalyId: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({ userId: t.Optional(t.String({ maxLength: 36 })) }),
      detail: { tags: ["health"], summary: "Acknowledge an anomaly" },
    }
  );
