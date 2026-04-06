/**
 * Medication Refill Routes
 *
 * Manages medication refill workflows:
 *   GET  /api/medications/refills/pending?userId=   → medications with refillDate ≤ 7 days away
 *   POST /api/medications/refills                   → create a refill reminder record
 *   GET  /api/medications/refills/reminders?userId= → upcoming refill reminders (same as pending)
 *   PATCH /api/medications/refills/:id/dismiss      → mark a refill reminder as snoozed/dismissed
 *
 * Refills are derived from the `medications.refillDate` field plus optional
 * `medication_reminders` rows created by the "request refill" action.
 */

import { Elysia, t } from "elysia";
import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/requireAuth";
import { medications, medicationReminders } from "../db/schema";

/** Days before refillDate to surface as "pending" */
const REFILL_LOOKAHEAD_DAYS = 7;

export const medicationRoutes = new Elysia({ prefix: "/api/medications" })
  .use(requireAuth)

  /**
   * GET /api/medications/refills/pending?userId=<id>
   * Returns medications whose refillDate is within the next 7 days (or already past).
   * Scoped to the authenticated user; userId query param is validated against session.
   */
  .get(
    "/refills/pending",
    async ({ db, userId, query, set }) => {
      // Only allow fetching own refills (or ignore the param entirely and use session)
      const targetUserId = (query.userId as string | undefined)?.trim() || userId;
      if (targetUserId !== userId) {
        set.status = 403;
        return { error: "Cannot fetch refills for another user" };
      }

      const now = new Date();
      const cutoff = new Date(now.getTime() + REFILL_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

      const rows = await db
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.userId, userId),
            eq(medications.isActive, true),
            isNull(medications.deletedAt),
            or(
              // refillDate is in the past (overdue)
              lte(medications.refillDate, now),
              // refillDate is within the next 7 days
              and(gte(medications.refillDate, now), lte(medications.refillDate, cutoff))
            )
          )
        );

      return rows.map((med) => {
        const refillDate = med.refillDate ? new Date(med.refillDate) : null;
        const daysRemaining = refillDate
          ? Math.ceil((refillDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return {
          id: med.id,
          userId: med.userId,
          medicationId: med.id,
          medicationName: med.name,
          daysRemaining,
          lastFillDate: undefined,
          pharmacyName: undefined,
          status: "pending" as const,
        };
      });
    },
    {
      query: t.Object({ userId: t.Optional(t.String({ minLength: 1, maxLength: 36 })) }),
      detail: { tags: ["health"], summary: "Get pending medication refills" },
    }
  )

  /**
   * POST /api/medications/refills
   * Creates a medication_reminders row to track a refill request.
   * Body: { medicationId: string }
   */
  .post(
    "/refills",
    async ({ db, userId, body, set }) => {
      // Verify the medication belongs to this user
      const [med] = await db
        .select({ id: medications.id, name: medications.name })
        .from(medications)
        .where(and(eq(medications.id, body.medicationId), eq(medications.userId, userId), isNull(medications.deletedAt)))
        .limit(1);

      if (!med) {
        set.status = 404;
        return { error: "Medication not found" };
      }

      // Insert a reminder row to record the refill request
      const reminderId = crypto.randomUUID();
      await db.insert(medicationReminders).values({
        id: reminderId,
        medicationId: med.id,
        userId,
        scheduledAt: new Date(),
        status: "pending",
        notes: "refill_request",
      });

      return { id: reminderId, medicationId: med.id, medicationName: med.name, status: "requested" };
    },
    {
      body: t.Object({ medicationId: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Request a medication refill" },
    }
  )

  /**
   * GET /api/medications/refills/reminders?userId=<id>
   * Returns upcoming refill reminders. Currently returns the same data as /pending
   * but filtered to medications with explicit refillDate set.
   */
  .get(
    "/refills/reminders",
    async ({ db, userId, query, set }) => {
      const targetUserId = (query.userId as string | undefined)?.trim() || userId;
      if (targetUserId !== userId) {
        set.status = 403;
        return { error: "Cannot fetch reminders for another user" };
      }

      const now = new Date();
      const cutoff = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14-day window for reminders

      const rows = await db
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.userId, userId),
            eq(medications.isActive, true),
            isNull(medications.deletedAt),
            gte(medications.refillDate, now),
            lte(medications.refillDate, cutoff)
          )
        );

      return rows.map((med) => {
        const refillDate = med.refillDate ? new Date(med.refillDate) : null;
        const daysRemaining = refillDate
          ? Math.ceil((refillDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        return {
          id: med.id,
          userId: med.userId,
          medicationId: med.id,
          medicationName: med.name,
          daysRemaining,
          lastFillDate: undefined,
          pharmacyName: undefined,
          status: "pending" as const,
        };
      });
    },
    {
      query: t.Object({ userId: t.Optional(t.String({ minLength: 1, maxLength: 36 })) }),
      detail: { tags: ["health"], summary: "Get medication refill reminders" },
    }
  )

  /**
   * PATCH /api/medications/refills/:id/dismiss
   * Marks a refill reminder (medication_reminders row) as snoozed/dismissed.
   * Falls back to updating the medication's refillDate if no reminder row exists.
   */
  .patch(
    "/refills/:id/dismiss",
    async ({ db, userId, params, set }) => {
      // Try to update a medication_reminders row first
      const [reminder] = await db
        .select({ id: medicationReminders.id, medicationId: medicationReminders.medicationId })
        .from(medicationReminders)
        .where(and(eq(medicationReminders.id, params.id), eq(medicationReminders.userId, userId)))
        .limit(1);

      if (reminder) {
        await db
          .update(medicationReminders)
          .set({ status: "snoozed" })
          // Include userId in WHERE to close the TOCTOU window between the
          // ownership check above and this mutation.
          .where(and(eq(medicationReminders.id, reminder.id), eq(medicationReminders.userId, userId)));
        return { id: reminder.id, status: "dismissed" };
      }

      // Fallback: the id might be the medication id itself — push refillDate out 30 days
      const [med] = await db
        .select({ id: medications.id, refillDate: medications.refillDate })
        .from(medications)
        .where(and(eq(medications.id, params.id), eq(medications.userId, userId), isNull(medications.deletedAt)))
        .limit(1);

      if (!med) {
        set.status = 404;
        return { error: "Refill reminder not found" };
      }

      const newRefillDate = new Date(
        (med.refillDate ? new Date(med.refillDate).getTime() : Date.now()) +
          30 * 24 * 60 * 60 * 1000
      );
      await db
        .update(medications)
        .set({ refillDate: newRefillDate, updatedAt: new Date() })
        // Include userId in WHERE to close the TOCTOU window.
        .where(and(eq(medications.id, med.id), eq(medications.userId, userId)));

      return { id: med.id, status: "dismissed" };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Dismiss a medication refill reminder" },
    }
  );
