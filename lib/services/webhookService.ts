import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEventType,
} from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function mapEndpoint(
  id: string,
  data: Record<string, unknown>
): WebhookEndpoint {
  return {
    id,
    orgId: data.orgId as string,
    name: data.name as string,
    url: data.url as string,
    signingSecret: data.signingSecret as string,
    events: (data.events as WebhookEventType[]) ?? [],
    isActive: data.isActive as boolean,
    createdAt: toDate(data.createdAt),
    createdBy: data.createdBy as string,
    lastTriggeredAt: data.lastTriggeredAt
      ? toDate(data.lastTriggeredAt)
      : undefined,
    failureCount: (data.failureCount as number) ?? 0,
  };
}

function mapDelivery(id: string, data: Record<string, unknown>): WebhookDelivery {
  return {
    id,
    webhookId: data.webhookId as string,
    orgId: data.orgId as string,
    event: data.event as WebhookEventType,
    payload: data.payload as Record<string, unknown>,
    status: data.status as WebhookDelivery["status"],
    responseCode: data.responseCode as number | undefined,
    responseBody: data.responseBody as string | undefined,
    attempts: (data.attempts as number) ?? 0,
    maxAttempts: (data.maxAttempts as number) ?? 3,
    nextRetryAt: data.nextRetryAt ? toDate(data.nextRetryAt) : undefined,
    deliveredAt: data.deliveredAt ? toDate(data.deliveredAt) : undefined,
    createdAt: toDate(data.createdAt),
    error: data.error as string | undefined,
  };
}

/**
 * Generate a cryptographically random signing secret for HMAC-SHA256.
 * Format: whsec_{48 hex chars}
 */
function generateSigningSecret(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `whsec_${hex}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class WebhookService {
  private endpointsCol(orgId: string) {
    return collection(db, "organizations", orgId, "webhooks");
  }

  private deliveriesCol(orgId: string, webhookId: string) {
    return collection(
      db,
      "organizations",
      orgId,
      "webhooks",
      webhookId,
      "deliveries"
    );
  }

  // ─── Endpoint Management ───────────────────────────────────────────────────

  /**
   * Register a new webhook endpoint.
   * Returns the endpoint including the signing secret — store it securely, shown once.
   */
  async createEndpoint(params: {
    orgId: string;
    name: string;
    url: string;
    events: WebhookEventType[];
    createdBy: string;
  }): Promise<{ endpoint: WebhookEndpoint; signingSecret: string }> {
    if (!params.url.startsWith("https://")) {
      throw new Error("Webhook URL must use HTTPS");
    }

    const signingSecret = generateSigningSecret();

    const ref = await addDoc(this.endpointsCol(params.orgId), {
      orgId: params.orgId,
      name: params.name,
      url: params.url,
      signingSecret,
      events: params.events,
      isActive: true,
      createdBy: params.createdBy,
      createdAt: serverTimestamp(),
      lastTriggeredAt: null,
      failureCount: 0,
    });

    const endpoint: WebhookEndpoint = {
      id: ref.id,
      orgId: params.orgId,
      name: params.name,
      url: params.url,
      signingSecret,
      events: params.events,
      isActive: true,
      createdAt: new Date(),
      createdBy: params.createdBy,
      failureCount: 0,
    };

    return { endpoint, signingSecret };
  }

  /**
   * List all webhook endpoints for an org.
   */
  async listEndpoints(orgId: string): Promise<WebhookEndpoint[]> {
    const snap = await getDocs(this.endpointsCol(orgId));
    return snap.docs.map((d) => mapEndpoint(d.id, d.data()));
  }

  /**
   * List active endpoints that subscribe to a specific event.
   */
  async getEndpointsForEvent(
    orgId: string,
    event: WebhookEventType
  ): Promise<WebhookEndpoint[]> {
    const snap = await getDocs(
      query(
        this.endpointsCol(orgId),
        where("isActive", "==", true),
        where("events", "array-contains", event)
      )
    );
    return snap.docs.map((d) => mapEndpoint(d.id, d.data()));
  }

  /**
   * Update a webhook endpoint's URL, events, or active status.
   */
  async updateEndpoint(
    orgId: string,
    webhookId: string,
    updates: {
      name?: string;
      url?: string;
      events?: WebhookEventType[];
      isActive?: boolean;
    }
  ): Promise<void> {
    if (updates.url && !updates.url.startsWith("https://")) {
      throw new Error("Webhook URL must use HTTPS");
    }
    await updateDoc(
      doc(this.endpointsCol(orgId), webhookId),
      updates as Record<string, unknown>
    );
  }

  /**
   * Disable a webhook endpoint (soft delete).
   */
  async disableEndpoint(orgId: string, webhookId: string): Promise<void> {
    await updateDoc(doc(this.endpointsCol(orgId), webhookId), {
      isActive: false,
    });
  }

  /**
   * Re-generate the signing secret for a webhook endpoint.
   * Returns the new secret — old secret is immediately invalidated.
   */
  async rotateSigningSecret(
    orgId: string,
    webhookId: string
  ): Promise<string> {
    const newSecret = generateSigningSecret();
    await updateDoc(doc(this.endpointsCol(orgId), webhookId), {
      signingSecret: newSecret,
    });
    return newSecret;
  }

  // ─── Delivery Log ──────────────────────────────────────────────────────────

  /**
   * Get recent deliveries for a webhook endpoint.
   */
  async getDeliveries(
    orgId: string,
    webhookId: string,
    maxResults = 20
  ): Promise<WebhookDelivery[]> {
    const snap = await getDocs(this.deliveriesCol(orgId, webhookId));
    return snap.docs
      .map((d) => mapDelivery(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, maxResults);
  }

  /**
   * Queue a webhook delivery for the Cloud Function to process.
   * This writes to the delivery subcollection; the Cloud Function picks it up.
   */
  async queueDelivery(params: {
    orgId: string;
    webhookId: string;
    event: WebhookEventType;
    payload: Record<string, unknown>;
  }): Promise<string> {
    const ref = await addDoc(
      this.deliveriesCol(params.orgId, params.webhookId),
      {
        webhookId: params.webhookId,
        orgId: params.orgId,
        event: params.event,
        payload: params.payload,
        status: "pending",
        attempts: 0,
        maxAttempts: 3,
        createdAt: serverTimestamp(),
        nextRetryAt: null,
        deliveredAt: null,
        error: null,
      }
    );
    return ref.id;
  }

  /**
   * Record the outcome of a delivery attempt.
   * Called by the Cloud Function webhook delivery system.
   */
  async recordDeliveryAttempt(
    orgId: string,
    webhookId: string,
    deliveryId: string,
    result: {
      success: boolean;
      responseCode?: number;
      responseBody?: string;
      error?: string;
      nextRetryAt?: Date;
    }
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      attempts: (await getDocs(this.deliveriesCol(orgId, webhookId))).size,
    };

    if (result.success) {
      updates.status = "delivered";
      updates.deliveredAt = serverTimestamp();
      updates.responseCode = result.responseCode;
      updates.responseBody = result.responseBody?.slice(0, 500);
    } else if (result.nextRetryAt) {
      updates.status = "failed";
      updates.nextRetryAt = result.nextRetryAt;
      updates.error = result.error;
      updates.responseCode = result.responseCode;
    } else {
      updates.status = "dead";
      updates.error = result.error;
    }

    await updateDoc(
      doc(this.deliveriesCol(orgId, webhookId), deliveryId),
      updates
    );
  }
}

export const webhookService = new WebhookService();
