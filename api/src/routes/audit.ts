/**
 * Audit trail routes — HIPAA-compliant append-only audit log.
 *
 * Replaces direct Firestore writes from the mobile `auditService.ts`.
 * Entries are written to the Neon `audit_trail` table.
 * The endpoint never throws so audit logging never blocks the calling code.
 */

import { Elysia, t } from "elysia";
import { requireAuth } from "../middleware/requireAuth";
import { auditTrail } from "../db/schema";
import crypto from "node:crypto";

export const auditRoutes = new Elysia({ prefix: "/api/audit" })
  .use(requireAuth)

  /**
   * POST /api/audit/log
   * Append-only audit log entry.
   *
   * Fields that don't exist as top-level columns (actorOrgId, patientUserId,
   * orgId, outcome, denialReason, details) are stored inside `metadata`.
   */
  .post(
    "/log",
    async ({ db, userId, request, body }) => {
      try {
        const ipAddress =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          undefined;
        const userAgent = request.headers.get("user-agent") ?? undefined;

        await db.insert(auditTrail).values({
          id: crypto.randomUUID(),
          // patientUserId maps to the table's userId column
          userId: body.patientUserId ?? undefined,
          // actorId is always the authenticated session user — body.actorId is
          // accepted for backward compatibility but intentionally not used here,
          // to prevent clients from forging audit log entries on behalf of others.
          actorId: userId,
          actorType: body.actorType,
          action: body.action,
          resourceType: body.resourceType ?? undefined,
          resourceId: body.resourceId ?? undefined,
          metadata: {
            orgId: body.orgId,
            actorOrgId: body.actorOrgId,
            outcome: body.outcome,
            denialReason: body.denialReason,
            ...body.details,
          },
          ipAddress,
          userAgent,
        });

        return { ok: true };
      } catch (err) {
        // Audit logging must never break the caller — swallow and log server-side
        console.error("[audit] Failed to write audit entry:", err);
        return { ok: false };
      }
    },
    {
      body: t.Object({
        // actorId is accepted for backward compatibility but the server always
        // uses the authenticated session userId instead — it cannot be spoofed.
        actorId: t.Optional(t.String()),
        actorType: t.String(),
        actorOrgId: t.Optional(t.String()),
        action: t.String(),
        resourceType: t.Optional(t.String()),
        resourceId: t.Optional(t.String()),
        patientUserId: t.Optional(t.String()),
        orgId: t.Optional(t.String()),
        details: t.Optional(t.Record(t.String(), t.Unknown())),
        outcome: t.Optional(t.String()),
        denialReason: t.Optional(t.String()),
      }),
      detail: {
        tags: ["audit"],
        summary: "Append an audit trail entry (HIPAA)",
      },
    }
  );
