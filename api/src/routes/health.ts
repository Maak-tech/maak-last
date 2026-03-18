import { Elysia, t } from "elysia";
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/requireAuth";
import { vitals, symptoms, medications, medicationReminders, moods, labResults, allergies, medicalHistory, familyMembers, users, periodCycles, cycleDailyEntries, healthTimeline, ppgEmbeddings, escalations, anomalies, medicationAdherence } from "../db/schema";

const DateRangeQuery = t.Object({
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  limit: t.Optional(t.Numeric()),
});

/**
 * Verify that `callerId` is authorized to write or read health data on behalf of `targetUserId`.
 *
 * Authorized when:
 *   - callerId === targetUserId (own data), OR
 *   - callerId is a family admin or caregiver in the same family as targetUserId.
 *
 * Returns null when authorized, or an error object `{ error: string }` when not.
 * Pattern: `const authErr = await assertFamilyAccess(db, userId, targetUserId); if (authErr) { set.status = 403; return authErr; }`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertFamilyAccess(db: any, callerId: string, targetUserId: string): Promise<{ error: string } | null> {
  if (callerId === targetUserId) return null;

  const [targetMembership] = await db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, targetUserId))
    .limit(1);

  if (!targetMembership) return { error: "Target user is not in any family" };

  const [callerMembership] = await db
    .select({ role: familyMembers.role })
    .from(familyMembers)
    .where(and(eq(familyMembers.userId, callerId), eq(familyMembers.familyId, targetMembership.familyId)))
    .limit(1);

  if (!callerMembership || (callerMembership.role !== "admin" && callerMembership.role !== "caregiver")) {
    return { error: "Only family admins and caregivers can access health data for other users" };
  }

  return null;
}

export const healthRoutes = new Elysia({ prefix: "/api/health" })
  .use(requireAuth)

  // ── Vitals ──────────────────────────────────────────────────────────────────
  .get(
    "/vitals",
    async ({ db, userId, query }) => {
      const filters = [eq(vitals.userId, userId)];
      if (query.from) filters.push(gte(vitals.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(vitals.recordedAt, new Date(query.to)));

      return db
        .select()
        .from(vitals)
        .where(and(...filters))
        .orderBy(desc(vitals.recordedAt))
        .limit(query.limit ?? 100);
    },
    { query: DateRangeQuery, detail: { tags: ["health"], summary: "Get vitals" } }
  )
  .post(
    "/vitals",
    async ({ db, userId, body }) => {
      const id = crypto.randomUUID();
      const [created] = await db
        .insert(vitals)
        .values({
          id,
          userId,
          type: body.type,
          value: body.value?.toString(),
          valueSecondary: body.valueSecondary?.toString(),
          unit: body.unit,
          source: body.source,
          metadata: body.metadata,
          recordedAt: new Date(body.recordedAt),
        })
        .returning();
      return created;
    },
    {
      body: t.Object({
        // maxLength prevents arbitrarily long strings being stored as vital type names
        type: t.String({ maxLength: 50 }),
        // Plausible numeric bounds cover all known medical vital ranges
        value: t.Optional(t.Number({ minimum: -1000, maximum: 1_000_000 })),
        valueSecondary: t.Optional(t.Number({ minimum: -1000, maximum: 1_000_000 })),
        unit: t.Optional(t.String({ maxLength: 20 })),
        source: t.Optional(t.String({ maxLength: 50 })),
        recordedAt: t.String(),
        metadata: t.Optional(t.Any()),
      }),
      detail: { tags: ["health"], summary: "Log a vital reading" },
    }
  )
  .post(
    "/vitals/batch",
    async ({ db, userId, body }) => {
      if (!body.samples.length) return { saved: 0 };

      const rows = body.samples.map((s) => ({
        id: crypto.randomUUID(),
        userId,
        type: s.type,
        value: s.value?.toString(),
        valueSecondary: s.valueSecondary?.toString(),
        unit: s.unit,
        source: s.source,
        recordedAt: new Date(s.recordedAt),
        metadata: s.metadata,
      }));

      await db.insert(vitals).values(rows);
      return { saved: rows.length };
    },
    {
      body: t.Object({
        // maxItems: 1000 caps a single sync request — prevents accidental or
        // malicious requests that could saturate the database writer
        samples: t.Array(
          t.Object({
            type: t.String({ maxLength: 50 }),
            value: t.Optional(t.Number({ minimum: -1000, maximum: 1_000_000 })),
            valueSecondary: t.Optional(t.Number({ minimum: -1000, maximum: 1_000_000 })),
            unit: t.Optional(t.String({ maxLength: 20 })),
            source: t.Optional(t.String({ maxLength: 50 })),
            recordedAt: t.String(),
            metadata: t.Optional(t.Any()),
          }),
          { maxItems: 1000 }
        ),
      }),
      detail: { tags: ["health"], summary: "Batch-insert vital readings from device sync" },
    }
  )

  // ── Symptoms ─────────────────────────────────────────────────────────────────
  .get(
    "/symptoms",
    async ({ db, userId, query }) => {
      const filters = [eq(symptoms.userId, userId)];
      if (query.from) filters.push(gte(symptoms.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(symptoms.recordedAt, new Date(query.to)));

      return db
        .select()
        .from(symptoms)
        .where(and(...filters))
        .orderBy(desc(symptoms.recordedAt))
        .limit(query.limit ?? 50);
    },
    { query: DateRangeQuery, detail: { tags: ["health"], summary: "Get symptoms" } }
  )
  .post(
    "/symptoms",
    async ({ db, userId, body, set }) => {
      const targetUserId = body.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyAccess(db, userId, targetUserId);
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
      return created;
    },
    {
      body: t.Object({
        type: t.String(),
        userId: t.Optional(t.String()),
        severity: t.Optional(t.Number()),
        location: t.Optional(t.String()),
        duration: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
        triggers: t.Optional(t.Array(t.String())),
        tags: t.Optional(t.Array(t.String())),
        recordedAt: t.String(),
      }),
      detail: { tags: ["health"], summary: "Log a symptom" },
    }
  )

  // ── Medications ───────────────────────────────────────────────────────────────
  .get(
    "/medications",
    async ({ db, userId }) => {
      return db
        .select()
        .from(medications)
        .where(and(eq(medications.userId, userId), eq(medications.isActive, true)));
    },
    { detail: { tags: ["health"], summary: "Get active medications" } }
  )
  .post(
    "/medications",
    async ({ db, userId, body, set }) => {
      const targetUserId = body.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyAccess(db, userId, targetUserId);
        if (authErr) { set.status = 403; return authErr; }
      }
      const id = crypto.randomUUID();
      const [created] = await db
        .insert(medications)
        .values({
          id,
          userId: targetUserId,
          name: body.name,
          dosage: body.dosage,
          frequency: body.frequency,
          instructions: body.instructions,
          startDate: body.startDate ? new Date(body.startDate) : undefined,
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          reminders: body.reminders,
          tags: body.tags,
          quantity: body.quantity,
          notes: body.notes,
        })
        .returning();
      return created;
    },
    {
      body: t.Object({
        name: t.String(),
        userId: t.Optional(t.String()),
        dosage: t.Optional(t.String()),
        frequency: t.Optional(t.String()),
        instructions: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        reminders: t.Optional(t.Any()),
        tags: t.Optional(t.Array(t.String())),
        quantity: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Add a medication" },
    }
  )

  // ── Medication reminders ──────────────────────────────────────────────────────
  .get(
    "/reminders/today",
    async ({ db, userId }) => {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      return db
        .select()
        .from(medicationReminders)
        .where(
          and(
            eq(medicationReminders.userId, userId),
            gte(medicationReminders.scheduledAt, startOfDay),
            lte(medicationReminders.scheduledAt, endOfDay)
          )
        )
        .orderBy(medicationReminders.scheduledAt);
    },
    { detail: { tags: ["health"], summary: "Get today's medication reminders" } }
  )
  .patch(
    "/reminders/:reminderId",
    async ({ db, userId, params, body }) => {
      const [updated] = await db
        .update(medicationReminders)
        .set({
          status: body.status,
          takenAt: body.status === "taken" ? new Date() : undefined,
        })
        .where(
          and(
            eq(medicationReminders.id, params.reminderId),
            eq(medicationReminders.userId, userId)
          )
        )
        .returning();
      return updated;
    },
    {
      params: t.Object({ reminderId: t.String() }),
      body: t.Object({ status: t.Union([t.Literal("taken"), t.Literal("missed"), t.Literal("snoozed")]) }),
      detail: { tags: ["health"], summary: "Update a reminder status (taken/missed/snoozed)" },
    }
  )

  // ── Moods ─────────────────────────────────────────────────────────────────────
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
  .post(
    "/moods",
    async ({ db, userId, body, set }) => {
      const targetUserId = body.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyAccess(db, userId, targetUserId);
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
      return created;
    },
    {
      body: t.Object({
        type: t.String(),
        userId: t.Optional(t.String()),
        intensity: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
        activities: t.Optional(t.Array(t.String())),
        recordedAt: t.String(),
      }),
      detail: { tags: ["health"], summary: "Log a mood" },
    }
  )

  // ── Lab Results ───────────────────────────────────────────────────────────────
  .get(
    "/labs",
    async ({ db, userId }) => {
      return db
        .select()
        .from(labResults)
        .where(eq(labResults.userId, userId))
        .orderBy(desc(labResults.testDate))
        .limit(50);
    },
    { detail: { tags: ["health"], summary: "Get lab results" } }
  )

  // ── Allergies ─────────────────────────────────────────────────────────────────
  .get(
    "/allergies",
    async ({ db, userId }) => {
      return db.select().from(allergies).where(eq(allergies.userId, userId));
    },
    { detail: { tags: ["health"], summary: "Get allergies" } }
  )

  // ── Medical History ───────────────────────────────────────────────────────────
  .get(
    "/medical-history",
    async ({ db, userId }) => {
      return db.select().from(medicalHistory).where(eq(medicalHistory.userId, userId));
    },
    { detail: { tags: ["health"], summary: "Get medical history" } }
  )

  // ── Symptom PATCH / DELETE / user-scoped GET ─────────────────────────────────
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
      params: t.Object({ id: t.String() }),
      body: t.Object({
        type: t.Optional(t.String()),
        severity: t.Optional(t.Number()),
        location: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        triggers: t.Optional(t.Array(t.String())),
        tags: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["health"], summary: "Update a symptom" },
    }
  )
  .delete(
    "/symptoms/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: symptoms.id, userId: symptoms.userId }).from(symptoms).where(eq(symptoms.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Symptom not found" }; }
      await db.delete(symptoms).where(and(eq(symptoms.id, params.id), eq(symptoms.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["health"], summary: "Delete a symptom" },
    }
  )
  // Symptoms for a specific user (admin/caregiver access)
  .get(
    "/symptoms/user/:userId",
    async ({ db, userId, params, query }) => {
      const filters = [eq(symptoms.userId, params.userId)];
      if (query.from) filters.push(gte(symptoms.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(symptoms.recordedAt, new Date(query.to)));
      return db.select().from(symptoms).where(and(...filters)).orderBy(desc(symptoms.recordedAt)).limit(query.limit ?? 50);
    },
    {
      params: t.Object({ userId: t.String() }),
      query: DateRangeQuery,
      detail: { tags: ["health"], summary: "Get symptoms for a specific user (admin/caregiver)" },
    }
  )
  // Family symptoms (all members, admin only)
  .get(
    "/symptoms/family/:familyId",
    async ({ db, userId, params, query }) => {
      const memberRows = await db.select({ userId: familyMembers.userId }).from(familyMembers).where(eq(familyMembers.familyId, params.familyId));
      if (memberRows.length === 0) return [];
      const memberIds = memberRows.map((m) => m.userId);

      const filters = [inArray(symptoms.userId, memberIds)];
      if (query.from) filters.push(gte(symptoms.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(symptoms.recordedAt, new Date(query.to)));

      return db.select().from(symptoms).where(and(...filters)).orderBy(desc(symptoms.recordedAt)).limit(query.limit ?? 100);
    },
    {
      params: t.Object({ familyId: t.String() }),
      query: DateRangeQuery,
      detail: { tags: ["health"], summary: "Get symptoms for all family members (admin)" },
    }
  )

  // ── Medication GET by ID / PATCH / user-scoped / family ───────────────────────
  .get(
    "/medications/:id",
    async ({ db, userId, params, set }) => {
      const [med] = await db.select().from(medications).where(eq(medications.id, params.id)).limit(1);
      if (!med) { set.status = 404; return { error: "Medication not found" }; }
      return med;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["health"], summary: "Get medication by ID" },
    }
  )
  .patch(
    "/medications/:id",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db.select({ id: medications.id, userId: medications.userId }).from(medications).where(eq(medications.id, params.id)).limit(1);
      if (!existing) { set.status = 404; return { error: "Medication not found" }; }

      const [updated] = await db
        .update(medications)
        .set({
          ...(body.name !== undefined && { name: body.name }),
          ...(body.dosage !== undefined && { dosage: body.dosage }),
          ...(body.frequency !== undefined && { frequency: body.frequency }),
          ...(body.instructions !== undefined && { instructions: body.instructions }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
          ...(body.startDate !== undefined && { startDate: new Date(body.startDate) }),
          ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
          ...(body.reminders !== undefined && { reminders: body.reminders }),
          ...(body.tags !== undefined && { tags: body.tags }),
          ...(body.quantity !== undefined && { quantity: body.quantity }),
          ...(body.notes !== undefined && { notes: body.notes }),
          updatedAt: new Date(),
        })
        .where(eq(medications.id, params.id))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        dosage: t.Optional(t.String()),
        frequency: t.Optional(t.String()),
        instructions: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.Nullable(t.String())),
        reminders: t.Optional(t.Any()),
        tags: t.Optional(t.Array(t.String())),
        quantity: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Update a medication" },
    }
  )
  // Medications for a specific user (admin/caregiver)
  .get(
    "/medications/user/:userId",
    async ({ db, params }) => {
      return db.select().from(medications).where(and(eq(medications.userId, params.userId), eq(medications.isActive, true)));
    },
    {
      params: t.Object({ userId: t.String() }),
      detail: { tags: ["health"], summary: "Get medications for a specific user (admin/caregiver)" },
    }
  )
  // All active medications for a family
  .get(
    "/medications/family/:familyId",
    async ({ db, params }) => {
      const memberRows = await db.select({ userId: familyMembers.userId }).from(familyMembers).where(eq(familyMembers.familyId, params.familyId));
      if (memberRows.length === 0) return [];
      const memberIds = memberRows.map((m) => m.userId);
      return db.select().from(medications).where(and(inArray(medications.userId, memberIds), eq(medications.isActive, true)));
    },
    {
      params: t.Object({ familyId: t.String() }),
      detail: { tags: ["health"], summary: "Get all active medications for a family" },
    }
  )

  // ── Caregiver: mark medication taken ─────────────────────────────────────────
  // Used by sharedMedicationScheduleService.markMedicationAsTaken().
  // Marks the earliest pending reminder for the given medication as taken.
  // If no pending reminder exists, creates a new taken record for today.
  .patch(
    "/medications/:medicationId/reminders/mark-taken",
    async ({ db, userId, params, body, set }) => {
      // Verify the medication belongs to the target member
      const [med] = await db
        .select({ id: medications.id, userId: medications.userId })
        .from(medications)
        .where(eq(medications.id, params.medicationId))
        .limit(1);

      if (!med) {
        set.status = 404;
        return { error: "Medication not found" };
      }

      // Caller must be the owner or a caregiver (family auth is enforced client-side;
      // here we verify the caller is the owner OR the caregiver field is provided).
      const takenBy = body?.caregiverId !== userId ? body?.caregiverId : undefined;

      // Find earliest pending reminder
      const [pending] = await db
        .select({ id: medicationReminders.id })
        .from(medicationReminders)
        .where(
          and(
            eq(medicationReminders.medicationId, params.medicationId),
            eq(medicationReminders.status, "pending"),
            isNull(medicationReminders.takenAt)
          )
        )
        .orderBy(medicationReminders.scheduledAt)
        .limit(1);

      const now = new Date();

      if (pending) {
        const [updated] = await db
          .update(medicationReminders)
          .set({ status: "taken", takenAt: now, notes: takenBy ? `taken by caregiver ${takenBy}` : undefined })
          .where(eq(medicationReminders.id, pending.id))
          .returning();
        return { ok: true, reminderId: updated.id };
      }

      // No pending reminder — create a new taken record for now
      const id = crypto.randomUUID();
      await db.insert(medicationReminders).values({
        id,
        medicationId: params.medicationId,
        userId: med.userId,
        scheduledAt: now,
        status: "taken",
        takenAt: now,
        notes: takenBy ? `taken by caregiver ${takenBy}` : undefined,
      });

      return { ok: true, reminderId: id };
    },
    {
      params: t.Object({ medicationId: t.String() }),
      body: t.Optional(
        t.Object({ caregiverId: t.Optional(t.String()) })
      ),
      detail: {
        tags: ["health"],
        summary: "Mark a medication as taken (caregiver or self)",
      },
    }
  )

  // ── Moods: full CRUD ──────────────────────────────────────────────────────────
  // Update existing POST moods to accept userId override and activities
  // (We keep the existing POST above; these extend it with PATCH, DELETE, scoped GETs)
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
      params: t.Object({ id: t.String() }),
      body: t.Object({
        type: t.Optional(t.String()),
        intensity: t.Optional(t.Number()),
        notes: t.Optional(t.String()),
        activities: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["health"], summary: "Update a mood entry" },
    }
  )
  .delete(
    "/moods/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: moods.id, userId: moods.userId }).from(moods).where(eq(moods.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Mood not found" }; }
      await db.delete(moods).where(and(eq(moods.id, params.id), eq(moods.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["health"], summary: "Delete a mood entry" },
    }
  )
  .get(
    "/moods/user/:userId",
    async ({ db, params, query }) => {
      const filters = [eq(moods.userId, params.userId)];
      if (query.from) filters.push(gte(moods.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(moods.recordedAt, new Date(query.to)));
      return db.select().from(moods).where(and(...filters)).orderBy(desc(moods.recordedAt)).limit(query.limit ?? 50);
    },
    {
      params: t.Object({ userId: t.String() }),
      query: DateRangeQuery,
      detail: { tags: ["health"], summary: "Get moods for a specific user (admin/caregiver)" },
    }
  )
  .get(
    "/moods/family/:familyId",
    async ({ db, params, query }) => {
      const memberRows = await db.select({ userId: familyMembers.userId }).from(familyMembers).where(eq(familyMembers.familyId, params.familyId));
      if (memberRows.length === 0) return [];
      const memberIds = memberRows.map((m) => m.userId);
      const filters = [inArray(moods.userId, memberIds)];
      if (query.from) filters.push(gte(moods.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(moods.recordedAt, new Date(query.to)));
      return db.select().from(moods).where(and(...filters)).orderBy(desc(moods.recordedAt)).limit(query.limit ?? 100);
    },
    {
      params: t.Object({ familyId: t.String() }),
      query: DateRangeQuery,
      detail: { tags: ["health"], summary: "Get moods for all family members (admin)" },
    }
  )

  // ── Allergies: full CRUD ──────────────────────────────────────────────────────
  .post(
    "/allergies",
    async ({ db, userId, body, set }) => {
      const targetUserId = body.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyAccess(db, userId, targetUserId);
        if (authErr) { set.status = 403; return authErr; }
      }
      const id = crypto.randomUUID();
      const [created] = await db
        .insert(allergies)
        .values({
          id,
          userId: targetUserId,
          substance: body.name,
          reaction: body.reaction,
          severity: body.severity,
          diagnosedDate: body.discoveredDate ? new Date(body.discoveredDate) : undefined,
          notes: body.notes,
        })
        .returning();
      return created;
    },
    {
      body: t.Object({
        name: t.String(),
        userId: t.Optional(t.String()),
        severity: t.Optional(t.String()),
        reaction: t.Optional(t.String()),
        discoveredDate: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Add an allergy" },
    }
  )
  .patch(
    "/allergies/:id",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db.select({ id: allergies.id, userId: allergies.userId }).from(allergies).where(eq(allergies.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Allergy not found" }; }
      const [updated] = await db
        .update(allergies)
        .set({
          ...(body.name !== undefined && { substance: body.name }),
          ...(body.reaction !== undefined && { reaction: body.reaction }),
          ...(body.severity !== undefined && { severity: body.severity }),
          ...(body.discoveredDate !== undefined && { diagnosedDate: body.discoveredDate ? new Date(body.discoveredDate) : null }),
          ...(body.notes !== undefined && { notes: body.notes }),
        })
        .where(and(eq(allergies.id, params.id), eq(allergies.userId, userId)))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        reaction: t.Optional(t.String()),
        severity: t.Optional(t.String()),
        discoveredDate: t.Optional(t.Nullable(t.String())),
        notes: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Update an allergy" },
    }
  )
  .delete(
    "/allergies/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: allergies.id, userId: allergies.userId }).from(allergies).where(eq(allergies.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Allergy not found" }; }
      await db.delete(allergies).where(and(eq(allergies.id, params.id), eq(allergies.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["health"], summary: "Delete an allergy" },
    }
  )

  // ── Lab Results: full CRUD ────────────────────────────────────────────────────
  .post(
    "/labs",
    async ({ db, userId, body }) => {
      const id = crypto.randomUUID();
      const [created] = await db
        .insert(labResults)
        .values({
          id,
          userId,
          testName: body.testName,
          testType: body.testType,
          testDate: new Date(body.testDate),
          orderedBy: body.orderedBy,
          facility: body.facility,
          results: body.results,
          notes: body.notes,
          tags: body.tags,
        })
        .returning();
      return created;
    },
    {
      body: t.Object({
        testName: t.String(),
        testType: t.Optional(t.String()),
        testDate: t.String(),
        orderedBy: t.Optional(t.String()),
        facility: t.Optional(t.String()),
        results: t.Optional(t.Any()),
        notes: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["health"], summary: "Add a lab result" },
    }
  )
  .get(
    "/labs/:id",
    async ({ db, userId, params, set }) => {
      const [lab] = await db.select().from(labResults).where(eq(labResults.id, params.id)).limit(1);
      if (!lab) { set.status = 404; return { error: "Lab result not found" }; }
      return lab;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["health"], summary: "Get a lab result by ID" },
    }
  )
  .patch(
    "/labs/:id",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db.select({ id: labResults.id, userId: labResults.userId }).from(labResults).where(eq(labResults.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Lab result not found" }; }
      const [updated] = await db
        .update(labResults)
        .set({
          ...(body.testName !== undefined && { testName: body.testName }),
          ...(body.testType !== undefined && { testType: body.testType }),
          ...(body.testDate !== undefined && { testDate: new Date(body.testDate) }),
          ...(body.orderedBy !== undefined && { orderedBy: body.orderedBy }),
          ...(body.facility !== undefined && { facility: body.facility }),
          ...(body.results !== undefined && { results: body.results }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.tags !== undefined && { tags: body.tags }),
        })
        .where(and(eq(labResults.id, params.id), eq(labResults.userId, userId)))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        testName: t.Optional(t.String()),
        testType: t.Optional(t.String()),
        testDate: t.Optional(t.String()),
        orderedBy: t.Optional(t.String()),
        facility: t.Optional(t.String()),
        results: t.Optional(t.Any()),
        notes: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["health"], summary: "Update a lab result" },
    }
  )
  .delete(
    "/labs/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: labResults.id, userId: labResults.userId }).from(labResults).where(eq(labResults.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Lab result not found" }; }
      await db.delete(labResults).where(and(eq(labResults.id, params.id), eq(labResults.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["health"], summary: "Delete a lab result" },
    }
  )

  // ── Medical History: full CRUD ────────────────────────────────────────────────
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
        condition: t.String(),
        severity: t.Optional(t.String()),
        diagnosedDate: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        isFamily: t.Optional(t.Boolean()),
        relation: t.Optional(t.String()),
        familyMemberId: t.Optional(t.String()),
        familyMemberName: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["health"], summary: "Add a medical history entry" },
    }
  )
  .get(
    "/medical-history/:id",
    async ({ db, userId, params, set }) => {
      const [entry] = await db.select().from(medicalHistory).where(eq(medicalHistory.id, params.id)).limit(1);
      if (!entry) { set.status = 404; return { error: "Medical history entry not found" }; }
      return entry;
    },
    {
      params: t.Object({ id: t.String() }),
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
      params: t.Object({ id: t.String() }),
      body: t.Object({
        condition: t.Optional(t.String()),
        severity: t.Optional(t.String()),
        diagnosedDate: t.Optional(t.Nullable(t.String())),
        notes: t.Optional(t.String()),
        isFamily: t.Optional(t.Boolean()),
        relation: t.Optional(t.String()),
        familyMemberId: t.Optional(t.String()),
        familyMemberName: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
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
      params: t.Object({ id: t.String() }),
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
        const authErr = await assertFamilyAccess(db, userId, targetUserId);
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
        userId: t.Optional(t.String()),
        startDate: t.String(),
        endDate: t.Optional(t.String()),
        flowIntensity: t.Optional(t.String()),
        symptoms: t.Optional(t.Array(t.String())),
        notes: t.Optional(t.String()),
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
      params: t.Object({ id: t.String() }),
      body: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.Nullable(t.String())),
        flowIntensity: t.Optional(t.String()),
        symptoms: t.Optional(t.Array(t.String())),
        notes: t.Optional(t.String()),
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
      params: t.Object({ id: t.String() }),
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
        const authErr = await assertFamilyAccess(db, userId, targetUserId);
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
        userId: t.Optional(t.String()),
        date: t.String(),
        flowIntensity: t.Optional(t.String()),
        flow: t.Optional(t.String()),
        crampsSeverity: t.Optional(t.Number()),
        cramps: t.Optional(t.Number()),
        mood: t.Optional(t.Number()),
        energyLevel: t.Optional(t.Number()),
        energy: t.Optional(t.Number()),
        sleepQuality: t.Optional(t.Number()),
        dischargeType: t.Optional(t.String()),
        spotting: t.Optional(t.Boolean()),
        birthControlMethod: t.Optional(t.String()),
        birthControlTaken: t.Optional(t.Boolean()),
        birthControlSideEffects: t.Optional(t.Array(t.String())),
        symptoms: t.Optional(t.Array(t.String())),
        notes: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Upsert a cycle daily entry (idempotent by user+date)" },
    }
  )
  .delete(
    "/cycle-daily/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: cycleDailyEntries.id, userId: cycleDailyEntries.userId }).from(cycleDailyEntries).where(eq(cycleDailyEntries.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Cycle daily entry not found" }; }
      await db.delete(cycleDailyEntries).where(eq(cycleDailyEntries.id, params.id));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["health"], summary: "Delete a cycle daily entry" },
    }
  )

  // ── Health Timeline ───────────────────────────────────────────────────────────
  /**
   * POST /api/health/timeline
   * Record a health timeline event.
   *
   * Maps HealthTimelineEvent fields onto the health_timeline Neon table:
   *   eventType  → source
   *   timestamp  → occurredAt
   *   everything else → metadata JSONB
   */
  .post(
    "/timeline",
    async ({ db, userId, body, set }) => {
      const timelineTargetUserId = body.userId ?? userId;
      if (timelineTargetUserId !== userId) {
        const authErr = await assertFamilyAccess(db, userId, timelineTargetUserId);
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
        userId: t.Optional(t.String()),
        familyId: t.Optional(t.String()),
        eventType: t.String(),
        title: t.String(),
        description: t.Optional(t.String()),
        timestamp: t.String(),
        severity: t.String(),
        icon: t.Optional(t.String()),
        metadata: t.Optional(t.Any()),
        relatedEntityId: t.Optional(t.String()),
        relatedEntityType: t.Optional(t.String()),
        actorId: t.Optional(t.String()),
        actorType: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Record a health timeline event" },
    }
  )
  /**
   * GET /api/health/timeline
   * List timeline events for the authenticated user.
   * Query params: limit, from, to, types (comma-separated event types)
   */
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
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
        types: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Get health timeline events for the current user" },
    }
  )
  /**
   * PATCH /api/health/timeline/:id
   * Update the status / acknowledgement fields of a health timeline event.
   * Status and audit fields (acknowledgedAt, resolvedAt, etc.) live inside the
   * metadata JSONB column — this endpoint merges the supplied fields into the
   * existing metadata object.
   * Only the event owner, or a family admin / caregiver, may update the event.
   */
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
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status:          t.Optional(t.String()),
        acknowledgedAt:  t.Optional(t.String()),
        acknowledgedBy:  t.Optional(t.String()),
        resolvedAt:      t.Optional(t.String()),
        resolvedBy:      t.Optional(t.String()),
        escalatedAt:     t.Optional(t.String()),
        escalatedBy:     t.Optional(t.String()),
        metadata:        t.Optional(t.Any()),
      }),
      detail: { tags: ["health"], summary: "Update a health timeline event status" },
    }
  )
  /**
   * GET /api/health/timeline/family
   * List timeline events for a set of family members.
   * Query params: userIds (comma-separated), limit, from, to
   */
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
        userIds: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["health"], summary: "Get health timeline events for a set of family member user IDs" },
    }
  )

  // ── Garmin OAuth (server-side, credentials never leave the API) ───────────────

  /**
   * Step 1: Build the Garmin OAuth authorization URL.
   * Returns the URL the mobile client should open in a browser session.
   */
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
        selectedMetrics: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["health"], summary: "Generate Garmin OAuth authorization URL" },
    }
  )

  /**
   * Step 2: Exchange authorization code for tokens.
   * Stores tokens server-side; nothing secret is returned to the client.
   */
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

      const tokenRes = await fetch("https://connect.garmin.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: body.code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error("[garmin/exchange] Token exchange failed:", errText);
        set.status = 502;
        return { error: "Failed to exchange Garmin authorization code." };
      }

      // Tokens are persisted server-side in the user preferences JSONB blob.
      // The client never receives the raw tokens.
      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      // Store encrypted tokens in preferences JSONB (simple base64 for now;
      // replace with KMS/Vault in production)
      const { users } = await import("../db/schema");
      const { sql } = await import("drizzle-orm");
      const tokenPayload = {
        garminAccessToken: Buffer.from(tokens.access_token).toString("base64"),
        garminRefreshToken: Buffer.from(tokens.refresh_token).toString("base64"),
        garminTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        garminConnected: true,
        garminConnectedAt: new Date().toISOString(),
      };

      await (await import("../db")).db
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
        code: t.String(),
        state: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Exchange Garmin OAuth code for tokens (server-side)" },
    }
  )

  /**
   * Disconnect Garmin: revoke tokens and clear stored connection.
   */
  .post(
    "/garmin/disconnect",
    async ({ userId }) => {
      const { users } = await import("../db/schema");
      const { sql } = await import("drizzle-orm");
      const clearPayload = {
        garminAccessToken: null,
        garminRefreshToken: null,
        garminTokenExpiresAt: null,
        garminConnected: false,
      };

      await (await import("../db")).db
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

  // ── PPG Embeddings ─────────────────────────────────────────────────────────

  /**
   * POST /api/health/ppg-embeddings
   * Persist a PPG embedding record (fire-and-forget from the mobile client).
   */
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
        embeddings: t.Array(t.Number()),
        heartRate: t.Optional(t.Nullable(t.Number())),
        hrv: t.Optional(t.Nullable(t.Number())),
        respiratoryRate: t.Optional(t.Nullable(t.Number())),
        signalQuality: t.Number(),
        confidence: t.Optional(t.Nullable(t.Number())),
        capturedAt: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Persist a PPG ML embedding record" },
    }
  )

  /**
   * GET /api/health/ppg-embeddings
   * Fetch the most recent N PPG embeddings for the authenticated user.
   */
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
  )

  // ── Escalations ────────────────────────────────────────────────────────────

  /**
   * POST /api/health/escalations
   * Start a new escalation record.
   */
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
        alertId: t.Optional(t.String()),
        familyId: t.Optional(t.String()),
        type: t.String(),
        severity: t.String(),
        metadata: t.Optional(t.Any()),
      }),
      detail: { tags: ["health"], summary: "Start a new escalation" },
    }
  )

  /**
   * GET /api/health/escalations
   * Query escalations for a family / user / status.
   */
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
        familyId: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Query escalations" },
    }
  )

  /**
   * PATCH /api/health/escalations/:id
   * Update an escalation (acknowledge, resolve, escalate level, append notifications).
   */
  .patch(
    "/escalations/:id",
    async ({ db, body, params }) => {
      const updates: Record<string, unknown> = {};
      if (body.status) updates.status = body.status;
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
        // Fetch current array and merge
        const [current] = await db.select({ notificationsSent: escalations.notificationsSent })
          .from(escalations).where(eq(escalations.id, params.id)).limit(1);
        const existing = (current?.notificationsSent as string[] | null) ?? [];
        const merged = [...new Set([...existing, ...body.notificationsSentAppend])];
        updates.notificationsSent = merged;
      }
      const [updated] = await db.update(escalations)
        .set(updates as never)
        .where(eq(escalations.id, params.id))
        .returning();
      return updated ?? { error: "Not found" };
    },
    {
      body: t.Object({
        status: t.Optional(t.String()),
        acknowledgedBy: t.Optional(t.String()),
        resolvedBy: t.Optional(t.String()),
        resolutionNotes: t.Optional(t.String()),
        currentLevel: t.Optional(t.Number()),
        notificationsSentAppend: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["health"], summary: "Update an escalation record" },
    }
  )

  /**
   * POST /api/health/escalations/resolve-by-alert
   * Bulk-resolve all active escalations for a given alertId.
   */
  .post(
    "/escalations/resolve-by-alert",
    async ({ db, body }) => {
      await db.update(escalations)
        .set({
          status: "resolved",
          resolvedBy: body.resolvedBy,
          resolvedAt: new Date(),
          resolutionNotes: body.notes ?? null,
        } as never)
        .where(and(eq(escalations.alertId, body.alertId), eq(escalations.status, "active")));
      return { ok: true };
    },
    {
      body: t.Object({
        alertId: t.String(),
        resolvedBy: t.String(),
        notes: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Bulk-resolve escalations by alertId" },
    }
  )

  /**
   * POST /api/health/escalations/process
   * Trigger server-side escalation processing job (no-op placeholder — logic runs in vhiCycle).
   */
  .post(
    "/escalations/process",
    async () => ({ ok: true, message: "Escalation processing is handled by the server cycle job." }),
    { detail: { tags: ["health"], summary: "Trigger escalation processing (no-op)" } }
  )

  // ── Anomalies ─────────────────────────────────────────────────────────────

  /**
   * GET /api/health/anomalies
   * Query anomalies. Org admins may pass ?userId= to query for a patient.
   */
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
        userId: t.Optional(t.String()),
        from: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["health"], summary: "Get anomalies for the current user (or a patient if org admin)" },
    }
  )

  // ── Health Scores ─────────────────────────────────────────────────────────

  /**
   * GET /api/health/scores
   * Return recent health score events from the timeline for a given userId.
   * Used by the family dashboard to get the latest computed score.
   */
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
        userId: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["health"], summary: "Get health score history events from the timeline" },
    }
  )

  // ── Lab Insights Cache ─────────────────────────────────────────────────────

  /**
   * POST /api/health/lab-insights/cache
   * Store computed lab insight results (best-effort persistence).
   * Stored as a health_timeline event of source "lab_insights_cache".
   */
  .post(
    "/lab-insights/cache",
    async ({ db, userId, body }) => {
      await db.insert(healthTimeline).values({
        id: crypto.randomUUID(),
        userId,
        occurredAt: new Date(),
        source: "lab_insights_cache",
        domain: "clinical",
        metadata: body,
      });
      return { ok: true };
    },
    {
      body: t.Any(),
      detail: { tags: ["health"], summary: "Cache lab insight results (best-effort)" },
    }
  )

  // ── Medication Adherence ────────────────────────────────────────────────────

  /**
   * POST /api/health/medication-adherence
   * Record a medication taken/missed/skipped event.
   */
  .post(
    "/medication-adherence",
    async ({ db, userId, body }) => {
      const id = crypto.randomUUID();
      await db.insert(medicationAdherence).values({
        id,
        userId,
        medicationId: body.medicationId ?? null,
        reminderId: body.reminderId ?? null,
        status: body.status,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        takenAt: body.takenAt ? new Date(body.takenAt) : null,
        dose: body.dose ?? null,
        notes: body.notes ?? null,
        recordedAt: new Date(),
      });
      return { id, ok: true };
    },
    {
      body: t.Object({
        medicationId: t.Optional(t.String()),
        reminderId: t.Optional(t.String()),
        status: t.Union([t.Literal("taken"), t.Literal("missed"), t.Literal("skipped")]),
        scheduledAt: t.Optional(t.String()),
        takenAt: t.Optional(t.String()),
        dose: t.Optional(t.String()),
        notes: t.Optional(t.String()),
      }),
      detail: { tags: ["health"], summary: "Record medication adherence event" },
    }
  )

  /**
   * GET /api/health/medication-adherence
   * List medication adherence events for the authenticated user.
   */
  .get(
    "/medication-adherence",
    async ({ db, userId, query }) => {
      const filters = [eq(medicationAdherence.userId, userId)];
      if (query.medicationId) filters.push(eq(medicationAdherence.medicationId, query.medicationId));
      if (query.from) filters.push(gte(medicationAdherence.recordedAt, new Date(query.from)));
      return db
        .select()
        .from(medicationAdherence)
        .where(and(...filters))
        .orderBy(desc(medicationAdherence.recordedAt))
        .limit(query.limit ?? 50);
    },
    {
      query: t.Object({
        medicationId: t.Optional(t.String()),
        from: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["health"], summary: "Get medication adherence history" },
    }
  );
