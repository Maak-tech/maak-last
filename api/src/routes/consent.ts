/**
 * Consent routes — patient consent management for org data access.
 *
 * Consent history is append-only for HIPAA audit compliance.
 * Revocations set isActive = false — records are never deleted.
 *
 * Endpoints:
 *   POST   /api/consent                       — grant consent (patient or org admin)
 *   GET    /api/consent/:targetUserId/:orgId   — get active consent record
 *   PATCH  /api/consent/:targetUserId/:orgId   — revoke or update scope
 *   GET    /api/consent/:targetUserId          — get all consents for a user
 *
 * The org-scoped list (GET /api/org/:orgId/consents) lives in routes/org.ts.
 */

import { Elysia, t } from "elysia";
import { and, desc, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/requireAuth";
import { patientConsents, orgMembers } from "../db/schema";

export const consentRoutes = new Elysia({ prefix: "/api/consent" })
  .use(requireAuth)

  /**
   * POST /api/consent
   * Grant consent for an org to access a patient's data.
   * Supersedes any prior active consent for the same user/org pair (history preserved).
   * Accessible by: the patient themselves, or an org admin for the specified org.
   */
  .post(
    "/",
    async ({ db, userId, body, set }) => {
      // Auth: patient grants own consent, OR org admin grants on patient's behalf
      if (userId !== body.userId) {
        const [membership] = await db
          .select({ role: orgMembers.role })
          .from(orgMembers)
          .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, body.orgId)))
          .limit(1);
        if (!membership || membership.role !== "admin") {
          set.status = 403;
          return { error: "Forbidden: only the patient or an org admin can grant consent" };
        }
      }

      // Deactivate any prior active consent for this user/org pair (history preserved)
      await db
        .update(patientConsents)
        .set({ isActive: false })
        .where(
          and(
            eq(patientConsents.userId, body.userId),
            eq(patientConsents.orgId, body.orgId),
            eq(patientConsents.isActive, true)
          )
        );

      const id = crypto.randomUUID();
      const [row] = await db
        .insert(patientConsents)
        .values({
          id,
          userId: body.userId,
          orgId: body.orgId,
          grantedBy: body.grantedBy ?? userId,
          grantMethod: body.grantMethod,
          scope: body.scope ?? [],
          version: body.version ?? "1.0",
          isActive: true,
        })
        .returning();

      set.status = 201;
      return row;
    },
    {
      body: t.Object({
        userId: t.String(),
        orgId: t.String(),
        grantedBy: t.Optional(t.String()),
        grantMethod: t.String(),
        scope: t.Optional(t.Array(t.String())),
        version: t.Optional(t.String()),
      }),
      detail: { tags: ["consent"], summary: "Grant consent for an org to access patient data" },
    }
  )

  /**
   * GET /api/consent/:targetUserId/:orgId
   * Get the current active consent record for a user/org pair.
   * Accessible by: the patient themselves, or an org admin for the specified org.
   * Note: declared before /:targetUserId to prevent Elysia from shadowing it.
   */
  .get(
    "/:targetUserId/:orgId",
    async ({ db, userId, params, set }) => {
      if (userId !== params.targetUserId) {
        const [membership] = await db
          .select({ role: orgMembers.role })
          .from(orgMembers)
          .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, params.orgId)))
          .limit(1);
        if (!membership || membership.role !== "admin") {
          set.status = 403;
          return { error: "Forbidden" };
        }
      }

      const [row] = await db
        .select()
        .from(patientConsents)
        .where(
          and(
            eq(patientConsents.userId, params.targetUserId),
            eq(patientConsents.orgId, params.orgId),
            eq(patientConsents.isActive, true)
          )
        )
        .orderBy(desc(patientConsents.grantedAt))
        .limit(1);

      if (!row) {
        set.status = 404;
        return { error: "No active consent found" };
      }

      return row;
    },
    {
      params: t.Object({ targetUserId: t.String(), orgId: t.String() }),
      detail: { tags: ["consent"], summary: "Get active consent for a user/org pair" },
    }
  )

  /**
   * PATCH /api/consent/:targetUserId/:orgId
   * Revoke active consent (isActive → false) OR update its scope.
   * Pass { isActive: false, revokedBy? } to revoke.
   * Pass { scope: [...] } to update the consent scope.
   * Accessible by: the patient themselves, or an org admin.
   */
  .patch(
    "/:targetUserId/:orgId",
    async ({ db, userId, params, body, set }) => {
      if (userId !== params.targetUserId) {
        const [membership] = await db
          .select({ role: orgMembers.role })
          .from(orgMembers)
          .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, params.orgId)))
          .limit(1);
        if (!membership || membership.role !== "admin") {
          set.status = 403;
          return { error: "Forbidden" };
        }
      }

      const hasRevoke = body.isActive === false;
      const hasScope = body.scope !== undefined;

      if (!hasRevoke && !hasScope) {
        set.status = 400;
        return { error: "No valid updates provided (send isActive: false or a new scope array)" };
      }

      await db
        .update(patientConsents)
        .set({
          ...(hasRevoke && {
            isActive: false,
            revokedAt: new Date(),
            revokedBy: body.revokedBy ?? userId,
          }),
          ...(body.scope !== undefined && { scope: body.scope }),
        })
        .where(
          and(
            eq(patientConsents.userId, params.targetUserId),
            eq(patientConsents.orgId, params.orgId),
            eq(patientConsents.isActive, true)
          )
        );

      return { ok: true };
    },
    {
      params: t.Object({ targetUserId: t.String(), orgId: t.String() }),
      body: t.Object({
        isActive: t.Optional(t.Boolean()),
        revokedBy: t.Optional(t.String()),
        scope: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["consent"], summary: "Revoke or update scope of active consent" },
    }
  )

  /**
   * GET /api/consent/:targetUserId
   * Get all consent records for a user across all orgs, newest first.
   * Includes both active and revoked records (full audit history).
   * Only accessible by the user themselves.
   */
  .get(
    "/:targetUserId",
    async ({ db, userId, params, set }) => {
      if (userId !== params.targetUserId) {
        set.status = 403;
        return { error: "Forbidden: you can only view your own consent history" };
      }

      return db
        .select()
        .from(patientConsents)
        .where(eq(patientConsents.userId, params.targetUserId))
        .orderBy(desc(patientConsents.grantedAt));
    },
    {
      params: t.Object({ targetUserId: t.String() }),
      detail: { tags: ["consent"], summary: "Get all consent records for a user (self only)" },
    }
  );
