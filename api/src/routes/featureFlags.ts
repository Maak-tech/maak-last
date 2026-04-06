/**
 * Feature flag routes.
 *
 * GET  /api/flags                    — evaluate all flags for the current user
 * GET  /api/flags/:name              — evaluate a single flag
 * POST /api/flags/:name              — upsert a flag (admin only — requires ADMIN_SECRET header)
 * DELETE /api/flags/:name            — delete a flag (admin only)
 *
 * The GET endpoints are auth-gated and evaluate flags in the context of the
 * calling user so the mobile app can gate UI features client-side.
 *
 * The POST/DELETE endpoints require ADMIN_SECRET to prevent any authenticated
 * user from toggling flags.  In production this secret should be set in the
 * Railway environment variables and only used by the ops team.
 */

import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { featureFlags } from "../db/schema";
import { isEnabled, evaluateFlags } from "../lib/featureFlags";

export const featureFlagRoutes = new Elysia({ prefix: "/api/flags" })
  .use(requireAuth)

  // GET /api/flags — evaluate all flags for the current user (returns map)
  .get("/", async ({ db, userId }) => {
    const rows = await db.select({ name: featureFlags.name }).from(featureFlags);
    const names = rows.map((r) => r.name);
    return evaluateFlags(names, { userId });
  })

  // GET /api/flags/:name — evaluate a single flag
  .get(
    "/:name",
    async ({ userId, params }) => {
      const enabled = await isEnabled(params.name, { userId });
      return { name: params.name, enabled };
    },
    {
      params: t.Object({ name: t.String({ maxLength: 100 }) }),
      detail: { tags: ["flags"], summary: "Evaluate a single feature flag for the current user" },
    }
  )

  // POST /api/flags/:name — create or update a flag (ops admin only)
  .post(
    "/:name",
    async ({ db, request, params, body, set }) => {
      // Require ADMIN_SECRET header — this endpoint must not be user-accessible
      const adminSecret = process.env.ADMIN_SECRET ?? "";
      const provided = request.headers.get("x-admin-secret") ?? "";
      if (!adminSecret || provided !== adminSecret) {
        set.status = 403;
        return { error: "Forbidden" };
      }

      await db
        .insert(featureFlags)
        .values({
          name: params.name,
          description: body.description ?? null,
          enabledForAll: body.enabledForAll ?? false,
          rolloutPercent: body.rolloutPercent ?? 0,
          enabledUserIds: body.enabledUserIds ?? [],
          enabledOrgIds: body.enabledOrgIds ?? [],
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [featureFlags.name],
          set: {
            description: body.description ?? null,
            enabledForAll: body.enabledForAll ?? false,
            rolloutPercent: body.rolloutPercent ?? 0,
            enabledUserIds: body.enabledUserIds ?? [],
            enabledOrgIds: body.enabledOrgIds ?? [],
            updatedAt: new Date(),
          },
        });

      return { ok: true, name: params.name };
    },
    {
      params: t.Object({ name: t.String({ minLength: 1, maxLength: 100 }) }),
      body: t.Object({
        description: t.Optional(t.String({ maxLength: 500 })),
        enabledForAll: t.Optional(t.Boolean()),
        rolloutPercent: t.Optional(t.Integer({ minimum: 0, maximum: 100 })),
        enabledUserIds: t.Optional(t.Array(t.String({ maxLength: 36 }), { maxItems: 1000 })),
        enabledOrgIds: t.Optional(t.Array(t.String({ maxLength: 36 }), { maxItems: 100 })),
      }),
      detail: { tags: ["flags"], summary: "Create or update a feature flag (admin only)" },
    }
  )

  // DELETE /api/flags/:name — remove a flag entirely (ops admin only)
  .delete(
    "/:name",
    async ({ db, request, params, set }) => {
      const adminSecret = process.env.ADMIN_SECRET ?? "";
      const provided = request.headers.get("x-admin-secret") ?? "";
      if (!adminSecret || provided !== adminSecret) {
        set.status = 403;
        return { error: "Forbidden" };
      }

      await db.delete(featureFlags).where(eq(featureFlags.name, params.name));
      return { ok: true };
    },
    {
      params: t.Object({ name: t.String({ minLength: 1, maxLength: 100 }) }),
      detail: { tags: ["flags"], summary: "Delete a feature flag (admin only)" },
    }
  );
