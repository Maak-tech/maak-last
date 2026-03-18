/**
 * Alert routes — CRUD for emergency alerts.
 *
 * Replaces Firestore `alerts` collection reads/writes + Cloud Function fallbacks in alertService.ts.
 * Neon schema: alerts { id, userId, familyId, type, severity, title, body, isAcknowledged,
 *   acknowledgedBy, acknowledgedAt, resolvedAt, metadata, createdAt }
 *
 * Response shape matches client EmergencyAlert type:
 *   { id, userId, type, severity, message, timestamp, resolved, resolvedAt, resolvedBy,
 *     acknowledgedBy, acknowledgedAt, responders, metadata }
 *
 * Authorization model:
 *   - Own alerts: full CRUD access.
 *   - Another user's alert: caller must be a family admin or caregiver in the same family.
 *   - GET /family: only returns alerts for userIds confirmed as members of the caller's family.
 *   - POST / with body.userId: caller must be a family admin of the target user.
 */

import { Elysia, t } from "elysia";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { alerts, familyMembers } from "../db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { dispatchWebhookEvent } from "../lib/webhookDispatcher";

type AlertRow = InferSelectModel<typeof alerts>;

/** Normalize Neon alert row → EmergencyAlert shape expected by mobile client */
function toEmergencyAlert(row: AlertRow) {
  const meta = row.metadata as Record<string, unknown> | null;
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    severity: row.severity,
    message: row.body ?? row.title,
    timestamp: row.createdAt ?? new Date(),
    resolved: row.isAcknowledged === true || row.resolvedAt !== null,
    resolvedAt: row.resolvedAt ?? undefined,
    resolvedBy: meta?.resolvedBy ?? undefined,
    acknowledgedBy: row.acknowledgedBy ?? undefined,
    acknowledgedAt: row.acknowledgedAt ?? undefined,
    responders: (meta?.responders as string[] | undefined) ?? [],
    metadata: meta ?? undefined,
  };
}

/**
 * Returns true when callerId is authorized to act on an alert owned by alertOwnerId.
 * Authorized if:
 *   - callerId === alertOwnerId (owner), OR
 *   - callerId is a family admin or caregiver in the same family as alertOwnerId.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function hasAlertAccess(db: any, callerId: string, alertOwnerId: string | null): Promise<boolean> {
  if (!alertOwnerId) return false;
  if (alertOwnerId === callerId) return true;

  // Find the alert owner's family
  const [ownerMembership] = await db
    .select({ familyId: familyMembers.familyId })
    .from(familyMembers)
    .where(eq(familyMembers.userId, alertOwnerId))
    .limit(1);

  if (!ownerMembership) return false;

  // Caller must be admin or caregiver in the same family
  const [callerMembership] = await db
    .select({ role: familyMembers.role })
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.userId, callerId),
        eq(familyMembers.familyId, ownerMembership.familyId)
      )
    )
    .limit(1);

  return callerMembership?.role === "admin" || callerMembership?.role === "caregiver";
}

export const alertsRoutes = new Elysia({ prefix: "/api/alerts" })
  .use(requireAuth)

  // ── GET own alerts ───────────────────────────────────────────────────────────
  .get(
    "/",
    async ({ db, userId, query }) => {
      const limitCount = Math.min(query.limit ?? 20, 200);
      const rows = await db
        .select()
        .from(alerts)
        .where(eq(alerts.userId, userId))
        .orderBy(desc(alerts.createdAt))
        .limit(limitCount);
      return rows.map(toEmergencyAlert);
    },
    {
      query: t.Object({ limit: t.Optional(t.Numeric()) }),
      detail: { tags: ["alerts"], summary: "Get own alerts (most recent first)" },
    }
  )

  // ── GET active (unresolved) alerts ───────────────────────────────────────────
  .get(
    "/active",
    async ({ db, userId }) => {
      const rows = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.userId, userId),
            eq(alerts.isAcknowledged, false),
            isNull(alerts.resolvedAt)
          )
        )
        .orderBy(desc(alerts.createdAt));
      return rows.map(toEmergencyAlert);
    },
    { detail: { tags: ["alerts"], summary: "Get active (unresolved) alerts for current user" } }
  )

  // ── GET active alert count ────────────────────────────────────────────────────
  .get(
    "/active/count",
    async ({ db, userId }) => {
      const rows = await db
        .select({ id: alerts.id })
        .from(alerts)
        .where(
          and(
            eq(alerts.userId, userId),
            eq(alerts.isAcknowledged, false),
            isNull(alerts.resolvedAt)
          )
        );
      return { count: rows.length };
    },
    { detail: { tags: ["alerts"], summary: "Count of active alerts for current user" } }
  )

  // ── GET family alerts (across multiple userIds) ──────────────────────────────
  // Only returns alerts for userIds that are confirmed members of the caller's own family.
  // Prevents cross-family data leakage when a user guesses userIds from another family.
  .get(
    "/family",
    async ({ db, userId, query, set }) => {
      if (!query.userIds) {
        set.status = 400;
        return { error: "userIds query param required" };
      }

      const requestedIds = query.userIds.split(",").filter(Boolean);
      if (requestedIds.length === 0) return [];

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

      // Cross-check: restrict to userIds that are actually in the caller's family.
      // Any requested userId not in the family is silently excluded.
      const authorizedMemberships = await db
        .select({ userId: familyMembers.userId })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.familyId, myMembership.familyId),
            inArray(familyMembers.userId, requestedIds)
          )
        );

      const authorizedUserIds: string[] = authorizedMemberships.map(
        (m: { userId: string }) => m.userId
      );

      if (authorizedUserIds.length === 0) return [];

      const limitCount = Math.min(query.limit ?? 50, 500);
      const showResolved = query.resolved === "true";

      const conditions = [inArray(alerts.userId, authorizedUserIds)];
      if (!showResolved) {
        conditions.push(
          or(eq(alerts.isAcknowledged, false), isNull(alerts.resolvedAt))!
        );
      }

      const rows = await db
        .select()
        .from(alerts)
        .where(and(...conditions))
        .orderBy(desc(alerts.createdAt))
        .limit(limitCount);

      return rows.map(toEmergencyAlert);
    },
    {
      query: t.Object({
        userIds: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
        resolved: t.Optional(t.String()),
      }),
      detail: { tags: ["alerts"], summary: "Get alerts for a list of userIds (family view)" },
    }
  )

  // ── POST create alert ─────────────────────────────────────────────────────────
  // If body.userId differs from the calling user, the caller must be a family admin
  // of the target user — prevents arbitrary users from creating alerts for any account.
  .post(
    "/",
    async ({ db, userId, body, set }) => {
      const targetUserId = body.userId ?? userId;

      if (targetUserId !== userId) {
        // Verify caller is a family admin of the target user
        const [targetMembership] = await db
          .select({ familyId: familyMembers.familyId })
          .from(familyMembers)
          .where(eq(familyMembers.userId, targetUserId))
          .limit(1);

        if (!targetMembership) {
          set.status = 403;
          return { error: "Target user is not in any family" };
        }

        const [callerMembership] = await db
          .select({ role: familyMembers.role })
          .from(familyMembers)
          .where(
            and(
              eq(familyMembers.userId, userId),
              eq(familyMembers.familyId, targetMembership.familyId)
            )
          )
          .limit(1);

        if (!callerMembership || callerMembership.role !== "admin") {
          set.status = 403;
          return { error: "Only family admins can create alerts for other users" };
        }
      }

      const id = crypto.randomUUID();
      const [created] = await db
        .insert(alerts)
        .values({
          id,
          userId: targetUserId,
          type: body.type,
          severity: body.severity,
          title: `${body.type} alert`,
          body: body.message,
          isAcknowledged: false,
          metadata: body.metadata
            ? ({ ...body.metadata, responders: [] } as Record<string, unknown>)
            : { responders: [] },
        })
        .returning();

      // Dispatch webhook event to SDK consumers (non-blocking)
      dispatchWebhookEvent("alert.triggered", targetUserId, {
        alertId: created.id,
        type: created.type,
        severity: created.severity,
        title: created.title,
      }).catch((err) => console.error("[alertsRoute] Webhook dispatch failed:", err));

      return toEmergencyAlert(created);
    },
    {
      body: t.Object({
        type: t.String(),
        severity: t.String(),
        message: t.String(),
        userId: t.Optional(t.String()),
        metadata: t.Optional(t.Any()),
      }),
      detail: { tags: ["alerts"], summary: "Create an emergency alert" },
    }
  )

  // ── PATCH resolve alert ───────────────────────────────────────────────────────
  // Caller must be the alert owner OR a family admin/caregiver of the alert owner.
  .patch(
    "/:alertId/resolve",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db
        .select()
        .from(alerts)
        .where(eq(alerts.id, params.alertId))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { error: "Alert not found" };
      }

      if (!await hasAlertAccess(db, userId, existing.userId)) {
        set.status = 403;
        return { error: "Access denied" };
      }

      const resolverId = body?.resolverId ?? userId;
      const existingMeta = (existing.metadata as Record<string, unknown>) ?? {};

      const [updated] = await db
        .update(alerts)
        .set({
          isAcknowledged: true,
          acknowledgedBy: resolverId,
          acknowledgedAt: new Date(),
          resolvedAt: new Date(),
          metadata: { ...existingMeta, resolvedBy: resolverId },
        })
        .where(eq(alerts.id, params.alertId))
        .returning();

      // Dispatch alert.resolved webhook to SDK consumers (non-blocking)
      dispatchWebhookEvent("alert.resolved", existing.userId ?? "", {
        alertId: existing.id,
        type: existing.type,
        severity: existing.severity,
        resolvedBy: resolverId,
      }).catch((err) => console.error("[alertsRoute] alert.resolved webhook failed:", err));

      return toEmergencyAlert(updated);
    },
    {
      params: t.Object({ alertId: t.String() }),
      body: t.Optional(t.Object({ resolverId: t.Optional(t.String()) })),
      detail: { tags: ["alerts"], summary: "Resolve (close) an alert" },
    }
  )

  // ── PATCH acknowledge alert ───────────────────────────────────────────────────
  // Caller must be the alert owner OR a family admin/caregiver of the alert owner.
  .patch(
    "/:alertId/acknowledge",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db
        .select()
        .from(alerts)
        .where(eq(alerts.id, params.alertId))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { error: "Alert not found" };
      }

      if (!await hasAlertAccess(db, userId, existing.userId)) {
        set.status = 403;
        return { error: "Access denied" };
      }

      const caregiverId = body?.caregiverId ?? userId;

      const [updated] = await db
        .update(alerts)
        .set({
          isAcknowledged: true,
          acknowledgedBy: caregiverId,
          acknowledgedAt: new Date(),
        })
        .where(eq(alerts.id, params.alertId))
        .returning();

      return toEmergencyAlert(updated);
    },
    {
      params: t.Object({ alertId: t.String() }),
      body: t.Optional(t.Object({ caregiverId: t.Optional(t.String()) })),
      detail: { tags: ["alerts"], summary: "Acknowledge an alert (caregiver check-in)" },
    }
  )

  // ── PATCH add responder ───────────────────────────────────────────────────────
  // Caller must be the alert owner OR a family admin/caregiver of the alert owner.
  .patch(
    "/:alertId/responders",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db
        .select()
        .from(alerts)
        .where(eq(alerts.id, params.alertId))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { error: "Alert not found" };
      }

      if (!await hasAlertAccess(db, userId, existing.userId)) {
        set.status = 403;
        return { error: "Access denied" };
      }

      const existingMeta = (existing.metadata as Record<string, unknown>) ?? {};
      const currentResponders = (existingMeta.responders as string[]) ?? [];
      const newResponders = Array.from(new Set([...currentResponders, body.responderId]));

      const [updated] = await db
        .update(alerts)
        .set({ metadata: { ...existingMeta, responders: newResponders } })
        .where(eq(alerts.id, params.alertId))
        .returning();

      return toEmergencyAlert(updated);
    },
    {
      params: t.Object({ alertId: t.String() }),
      body: t.Object({ responderId: t.String() }),
      detail: { tags: ["alerts"], summary: "Add a responder to an alert" },
    }
  );
