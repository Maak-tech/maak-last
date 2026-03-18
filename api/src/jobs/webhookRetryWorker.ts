/**
 * Webhook Retry Worker — runs every 5 minutes via Railway cron.
 *
 * Scans `webhook_deliveries` for rows with:
 *   status = 'failed'  AND  attempts < MAX_ATTEMPTS  AND  next_retry_at <= now
 *
 * Retry schedule (exponential back-off):
 *   attempt 1 → immediate (first try, done by dispatcher)
 *   attempt 2 → 1 minute  after first failure  (nextRetryAt = now + 1 min)
 *   attempt 3 → 5 minutes after second failure (nextRetryAt = now + 5 min)
 *   attempt 4 → 30 minutes                     (nextRetryAt = now + 30 min)
 *   attempt 5 → 2 hours                        (nextRetryAt = now + 2 h)
 *   Beyond 5  → marked 'permanently_failed', endpoint auto-deactivated after 10
 *               consecutive permanent failures.
 */

import crypto from "node:crypto";
import { and, eq, lte, lt, inArray } from "drizzle-orm";
import { db } from "../db";
import { webhookDeliveries, webhookEndpoints } from "../db/schema";

const MAX_ATTEMPTS = 5;

// Delay (ms) before attempt N (1-indexed)
const RETRY_DELAYS_MS = [
  0,            // attempt 1 — instant (done by dispatcher)
  60_000,       // attempt 2 — 1 min
  5 * 60_000,   // attempt 3 — 5 min
  30 * 60_000,  // attempt 4 — 30 min
  2 * 3600_000, // attempt 5 — 2 h
];

async function runWebhookRetryWorker() {
  console.log(`[webhookRetry] Starting at ${new Date().toISOString()}`);

  // Fetch all failed deliveries that are due for a retry
  const due = await db
    .select({
      id: webhookDeliveries.id,
      endpointId: webhookDeliveries.endpointId,
      event: webhookDeliveries.event,
      payload: webhookDeliveries.payload,
      attempts: webhookDeliveries.attempts,
    })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.status, "failed"),
        lt(webhookDeliveries.attempts, MAX_ATTEMPTS),
        lte(webhookDeliveries.nextRetryAt, new Date())
      )
    )
    .limit(100); // process at most 100 per run to avoid long-running jobs

  console.log(`[webhookRetry] ${due.length} deliveries due for retry`);
  if (due.length === 0) return;

  // Fetch endpoint details for all unique endpointIds
  const endpointIds = [...new Set(due.map((d) => d.endpointId))];
  const endpoints = await db
    .select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      secret: webhookEndpoints.secret,
      isActive: webhookEndpoints.isActive,
    })
    .from(webhookEndpoints)
    .where(inArray(webhookEndpoints.id, endpointIds));

  const endpointMap = new Map(endpoints.map((e) => [e.id, e]));

  const results = await Promise.allSettled(
    due.map((delivery) => retryDelivery(delivery, endpointMap))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - succeeded;
  console.log(`[webhookRetry] Done. Re-delivered: ${succeeded}, Still failing: ${failed}`);
}

// ── Single delivery retry ─────────────────────────────────────────────────────

type DeliveryRow = {
  id: string;
  endpointId: string;
  event: string;
  payload: unknown;
  attempts: number | null;
};

type EndpointRow = {
  id: string;
  url: string;
  secret: string;
  isActive: boolean | null;
};

async function retryDelivery(
  delivery: DeliveryRow,
  endpointMap: Map<string, EndpointRow>
): Promise<void> {
  const endpoint = endpointMap.get(delivery.endpointId);

  // If endpoint no longer exists or is deactivated, permanently fail the delivery
  if (!endpoint || !endpoint.isActive) {
    await db
      .update(webhookDeliveries)
      .set({ status: "permanently_failed", lastError: "Endpoint deactivated or removed" })
      .where(eq(webhookDeliveries.id, delivery.id));
    return;
  }

  const attemptNumber = (delivery.attempts ?? 1) + 1;
  const body = JSON.stringify(delivery.payload);
  const sig = crypto
    .createHmac("sha256", endpoint.secret)
    .update(body)
    .digest("hex");

  let status: "delivered" | "failed" = "failed";
  let lastError: string | null = null;
  let deliveredAt: Date | null = null;

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nuralix-Signature": `sha256=${sig}`,
        "X-Nuralix-Event": delivery.event,
        "X-Nuralix-Delivery": delivery.id,
        "User-Agent": "Nuralix-Webhooks/1.0 (retry)",
      },
      body,
      signal: AbortSignal.timeout(10_000),
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

  if (status === "delivered") {
    await db
      .update(webhookDeliveries)
      .set({ status: "delivered", attempts: attemptNumber, deliveredAt, lastError: null })
      .where(eq(webhookDeliveries.id, delivery.id));
    return;
  }

  // Still failing — schedule next retry or permanently fail
  const nextAttempt = attemptNumber + 1;
  if (nextAttempt > MAX_ATTEMPTS) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "permanently_failed",
        attempts: attemptNumber,
        lastError,
        nextRetryAt: null,
      })
      .where(eq(webhookDeliveries.id, delivery.id));

    // Check if this endpoint has too many permanent failures and deactivate it
    await maybeDeactivateEndpoint(delivery.endpointId);
    return;
  }

  const delayMs = RETRY_DELAYS_MS[attemptNumber] ?? 2 * 3600_000;
  const nextRetryAt = new Date(Date.now() + delayMs);

  await db
    .update(webhookDeliveries)
    .set({ status: "failed", attempts: attemptNumber, lastError, nextRetryAt })
    .where(eq(webhookDeliveries.id, delivery.id));

  console.warn(
    `[webhookRetry] Delivery ${delivery.id} still failing (attempt ${attemptNumber}/${MAX_ATTEMPTS}). ` +
      `Next retry at ${nextRetryAt.toISOString()}. Error: ${lastError}`
  );
}

// ── Auto-deactivate consistently failing endpoints ────────────────────────────

async function maybeDeactivateEndpoint(endpointId: string): Promise<void> {
  const permanentFailures = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(
      and(
        eq(webhookDeliveries.endpointId, endpointId),
        eq(webhookDeliveries.status, "permanently_failed")
      )
    )
    .limit(11);

  if (permanentFailures.length >= 10) {
    await db
      .update(webhookEndpoints)
      .set({ isActive: false })
      .where(eq(webhookEndpoints.id, endpointId));

    console.warn(
      `[webhookRetry] Endpoint ${endpointId} deactivated after 10+ permanent delivery failures.`
    );
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
// Guard prevents execution when this file is imported as a module by another
// file. Without this, any `import { ... } from "./webhookRetryWorker"` would
// immediately run the worker and call process.exit(), crashing the importer.

if (import.meta.main) {
  runWebhookRetryWorker()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[webhookRetry] Fatal error:", err);
      process.exit(1);
    });
}
