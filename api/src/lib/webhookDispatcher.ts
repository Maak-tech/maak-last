/**
 * Webhook Dispatcher — shared utility for all server-side webhook delivery.
 *
 * Flow for each event:
 *   1. Look up which orgs have the patient enrolled (`patientRosters`)
 *   2. Find all active webhooks for those orgs that subscribe to this event
 *   3. For each matching endpoint:
 *      a. Sign the payload with HMAC-SHA256 using the endpoint's secret
 *      b. POST the signed payload to the endpoint's URL
 *      c. Write a `webhookDeliveries` record (status = "delivered" | "failed")
 *
 * All delivery errors are caught silently — webhooks must not crash the caller.
 * The `webhookDeliveries` table provides a delivery audit trail.
 *
 * Usage:
 *   import { dispatchWebhookEvent } from "@/lib/webhookDispatcher";
 *   await dispatchWebhookEvent("vhi.updated", userId, { overallScore, compositeRisk });
 */

import crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  patientRosters,
  webhookEndpoints,
  webhookDeliveries,
} from "../db/schema";

export type WebhookEventName =
  | "vhi.updated"
  | "vhi.risk_elevated"
  | "genetics.processed"
  | "alert.triggered"
  | "alert.resolved"
  | "medication.missed"
  | "*";

/**
 * Dispatch a webhook event for a given patient.
 *
 * Finds all orgs with the patient on their roster, then fires webhook
 * deliveries to every matching active endpoint belonging to those orgs.
 *
 * Non-blocking: errors are logged but never propagate to the caller.
 */
export async function dispatchWebhookEvent(
  event: WebhookEventName,
  userId: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // 1. Find orgs that have this patient enrolled
    const rosters = await db
      .select({ orgId: patientRosters.orgId })
      .from(patientRosters)
      .where(
        and(
          eq(patientRosters.userId, userId),
          eq(patientRosters.status, "active")
        )
      );

    if (rosters.length === 0) return; // no org has this patient — skip

    const orgIds = rosters.map((r) => r.orgId);

    // 2. Find active webhook endpoints for those orgs that match the event
    const hooks = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          inArray(webhookEndpoints.orgId, orgIds),
          eq(webhookEndpoints.isActive, true)
        )
      );

    if (hooks.length === 0) return;

    const matchingHooks = hooks.filter(
      (h) => h.events?.includes(event) || h.events?.includes("*")
    );

    if (matchingHooks.length === 0) return;

    // 3. Dispatch to each matching endpoint concurrently
    const envelope = {
      event,
      userId,
      timestamp: new Date().toISOString(),
      data,
    };

    await Promise.allSettled(
      matchingHooks.map((hook) => deliverToEndpoint(hook, event, envelope))
    );
  } catch (err) {
    // Never propagate — webhook dispatch is always best-effort
    console.error("[webhookDispatcher] Unexpected error:", err);
  }
}

// ── Internal delivery helper ──────────────────────────────────────────────────

type WebhookEndpoint = {
  id: string;
  url: string;
  secret: string;
  events: string[] | null;
};

async function deliverToEndpoint(
  hook: WebhookEndpoint,
  event: string,
  envelope: Record<string, unknown>
): Promise<void> {
  const deliveryId = crypto.randomUUID();
  const body = JSON.stringify(envelope);

  // Sign the body using HMAC-SHA256 with the endpoint's secret
  const sig = crypto
    .createHmac("sha256", hook.secret)
    .update(body)
    .digest("hex");

  let status: "delivered" | "failed" = "failed";
  let lastError: string | null = null;
  let deliveredAt: Date | null = null;

  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nuralix-Signature": `sha256=${sig}`,
        "X-Nuralix-Event": event,
        "X-Nuralix-Delivery": deliveryId,
        "User-Agent": "Nuralix-Webhooks/1.0",
      },
      body,
      signal: AbortSignal.timeout(10_000), // 10-second delivery timeout
    });

    if (res.ok) {
      status = "delivered";
      deliveredAt = new Date();
    } else {
      lastError = `HTTP ${res.status} ${res.statusText}`;
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }

  // Write delivery record to audit table (best-effort).
  // On failure set nextRetryAt = now + 1 min so the retry worker picks it up.
  const nextRetryAt = status === "failed" ? new Date(Date.now() + 60_000) : null;

  db.insert(webhookDeliveries)
    .values({
      id: deliveryId,
      endpointId: hook.id,
      event,
      payload: envelope,
      status,
      attempts: 1,
      lastError,
      nextRetryAt: nextRetryAt ?? undefined,
      deliveredAt: deliveredAt ?? undefined,
    })
    .catch((dbErr) =>
      console.error("[webhookDispatcher] Failed to write delivery record:", dbErr)
    );

  if (status === "failed") {
    console.warn(
      `[webhookDispatcher] Delivery failed to ${hook.url} (event=${event}): ${lastError}`
    );
  }
}
