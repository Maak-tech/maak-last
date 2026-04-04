/**
 * Connected Integrations routes
 *
 * Registers/deregisters provider user IDs for server-side webhook routing.
 * When a user connects Withings (or Fitbit, Oura, etc.) via OAuth on the mobile
 * app, the app calls POST /api/integrations/register with the provider user ID.
 * This allows the server to route incoming Withings webhook notifications to the
 * correct Nuralix user.
 */

import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { connectedIntegrations } from "../db/schema";

export const integrationRoutes = new Elysia({ prefix: "/api/integrations" })
  .use(requireAuth)

  /**
   * POST /api/integrations/register
   *
   * Called by the mobile app after a successful OAuth connection to register
   * the provider user ID for server-side webhook routing.
   *
   * Example: after Withings OAuth, call this with:
   *   { provider: "withings", providerUserId: "<withings_userid>" }
   */
  .post(
    "/register",
    async ({ db, userId, body }) => {
      await db
        .insert(connectedIntegrations)
        .values({
          userId,
          provider: body.provider,
          providerUserId: body.providerUserId,
          isActive: true,
          metadata: (body.metadata as Record<string, unknown>) ?? null,
        })
        .onConflictDoUpdate({
          target: [connectedIntegrations.userId, connectedIntegrations.provider],
          set: {
            providerUserId: body.providerUserId,
            isActive: true,
            disconnectedAt: null,
            metadata: (body.metadata as Record<string, unknown>) ?? null,
          },
        });
      return { ok: true };
    },
    {
      body: t.Object({
        provider: t.String({ maxLength: 50 }),
        providerUserId: t.String({ maxLength: 255 }),
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
      detail: {
        tags: ["integrations"],
        summary: "Register a provider user ID for webhook routing",
      },
    }
  )

  /**
   * DELETE /api/integrations/:provider
   *
   * Mark a provider integration as disconnected so webhook notifications
   * are no longer routed to this user.
   */
  .delete(
    "/:provider",
    async ({ db, userId, params }) => {
      await db
        .update(connectedIntegrations)
        .set({ isActive: false, disconnectedAt: new Date() })
        .where(
          and(
            eq(connectedIntegrations.userId, userId),
            eq(connectedIntegrations.provider, params.provider)
          )
        );
      return { ok: true };
    },
    {
      params: t.Object({ provider: t.String({ maxLength: 50 }) }),
      detail: {
        tags: ["integrations"],
        summary: "Deregister a provider integration (disconnect)",
      },
    }
  )

  /**
   * GET /api/integrations
   *
   * Returns all active integrations for the current user.
   */
  .get(
    "/",
    async ({ db, userId }) => {
      return db
        .select({
          id: connectedIntegrations.id,
          provider: connectedIntegrations.provider,
          isActive: connectedIntegrations.isActive,
          connectedAt: connectedIntegrations.connectedAt,
          disconnectedAt: connectedIntegrations.disconnectedAt,
        })
        .from(connectedIntegrations)
        .where(eq(connectedIntegrations.userId, userId));
    },
    {
      detail: {
        tags: ["integrations"],
        summary: "List all provider integrations for the current user",
      },
    }
  );
