import { Elysia, t } from "elysia";
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../../middleware/requireAuth.js";
import { logger } from "../../lib/logger.js";
import { medications, medicationReminders, medicationAdherence, allergies, familyMembers, alerts } from "../../db/schema.js";
import { assertFamilyAccess, assertFamilyWriteAccess } from "../../services/familyAccessService.js";

// Reusable ISO 8601 date-string type.
const IsoDateString = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}" });

export const medicationsRoutes = new Elysia()
  .use(requireAuth)

  // ── GET /medications ─────────────────────────────────────────────────────────
  .get(
    "/medications",
    async ({ db, userId }) => {
      return db
        .select()
        .from(medications)
        .where(and(eq(medications.userId, userId), eq(medications.isActive, true), isNull(medications.deletedAt)));
    },
    { detail: { tags: ["health"], summary: "Get active medications" } }
  )

  // ── POST /medications ────────────────────────────────────────────────────────
  .post(
    "/medications",
    async ({ db, userId, body, set }) => {
      const targetUserId = body.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyWriteAccess(db, userId, targetUserId);
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

      // Non-blocking allergy cross-check
      // Returns a warning if the medication name matches an active allergy substance.
      // Does NOT block creation — we warn, never gate.
      let allergyWarning: string | null = null;
      try {
        const medNameLower = body.name.toLowerCase().trim();
        const activeAllergies = await db
          .select({ substance: allergies.substance })
          .from(allergies)
          .where(and(eq(allergies.userId, targetUserId), isNull(allergies.deletedAt)))
          .limit(50);

        const conflict = activeAllergies.find((a) => {
          const sub = (a.substance ?? '').toLowerCase().trim();
          return sub.length > 2 && (
            medNameLower.includes(sub) ||
            sub.includes(medNameLower)
          );
        });

        if (conflict) {
          allergyWarning = `You have a recorded allergy to "${conflict.substance}". Please verify this medication is safe before taking it.`;
          logger.warn(
            { medication: body.name, substance: conflict.substance },
            "[medications] Allergy conflict detected"
          );
        }
      } catch (allergyCheckErr) {
        // Never fail medication creation due to allergy check errors
        logger.error({ err: allergyCheckErr }, '[medications] Allergy check failed');
      }

      // Non-blocking DDI check — never delays the response
      (async () => {
        try {
          const { checkDrugInteractions } = await import('../../services/drugInteractionService.js');
          // Get user's other active medications
          const activeMeds = await db.select({ name: medications.name })
            .from(medications)
            .where(and(eq(medications.userId, targetUserId), eq(medications.isActive, true), isNull(medications.deletedAt)))
            .limit(50);
          const existingNames = activeMeds.map(m => m.name).filter(n => n !== body.name);
          const interactions = await checkDrugInteractions(body.name, existingNames);
          if (interactions.length > 0) {
            // Store as a warning alert — not critical, clinicians decide
            await db.insert(alerts).values({
              id: crypto.randomUUID(),
              userId: targetUserId,
              type: 'drug_interaction_warning',
              severity: 'high',
              title: 'Potential Drug Interaction',
              body: `${body.name} may interact with ${interactions.map(i => i.drug).join(', ')}. Review with your doctor.`,
              isAcknowledged: false,
              metadata: { newDrug: body.name, interactions },
            });
          }
        } catch (err: unknown) {
          logger.warn({ err }, '[medications] DDI check failed');
        }
      })();

      return { ...created, allergyWarning };
    },
    {
      body: t.Object({
        name: t.String({ maxLength: 255 }),
        userId: t.Optional(t.String({ maxLength: 36 })),
        dosage: t.Optional(t.String({ maxLength: 100 })),
        frequency: t.Optional(t.String({ maxLength: 100 })),
        instructions: t.Optional(t.String({ maxLength: 2000 })),
        startDate: t.Optional(IsoDateString),
        endDate: t.Optional(IsoDateString),
        reminders: t.Optional(t.Array(t.Record(t.String(), t.Unknown()), { maxItems: 50 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 50 })),
        quantity: t.Optional(t.Number({ minimum: 0, maximum: 10000 })),
        notes: t.Optional(t.String({ maxLength: 2000 })),
      }),
      detail: { tags: ["health"], summary: "Add a medication" },
    }
  )

  // ── GET /medications/:id ─────────────────────────────────────────────────────
  .get(
    "/medications/:id",
    async ({ db, userId, params, set }) => {
      const [med] = await db.select().from(medications).where(and(eq(medications.id, params.id), isNull(medications.deletedAt))).limit(1);
      if (!med) { set.status = 404; return { error: "Medication not found" }; }
      // Ensure the caller owns this medication (or has family access)
      const authErr = await assertFamilyAccess(db, userId, med.userId, "medications");
      if (authErr) { set.status = 403; return authErr; }
      return med;
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Get medication by ID" },
    }
  )

  // ── PATCH /medications/:id ───────────────────────────────────────────────────
  .patch(
    "/medications/:id",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db.select({ id: medications.id, userId: medications.userId }).from(medications).where(and(eq(medications.id, params.id), isNull(medications.deletedAt))).limit(1);
      if (!existing) { set.status = 404; return { error: "Medication not found" }; }
      // Only the owner or a family admin may modify a medication (caregivers read-only)
      const authErr = await assertFamilyWriteAccess(db, userId, existing.userId);
      if (authErr) { set.status = 403; return authErr; }

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
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 255 })),
        dosage: t.Optional(t.String({ maxLength: 100 })),
        frequency: t.Optional(t.String({ maxLength: 100 })),
        instructions: t.Optional(t.String({ maxLength: 2000 })),
        isActive: t.Optional(t.Boolean()),
        startDate: t.Optional(IsoDateString),
        endDate: t.Optional(t.Nullable(IsoDateString)),
        reminders: t.Optional(t.Array(t.Record(t.String(), t.Unknown()), { maxItems: 50 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 50 })),
        quantity: t.Optional(t.Number({ minimum: 0 })),
        notes: t.Optional(t.String({ maxLength: 2000 })),
      }),
      detail: { tags: ["health"], summary: "Update a medication" },
    }
  )

  // ── GET /medications/user/:userId (admin/caregiver) ──────────────────────────
  .get(
    "/medications/user/:userId",
    async ({ db, userId, params, set }) => {
      const authErr = await assertFamilyAccess(db, userId, params.userId, "medications");
      if (authErr) { set.status = 403; return authErr; }
      // Cap at 500 — a long-term patient could have hundreds of historical medications.
      return db.select().from(medications).where(and(eq(medications.userId, params.userId), eq(medications.isActive, true), isNull(medications.deletedAt))).limit(500);
    },
    {
      params: t.Object({ userId: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Get medications for a specific user (admin/caregiver)" },
    }
  )

  // ── GET /medications/family/:familyId ────────────────────────────────────────
  .get(
    "/medications/family/:familyId",
    async ({ db, userId, params, set }) => {
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
      // Cap at 500 rows — a family is unlikely to have more active medications than
      // this, and an unbounded query on a large family would dump the entire table.
      return db.select().from(medications).where(and(inArray(medications.userId, memberIds), eq(medications.isActive, true), isNull(medications.deletedAt))).limit(500);
    },
    {
      params: t.Object({ familyId: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Get all active medications for a family" },
    }
  )

  // ── PATCH /medications/:medicationId/reminders/mark-taken ────────────────────
  .patch(
    "/medications/:medicationId/reminders/mark-taken",
    async ({ db, userId, params, body, set }) => {
      // Verify the medication belongs to the target member
      const [med] = await db
        .select({ id: medications.id, userId: medications.userId })
        .from(medications)
        .where(and(eq(medications.id, params.medicationId), isNull(medications.deletedAt)))
        .limit(1);

      if (!med) {
        set.status = 404;
        return { error: "Medication not found" };
      }

      // Caller must be the owner OR a family admin (caregivers may not mark-taken on behalf of others).
      const authErr = await assertFamilyWriteAccess(db, userId, med.userId);
      if (authErr) { set.status = 403; return authErr; }

      // Record who administered the medication. Always derive from the authenticated
      // session — never from the body, to prevent attributing the action to others.
      const takenBy = userId !== med.userId ? userId : undefined;

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
      params: t.Object({ medicationId: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Optional(
        t.Object({ caregiverId: t.Optional(t.String({ maxLength: 36 })) })
      ),
      detail: {
        tags: ["health"],
        summary: "Mark a medication as taken (caregiver or self)",
      },
    }
  )

  // ── POST /medications/schedule-reminders ─────────────────────────────────────
  .post(
    "/medications/schedule-reminders",
    async ({ db, userId, body, set }) => {
      // Verify the medication exists and the caller is authorised to manage it
      const [med] = await db
        .select({ id: medications.id, userId: medications.userId })
        .from(medications)
        .where(and(eq(medications.id, body.medicationId), isNull(medications.deletedAt)))
        .limit(1);

      if (!med) {
        set.status = 404;
        return { error: "Medication not found" };
      }

      const authErr = await assertFamilyWriteAccess(db, userId, med.userId);
      if (authErr) { set.status = 403; return authErr; }

      const now = new Date();

      // Delete all existing future pending reminders for this medication
      await db
        .delete(medicationReminders)
        .where(
          and(
            eq(medicationReminders.medicationId, body.medicationId),
            eq(medicationReminders.status, "pending"),
            gte(medicationReminders.scheduledAt, now)
          )
        );

      // Build 30 days of reminder rows for each supplied time
      const rows: {
        id: string;
        medicationId: string;
        userId: string;
        scheduledAt: Date;
        status: "pending";
      }[] = [];

      for (let day = 0; day < 30; day++) {
        for (const timeStr of body.reminderTimes) {
          const [hh, mm] = timeStr.split(":").map(Number);
          const scheduledAt = new Date();
          scheduledAt.setDate(scheduledAt.getDate() + day);
          scheduledAt.setHours(hh, mm, 0, 0);
          rows.push({
            id: crypto.randomUUID(),
            medicationId: body.medicationId,
            userId: med.userId,
            scheduledAt,
            status: "pending",
          });
        }
      }

      if (rows.length > 0) {
        await db.insert(medicationReminders).values(rows);
      }

      return { scheduled: rows.length };
    },
    {
      body: t.Object({
        medicationId: t.String({ minLength: 1, maxLength: 36 }),
        // Each entry must be a valid "HH:MM" 24-hour time string
        reminderTimes: t.Array(
          t.String({ pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$" }),
          { minItems: 1, maxItems: 20 }
        ),
      }),
      detail: {
        tags: ["health"],
        summary: "Schedule medication reminders for 30 days",
      },
    }
  )

  // ── GET /reminders/today ─────────────────────────────────────────────────────
  .get(
    "/reminders/today",
    async ({ db, userId }) => {
      const now = new Date();
      // Use the Date constructor (year, month, date, ...) to avoid mutating `now`
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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

  // ── PATCH /reminders/:reminderId ─────────────────────────────────────────────
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
      params: t.Object({ reminderId: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({ status: t.Union([t.Literal("taken"), t.Literal("missed"), t.Literal("snoozed")]) }),
      detail: { tags: ["health"], summary: "Update a reminder status (taken/missed/snoozed)" },
    }
  )

  // ── POST /medication-adherence ───────────────────────────────────────────────
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
        medicationId: t.Optional(t.String({ maxLength: 36 })),
        reminderId: t.Optional(t.String({ maxLength: 36 })),
        status: t.Union([t.Literal("taken"), t.Literal("missed"), t.Literal("skipped")]),
        scheduledAt: t.Optional(IsoDateString),
        takenAt: t.Optional(IsoDateString),
        dose: t.Optional(t.String({ maxLength: 100 })),
        notes: t.Optional(t.String({ maxLength: 2000 })),
      }),
      detail: { tags: ["health"], summary: "Record medication adherence event" },
    }
  )

  // ── GET /medication-adherence ────────────────────────────────────────────────
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
        medicationId: t.Optional(t.String({ minLength: 1, maxLength: 36 })),
        from: t.Optional(IsoDateString),
        limit: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["health"], summary: "Get medication adherence history" },
    }
  );
