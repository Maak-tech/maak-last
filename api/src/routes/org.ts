/**
 * Org routes — admin-scoped endpoints for org management.
 *
 * Every endpoint is gated by org membership.
 * Read-only endpoints (roster list, pathway list, agent state) require any org
 * role (admin | coordinator | provider | viewer).
 * Write endpoints (roster enroll/remove, pathway update, enrollment create/update)
 * require the 'admin' role.
 * The audit-trail endpoint requires 'admin' because it exposes patient-level PHI.
 */

import { Elysia, t } from "elysia";
import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import crypto from "node:crypto";

/** ISO 8601 date pattern — prevents invalid dates from reaching new Date() */
const IsoDateString = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}" });
import { requireAuth } from "../middleware/requireAuth";
import {
  auditTrail,
  orgMembers,
  patientAgentState,
  carePathways,
  pathwayEnrollments,
  patientRosters,
  organizations,
  apiKeys,
  webhookEndpoints,
  webhookDeliveries,
  notificationTemplates,
  patientConsents,
  cohorts,
  cohortMembers,
} from "../db/schema";
import type { Database } from "../db";
// ── Authorization helpers ──────────────────────────────────────────────────────

/**
 * Returns the caller's org membership row, or null if they are not a member.
 * Used by all org-gated endpoints to enforce role-based access control.
 */
async function getOrgMembership(db: Database, userId: string, orgId: string): Promise<{ role: string | null } | null> {
  const [row] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const orgRoutes = new Elysia({ prefix: "/api/org" })
  .use(requireAuth)

  /**
   * GET /api/org/audit-trail
   * Query the org-scoped audit trail.
   * orgId is required. Caller must be an org admin.
   * Returns audit entries where the subject user (userId) is enrolled in the org's roster.
   */
  .get(
    "/audit-trail",
    async ({ db, userId, query, set }) => {
      if (!query.orgId) {
        set.status = 400;
        return { error: "orgId is required" };
      }

      // Only org admins may view the audit trail (HIPAA: minimum necessary access)
      const membership = await getOrgMembership(db, userId, query.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can view the audit trail" };
      }

      // Scope audit entries to patients on this org's roster
      const rosterRows = await db
        .select({ userId: patientRosters.userId })
        .from(patientRosters)
        .where(eq(patientRosters.orgId, query.orgId));

      const rosterUserIds = rosterRows.map((r: { userId: string }) => r.userId);

      if (rosterUserIds.length === 0) {
        // Org has no enrolled patients — return empty result set
        return [];
      }

      const filters: ReturnType<typeof eq>[] = [inArray(auditTrail.userId, rosterUserIds)];

      // Optional caller-supplied narrowing filters
      if (query.userId) {
        // Ensure the requested userId is actually in this org's roster
        if (!rosterUserIds.includes(query.userId)) {
          set.status = 403;
          return { error: "User is not enrolled in this organisation" };
        }
        filters.push(eq(auditTrail.userId, query.userId));
      }
      if (query.from) filters.push(gte(auditTrail.createdAt, new Date(query.from)));
      if (query.before) filters.push(lte(auditTrail.createdAt, new Date(query.before)));

      const rows = await db
        .select()
        .from(auditTrail)
        .where(and(...filters))
        .orderBy(desc(auditTrail.createdAt))
        .limit(Math.min(query.limit ?? 50, 500));

      // Optional server-side action filter (comma-separated list)
      if (query.actions) {
        const actionSet = new Set(query.actions.split(",").map((s: string) => s.trim()));
        return rows.filter((r: { action: string }) => actionSet.has(r.action));
      }

      return rows;
    },
    {
      query: t.Object({
        orgId: t.String(), // required (was Optional — now mandatory for RBAC)
        userId: t.Optional(t.String()),
        from: t.Optional(IsoDateString),
        before: t.Optional(IsoDateString),
        limit: t.Optional(t.Numeric()),
        actions: t.Optional(t.String()), // comma-separated action filter (server-side)
      }),
      detail: { tags: ["org"], summary: "Query audit trail for org patients (org admin)" },
    }
  )

  /**
   * GET /api/org/patient-agent-state/:orgId/:userId
   * Get the agent execution state for a patient within an org.
   * Requires any org membership role.
   */
  .get(
    "/patient-agent-state/:orgId/:userId",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const id = `${params.orgId}_${params.userId}`;
      const [row] = await db
        .select()
        .from(patientAgentState)
        .where(eq(patientAgentState.id, id))
        .limit(1);
      return row ?? null;
    },
    {
      params: t.Object({ orgId: t.String(), userId: t.String() }),
      detail: { tags: ["org"], summary: "Get patient agent state for org (org member)" },
    }
  )

  // ── Care Pathways ────────────────────────────────────────────────────────────

  /**
   * GET /api/org/:orgId/pathways
   * List care pathway templates for an org. Requires any org membership role.
   */
  .get(
    "/:orgId/pathways",
    async ({ db, userId, params, query, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const filters: ReturnType<typeof eq>[] = [eq(carePathways.orgId, params.orgId)];
      if (query.isActive !== undefined)
        filters.push(eq(carePathways.isActive, query.isActive === "true"));
      if (query.triggerCondition)
        filters.push(eq(carePathways.triggerCondition, query.triggerCondition));

      return db
        .select()
        .from(carePathways)
        .where(and(...filters))
        .orderBy(desc(carePathways.createdAt))
        .limit(Math.min(query.limit ?? 100, 500));
    },
    {
      params: t.Object({ orgId: t.String() }),
      query: t.Object({
        isActive: t.Optional(t.String()),
        triggerCondition: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["org"], summary: "List care pathways for an org (org member)" },
    }
  )

  /**
   * PATCH /api/org/:orgId/pathways/:pathwayId
   * Update a care pathway template. Requires org admin role.
   */
  .patch(
    "/:orgId/pathways/:pathwayId",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can modify care pathways" };
      }

      await db
        .update(carePathways)
        .set({ ...body, updatedAt: new Date() })
        .where(and(eq(carePathways.id, params.pathwayId), eq(carePathways.orgId, params.orgId)));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), pathwayId: t.String() }),
      body: t.Object({
        isActive: t.Optional(t.Boolean()),
        name: t.Optional(t.String({ maxLength: 255 })),
        description: t.Optional(t.String({ maxLength: 2000 })),
        triggerCondition: t.Optional(t.String({ maxLength: 500 })),
        steps: t.Optional(t.Any()),
      }),
      detail: { tags: ["org"], summary: "Update a care pathway (org admin)" },
    }
  )

  /**
   * POST /api/org/pathway-enrollments
   * Enroll a patient in a care pathway. Requires org admin role.
   */
  .post(
    "/pathway-enrollments",
    async ({ db, userId, body, set }) => {
      const membership = await getOrgMembership(db, userId, body.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can enroll patients in care pathways" };
      }

      const id = crypto.randomUUID();
      await db.insert(pathwayEnrollments).values({
        id,
        orgId: body.orgId,
        pathwayId: body.pathwayId,
        patientId: body.patientId,
        status: "active",
        currentStepId: body.currentStepId ?? null,
        enrolledAt: new Date(),
        nextStepAt: body.nextStepAt ? new Date(body.nextStepAt) : null,
        metadata: body.metadata ?? null,
      });

      return { id, ok: true };
    },
    {
      body: t.Object({
        orgId: t.String({ maxLength: 36 }),
        pathwayId: t.String({ maxLength: 36 }),
        patientId: t.String({ maxLength: 36 }),
        currentStepId: t.Optional(t.String({ maxLength: 36 })),
        nextStepAt: t.Optional(IsoDateString),
        metadata: t.Optional(t.Any()),
      }),
      detail: { tags: ["org"], summary: "Enroll a patient in a care pathway (org admin)" },
    }
  )

  /**
   * GET /api/org/pathway-enrollments
   * List pathway enrollments. orgId is required. Requires any org membership role.
   */
  .get(
    "/pathway-enrollments",
    async ({ db, userId, query, set }) => {
      if (!query.orgId) {
        set.status = 400;
        return { error: "orgId is required" };
      }

      const membership = await getOrgMembership(db, userId, query.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const filters: ReturnType<typeof eq>[] = [eq(pathwayEnrollments.orgId, query.orgId)];
      if (query.patientId) filters.push(eq(pathwayEnrollments.patientId, query.patientId));
      if (query.status) filters.push(eq(pathwayEnrollments.status, query.status));

      return db
        .select()
        .from(pathwayEnrollments)
        .where(and(...filters))
        .orderBy(desc(pathwayEnrollments.enrolledAt))
        .limit(Math.min(query.limit ?? 100, 500));
    },
    {
      query: t.Object({
        orgId: t.String(), // required for RBAC
        patientId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["org"], summary: "List pathway enrollments (org member)" },
    }
  )

  /**
   * PATCH /api/org/pathway-enrollments/:id
   * Update a pathway enrollment. Requires org admin role.
   * Looks up the enrollment's orgId to enforce authorization.
   */
  .patch(
    "/pathway-enrollments/:id",
    async ({ db, userId, params, body, set }) => {
      // Look up the enrollment to find its orgId
      const [enrollment] = await db
        .select({ orgId: pathwayEnrollments.orgId })
        .from(pathwayEnrollments)
        .where(eq(pathwayEnrollments.id, params.id))
        .limit(1);

      if (!enrollment) {
        set.status = 404;
        return { error: "Enrollment not found" };
      }

      const membership = await getOrgMembership(db, userId, enrollment.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can update care pathway enrollments" };
      }

      await db
        .update(pathwayEnrollments)
        .set({
          status: body.status ?? undefined,
          currentStepId: body.currentStepId ?? undefined,
          nextStepAt: body.nextStepAt ? new Date(body.nextStepAt) : undefined,
          completedAt: body.completedAt ? new Date(body.completedAt) : undefined,
          metadata: body.metadata ?? undefined,
        })
        // Include orgId in the WHERE clause to close the TOCTOU window between the
        // SELECT (which determined membership/authorization) and this UPDATE.
        // Without orgId here an attacker could PATCH an enrollment in a different org
        // by racing a membership change between the two queries.
        .where(and(eq(pathwayEnrollments.id, params.id), eq(pathwayEnrollments.orgId, enrollment.orgId)));

      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.Optional(t.String({ maxLength: 50 })),
        currentStepId: t.Optional(t.String({ maxLength: 36 })),
        nextStepAt: t.Optional(IsoDateString),
        completedAt: t.Optional(IsoDateString),
        metadata: t.Optional(t.Any()),
      }),
      detail: { tags: ["org"], summary: "Update a pathway enrollment (org admin)" },
    }
  )

  // ── Patient Roster ───────────────────────────────────────────────────────────

  /**
   * GET /api/org/:orgId/roster
   * List all patients enrolled in the org's roster.
   * Requires any org membership role.
   */
  .get(
    "/:orgId/roster",
    async ({ db, userId, params, query, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const filters: ReturnType<typeof eq>[] = [eq(patientRosters.orgId, params.orgId)];
      if (query.status) filters.push(eq(patientRosters.status, query.status));

      return db
        .select()
        .from(patientRosters)
        .where(and(...filters))
        .orderBy(desc(patientRosters.enrolledAt))
        .limit(Math.min(query.limit ?? 500, 1000));
    },
    {
      params: t.Object({ orgId: t.String() }),
      query: t.Object({
        status: t.Optional(t.String()), // 'active' | 'inactive' | 'pending'
        limit: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["org"], summary: "List patients on org's SDK roster (org member)" },
    }
  )

  /**
   * POST /api/org/:orgId/roster
   * Enrol a patient in the org's roster. Requires org admin role.
   */
  .post(
    "/:orgId/roster",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can enrol patients on the roster" };
      }

      const [existing] = await db
        .select({ id: patientRosters.id })
        .from(patientRosters)
        .where(and(eq(patientRosters.orgId, params.orgId), eq(patientRosters.userId, body.userId)))
        .limit(1);

      if (existing) {
        // Re-activate if previously removed
        await db
          .update(patientRosters)
          .set({ status: "active", enrolledAt: new Date(), enrolledBy: userId })
          .where(and(eq(patientRosters.orgId, params.orgId), eq(patientRosters.userId, body.userId)));
        return { ok: true, action: "reactivated" };
      }

      const id = crypto.randomUUID();
      await db.insert(patientRosters).values({
        id,
        orgId: params.orgId,
        userId: body.userId,
        enrolledBy: userId,
        status: "active",
        enrolledAt: new Date(),
      });

      return { id, ok: true, action: "enrolled" };
    },
    {
      params: t.Object({ orgId: t.String() }),
      body: t.Object({ userId: t.String({ maxLength: 36 }) }),
      detail: { tags: ["org"], summary: "Enrol a patient in the org's SDK roster (org admin)" },
    }
  )

  /**
   * DELETE /api/org/:orgId/roster/:userId
   * Remove a patient from the org's roster (sets status = 'inactive').
   * Requires org admin role.
   */
  .delete(
    "/:orgId/roster/:userId",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can remove patients from the roster" };
      }

      const [existing] = await db
        .select({ id: patientRosters.id })
        .from(patientRosters)
        .where(and(eq(patientRosters.orgId, params.orgId), eq(patientRosters.userId, params.userId)))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { error: "Patient not found on roster" };
      }

      await db
        .update(patientRosters)
        .set({ status: "inactive" })
        .where(and(eq(patientRosters.orgId, params.orgId), eq(patientRosters.userId, params.userId)));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), userId: t.String() }),
      detail: { tags: ["org"], summary: "Remove a patient from the org's SDK roster (org admin)" },
    }
  )

  /**
   * GET /api/org/:orgId/roster/:targetUserId
   * Get a specific roster entry. Requires any org membership role.
   */
  .get(
    "/:orgId/roster/:targetUserId",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const [row] = await db
        .select()
        .from(patientRosters)
        .where(and(eq(patientRosters.orgId, params.orgId), eq(patientRosters.userId, params.targetUserId)))
        .limit(1);

      if (!row) {
        set.status = 404;
        return { error: "Patient not found on roster" };
      }

      return row;
    },
    {
      params: t.Object({ orgId: t.String(), targetUserId: t.String() }),
      detail: { tags: ["org"], summary: "Get a specific roster entry (org member)" },
    }
  )

  /**
   * PATCH /api/org/:orgId/roster/:targetUserId
   * Update roster entry: status (admin-only), riskScore, lastContactAt, assignedProviders.
   * Status updates require admin role; metadata updates allow admin/coordinator/provider.
   */
  .patch(
    "/:orgId/roster/:targetUserId",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      // Status changes are admin-only; metadata updates allow coordinator and provider too
      const isAdmin = membership.role === "admin";
      const canUpdateMetadata = ["admin", "coordinator", "provider"].includes(membership.role ?? "");

      if (body.status !== undefined && !isAdmin) {
        set.status = 403;
        return { error: "Only org admins can update roster status" };
      }
      if ((body.riskScore !== undefined || body.lastContactAt !== undefined || body.assignedProviders !== undefined) && !canUpdateMetadata) {
        set.status = 403;
        return { error: "Insufficient permissions to update roster metadata" };
      }

      const [existing] = await db
        .select({ id: patientRosters.id })
        .from(patientRosters)
        .where(and(eq(patientRosters.orgId, params.orgId), eq(patientRosters.userId, params.targetUserId)))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { error: "Patient not found on roster" };
      }

      const updateFields: Record<string, unknown> = {};
      if (body.status !== undefined) updateFields.status = body.status;
      if (body.riskScore !== undefined) updateFields.riskScore = body.riskScore;
      if (body.lastContactAt !== undefined) updateFields.lastContactAt = new Date(body.lastContactAt);
      if (body.assignedProviders !== undefined) updateFields.assignedProviders = body.assignedProviders;

      if (Object.keys(updateFields).length === 0) {
        return { ok: true, message: "Nothing to update" };
      }

      await db
        .update(patientRosters)
        .set(updateFields)
        .where(and(eq(patientRosters.orgId, params.orgId), eq(patientRosters.userId, params.targetUserId)));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), targetUserId: t.String() }),
      body: t.Object({
        status: t.Optional(t.String()),
        riskScore: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        lastContactAt: t.Optional(t.String()),
        assignedProviders: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["org"], summary: "Update roster entry (status, risk score, last contact, assigned providers)" },
    }
  )

  // ── Organization CRUD ─────────────────────────────────────────────────────

  /**
   * POST /api/org
   * Create a new organisation. No prior membership required.
   * The creator is automatically added as an admin.
   */
  .post(
    "/",
    async ({ db, userId, body }) => {
      const id = body.id ?? crypto.randomUUID();

      await db.insert(organizations).values({
        id,
        name: body.name,
        type: body.type ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        website: body.website ?? null,
        settings: body.settings ?? null,
        isActive: true,
      });

      // Auto-enroll creator as org admin
      await db.insert(orgMembers).values({
        id: crypto.randomUUID(),
        orgId: id,
        userId,
        role: "admin",
      });

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      return org;
    },
    {
      body: t.Object({
        id: t.Optional(t.String({ maxLength: 36 })),
        name: t.String({ maxLength: 255 }),
        type: t.Optional(t.String({ maxLength: 100 })),
        email: t.Optional(t.String({ maxLength: 255 })),
        phone: t.Optional(t.String({ maxLength: 30 })),
        website: t.Optional(t.String({ maxLength: 2000 })),
        settings: t.Optional(t.Any()),
      }),
      detail: { tags: ["org"], summary: "Create a new organisation (auto-enrols creator as admin)" },
    }
  )

  /**
   * GET /api/org/me
   * Get the authenticated user's primary organisation (admin role preferred).
   * Returns { id, name, type, memberCount, plan } or 404 if not in any org.
   * Must be declared before /:orgId to prevent Elysia from matching "me" as an orgId.
   */
  .get(
    "/me",
    async ({ db, userId, set }) => {
      // Find all memberships, preferring admin role
      const memberships = await db
        .select({ orgId: orgMembers.orgId, role: orgMembers.role })
        .from(orgMembers)
        .where(eq(orgMembers.userId, userId));

      if (memberships.length === 0) {
        set.status = 404;
        return { error: "No organisation membership found" };
      }

      // Prefer admin membership; fall back to first membership
      const preferred = memberships.find((m) => m.role === "admin") ?? memberships[0];

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, preferred.orgId))
        .limit(1);

      if (!org) {
        set.status = 404;
        return { error: "Organisation not found" };
      }

      // Count members in this org
      const [memberCountRow] = await db
        .select({ count: count() })
        .from(orgMembers)
        .where(eq(orgMembers.orgId, org.id));

      const memberCount = Number(memberCountRow?.count ?? 0);

      const settings = (org.settings ?? {}) as Record<string, unknown>;
      const plan = (settings.plan as string | undefined) ?? "free";

      return {
        id: org.id,
        name: org.name,
        type: org.type ?? "other",
        memberCount,
        plan,
      };
    },
    { detail: { tags: ["org"], summary: "Get the authenticated user's primary organisation" } }
  )

  /**
   * GET /api/org/:orgId
   * Get organisation details. Requires any org membership role.
   */
  .get(
    "/:orgId",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, params.orgId))
        .limit(1);

      if (!org) {
        set.status = 404;
        return { error: "Organisation not found" };
      }

      return org;
    },
    {
      params: t.Object({ orgId: t.String() }),
      detail: { tags: ["org"], summary: "Get organisation details (org member)" },
    }
  )

  /**
   * PATCH /api/org/:orgId
   * Update organisation settings. Requires org admin role.
   */
  .patch(
    "/:orgId",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can update organisation settings" };
      }

      await db
        .update(organizations)
        .set({
          ...(body.name !== undefined && { name: body.name }),
          ...(body.type !== undefined && { type: body.type }),
          ...(body.email !== undefined && { email: body.email }),
          ...(body.phone !== undefined && { phone: body.phone }),
          ...(body.website !== undefined && { website: body.website }),
          ...(body.settings !== undefined && { settings: body.settings }),
        })
        .where(eq(organizations.id, params.orgId));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 255 })),
        type: t.Optional(t.String({ maxLength: 100 })),
        email: t.Optional(t.String({ maxLength: 255 })),
        phone: t.Optional(t.String({ maxLength: 30 })),
        website: t.Optional(t.String({ maxLength: 2000 })),
        settings: t.Optional(t.Any()),
      }),
      detail: { tags: ["org"], summary: "Update organisation settings (org admin)" },
    }
  )

  // ── Member Management ─────────────────────────────────────────────────────

  /**
   * GET /api/org/:orgId/members
   * List all org members. Requires any org membership role.
   */
  .get(
    "/:orgId/members",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      return db
        .select()
        .from(orgMembers)
        .where(eq(orgMembers.orgId, params.orgId))
        .orderBy(orgMembers.joinedAt);
    },
    {
      params: t.Object({ orgId: t.String() }),
      detail: { tags: ["org"], summary: "List org members (org member)" },
    }
  )

  /**
   * GET /api/org/:orgId/members/:memberId
   * Get a specific org member. Requires any org membership role.
   */
  .get(
    "/:orgId/members/:memberId",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const [row] = await db
        .select()
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, params.orgId), eq(orgMembers.userId, params.memberId)))
        .limit(1);

      if (!row) {
        set.status = 404;
        return { error: "Member not found" };
      }

      return row;
    },
    {
      params: t.Object({ orgId: t.String(), memberId: t.String() }),
      detail: { tags: ["org"], summary: "Get a specific org member (org member)" },
    }
  )

  /**
   * POST /api/org/:orgId/members
   * Add a member to the org. Requires org admin role.
   */
  .post(
    "/:orgId/members",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can add members" };
      }

      // Idempotent — update role if already a member
      const [existing] = await db
        .select({ id: orgMembers.id })
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, params.orgId), eq(orgMembers.userId, body.userId)))
        .limit(1);

      if (existing) {
        await db
          .update(orgMembers)
          .set({ role: body.role ?? "coordinator" })
          .where(eq(orgMembers.id, existing.id));
        return { id: existing.id, ok: true, action: "updated" };
      }

      const id = crypto.randomUUID();
      await db.insert(orgMembers).values({
        id,
        orgId: params.orgId,
        userId: body.userId,
        role: body.role ?? "coordinator",
      });

      return { id, ok: true, action: "added" };
    },
    {
      params: t.Object({ orgId: t.String() }),
      body: t.Object({
        userId: t.String({ maxLength: 36 }),
        role: t.Optional(t.String({ maxLength: 50 })),
      }),
      detail: { tags: ["org"], summary: "Add a member to the org (org admin)" },
    }
  )

  /**
   * PATCH /api/org/:orgId/members/:memberId
   * Update a member's role. Requires org admin role.
   */
  .patch(
    "/:orgId/members/:memberId",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can update member roles" };
      }

      await db
        .update(orgMembers)
        .set({ role: body.role })
        .where(and(eq(orgMembers.orgId, params.orgId), eq(orgMembers.userId, params.memberId)));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), memberId: t.String() }),
      body: t.Object({ role: t.String({ maxLength: 50 }) }),
      detail: { tags: ["org"], summary: "Update a member's role (org admin)" },
    }
  )

  /**
   * DELETE /api/org/:orgId/members/:memberId
   * Remove a member from the org. Requires org admin role.
   * Admins cannot remove themselves.
   */
  .delete(
    "/:orgId/members/:memberId",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can remove members" };
      }
      if (params.memberId === userId) {
        set.status = 400;
        return { error: "Admins cannot remove themselves from the organisation" };
      }

      await db
        .delete(orgMembers)
        .where(and(eq(orgMembers.orgId, params.orgId), eq(orgMembers.userId, params.memberId)));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), memberId: t.String() }),
      detail: { tags: ["org"], summary: "Remove a member from the org (org admin)" },
    }
  )

  // ── API Keys ──────────────────────────────────────────────────────────────

  /**
   * POST /api/org/:orgId/keys
   * Create a new API key. Server generates the key — plaintext returned once only.
   * Requires org admin role.
   */
  .post(
    "/:orgId/keys",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can create API keys" };
      }

      // Server-side key generation — plaintext never stored
      const rawBytes = crypto.randomBytes(24);
      const plaintext = `nk_live_${rawBytes.toString("hex")}`;
      const keyPrefix = plaintext.slice(0, 16);
      const keyHash = crypto.createHash("sha256").update(plaintext).digest("hex");

      const id = crypto.randomUUID();
      await db.insert(apiKeys).values({
        id,
        orgId: params.orgId,
        keyHash,
        keyPrefix,
        name: body.name ?? null,
        scopes: body.scopes ?? [],
        isActive: true,
      });

      // Return plaintext once — never stored or returned again
      return { id, keyPrefix, scopes: body.scopes ?? [], name: body.name ?? null, plaintext, ok: true };
    },
    {
      params: t.Object({ orgId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 255 })),
        scopes: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 50 })),
      }),
      detail: { tags: ["org"], summary: "Create API key — plaintext returned once only (org admin)" },
    }
  )

  /**
   * GET /api/org/:orgId/keys
   * List API keys for an org. Never returns key hashes or plaintext.
   * Requires org admin role.
   */
  .get(
    "/:orgId/keys",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can list API keys" };
      }

      // Explicitly exclude keyHash from the projection
      return db
        .select({
          id: apiKeys.id,
          orgId: apiKeys.orgId,
          keyPrefix: apiKeys.keyPrefix,
          name: apiKeys.name,
          scopes: apiKeys.scopes,
          isActive: apiKeys.isActive,
          lastUsedAt: apiKeys.lastUsedAt,
          createdAt: apiKeys.createdAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.orgId, params.orgId))
        .orderBy(desc(apiKeys.createdAt));
    },
    {
      params: t.Object({ orgId: t.String() }),
      detail: { tags: ["org"], summary: "List API keys — no hashes or plaintext (org admin)" },
    }
  )

  /**
   * PATCH /api/org/:orgId/keys/:keyId
   * Update an API key's name or scopes. Requires org admin role.
   */
  .patch(
    "/:orgId/keys/:keyId",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can update API keys" };
      }

      const [key] = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(and(eq(apiKeys.id, params.keyId), eq(apiKeys.orgId, params.orgId)))
        .limit(1);

      if (!key) {
        set.status = 404;
        return { error: "API key not found" };
      }

      await db
        .update(apiKeys)
        .set({
          ...(body.name !== undefined && { name: body.name }),
          ...(body.scopes !== undefined && { scopes: body.scopes }),
        })
        .where(and(eq(apiKeys.id, params.keyId), eq(apiKeys.orgId, params.orgId)));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), keyId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 255 })),
        scopes: t.Optional(t.Array(t.String({ maxLength: 100 }), { maxItems: 50 })),
      }),
      detail: { tags: ["org"], summary: "Update an API key's name or scopes (org admin)" },
    }
  )

  /**
   * DELETE /api/org/:orgId/keys/:keyId
   * Revoke an API key (soft delete — sets isActive = false).
   * Requires org admin role.
   */
  .delete(
    "/:orgId/keys/:keyId",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can revoke API keys" };
      }

      const [key] = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(and(eq(apiKeys.id, params.keyId), eq(apiKeys.orgId, params.orgId)))
        .limit(1);

      if (!key) {
        set.status = 404;
        return { error: "API key not found" };
      }

      await db.update(apiKeys).set({ isActive: false }).where(and(eq(apiKeys.id, params.keyId), eq(apiKeys.orgId, params.orgId)));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), keyId: t.String() }),
      detail: { tags: ["org"], summary: "Revoke an API key (org admin)" },
    }
  )

  /**
   * POST /api/org/:orgId/keys/:keyId/rotate
   * Rotate an API key: revoke the old one, create a new one with the same settings.
   * Returns the new plaintext key — shown once only.
   * Requires org admin role.
   */
  .post(
    "/:orgId/keys/:keyId/rotate",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can rotate API keys" };
      }

      const [oldKey] = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.id, params.keyId), eq(apiKeys.orgId, params.orgId)))
        .limit(1);

      if (!oldKey) {
        set.status = 404;
        return { error: "API key not found" };
      }

      // Revoke old — include orgId to close TOCTOU window
      await db.update(apiKeys).set({ isActive: false }).where(and(eq(apiKeys.id, params.keyId), eq(apiKeys.orgId, params.orgId)));

      // Create replacement with same name and scopes
      const rawBytes = crypto.randomBytes(24);
      const plaintext = `nk_live_${rawBytes.toString("hex")}`;
      const keyPrefix = plaintext.slice(0, 16);
      const keyHash = crypto.createHash("sha256").update(plaintext).digest("hex");
      const newId = crypto.randomUUID();

      await db.insert(apiKeys).values({
        id: newId,
        orgId: params.orgId,
        keyHash,
        keyPrefix,
        name: oldKey.name,
        scopes: oldKey.scopes ?? [],
        isActive: true,
      });

      return { id: newId, keyPrefix, scopes: oldKey.scopes ?? [], name: oldKey.name, plaintext, ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), keyId: t.String() }),
      detail: { tags: ["org"], summary: "Rotate an API key — new plaintext returned once (org admin)" },
    }
  )

  // ── Webhooks ──────────────────────────────────────────────────────────────

  /**
   * POST /api/org/:orgId/webhooks
   * Register a new webhook endpoint. Signing secret returned once only.
   * Requires org admin role. URL must be HTTPS.
   */
  .post(
    "/:orgId/webhooks",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can create webhook endpoints" };
      }
      if (!body.url.startsWith("https://")) {
        set.status = 400;
        return { error: "Webhook URL must use HTTPS" };
      }

      const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
      const id = crypto.randomUUID();

      await db.insert(webhookEndpoints).values({
        id,
        orgId: params.orgId,
        url: body.url,
        events: body.events ?? [],
        secret,
        isActive: true,
      });

      // Return signing secret once — store it securely, not shown again
      return { id, url: body.url, events: body.events ?? [], signingSecret: secret, ok: true };
    },
    {
      params: t.Object({ orgId: t.String() }),
      body: t.Object({
        url: t.String({ maxLength: 2000 }),
        events: t.Optional(t.Array(t.String({ maxLength: 100 }))),
      }),
      detail: { tags: ["org"], summary: "Register webhook endpoint — signing secret returned once (org admin)" },
    }
  )

  /**
   * GET /api/org/:orgId/webhooks
   * List webhook endpoints for an org. Never returns signing secrets.
   * Requires any org membership role.
   */
  .get(
    "/:orgId/webhooks",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      // Explicitly exclude secret from projection
      return db
        .select({
          id: webhookEndpoints.id,
          orgId: webhookEndpoints.orgId,
          url: webhookEndpoints.url,
          events: webhookEndpoints.events,
          isActive: webhookEndpoints.isActive,
          createdAt: webhookEndpoints.createdAt,
        })
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.orgId, params.orgId))
        .orderBy(desc(webhookEndpoints.createdAt));
    },
    {
      params: t.Object({ orgId: t.String() }),
      detail: { tags: ["org"], summary: "List webhook endpoints — no secrets returned (org member)" },
    }
  )

  /**
   * PATCH /api/org/:orgId/webhooks/:webhookId
   * Update a webhook endpoint's URL, events, or active status.
   * Requires org admin role. URL must be HTTPS if provided.
   */
  .patch(
    "/:orgId/webhooks/:webhookId",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can update webhook endpoints" };
      }
      if (body.url && !body.url.startsWith("https://")) {
        set.status = 400;
        return { error: "Webhook URL must use HTTPS" };
      }

      const [endpoint] = await db
        .select({ id: webhookEndpoints.id })
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, params.webhookId), eq(webhookEndpoints.orgId, params.orgId)))
        .limit(1);

      if (!endpoint) {
        set.status = 404;
        return { error: "Webhook endpoint not found" };
      }

      await db
        .update(webhookEndpoints)
        .set({
          ...(body.url !== undefined && { url: body.url }),
          ...(body.events !== undefined && { events: body.events }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        })
        .where(and(eq(webhookEndpoints.id, params.webhookId), eq(webhookEndpoints.orgId, params.orgId)));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), webhookId: t.String() }),
      body: t.Object({
        url: t.Optional(t.String({ maxLength: 2000 })),
        events: t.Optional(t.Array(t.String({ maxLength: 100 }))),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: { tags: ["org"], summary: "Update a webhook endpoint (org admin)" },
    }
  )

  /**
   * DELETE /api/org/:orgId/webhooks/:webhookId
   * Disable a webhook endpoint (soft delete — sets isActive = false).
   * Requires org admin role.
   */
  .delete(
    "/:orgId/webhooks/:webhookId",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can delete webhook endpoints" };
      }

      const [endpoint] = await db
        .select({ id: webhookEndpoints.id })
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, params.webhookId), eq(webhookEndpoints.orgId, params.orgId)))
        .limit(1);

      if (!endpoint) {
        set.status = 404;
        return { error: "Webhook endpoint not found" };
      }

      await db
        .update(webhookEndpoints)
        .set({ isActive: false })
        .where(eq(webhookEndpoints.id, params.webhookId));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), webhookId: t.String() }),
      detail: { tags: ["org"], summary: "Disable a webhook endpoint (org admin)" },
    }
  )

  /**
   * POST /api/org/:orgId/webhooks/:webhookId/rotate-secret
   * Rotate the HMAC signing secret. New secret returned once only.
   * Old secret is immediately invalidated.
   * Requires org admin role.
   */
  .post(
    "/:orgId/webhooks/:webhookId/rotate-secret",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can rotate webhook signing secrets" };
      }

      const [endpoint] = await db
        .select({ id: webhookEndpoints.id })
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, params.webhookId), eq(webhookEndpoints.orgId, params.orgId)))
        .limit(1);

      if (!endpoint) {
        set.status = 404;
        return { error: "Webhook endpoint not found" };
      }

      const newSecret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
      await db
        .update(webhookEndpoints)
        .set({ secret: newSecret })
        .where(eq(webhookEndpoints.id, params.webhookId));

      return { signingSecret: newSecret, ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), webhookId: t.String() }),
      detail: { tags: ["org"], summary: "Rotate webhook signing secret — returned once only (org admin)" },
    }
  )

  /**
   * GET /api/org/:orgId/webhooks/:webhookId/deliveries
   * List recent delivery attempts for a webhook endpoint.
   * Requires any org membership role.
   */
  .get(
    "/:orgId/webhooks/:webhookId/deliveries",
    async ({ db, userId, params, query, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      // Verify webhook belongs to this org before listing deliveries
      const [endpoint] = await db
        .select({ id: webhookEndpoints.id })
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.id, params.webhookId), eq(webhookEndpoints.orgId, params.orgId)))
        .limit(1);

      if (!endpoint) {
        set.status = 404;
        return { error: "Webhook endpoint not found" };
      }

      return db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.endpointId, params.webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(Math.min(query.limit ?? 50, 200));
    },
    {
      params: t.Object({ orgId: t.String(), webhookId: t.String() }),
      query: t.Object({ limit: t.Optional(t.Numeric()) }),
      detail: { tags: ["org"], summary: "List recent webhook delivery attempts (org member)" },
    }
  )

  // ── Notification Templates ────────────────────────────────────────────────

  /**
   * GET /api/org/:orgId/notification-settings
   * Get notification templates for an org.
   * Requires any org membership role.
   */
  .get(
    "/:orgId/notification-settings",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      return db
        .select()
        .from(notificationTemplates)
        .where(eq(notificationTemplates.orgId, params.orgId))
        .orderBy(notificationTemplates.type);
    },
    {
      params: t.Object({ orgId: t.String() }),
      detail: { tags: ["org"], summary: "Get org notification templates (org member)" },
    }
  )

  /**
   * PUT /api/org/:orgId/notification-settings
   * Upsert notification templates for an org (insert or update per type+channel+language).
   * Requires org admin role.
   */
  .put(
    "/:orgId/notification-settings",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can update notification settings" };
      }

      // Batch-fetch all existing templates for this org in one query (avoids N+1)
      const existingTemplates = await db
        .select({
          id: notificationTemplates.id,
          type: notificationTemplates.type,
          channel: notificationTemplates.channel,
          language: notificationTemplates.language,
        })
        .from(notificationTemplates)
        .where(eq(notificationTemplates.orgId, params.orgId));

      const existingMap = new Map(
        existingTemplates.map((t) => [`${t.type}:${t.channel}:${t.language}`, t.id])
      );

      // Execute all upserts in parallel
      await Promise.all(
        body.templates.map((tpl) => {
          const lang = tpl.language ?? "en";
          const existingId = existingMap.get(`${tpl.type}:${tpl.channel}:${lang}`);
          if (existingId) {
            return db
              .update(notificationTemplates)
              .set({
                titleTemplate: tpl.titleTemplate,
                bodyTemplate: tpl.bodyTemplate,
                isActive: tpl.isActive ?? true,
                updatedAt: new Date(),
              })
              .where(and(eq(notificationTemplates.id, existingId), eq(notificationTemplates.orgId, params.orgId)));
          } else {
            return db.insert(notificationTemplates).values({
              orgId: params.orgId,
              type: tpl.type,
              channel: tpl.channel,
              language: lang,
              titleTemplate: tpl.titleTemplate,
              bodyTemplate: tpl.bodyTemplate,
              isActive: tpl.isActive ?? true,
            });
          }
        })
      );

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String() }),
      body: t.Object({
        templates: t.Array(
          t.Object({
            type: t.String({ maxLength: 100 }),
            channel: t.String({ maxLength: 50 }),
            language: t.Optional(t.String({ maxLength: 10 })),
            titleTemplate: t.String({ maxLength: 500 }),
            bodyTemplate: t.String({ maxLength: 2000 }),
            isActive: t.Optional(t.Boolean()),
          })
        ),
      }),
      detail: { tags: ["org"], summary: "Upsert org notification templates (org admin)" },
    }
  )

  // ── Consents (org-scoped view) ─────────────────────────────────────────────

  /**
   * GET /api/org/:orgId/consents
   * List all active patient consents granted to an org, newest first.
   * Requires org admin role — consent records contain sensitive PHI.
   */
  .get(
    "/:orgId/consents",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can view patient consents" };
      }

      return db
        .select()
        .from(patientConsents)
        .where(
          and(
            eq(patientConsents.orgId, params.orgId),
            eq(patientConsents.isActive, true)
          )
        )
        .orderBy(desc(patientConsents.grantedAt));
    },
    {
      params: t.Object({ orgId: t.String() }),
      detail: { tags: ["org"], summary: "List active patient consents for an org (org admin)" },
    }
  )

  // ── Cohorts ────────────────────────────────────────────────────────────────

  /**
   * POST /api/org/:orgId/cohorts
   * Create a patient cohort for this org. Requires org admin role.
   * New cohorts start with patientCount: 0 — use the membership endpoints to enroll patients.
   */
  .post(
    "/:orgId/cohorts",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can create cohorts" };
      }

      const id = crypto.randomUUID();
      const [row] = await db
        .insert(cohorts)
        .values({
          id,
          orgId: params.orgId,
          name: body.name,
          description: body.description ?? null,
          condition: body.condition ?? null,
          program: body.program ?? null,
          createdBy: userId,
        })
        .returning();

      set.status = 201;
      return { ...row, patientCount: 0 };
    },
    {
      params: t.Object({ orgId: t.String() }),
      body: t.Object({
        name: t.String({ maxLength: 255 }),
        description: t.Optional(t.String({ maxLength: 2000 })),
        condition: t.Optional(t.String({ maxLength: 255 })),
        program: t.Optional(t.String({ maxLength: 255 })),
      }),
      detail: { tags: ["org"], summary: "Create a patient cohort (org admin)" },
    }
  )

  /**
   * GET /api/org/:orgId/cohorts
   * List all cohorts for an org with live patient counts.
   * Requires any org membership role.
   */
  .get(
    "/:orgId/cohorts",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const rows = await db
        .select()
        .from(cohorts)
        .where(eq(cohorts.orgId, params.orgId))
        .orderBy(cohorts.name);

      if (rows.length === 0) return [];

      // Compute patient counts in a single aggregation query
      const ids = rows.map((r) => r.id);
      const counts = await db
        .select({ cohortId: cohortMembers.cohortId, n: count(cohortMembers.id) })
        .from(cohortMembers)
        .where(inArray(cohortMembers.cohortId, ids))
        .groupBy(cohortMembers.cohortId);

      const countMap: Record<string, number> = {};
      for (const c of counts) countMap[c.cohortId] = Number(c.n);

      return rows.map((r) => ({ ...r, patientCount: countMap[r.id] ?? 0 }));
    },
    {
      params: t.Object({ orgId: t.String() }),
      detail: { tags: ["org"], summary: "List cohorts for an org (org member)" },
    }
  )

  /**
   * PATCH /api/org/:orgId/cohorts/:cohortId
   * Update a cohort's name, description, condition, or program.
   * Requires org admin role.
   */
  .patch(
    "/:orgId/cohorts/:cohortId",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin") {
        set.status = 403;
        return { error: "Only org admins can update cohorts" };
      }

      const [existing] = await db
        .select({ id: cohorts.id })
        .from(cohorts)
        .where(and(eq(cohorts.id, params.cohortId), eq(cohorts.orgId, params.orgId)))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { error: "Cohort not found" };
      }

      await db
        .update(cohorts)
        .set({
          ...(body.name !== undefined && { name: body.name }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.condition !== undefined && { condition: body.condition }),
          ...(body.program !== undefined && { program: body.program }),
          updatedAt: new Date(),
        })
        .where(and(eq(cohorts.id, params.cohortId), eq(cohorts.orgId, params.orgId)));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), cohortId: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 255 })),
        description: t.Optional(t.String({ maxLength: 2000 })),
        condition: t.Optional(t.String({ maxLength: 255 })),
        program: t.Optional(t.String({ maxLength: 255 })),
      }),
      detail: { tags: ["org"], summary: "Update a cohort (org admin)" },
    }
  )

  // ── Cohort membership ───────────────────────────────────────────────────────

  /**
   * POST /api/org/:orgId/cohorts/:cohortId/members
   * Enroll a patient in a cohort. Requires org admin role.
   * The patient must already be on the org's active roster.
   */
  .post(
    "/:orgId/cohorts/:cohortId/members",
    async ({ db, userId, params, body, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) { set.status = 403; return { error: "Not a member of this organisation" }; }
      if (membership.role !== "admin") { set.status = 403; return { error: "Only org admins can manage cohort members" }; }

      // Verify cohort belongs to this org
      const [cohort] = await db
        .select({ id: cohorts.id })
        .from(cohorts)
        .where(and(eq(cohorts.id, params.cohortId), eq(cohorts.orgId, params.orgId)))
        .limit(1);
      if (!cohort) { set.status = 404; return { error: "Cohort not found" }; }

      // Verify patient is on the active roster
      const [rosterRow] = await db
        .select({ id: patientRosters.id })
        .from(patientRosters)
        .where(and(
          eq(patientRosters.orgId, params.orgId),
          eq(patientRosters.userId, body.userId),
          eq(patientRosters.status, "active"),
        ))
        .limit(1);
      if (!rosterRow) { set.status = 422; return { error: "Patient is not on the org's active roster" }; }

      // Upsert — silently ignore if already enrolled
      await db
        .insert(cohortMembers)
        .values({
          cohortId: params.cohortId,
          orgId: params.orgId,
          userId: body.userId,
          enrolledBy: userId,
        })
        .onConflictDoNothing({ target: [cohortMembers.cohortId, cohortMembers.userId] });

      set.status = 201;
      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), cohortId: t.String() }),
      body: t.Object({ userId: t.String({ maxLength: 36 }) }),
      detail: { tags: ["org"], summary: "Enroll a patient in a cohort (org admin)" },
    }
  )

  /**
   * DELETE /api/org/:orgId/cohorts/:cohortId/members/:userId
   * Remove a patient from a cohort. Requires org admin role.
   */
  .delete(
    "/:orgId/cohorts/:cohortId/members/:userId",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) { set.status = 403; return { error: "Not a member of this organisation" }; }
      if (membership.role !== "admin") { set.status = 403; return { error: "Only org admins can manage cohort members" }; }

      await db
        .delete(cohortMembers)
        .where(and(
          eq(cohortMembers.cohortId, params.cohortId),
          eq(cohortMembers.userId, params.userId),
          eq(cohortMembers.orgId, params.orgId),
        ));

      return { ok: true };
    },
    {
      params: t.Object({ orgId: t.String(), cohortId: t.String(), userId: t.String() }),
      detail: { tags: ["org"], summary: "Remove a patient from a cohort (org admin)" },
    }
  )

  /**
   * GET /api/org/:orgId/cohorts/:cohortId/members
   * List all patients enrolled in a cohort. Requires any org membership role.
   */
  .get(
    "/:orgId/cohorts/:cohortId/members",
    async ({ db, userId, params, set }) => {
      const membership = await getOrgMembership(db, userId, params.orgId);
      if (!membership) { set.status = 403; return { error: "Not a member of this organisation" }; }

      const [cohort] = await db
        .select({ id: cohorts.id })
        .from(cohorts)
        .where(and(eq(cohorts.id, params.cohortId), eq(cohorts.orgId, params.orgId)))
        .limit(1);
      if (!cohort) { set.status = 404; return { error: "Cohort not found" }; }

      const members = await db
        .select({
          userId: cohortMembers.userId,
          enrolledBy: cohortMembers.enrolledBy,
          enrolledAt: cohortMembers.enrolledAt,
        })
        .from(cohortMembers)
        .where(eq(cohortMembers.cohortId, params.cohortId))
        .orderBy(cohortMembers.enrolledAt);

      return { cohortId: params.cohortId, members, count: members.length };
    },
    {
      params: t.Object({ orgId: t.String(), cohortId: t.String() }),
      detail: { tags: ["org"], summary: "List patients in a cohort (org member)" },
    }
  );
