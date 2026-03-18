/**
 * Subscription routes — read and update plan/entitlement state.
 *
 * The subscription row is written by the RevenueCat webhook bridge
 * (`POST /webhooks/revenuecat`). These routes are for reading current
 * entitlement state and for internal plan management.
 */

import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { subscriptions } from "../db/schema";

export const subscriptionRoutes = new Elysia({ prefix: "/api/subscriptions" })
  .use(requireAuth)

  /**
   * GET /api/subscriptions/me
   * Returns the current user's plan, status, and period end date.
   * If no subscription row exists, returns the free plan defaults.
   */
  .get(
    "/me",
    async ({ db, userId }) => {
      const [sub] = await db
        .select({
          plan: subscriptions.plan,
          status: subscriptions.status,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
        })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

      // Default to free plan if no row exists
      return (
        sub ?? {
          plan: "free",
          status: "active",
          currentPeriodEnd: null,
        }
      );
    },
    { detail: { tags: ["subscriptions"], summary: "Get current user's subscription plan" } }
  );
