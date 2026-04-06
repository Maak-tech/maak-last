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
import fs from "node:fs";
import path from "node:path";
import { and, eq, lte, lt, inArray } from "drizzle-orm";
import { db } from "../db";
import { webhookDeliveries, webhookEndpoints } from "../db/schema";
import { recordHeartbeat } from "../lib/heartbeat.js";

const MAX_ATTEMPTS = 5;

// ── Concurrency guard ─────────────────────────────────────────────────────────
const LOCK_FILE = path.join("/tmp", "webhook_retry.lock");
const LOCK_STALE_MS = 8 * 60 * 1000; // 8 minutes (generous for a 5-min cron)

function acquireLock(): boolean {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const stat = fs.statSync(LOCK_FILE);
      if (Date.now() - stat.mtimeMs < LOCK_STALE_MS) {
        console.warn("[webhookRetry] Already running. Skipping.");
        return false;
      }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    return true;
  } catch (err: unknown) {
    console.warn("[webhookRetry] Failed to acquire lock — proceeding without guard:", err instanceof Error ? err.message : String(err));
    return true;
  }
}

function releaseLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
  } catch (err: unknown) {
    console.warn("[webhookRetry] Failed to release lock:", err instanceof Error ? err.message : String(err));
  }
}

// Delay (ms) before attempt N (1-indexed)
const RETRY_DELAYS_MS = [
  0,            // attempt 1 — instant (done by dispatcher)
  60_000,       // attempt 2 — 1 min
  5 * 60_000,   // attempt 3 — 5 min
  30 * 60_000,  // attempt 4 — 30 min
  2 * 3600_000, // attempt 5 — 2 h
];

async function runWebhookRetryWorker() {
  if (!acquireLock()) return;
  console.log(`[webhookRetry] Starting at ${new Date().toISOString()}`);

  // Fetch all failed deliveries that are due for a retry
  const due = await db
    .select({
      id: webhookDeliveries.id,
      endpointId: webhookDeliveries.endpointId,
      event: webhookDeliveries.event,
      payload: webhookDeliveries.payload,
      canonicalBody: webhookDeliveries.canonicalBody,
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
  releaseLock();
  try { await recordHeartbeat('webhookRetryWorker', 300) } catch (e) { console.warn('[webhookRetry] heartbeat failed', e instanceof Error ? e.message : String(e)) }
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
  // Use the stored canonical body string to compute the HMAC.
  // Re-serializing delivery.payload from JSONB could produce a different key
  // order than the original JSON.stringify(), causing signature mismatch on
  // the receiving endpoint. Fall back to re-serializing only if the field is
  // missing (rows created before this column was added).
  const body = delivery.canonicalBody ?? JSON.stringify(delivery.payload);
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
  } catch (err: unknown) {
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

  // RETRY_DELAYS_MS is 0-indexed by attempt number (attempt 1 = index 0, attempt 2 = index 1, ...).
  // attemptNumber is 1-based (e.g. 2 for the first retry), so subtract 1 for the correct delay.
  const delayMs = RETRY_DELAYS_MS[attemptNumber - 1] ?? 2 * 3600_000;
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
    .catch((err: unknown) => {
      console.error("[webhookRetry] Fatal error:", err instanceof Error ? err.message : String(err));
      releaseLock();
      process.exit(1);
    });
}
