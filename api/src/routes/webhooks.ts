/**
 * Webhook routes — Phase 11: Autumn + RevenueCat bridge.
 *
 * RevenueCat handles native Apple / Google IAP on mobile.
 * When a purchase or subscription event occurs on RevenueCat, it POSTs to
 * `POST /webhooks/revenuecat`.
 *
 * This handler:
 *   1. Verifies the RevenueCat webhook signature (HMAC-SHA256).
 *   2. Maps the RevenueCat event type to an Autumn attachment/detachment call,
 *      so Autumn reflects the current entitlement state.
 *   3. Updates the `subscriptions` table in Neon so the app can gate features
 *      without an extra Autumn round-trip.
 *
 * Autumn SDK reference: https://docs.useautumn.com
 * RevenueCat webhook reference: https://www.revenuecat.com/docs/integrations/webhooks
 */

import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { subscriptions, users } from "../db/schema";
import { db } from "../db";

// ── Constants ──────────────────────────────────────────────────────────────────

const RC_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET ?? "";
const AUTUMN_API_KEY = process.env.AUTUMN_API_KEY ?? "";
const AUTUMN_BASE = "https://api.useautumn.com/v1";

// Map RevenueCat product IDs → Autumn feature IDs
// Extend this map when new products are added to RevenueCat.
const PRODUCT_TO_FEATURE: Record<string, string> = {
  nuralix_individual_monthly: "plan_individual",
  nuralix_individual_annual: "plan_individual",
  nuralix_family_monthly: "plan_family",
  nuralix_family_annual: "plan_family",
};

// Map RevenueCat product IDs → internal plan names
const PRODUCT_TO_PLAN: Record<string, string> = {
  nuralix_individual_monthly: "individual",
  nuralix_individual_annual: "individual",
  nuralix_family_monthly: "family",
  nuralix_family_annual: "family",
};

// RevenueCat event types that grant access
const RC_GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
]);

// RevenueCat event types that revoke access
const RC_REVOKE_EVENTS = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "SUBSCRIBER_ALIAS",
  "BILLING_ISSUE",
]);

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Verify RevenueCat HMAC-SHA256 webhook signature.
 * RevenueCat sends the raw body hash in `X-RevenueCat-Signature`.
 */
function verifyRevenueCatSignature(rawBody: string, signature: string): boolean {
  if (!RC_WEBHOOK_SECRET) return true; // skip verification in dev
  const expected = crypto
    .createHmac("sha256", RC_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

/**
 * Attach a feature entitlement in Autumn for a customer.
 * Called when a purchase / renewal occurs.
 */
async function autumnAttach(customerId: string, productId: string): Promise<void> {
  if (!AUTUMN_API_KEY) {
    console.warn("[webhooks] AUTUMN_API_KEY not set — skipping Autumn attach");
    return;
  }
  await fetch(`${AUTUMN_BASE}/attach`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AUTUMN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ customerId, productId }),
    signal: AbortSignal.timeout(10_000), // Autumn must respond within 10 s
  });
}

/**
 * Detach a feature entitlement in Autumn for a customer.
 * Called when a subscription expires or is cancelled.
 */
async function autumnDetach(customerId: string, productId: string): Promise<void> {
  if (!AUTUMN_API_KEY) {
    console.warn("[webhooks] AUTUMN_API_KEY not set — skipping Autumn detach");
    return;
  }
  await fetch(`${AUTUMN_BASE}/detach`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AUTUMN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ customerId, productId }),
    signal: AbortSignal.timeout(10_000), // Autumn must respond within 10 s
  });
}

// ── Elysia plugin ──────────────────────────────────────────────────────────────

export const webhookRoutes = new Elysia({ prefix: "/webhooks" })
  .decorate("db", db)

  /**
   * POST /webhooks/revenuecat
   *
   * Receives all RevenueCat subscriber events.
   * No session auth — verified by HMAC signature instead.
   */
  .post(
    "/revenuecat",
    async ({ db, request, body, set }) => {
      // 1. Verify signature using the raw request bytes.
      //    JSON.stringify(body) is NOT safe here — Elysia's parser may reformat
      //    the JSON (different whitespace / key order), breaking the HMAC.
      //    request.clone().text() reads the original bytes from a cloned stream
      //    before the primary stream is consumed by the body parser.
      const rawBody = await request.clone().text();
      const signature = request.headers.get("x-revenuecat-signature") ?? "";
      if (!verifyRevenueCatSignature(rawBody, signature)) {
        set.status = 401;
        return { error: "Invalid signature" };
      }

      const event = body.event as Record<string, unknown>;
      const eventType = event?.type as string;
      const appUserId = event?.app_user_id as string;
      const productId = event?.product_id as string;
      const expiresAt = event?.expiration_at_ms
        ? new Date(event.expiration_at_ms as number)
        : undefined;

      console.log(`[webhooks/revenuecat] ${eventType} userId=${appUserId} product=${productId}`);

      // 2. Look up user by RevenueCat app_user_id (which we set to the Nuralix userId)
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, appUserId))
        .limit(1);

      if (!user) {
        // RevenueCat may send events for users who don't have a Nuralix account yet
        // (e.g., anonymous purchase before sign-up). Log and return 200 to prevent retry.
        console.warn(`[webhooks/revenuecat] Unknown user ${appUserId} — ignoring`);
        return { ok: true, ignored: true };
      }

      const featureId = PRODUCT_TO_FEATURE[productId];
      const planName = PRODUCT_TO_PLAN[productId] ?? "individual";

      // 3. Sync to Autumn
      if (featureId) {
        if (RC_GRANT_EVENTS.has(eventType)) {
          await autumnAttach(appUserId, productId).catch((err) =>
            console.error("[webhooks/revenuecat] Autumn attach failed:", err)
          );
        } else if (RC_REVOKE_EVENTS.has(eventType)) {
          await autumnDetach(appUserId, productId).catch((err) =>
            console.error("[webhooks/revenuecat] Autumn detach failed:", err)
          );
        }
      }

      // 4. Update Neon subscriptions table
      const isActive = RC_GRANT_EVENTS.has(eventType);
      await db
        .insert(subscriptions)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          plan: isActive ? planName : "free",
          status: isActive ? "active" : (eventType === "CANCELLATION" ? "cancelled" : "expired"),
          revenueCatCustomerId: appUserId,
          autumnCustomerId: appUserId, // Autumn uses same customer ID
          currentPeriodEnd: expiresAt ?? undefined,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [subscriptions.userId],
          set: {
            plan: isActive ? planName : "free",
            status: isActive ? "active" : (eventType === "CANCELLATION" ? "cancelled" : "expired"),
            revenueCatCustomerId: appUserId,
            autumnCustomerId: appUserId,
            currentPeriodEnd: expiresAt ?? undefined,
            updatedAt: new Date(),
          },
        });

      return { ok: true };
    },
    {
      // Accept the full RevenueCat payload as an opaque object
      body: t.Object({ event: t.Any() }, { additionalProperties: true }),
      detail: {
        tags: ["webhooks"],
        summary: "RevenueCat subscription event webhook",
      },
    }
  )

  /**
   * POST /webhooks/autumn
   *
   * Optional: receive Autumn-side billing events (e.g., Stripe payment failure).
   * Autumn signs requests with `X-Autumn-Signature` (HMAC-SHA256).
   */
  .post(
    "/autumn",
    async ({ db, request, body, set }) => {
      const AUTUMN_WEBHOOK_SECRET = process.env.AUTUMN_WEBHOOK_SECRET ?? "";
      // Same raw-body pattern: clone the stream before it is consumed by the parser
      const rawBody = await request.clone().text();
      const signature = request.headers.get("x-autumn-signature") ?? "";

      if (AUTUMN_WEBHOOK_SECRET) {
        const expected = crypto
          .createHmac("sha256", AUTUMN_WEBHOOK_SECRET)
          .update(rawBody)
          .digest("hex");
        try {
          if (!crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))) {
            set.status = 401;
            return { error: "Invalid signature" };
          }
        } catch {
          set.status = 401;
          return { error: "Invalid signature" };
        }
      }

      const event = body as Record<string, unknown>;
      const eventType = event.type as string;
      const customerId = event.customer_id as string;

      console.log(`[webhooks/autumn] ${eventType} customerId=${customerId}`);

      // Handle Stripe-originated billing failure: downgrade to free
      if (eventType === "payment.failed" || eventType === "subscription.cancelled") {
        await db
          .update(subscriptions)
          .set({ plan: "free", status: "expired", updatedAt: new Date() })
          .where(eq(subscriptions.autumnCustomerId, customerId));
      }

      return { ok: true };
    },
    {
      body: t.Record(t.String(), t.Unknown()),
      detail: {
        tags: ["webhooks"],
        summary: "Autumn billing event webhook",
      },
    }
  );
