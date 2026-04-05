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

// Maps a DB row to the ProviderConnection shape the mobile client expects.
function rowToProviderConnection(row: {
  provider: string;
  isActive: boolean;
  connectedAt: Date;
  disconnectedAt: Date | null;
  metadata: unknown;
}) {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    provider: row.provider,
    isConnected: row.isActive,
    connectedAt: row.connectedAt.toISOString(),
    lastSyncAt: typeof meta.lastSyncAt === "string" ? meta.lastSyncAt : undefined,
    authorizedMetrics: Array.isArray(meta.authorizedMetrics) ? meta.authorizedMetrics : [],
    selectedMetrics: Array.isArray(meta.selectedMetrics) ? meta.selectedMetrics : undefined,
    deviceInfo: typeof meta.deviceInfo === "object" && meta.deviceInfo !== null
      ? meta.deviceInfo
      : undefined,
  };
}

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
  )

  /**
   * GET /api/integrations/provider-connections
   *
   * Returns all provider connections for the current user in the ProviderConnection
   * shape expected by the mobile client.
   */
  .get(
    "/provider-connections",
    async ({ db, userId }) => {
      const rows = await db
        .select()
        .from(connectedIntegrations)
        .where(eq(connectedIntegrations.userId, userId));
      return { connections: rows.map(rowToProviderConnection) };
    },
    {
      detail: {
        tags: ["integrations"],
        summary: "List all provider connections (ProviderConnection shape)",
      },
    }
  )

  /**
   * GET /api/integrations/provider-connections/:provider
   *
   * Returns the connection record for a specific provider, or null if not found.
   */
  .get(
    "/provider-connections/:provider",
    async ({ db, userId, params }) => {
      const [row] = await db
        .select()
        .from(connectedIntegrations)
        .where(
          and(
            eq(connectedIntegrations.userId, userId),
            eq(connectedIntegrations.provider, params.provider)
          )
        )
        .limit(1);
      return { connection: row ? rowToProviderConnection(row) : null };
    },
    {
      params: t.Object({ provider: t.String({ maxLength: 50 }) }),
      detail: {
        tags: ["integrations"],
        summary: "Get a specific provider connection",
      },
    }
  )

  /**
   * POST /api/integrations/provider-connections
   *
   * Creates or updates a provider connection. Called by the mobile app after
   * successful OAuth or SDK auth. `providerUserId` is optional for providers
   * that don't have a server-side user ID (e.g. Apple Health, Health Connect).
   */
  .post(
    "/provider-connections",
    async ({ db, userId, body }) => {
      await db
        .insert(connectedIntegrations)
        .values({
          userId,
          provider: body.provider,
          providerUserId: body.providerUserId ?? "",
          isActive: true,
          metadata: {
            authorizedMetrics: body.authorizedMetrics ?? [],
            selectedMetrics: body.selectedMetrics ?? [],
            deviceInfo: body.deviceInfo ?? null,
            lastSyncAt: body.connectedAt ?? new Date().toISOString(),
          },
        })
        .onConflictDoUpdate({
          target: [connectedIntegrations.userId, connectedIntegrations.provider],
          set: {
            isActive: true,
            disconnectedAt: null,
            metadata: {
              authorizedMetrics: body.authorizedMetrics ?? [],
              selectedMetrics: body.selectedMetrics ?? [],
              deviceInfo: body.deviceInfo ?? null,
              lastSyncAt: body.connectedAt ?? new Date().toISOString(),
            },
          },
        });
      return { ok: true };
    },
    {
      body: t.Object({
        provider: t.String({ maxLength: 50 }),
        providerUserId: t.Optional(t.String({ maxLength: 255 })),
        connectedAt: t.Optional(t.String()),
        authorizedMetrics: t.Optional(t.Array(t.String())),
        selectedMetrics: t.Optional(t.Array(t.String())),
        deviceInfo: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
      detail: {
        tags: ["integrations"],
        summary: "Save or update a provider connection",
      },
    }
  )

  /**
   * DELETE /api/integrations/provider-connections/:provider
   *
   * Marks a provider connection as disconnected.
   */
  .delete(
    "/provider-connections/:provider",
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
        summary: "Disconnect a provider (by provider-connections path)",
      },
    }
  );
