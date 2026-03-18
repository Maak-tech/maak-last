import { Elysia, t } from "elysia";
import { and, desc, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/requireAuth";
import { clinicalIntegrationRequests, orgMembers } from "../db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireOrgMember(db: any, userId: string, orgId: string) {
  const [row] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

export const clinicalRoutes = new Elysia({ prefix: "/api/clinical" })
  .use(requireAuth)

  /**
   * GET /api/clinical/integration-requests
   * List clinical integration requests filtered by orgId.
   * orgId is required. Caller must be a member of that org.
   */
  .get(
    "/integration-requests",
    async ({ db, userId, query, set }) => {
      const membership = await requireOrgMember(db, userId, query.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const filters = [eq(clinicalIntegrationRequests.orgId, query.orgId)];
      if (query.patientId) filters.push(eq(clinicalIntegrationRequests.patientId, query.patientId));
      if (query.status) filters.push(eq(clinicalIntegrationRequests.status, query.status));

      return db
        .select()
        .from(clinicalIntegrationRequests)
        .where(and(...filters))
        .orderBy(desc(clinicalIntegrationRequests.createdAt))
        .limit(Math.min(query.limit ?? 50, 500));
    },
    {
      query: t.Object({
        orgId: t.String(), // required — mandatory for RBAC
        patientId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: { tags: ["clinical"], summary: "List clinical integration requests (org member)" },
    }
  )

  /**
   * POST /api/clinical/integration-requests
   * Create a new clinical integration request.
   * Caller must be a member of the specified org.
   */
  .post(
    "/integration-requests",
    async ({ db, userId, body, set }) => {
      const membership = await requireOrgMember(db, userId, body.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const id = crypto.randomUUID();
      await db.insert(clinicalIntegrationRequests).values({
        id,
        orgId: body.orgId,
        requesterId: userId, // always the authenticated caller
        patientId: body.patientId ?? null,
        integrationType: body.integrationType,
        status: "pending",
        requestData: body.requestData ?? null,
        createdAt: new Date(),
      });
      return { id, ok: true };
    },
    {
      body: t.Object({
        orgId: t.String(),
        patientId: t.Optional(t.String()),
        integrationType: t.String(),
        requestData: t.Optional(t.Any()),
      }),
      detail: { tags: ["clinical"], summary: "Create a clinical integration request (org member)" },
    }
  );
