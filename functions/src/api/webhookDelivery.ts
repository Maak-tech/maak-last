/**
 * Webhook Delivery System
 *
 * Delivers outbound webhook events to organization-registered endpoints.
 * Uses HMAC-SHA256 signed payloads (Stripe-style).
 *
 * Retry schedule:
 *   Attempt 1: immediate
 *   Attempt 2: 1 minute after failure
 *   Attempt 3: 5 minutes after failure
 *   After 3 failures: mark as "dead"
 *
 * Exports:
 *   deliverWebhookEvent(orgId, event, payload) — called from other Cloud Functions
 *   retryFailedWebhooks — scheduled Cloud Function (every 5 minutes)
 */

import { createHmac } from "crypto";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "../observability/logger";
import { createTraceId } from "../observability/correlation";
import type { WebhookEventType } from "../../../types";

const db = () => getFirestore();

// ─── Constants ────────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [0, 60_000, 300_000]; // 0s, 1min, 5min
const MAX_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

// ─── HMAC Signing ─────────────────────────────────────────────────────────────

/**
 * Generate HMAC-SHA256 signature for webhook payload.
 * Header: X-Maak-Signature: sha256=<hmac>
 */
function signPayload(secret: string, payload: string, timestamp: number): string {
  const message = `${timestamp}.${payload}`;
  return `sha256=${createHmac("sha256", secret).update(message).digest("hex")}`;
}

// ─── HTTP Delivery ────────────────────────────────────────────────────────────

type DeliveryResult = {
  success: boolean;
  responseCode?: number;
  responseBody?: string;
  error?: string;
};

async function attemptDelivery(
  url: string,
  signingSecret: string,
  event: WebhookEventType,
  payload: Record<string, unknown>,
  deliveryId: string,
  attemptNum: number
): Promise<DeliveryResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    id: deliveryId,
    event,
    attempt: attemptNum,
    timestamp,
    data: payload,
  });

  const signature = signPayload(signingSecret, body, timestamp);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Maak-Webhook/1.0",
        "X-Maak-Event": event,
        "X-Maak-Delivery": deliveryId,
        "X-Maak-Signature": signature,
        "X-Maak-Timestamp": timestamp.toString(),
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text().catch(() => "");

    return {
      success: response.ok,
      responseCode: response.status,
      responseBody: responseText.slice(0, 500),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const error = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error };
  }
}

// ─── Core Delivery Logic ──────────────────────────────────────────────────────

/**
 * Deliver a webhook event to all subscribed endpoints for an org.
 * Called by other Cloud Functions when events occur.
 */
export async function deliverWebhookEvent(
  orgId: string,
  event: WebhookEventType,
  payload: Record<string, unknown>
): Promise<void> {
  const traceId = createTraceId();

  try {
    // Find all active endpoints subscribed to this event
    const endpointsSnap = await db()
      .collection("organizations")
      .doc(orgId)
      .collection("webhooks")
      .where("isActive", "==", true)
      .where("events", "array-contains", event)
      .get();

    if (endpointsSnap.empty) return;

    logger.info("Delivering webhook event", {
      traceId,
      orgId,
      event,
      endpointCount: endpointsSnap.size,
      fn: "deliverWebhookEvent",
    });

    const now = new Date();

    // Deliver to each endpoint concurrently
    await Promise.allSettled(
      endpointsSnap.docs.map(async (endpointDoc) => {
        const endpoint = endpointDoc.data();
        const webhookId = endpointDoc.id;

        // Write a delivery record
        const deliveryRef = await db()
          .collection("organizations")
          .doc(orgId)
          .collection("webhooks")
          .doc(webhookId)
          .collection("deliveries")
          .add({
            webhookId,
            orgId,
            event,
            payload,
            status: "pending",
            attempts: 0,
            maxAttempts: MAX_ATTEMPTS,
            createdAt: FieldValue.serverTimestamp(),
            nextRetryAt: null,
            deliveredAt: null,
            error: null,
          });

        // Attempt delivery
        const result = await attemptDelivery(
          endpoint.url as string,
          endpoint.signingSecret as string,
          event,
          payload,
          deliveryRef.id,
          1
        );

        const updateData: Record<string, unknown> = {
          attempts: 1,
          responseCode: result.responseCode ?? null,
          responseBody: result.responseBody ?? null,
        };

        if (result.success) {
          updateData.status = "delivered";
          updateData.deliveredAt = FieldValue.serverTimestamp();

          // Update endpoint lastTriggeredAt
          endpointDoc.ref.update({
            lastTriggeredAt: FieldValue.serverTimestamp(),
            failureCount: 0,
          }).catch(() => {});
        } else {
          updateData.status = "failed";
          updateData.error = result.error ?? `HTTP ${result.responseCode}`;

          if (MAX_ATTEMPTS > 1) {
            // Schedule first retry
            const retryAt = new Date(now.getTime() + RETRY_DELAYS_MS[1]);
            updateData.nextRetryAt = Timestamp.fromDate(retryAt);
          } else {
            updateData.status = "dead";
          }

          // Increment failure count on endpoint
          endpointDoc.ref.update({
            failureCount: (endpoint.failureCount as number ?? 0) + 1,
          }).catch(() => {});
        }

        await deliveryRef.update(updateData);

        logger.info("Webhook delivery attempt", {
          traceId,
          orgId,
          webhookId,
          deliveryId: deliveryRef.id,
          event,
          success: result.success,
          responseCode: result.responseCode,
          fn: "deliverWebhookEvent",
        });
      })
    );
  } catch (err) {
    logger.error("Failed to deliver webhook event", err as Error, {
      traceId,
      orgId,
      event,
      fn: "deliverWebhookEvent",
    });
  }
}

// ─── Retry Scheduled Function ─────────────────────────────────────────────────

/**
 * Retry failed webhook deliveries.
 * Runs every 5 minutes to process the retry queue.
 */
export const retryFailedWebhooks = onSchedule(
  {
    schedule: "every 5 minutes",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const traceId = createTraceId();
    const now = new Date();

    logger.info("Starting webhook retry cycle", {
      traceId,
      fn: "retryFailedWebhooks",
    });

    try {
      // Find all failed deliveries that are due for retry
      // This is a collectionGroup query across all deliveries subcollections
      const failedSnap = await db()
        .collectionGroup("deliveries")
        .where("status", "==", "failed")
        .where("nextRetryAt", "<=", Timestamp.fromDate(now))
        .where("attempts", "<", MAX_ATTEMPTS)
        .limit(100)
        .get();

      logger.info("Found deliveries to retry", {
        traceId,
        count: failedSnap.size,
        fn: "retryFailedWebhooks",
      });

      await Promise.allSettled(
        failedSnap.docs.map(async (deliveryDoc) => {
          const delivery = deliveryDoc.data();
          const webhookId = delivery.webhookId as string;
          const orgId = delivery.orgId as string;
          const attemptNum = (delivery.attempts as number) + 1;

          // Get the parent webhook endpoint
          const endpointSnap = await db()
            .collection("organizations")
            .doc(orgId)
            .collection("webhooks")
            .doc(webhookId)
            .get();

          if (!endpointSnap.exists) {
            await deliveryDoc.ref.update({ status: "dead", error: "Webhook endpoint deleted" });
            return;
          }

          const endpoint = endpointSnap.data()!;

          if (!endpoint.isActive) {
            await deliveryDoc.ref.update({ status: "dead", error: "Webhook endpoint disabled" });
            return;
          }

          const result = await attemptDelivery(
            endpoint.url as string,
            endpoint.signingSecret as string,
            delivery.event as WebhookEventType,
            delivery.payload as Record<string, unknown>,
            deliveryDoc.id,
            attemptNum
          );

          const updateData: Record<string, unknown> = {
            attempts: attemptNum,
            responseCode: result.responseCode ?? null,
            responseBody: result.responseBody ?? null,
          };

          if (result.success) {
            updateData.status = "delivered";
            updateData.deliveredAt = FieldValue.serverTimestamp();
            updateData.nextRetryAt = null;
            endpointSnap.ref.update({
              lastTriggeredAt: FieldValue.serverTimestamp(),
              failureCount: 0,
            }).catch(() => {});
          } else if (attemptNum < MAX_ATTEMPTS) {
            updateData.status = "failed";
            updateData.error = result.error ?? `HTTP ${result.responseCode}`;
            const retryDelayMs = RETRY_DELAYS_MS[attemptNum] ?? 300_000;
            updateData.nextRetryAt = Timestamp.fromDate(
              new Date(now.getTime() + retryDelayMs)
            );
          } else {
            // Max attempts reached
            updateData.status = "dead";
            updateData.error = result.error ?? `HTTP ${result.responseCode}`;
            updateData.nextRetryAt = null;
            endpointSnap.ref.update({
              failureCount: (endpoint.failureCount as number ?? 0) + 1,
            }).catch(() => {});
          }

          await deliveryDoc.ref.update(updateData);
        })
      );
    } catch (err) {
      logger.error("Webhook retry cycle failed", err as Error, {
        traceId,
        fn: "retryFailedWebhooks",
      });
    }
  }
);
