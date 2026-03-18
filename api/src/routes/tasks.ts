import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { tasks, orgMembers } from "../db/schema";

// Verify the calling user is a member of the specified org.
// Returns the membership row or null.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireOrgMember(db: any, userId: string, orgId: string) {
  const [row] = await db
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

export const taskRoutes = new Elysia({ prefix: "/api/tasks" })
  .use(requireAuth)

  // Create a task. Caller must be a member of the specified org.
  // `assignedBy` is always set to the authenticated user — not taken from the body
  // to prevent callers from falsely attributing task creation to someone else.
  .post(
    "/",
    async ({ db, userId, body, set }) => {
      const membership = await requireOrgMember(db, userId, body.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const [task] = await db
        .insert(tasks)
        .values({
          orgId: body.orgId,
          patientId: body.patientId,
          assignedBy: userId, // always the authenticated caller
          assignedTo: body.assignedTo,
          type: body.type,
          priority: body.priority ?? "normal",
          status: "open",
          source: body.source,
          title: body.title,
          description: body.description,
          context: body.context,
          dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        })
        .returning();
      return task;
    },
    {
      body: t.Object({
        orgId: t.String(),
        patientId: t.String(),
        type: t.String(),
        priority: t.Optional(t.String()),
        source: t.String(),
        title: t.String(),
        description: t.Optional(t.String()),
        assignedTo: t.Optional(t.String()),
        dueAt: t.Optional(t.String()),
        context: t.Optional(t.Any()),
        // assignedBy is intentionally omitted — always set to the calling userId
      }),
      detail: { tags: ["tasks"], summary: "Create a task (org member)" },
    }
  )

  // List tasks for an org. orgId is required; caller must be an org member.
  .get(
    "/",
    async ({ db, userId, query, set }) => {
      const membership = await requireOrgMember(db, userId, query.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const conditions = [eq(tasks.orgId, query.orgId)];
      if (query.status && query.status !== "all") conditions.push(eq(tasks.status, query.status));
      if (query.assignedTo) conditions.push(eq(tasks.assignedTo, query.assignedTo));
      if (query.priority) conditions.push(eq(tasks.priority, query.priority));
      if (query.patientId) conditions.push(eq(tasks.patientId, query.patientId));

      return db
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(tasks.createdAt)
        .limit(Math.min(query.limit ? Number(query.limit) : 50, 500));
    },
    {
      query: t.Object({
        orgId: t.String(), // required — mandatory for RBAC
        status: t.Optional(t.String()),
        assignedTo: t.Optional(t.String()),
        priority: t.Optional(t.String()),
        patientId: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
      detail: { tags: ["tasks"], summary: "List org tasks (org member)" },
    }
  )

  // Update task status. Caller must be a member of the task's org.
  .patch(
    "/:id/status",
    async ({ db, userId, params, body, set }) => {
      const [task] = await db
        .select({ orgId: tasks.orgId })
        .from(tasks)
        .where(eq(tasks.id, params.id))
        .limit(1);

      if (!task) {
        set.status = 404;
        return { error: "Task not found" };
      }

      const membership = await requireOrgMember(db, userId, task.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }

      const updates: Record<string, unknown> = { status: body.status, updatedAt: new Date() };
      if (body.status === "completed" && body.completedBy) {
        updates.completedAt = new Date();
        updates.completedBy = body.completedBy;
      }
      await db.update(tasks).set(updates).where(eq(tasks.id, params.id));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.String(),
        completedBy: t.Optional(t.String()),
      }),
      detail: { tags: ["tasks"], summary: "Update task status (org member)" },
    }
  )

  // Assign a task to a user. Requires org admin or coordinator role.
  .patch(
    "/:id/assign",
    async ({ db, userId, params, body, set }) => {
      const [task] = await db
        .select({ orgId: tasks.orgId })
        .from(tasks)
        .where(eq(tasks.id, params.id))
        .limit(1);

      if (!task) {
        set.status = 404;
        return { error: "Task not found" };
      }

      const membership = await requireOrgMember(db, userId, task.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin" && membership.role !== "coordinator") {
        set.status = 403;
        return { error: "Only org admins and coordinators can assign tasks" };
      }

      await db
        .update(tasks)
        .set({ assignedTo: body.assignedTo, status: "in_progress", updatedAt: new Date() })
        .where(eq(tasks.id, params.id));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ assignedTo: t.String() }),
      detail: { tags: ["tasks"], summary: "Assign a task (org admin or coordinator)" },
    }
  )

  // Escalate a task. Requires org admin or coordinator role.
  .patch(
    "/:id/escalate",
    async ({ db, userId, params, body, set }) => {
      const [task] = await db
        .select({ orgId: tasks.orgId })
        .from(tasks)
        .where(eq(tasks.id, params.id))
        .limit(1);

      if (!task) {
        set.status = 404;
        return { error: "Task not found" };
      }

      const membership = await requireOrgMember(db, userId, task.orgId);
      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this organisation" };
      }
      if (membership.role !== "admin" && membership.role !== "coordinator") {
        set.status = 403;
        return { error: "Only org admins and coordinators can escalate tasks" };
      }

      await db
        .update(tasks)
        .set({ status: "escalated", priority: "urgent", context: body.context, updatedAt: new Date() })
        .where(eq(tasks.id, params.id));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ context: t.Optional(t.Any()) }),
      detail: { tags: ["tasks"], summary: "Escalate a task (org admin or coordinator)" },
    }
  );
