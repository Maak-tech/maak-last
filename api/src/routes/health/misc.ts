/**
 * Miscellaneous health routes:
 *   - Medical history (CRUD)
 *   - Period entries (CRUD)
 *   - Cycle daily entries (upsert / list / delete)
 *   - Health timeline (GET / POST / PATCH / family)
 *   - Health scores
 *   - Garmin OAuth (auth-url / exchange / disconnect)
 *   - PPG ML analysis and embeddings
 */
import { Elysia, t } from "elysia";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../../middleware/requireAuth.js";
import { logger } from "../../lib/logger.js";
import {
  medicalHistory,
  periodCycles,
  cycleDailyEntries,
  healthTimeline,
  ppgEmbeddings,
  familyMembers,
  users,
} from "../../db/schema.js";
import { assertFamilyAccess, assertFamilyWriteAccess } from "../../services/familyAccessService.js";
import { ppgAnalyzeRateLimiter } from "../../lib/rateLimiter.js";

// Reusable ISO 8601 date-string type.
const IsoDateString = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}" });

const DateRangeQuery = t.Object({
  from: t.Optional(IsoDateString),
  to: t.Optional(IsoDateString),
  limit: t.Optional(t.Numeric({ maximum: 1000 })),
  type: t.Optional(t.String({ maxLength: 64 })),
});

export const miscHealthRoutes = new Elysia()
  .use(requireAuth)

  // ── Medical History: full CRUD ────────────────────────────────────────────────
  .get(
    "/medical-history",
    async ({ db, userId }) => {
      // Cap at 200 — unbounded SELECT on users migrated from legacy systems could
      // return thousands of historical condition rows in one serialisation.
      return db.select().from(medicalHistory).where(eq(medicalHistory.userId, userId)).limit(200);
    },
    { detail: { tags: ["health"], summary: "Get medical history" } }
  )
  .post(
    "/medical-history",
    async ({ db, userId, body }) => {
      const id = crypto.randomUUID();
      const [created] = await db
        .insert(medicalHistory)
        .values({
          id,
          userId,
          condition: body.condition,
          severity: body.severity,
          diagnosedDate: body.diagnosedDate ? new Date(body.diagnosedDate) : undefined,
          notes: body.notes,
          isFamily: body.isFamily ?? false,
          relation: body.relation,
          familyMemberId: body.familyMemberId,
          familyMemberName: body.familyMemberName,
          tags: body.tags,
        })
        .returning();
      return created;
    },
    {
      body: t.Object({
        condition: t.String({ maxLength: 255 }),
        severity: t.Optional(t.String({ maxLength: 50 })),
        diagnosedDate: t.Optional(IsoDateString),
        notes: t.Optional(t.String({ maxLength: 2000 })),
        isFamily: t.Optional(t.Boolean()),
        relation: t.Optional(t.String({ maxLength: 100 })),
        familyMemberId: t.Optional(t.String({ maxLength: 36 })),
        familyMemberName: t.Optional(t.String({ maxLength: 255 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 50 })),
      }),
      detail: { tags: ["health"], summary: "Add a medical history entry" },
    }
  )
  .get(
    "/medical-history/:id",
    async ({ db, userId, params, set }) => {
      const [entry] = await db.select().from(medicalHistory).where(eq(medicalHistory.id, params.id)).limit(1);
      if (!entry) { set.status = 404; return { error: "Medical history entry not found" }; }
      const authErr = await assertFamilyAccess(db, userId, entry.userId, "medical_history");
      if (authErr) { set.status = 403; return authErr; }
      return entry;
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Get a medical history entry by ID" },
    }
  )
  .patch(
    "/medical-history/:id",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db.select({ id: medicalHistory.id, userId: medicalHistory.userId }).from(medicalHistory).where(eq(medicalHistory.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Medical history entry not found" }; }
      const [updated] = await db
        .update(medicalHistory)
        .set({
          ...(body.condition !== undefined && { condition: body.condition }),
          ...(body.severity !== undefined && { severity: body.severity }),
          ...(body.diagnosedDate !== undefined && { diagnosedDate: body.diagnosedDate ? new Date(body.diagnosedDate) : null }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.isFamily !== undefined && { isFamily: body.isFamily }),
          ...(body.relation !== undefined && { relation: body.relation }),
          ...(body.familyMemberId !== undefined && { familyMemberId: body.familyMemberId }),
          ...(body.familyMemberName !== undefined && { familyMemberName: body.familyMemberName }),
          ...(body.tags !== undefined && { tags: body.tags }),
        })
        .where(and(eq(medicalHistory.id, params.id), eq(medicalHistory.userId, userId)))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({
        condition: t.Optional(t.String({ maxLength: 255 })),
        severity: t.Optional(t.String({ maxLength: 50 })),
        diagnosedDate: t.Optional(t.Nullable(IsoDateString)),
        notes: t.Optional(t.String({ maxLength: 2000 })),
        isFamily: t.Optional(t.Boolean()),
        relation: t.Optional(t.String({ maxLength: 100 })),
        familyMemberId: t.Optional(t.String({ maxLength: 36 })),
        familyMemberName: t.Optional(t.String({ maxLength: 255 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 50 })),
      }),
      detail: { tags: ["health"], summary: "Update a medical history entry" },
    }
  )
  .delete(
    "/medical-history/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: medicalHistory.id, userId: medicalHistory.userId }).from(medicalHistory).where(eq(medicalHistory.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Medical history entry not found" }; }
      await db.delete(medicalHistory).where(and(eq(medicalHistory.id, params.id), eq(medicalHistory.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Delete a medical history entry" },
    }
  )

  // ── Period Entries: full CRUD ─────────────────────────────────────────────────
  .get(
    "/period-entries",
    async ({ db, userId, query }) => {
      const filters = [eq(periodCycles.userId, userId)];
      if (query.from) filters.push(gte(periodCycles.startDate, new Date(query.from)));
      if (query.to) filters.push(lte(periodCycles.startDate, new Date(query.to)));
      return db
        .select()
        .from(periodCycles)
        .where(and(...filters))
        .orderBy(desc(periodCycles.startDate))
        .limit(query.limit ?? 100);
    },
    { query: DateRangeQuery, detail: { tags: ["health"], summary: "Get period entries" } }
  )
  .post(
    "/period-entries",
    async ({ db, userId, body, set }) => {
      const targetUserId = body.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyWriteAccess(db, userId, targetUserId);
        if (authErr) { set.status = 403; return authErr; }
      }
      const id = crypto.randomUUID();
      const [created] = await db
        .insert(periodCycles)
        .values({
          id,
          userId: targetUserId,
          startDate: new Date(body.startDate),
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          flowIntensity: body.flowIntensity,
          symptoms: body.symptoms,
          notes: body.notes,
        })
        .returning();
      return created;
    },
    {
      body: t.Object({
        userId: t.Optional(t.String({ maxLength: 36 })),
        startDate: IsoDateString,
        endDate: t.Optional(IsoDateString),
        flowIntensity: t.Optional(t.String({ maxLength: 20 })),
        symptoms: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 50 })),
        notes: t.Optional(t.String({ maxLength: 5000 })),
      }),
      detail: { tags: ["health"], summary: "Add a period entry" },
    }
  )
  .patch(
    "/period-entries/:id",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db.select({ id: periodCycles.id, userId: periodCycles.userId }).from(periodCycles).where(eq(periodCycles.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Period entry not found" }; }
      const [updated] = await db
        .update(periodCycles)
        .set({
          ...(body.startDate !== undefined && { startDate: new Date(body.startDate) }),
          ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
          ...(body.flowIntensity !== undefined && { flowIntensity: body.flowIntensity }),
          ...(body.symptoms !== undefined && { symptoms: body.symptoms }),
          ...(body.notes !== undefined && { notes: body.notes }),
        })
        .where(and(eq(periodCycles.id, params.id), eq(periodCycles.userId, userId)))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({
        startDate: t.Optional(IsoDateString),
        endDate: t.Optional(t.Nullable(IsoDateString)),
        flowIntensity: t.Optional(t.String({ maxLength: 50 })),
        symptoms: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 50 })),
        notes: t.Optional(t.String({ maxLength: 2000 })),
      }),
      detail: { tags: ["health"], summary: "Update a period entry" },
    }
  )
  .delete(
    "/period-entries/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: periodCycles.id, userId: periodCycles.userId }).from(periodCycles).where(eq(periodCycles.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Period entry not found" }; }
      await db.delete(periodCycles).where(and(eq(periodCycles.id, params.id), eq(periodCycles.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Delete a period entry" },
    }
  )

  // ── Cycle Daily Entries: upsert + list + delete ───────────────────────────────
  .get(
    "/cycle-daily",
    async ({ db, userId, query }) => {
      const filters = [eq(cycleDailyEntries.userId, userId)];
      if (query.from) filters.push(gte(cycleDailyEntries.date, new Date(query.from)));
      if (query.to) filters.push(lte(cycleDailyEntries.date, new Date(query.to)));
      return db
        .select()
        .from(cycleDailyEntries)
        .where(and(...filters))
        .orderBy(desc(cycleDailyEntries.date))
        .limit(query.limit ?? 90);
    },
    { query: DateRangeQuery, detail: { tags: ["health"], summary: "Get cycle daily entries" } }
  )
  .post(
    "/cycle-daily",
    async ({ db, userId, body, set }) => {
      const targetUserId = body.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyWriteAccess(db, userId, targetUserId);
        if (authErr) { set.status = 403; return authErr; }
      }
      // Normalise to midnight so the deterministic id is stable within a day
      const date = new Date(body.date);
      date.setHours(0, 0, 0, 0);

      // Deterministic id so concurrent upserts are idempotent
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      const id = `${targetUserId}_${y}-${m}-${d}`;

      const values = {
        id,
        userId: targetUserId,
        date,
        flow: body.flowIntensity ?? body.flow,
        cramps: body.crampsSeverity ?? body.cramps,
        mood: body.mood,
        energy: body.energyLevel ?? body.energy,
        sleepQuality: body.sleepQuality,
        dischargeType: body.dischargeType,
        spotting: body.spotting,
        birthControlMethod: body.birthControlMethod,
        birthControlTaken: body.birthControlTaken,
        birthControlSideEffects: body.birthControlSideEffects,
        symptoms: body.symptoms,
        notes: body.notes,
        updatedAt: new Date(),
      };

      // Upsert: update on conflict
      await db
        .insert(cycleDailyEntries)
        .values({ ...values, createdAt: new Date() })
        .onConflictDoUpdate({ target: cycleDailyEntries.id, set: { ...values } });

      return { id };
    },
    {
      body: t.Object({
        userId: t.Optional(t.String({ maxLength: 36 })),
        date: IsoDateString,
        flowIntensity: t.Optional(t.String({ maxLength: 50 })),
        flow: t.Optional(t.String({ maxLength: 50 })),
        crampsSeverity: t.Optional(t.Number({ minimum: 0, maximum: 10 })),
        cramps: t.Optional(t.Number({ minimum: 0, maximum: 10 })),
        mood: t.Optional(t.Number({ minimum: 0, maximum: 10 })),
        energyLevel: t.Optional(t.Number({ minimum: 0, maximum: 10 })),
        energy: t.Optional(t.Number({ minimum: 0, maximum: 10 })),
        sleepQuality: t.Optional(t.Number({ minimum: 0, maximum: 10 })),
        dischargeType: t.Optional(t.String({ maxLength: 100 })),
        spotting: t.Optional(t.Boolean()),
        birthControlMethod: t.Optional(t.String({ maxLength: 100 })),
        birthControlTaken: t.Optional(t.Boolean()),
        birthControlSideEffects: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 20 })),
        symptoms: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 50 })),
        notes: t.Optional(t.String({ maxLength: 2000 })),
      }),
      detail: { tags: ["health"], summary: "Upsert a cycle daily entry (idempotent by user+date)" },
    }
  )
  .delete(
    "/cycle-daily/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: cycleDailyEntries.id, userId: cycleDailyEntries.userId }).from(cycleDailyEntries).where(eq(cycleDailyEntries.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Cycle daily entry not found" }; }
      // Include userId in WHERE to close the TOCTOU window between ownership check and mutation.
      await db.delete(cycleDailyEntries).where(and(eq(cycleDailyEntries.id, params.id), eq(cycleDailyEntries.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Delete a cycle daily entry" },
    }
  )

  // ── Health Timeline ───────────────────────────────────────────────────────────
  .post(
    "/timeline",
    async ({ db, userId, body, set }) => {
      const timelineTargetUserId = body.userId ?? userId;
      if (timelineTargetUserId !== userId) {
        const authErr = await assertFamilyWriteAccess(db, userId, timelineTargetUserId);
        if (authErr) { set.status = 403; return authErr; }
      }
      const domainMap: Record<string, string> = {
        vital_recorded: "vitals", vital_abnormal: "vitals",
        symptom_logged: "symptoms", period_logged: "behavior",
        medication_taken: "behavior", medication_missed: "behavior",
        medication_scheduled: "behavior", fall_detected: "symptoms",
        alert_created: "clinical", alert_acknowledged: "clinical",
        alert_resolved: "clinical", mood_logged: "behavior",
        appointment_scheduled: "clinical", appointment_reminder: "clinical",
        health_sync: "behavior", caregiver_action: "clinical",
        ai_interaction: "behavior", allergy_added: "clinical",
        medical_history_added: "clinical",
      };

      const id = crypto.randomUUID();
      const [created] = await db
        .insert(healthTimeline)
        .values({
          id,
          userId: timelineTargetUserId,
          occurredAt: new Date(body.timestamp),
          source: body.eventType,
          domain: domainMap[body.eventType] ?? "behavior",
          metadata: {
            familyId: body.familyId,
            title: body.title,
            description: body.description,
            severity: body.severity,
            icon: body.icon,
            relatedEntityId: body.relatedEntityId,
            relatedEntityType: body.relatedEntityType,
            actorId: body.actorId,
            actorType: body.actorType,
            ...(body.metadata as Record<string, unknown> | undefined ?? {}),
          },
        })
        .returning({ id: healthTimeline.id });

      return { id: created.id };
    },
    {
      body: t.Object({
        userId: t.Optional(t.String({ maxLength: 36 })),
        familyId: t.Optional(t.String({ maxLength: 36 })),
        eventType: t.String({ maxLength: 100 }),
        title: t.String({ maxLength: 500 }),
        description: t.Optional(t.String({ maxLength: 2000 })),
        timestamp: IsoDateString,
        severity: t.String({ maxLength: 50 }),
        icon: t.Optional(t.String({ maxLength: 100 })),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
        relatedEntityId: t.Optional(t.String({ maxLength: 36 })),
        relatedEntityType: t.Optional(t.String({ maxLength: 50 })),
        actorId: t.Optional(t.String({ maxLength: 36 })),
        actorType: t.Optional(t.String({ maxLength: 50 })),
      }),
      detail: { tags: ["health"], summary: "Record a health timeline event" },
    }
  )
  .get(
    "/timeline",
    async ({ db, userId, query }) => {
      const filters = [eq(healthTimeline.userId, userId)];
      if (query.from) filters.push(gte(healthTimeline.occurredAt, new Date(query.from)));
      if (query.to)   filters.push(lte(healthTimeline.occurredAt, new Date(query.to)));
      if (query.types) {
        const types = query.types.split(",").map((t: string) => t.trim()).filter(Boolean);
        if (types.length > 0) filters.push(inArray(healthTimeline.source, types));
      }

      const rows = await db
        .select()
        .from(healthTimeline)
        .where(and(...filters))
        .orderBy(desc(healthTimeline.occurredAt))
        .limit(query.limit ?? 100);

      // Reconstruct HealthTimelineEvent shape from row
      return rows.map((row) => {
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        return {
          id: row.id,
          userId: row.userId,
          familyId: meta.familyId,
          eventType: row.source,
          title: meta.title,
          description: meta.description,
          timestamp: row.occurredAt,
          severity: meta.severity ?? "info",
          icon: meta.icon,
          metadata: meta,
          relatedEntityId: meta.relatedEntityId,
          relatedEntityType: meta.relatedEntityType,
          actorId: meta.actorId,
          actorType: meta.actorType,
        };
      });
    },
    {
      query: t.Object({
        from: t.Optional(IsoDateString),
        to: t.Optional(IsoDateString),
        limit: t.Optional(t.Numeric()),
        types: t.Optional(t.String({ minLength: 1, maxLength: 512 })),
      }),
      detail: { tags: ["health"], summary: "Get health timeline events for the current user" },
    }
  )
  .patch(
    "/timeline/:id",
    async ({ db, userId, params, body, set }) => {
      const [row] = await db
        .select({ id: healthTimeline.id, userId: healthTimeline.userId, metadata: healthTimeline.metadata })
        .from(healthTimeline)
        .where(eq(healthTimeline.id, params.id))
        .limit(1);

      if (!row) { set.status = 404; return { error: "Timeline event not found" }; }

      // Authorization: own event or family admin / caregiver
      if (row.userId !== userId) {
        const authErr = await assertFamilyAccess(db, userId, row.userId);
        if (authErr) { set.status = 403; return authErr; }
      }

      // Merge update fields into existing metadata JSONB
      const existingMeta = (row.metadata ?? {}) as Record<string, unknown>;
      const updatedMeta: Record<string, unknown> = { ...existingMeta };

      if (body.status       !== undefined) updatedMeta.status       = body.status;
      if (body.acknowledgedAt !== undefined) updatedMeta.acknowledgedAt = body.acknowledgedAt;
      if (body.acknowledgedBy !== undefined) updatedMeta.acknowledgedBy = body.acknowledgedBy;
      if (body.resolvedAt   !== undefined) updatedMeta.resolvedAt   = body.resolvedAt;
      if (body.resolvedBy   !== undefined) updatedMeta.resolvedBy   = body.resolvedBy;
      if (body.escalatedAt  !== undefined) updatedMeta.escalatedAt  = body.escalatedAt;
      if (body.escalatedBy  !== undefined) updatedMeta.escalatedBy  = body.escalatedBy;
      if (body.metadata     !== undefined) {
        Object.assign(updatedMeta, body.metadata as Record<string, unknown>);
      }

      await db
        .update(healthTimeline)
        .set({ metadata: updatedMeta })
        .where(eq(healthTimeline.id, params.id));

      return { ok: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({
        status:          t.Optional(t.String({ maxLength: 50 })),
        acknowledgedAt:  t.Optional(IsoDateString),
        acknowledgedBy:  t.Optional(t.String({ maxLength: 36 })),
        resolvedAt:      t.Optional(IsoDateString),
        resolvedBy:      t.Optional(t.String({ maxLength: 36 })),
        escalatedAt:     t.Optional(IsoDateString),
        escalatedBy:     t.Optional(t.String({ maxLength: 36 })),
        metadata:        t.Optional(t.Record(t.String(), t.Unknown())),
      }),
      detail: { tags: ["health"], summary: "Update a health timeline event status" },
    }
  )
  .get(
    "/timeline/family",
    async ({ db, userId, query, set }) => {
      if (!query.userIds) return [];

      // Verify requesting user belongs to a family
      const [myMembership] = await db
        .select({ familyId: familyMembers.familyId })
        .from(familyMembers)
        .where(eq(familyMembers.userId, userId))
        .limit(1);

      if (!myMembership) {
        set.status = 403;
        return { error: "Not in any family" };
      }

      const requestedIds = query.userIds.split(",").map((id: string) => id.trim()).filter(Boolean);
      if (requestedIds.length === 0) return [];

      // Cross-check: only return timeline for userIds confirmed as members of the caller's family
      const authorizedMemberships = await db
        .select({ userId: familyMembers.userId })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.familyId, myMembership.familyId),
            inArray(familyMembers.userId, requestedIds)
          )
        );

      const userIds: string[] = authorizedMemberships.map((m: { userId: string }) => m.userId);
      if (userIds.length === 0) return [];

      const filters = [inArray(healthTimeline.userId, userIds)];
      if (query.from) filters.push(gte(healthTimeline.occurredAt, new Date(query.from)));
      if (query.to)   filters.push(lte(healthTimeline.occurredAt, new Date(query.to)));

      const rows = await db
        .select()
        .from(healthTimeline)
        .where(and(...filters))
        .orderBy(desc(healthTimeline.occurredAt))
        .limit(query.limit ?? 200);

      return rows.map((row) => {
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        return {
          id: row.id,
          userId: row.userId,
          familyId: meta.familyId,
          eventType: row.source,
          title: meta.title,
          description: meta.description,
          timestamp: row.occurredAt,
          severity: meta.severity ?? "info",
          icon: meta.icon,
          metadata: meta,
          relatedEntityId: meta.relatedEntityId,
          relatedEntityType: meta.relatedEntityType,
          actorId: meta.actorId,
          actorType: meta.actorType,
        };
      });
    },
    {
      query: t.Object({
        userIds: t.Optional(t.String({ minLength: 1, maxLength: 512 })),
        from: t.Optional(IsoDateString),
        to: t.Optional(IsoDateString),
        limit: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["health"], summary: "Get health timeline events for a set of family member user IDs" },
    }
  )

  // ── Health Scores ─────────────────────────────────────────────────────────────
  .get(
    "/scores",
    async ({ db, userId, query, set }) => {
      const targetUserId = query.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyAccess(db, userId, targetUserId);
        if (authErr) { set.status = 403; return authErr; }
      }
      return db
        .select()
        .from(healthTimeline)
        .where(
          and(
            eq(healthTimeline.userId, targetUserId),
            eq(healthTimeline.source, "health_sync")
          )
        )
        .orderBy(desc(healthTimeline.occurredAt))
        .limit(query.limit ?? 10);
    },
    {
      query: t.Object({
        userId: t.Optional(t.String({ minLength: 1, maxLength: 36 })),
        // Cap at 500 to prevent a client from dumping the full health timeline
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 500 })),
      }),
      detail: { tags: ["health"], summary: "Get health score history events from the timeline" },
    }
  )

  // ── Garmin OAuth ──────────────────────────────────────────────────────────────
  .post(
    "/garmin/auth-url",
    async ({ body, set }) => {
      const clientId = process.env.GARMIN_CLIENT_ID;
      const redirectUri =
        process.env.GARMIN_REDIRECT_URI ?? "https://app.nuralix.ai/garmin-callback";

      if (!clientId) {
        set.status = 503;
        return { error: "Garmin integration is not configured." };
      }

      const state = crypto.randomUUID();

      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: (body.selectedMetrics ?? []).join(" ") || "activity heartRate sleep",
      });

      const url = `https://connect.garmin.com/oauth2/authorize?${params.toString()}`;
      return { url, redirectUri, state };
    },
    {
      body: t.Object({
        selectedMetrics: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 50 })),
      }),
      detail: { tags: ["health"], summary: "Generate Garmin OAuth authorization URL" },
    }
  )
  .post(
    "/garmin/exchange",
    async ({ body, userId, set }) => {
      const clientId = process.env.GARMIN_CLIENT_ID;
      const clientSecret = process.env.GARMIN_CLIENT_SECRET;
      const redirectUri =
        process.env.GARMIN_REDIRECT_URI ?? "https://app.nuralix.ai/garmin-callback";

      if (!(clientId && clientSecret)) {
        set.status = 503;
        return { error: "Garmin integration is not configured." };
      }

      let tokenRes: Response;
      try {
        tokenRes = await fetch("https://connect.garmin.com/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: body.code,
            redirect_uri: redirectUri,
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (fetchErr: unknown) {
        const isTimeout = fetchErr instanceof Error && fetchErr.name === "TimeoutError";
        logger.error({ err: fetchErr }, "[garmin/exchange] Token fetch failed");
        set.status = 504;
        return { error: isTimeout ? "Garmin OAuth timed out. Please try again." : "Garmin OAuth unreachable." };
      }

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        logger.error({ status: tokenRes.status, body: errText.slice(0, 200) }, "[garmin/exchange] Token exchange failed");
        set.status = 502;
        return { error: "Failed to exchange Garmin authorization code." };
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      // Store AES-256-GCM encrypted tokens in preferences JSONB.
      const { encryptToken } = await import("../../lib/tokenEncryption.js");
      const { sql } = await import("drizzle-orm");
      const tokenPayload = {
        garminAccessToken: encryptToken(tokens.access_token),
        garminRefreshToken: encryptToken(tokens.refresh_token),
        garminTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        garminConnected: true,
        garminConnectedAt: new Date().toISOString(),
      };

      await (await import("../../db/index.js")).db
        .update(users)
        .set({
          preferences: sql`COALESCE(${users.preferences}, '{}'::jsonb) || ${JSON.stringify(tokenPayload)}::jsonb`,
          updatedAt: new Date(),
        })
        .where((await import("drizzle-orm")).eq(users.id, userId));

      return { ok: true };
    },
    {
      body: t.Object({
        code: t.String({ maxLength: 512 }),
        state: t.Optional(t.String({ maxLength: 128 })),
      }),
      detail: { tags: ["health"], summary: "Exchange Garmin OAuth code for tokens (server-side)" },
    }
  )
  .post(
    "/garmin/disconnect",
    async ({ userId }) => {
      const { sql } = await import("drizzle-orm");
      const clearPayload = {
        garminAccessToken: null,
        garminRefreshToken: null,
        garminTokenExpiresAt: null,
        garminConnected: false,
      };

      await (await import("../../db/index.js")).db
        .update(users)
        .set({
          preferences: sql`COALESCE(${users.preferences}, '{}'::jsonb) || ${JSON.stringify(clearPayload)}::jsonb`,
          updatedAt: new Date(),
        })
        .where((await import("drizzle-orm")).eq(users.id, userId));

      return { ok: true };
    },
    {
      detail: { tags: ["health"], summary: "Disconnect Garmin and revoke stored tokens" },
    }
  )

  // ── PPG ML Analysis ────────────────────────────────────────────────────────────
  .post(
    "/ppg/analyze",
    async ({ userId, body, set }) => {
      // Rate limit: 10 requests / user / minute
      const rl = await ppgAnalyzeRateLimiter.check(userId);
      if (!rl.allowed) {
        set.status = 429;
        const retryAfterSecs = Math.ceil(rl.resetIn / 1000);
        set.headers = { "Retry-After": String(retryAfterSecs) };
        return { success: false, error: "Too many PPG analysis requests. Please try again shortly.", signalQuality: 0, warnings: [] };
      }

      const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";
      let mlRes: Response;
      try {
        mlRes = await fetch(`${ML_SERVICE_URL}/api/ppg/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, userId }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (fetchErr: unknown) {
        const isTimeout = fetchErr instanceof Error && fetchErr.name === "TimeoutError";
        logger.error({ err: fetchErr }, "[ppg/analyze] ML service fetch failed");
        set.status = 504;
        return {
          success: false,
          error: isTimeout ? "PPG analysis timed out. Please try again." : "PPG ML service unreachable.",
          signalQuality: 0,
          warnings: [],
        };
      }
      if (!mlRes.ok) {
        set.status = mlRes.status >= 500 ? 502 : mlRes.status;
        return {
          success: false,
          error: `ML service error: HTTP ${mlRes.status}`,
          signalQuality: 0,
          warnings: [],
        };
      }
      return mlRes.json();
    },
    {
      body: t.Object({
        signal: t.Array(t.Number(), { maxItems: 10_000 }),
        frameRate: t.Number({ minimum: 1, maximum: 240 }),
        duration: t.Optional(t.Number({ minimum: 0 })),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
      detail: { tags: ["health"], summary: "Run ML PPG analysis (proxy to Python ML service)" },
    }
  )
  .get(
    "/ppg/analyze",
    async ({ set }) => {
      const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";
      try {
        const res = await fetch(`${ML_SERVICE_URL}/health`, { signal: AbortSignal.timeout(5_000) });
        if (res.ok) return { available: true };
        set.status = 502;
        return { available: false };
      } catch {
        set.status = 503;
        return { available: false };
      }
    },
    { detail: { tags: ["health"], summary: "Check if PPG ML service is available" } }
  )

  // ── PPG Embeddings ─────────────────────────────────────────────────────────────
  .post(
    "/ppg-embeddings",
    async ({ db, userId, body }) => {
      const id = crypto.randomUUID();
      await db.insert(ppgEmbeddings).values({
        id,
        userId,
        embeddings: body.embeddings,
        heartRate: body.heartRate?.toString(),
        hrv: body.hrv?.toString(),
        respiratoryRate: body.respiratoryRate?.toString(),
        signalQuality: body.signalQuality.toString(),
        confidence: body.confidence?.toString(),
        capturedAt: body.capturedAt ? new Date(body.capturedAt) : new Date(),
      });
      return { id };
    },
    {
      body: t.Object({
        embeddings: t.Array(t.Number(), { maxItems: 512 }),
        heartRate: t.Optional(t.Nullable(t.Number({ minimum: 20, maximum: 300 }))),
        hrv: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 300 }))),
        respiratoryRate: t.Optional(t.Nullable(t.Number({ minimum: 4, maximum: 60 }))),
        signalQuality: t.Number({ minimum: 0, maximum: 1 }),
        confidence: t.Optional(t.Nullable(t.Number({ minimum: 0, maximum: 1 }))),
        capturedAt: t.Optional(IsoDateString),
      }),
      detail: { tags: ["health"], summary: "Persist a PPG ML embedding record" },
    }
  )
  .get(
    "/ppg-embeddings",
    async ({ db, userId, query }) => {
      return db
        .select()
        .from(ppgEmbeddings)
        .where(eq(ppgEmbeddings.userId, userId))
        .orderBy(desc(ppgEmbeddings.capturedAt))
        .limit(query.limit ?? 10);
    },
    {
      query: t.Object({ limit: t.Optional(t.Numeric()) }),
      detail: { tags: ["health"], summary: "Get recent PPG embeddings for the current user" },
    }
  );
