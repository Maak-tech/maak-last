import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { familyMembers, vhi } from "../db/schema";
import { processUser } from "../jobs/vhiCycle";

export const vhiRoutes = new Elysia({ prefix: "/api/vhi" })
  .use(requireAuth)
  // Get own VHI
  .get(
    "/me",
    async ({ db, userId }) => {
      const result = await db.select().from(vhi).where(eq(vhi.userId, userId)).limit(1);
      return result[0] ?? null;
    },
    { detail: { tags: ["vhi"], summary: "Get current user's Virtual Health Identity" } }
  )
  // Get a family member's VHI — requesting user must be a family admin of that member
  .get(
    "/:memberId",
    async ({ db, userId, params, set }) => {
      const { memberId } = params;

      // 1. Find the member's family membership row to get their familyId
      const [memberRow] = await db
        .select({ familyId: familyMembers.familyId })
        .from(familyMembers)
        .where(eq(familyMembers.userId, memberId))
        .limit(1);

      if (!memberRow) {
        set.status = 404;
        return { error: "Member not found or not in any family" };
      }

      // 2. Verify the requesting user is an admin of that same family
      const [adminRow] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.userId, userId),
            eq(familyMembers.familyId, memberRow.familyId),
            eq(familyMembers.role, "admin")
          )
        )
        .limit(1);

      if (!adminRow) {
        set.status = 403;
        return { error: "Not authorized to view this member's VHI" };
      }

      // 3. Fetch and return the member's VHI
      const [memberVhi] = await db
        .select()
        .from(vhi)
        .where(eq(vhi.userId, memberId))
        .limit(1);

      if (!memberVhi) {
        set.status = 404;
        return { error: "VHI not found for this member" };
      }

      return memberVhi;
    },
    {
      params: t.Object({ memberId: t.String() }),
      detail: { tags: ["vhi"], summary: "Get a family member's VHI (admin only)" },
    }
  )
  // Acknowledge a pending VHI action
  .post(
    "/me/actions/:actionId/acknowledge",
    async ({ db, userId, params }) => {
      const [current] = await db.select().from(vhi).where(eq(vhi.userId, userId)).limit(1);
      if (!current?.data) return { ok: false };

      const data = current.data;
      const now = new Date().toISOString();

      data.pendingActions = data.pendingActions.map((action) =>
        action.id === params.actionId
          ? { ...action, acknowledged: true, acknowledgedAt: now }
          : action
      );

      await db.update(vhi).set({ data, updatedAt: new Date() }).where(eq(vhi.userId, userId));

      return { ok: true };
    },
    {
      params: t.Object({ actionId: t.String() }),
      detail: { tags: ["vhi"], summary: "Acknowledge a pending VHI action" },
    }
  )
  // Request an immediate VHI recompute for the authenticated user.
  // The computation runs asynchronously — the response is returned immediately
  // and the VHI is updated in the background (typically within 5–30 seconds).
  .post(
    "/me/recompute",
    async ({ userId }) => {
      // Fire-and-forget: run the full VHI pipeline for just this user.
      // Errors are logged but never propagate to the caller.
      processUser(userId).catch((err) =>
        console.error(`[vhiRoutes] Background recompute failed for user ${userId}:`, err)
      );
      return { ok: true, message: "Recompute started — your VHI will update within 30 seconds" };
    },
    {
      detail: {
        tags: ["vhi"],
        summary: "Request an immediate VHI recompute",
        description: "Triggers a background VHI recompute for the authenticated user. Returns immediately; the updated VHI is available within ~30 seconds.",
      },
    }
  );
