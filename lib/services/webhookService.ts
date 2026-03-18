import { api } from "@/lib/apiClient";
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
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date();
}

function mapEndpoint(data: Record<string, unknown>): WebhookEndpoint {
  return {
    id: data.id as string,
    orgId: data.orgId as string,
    name: (data.name as string) ?? "",
    url: data.url as string,
    signingSecret: (data.signingSecret ?? data.secret ?? "") as string,
    events: (data.events as WebhookEventType[]) ?? [],
    isActive: data.isActive as boolean,
    createdAt: toDate(data.createdAt),
    createdBy: (data.createdBy as string) ?? "",
    lastTriggeredAt: data.lastTriggeredAt
      ? toDate(data.lastTriggeredAt)
      : undefined,
    failureCount: (data.failureCount as number) ?? 0,
  };
}

function mapDelivery(data: Record<string, unknown>): WebhookDelivery {
  return {
    id: data.id as string,
    webhookId: (data.webhookId ?? data.endpointId) as string,
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
    error: (data.error ?? data.lastError) as string | undefined,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Webhook endpoint management for organizations.
 *
 * All routes are session-authenticated (Better-auth cookie) via /api/org/:orgId/webhooks.
 * The signing secret is generated server-side and returned once on creation/rotation.
 * Listing endpoints never returns secrets.
 */
class WebhookService {
  // ─── Endpoint Management ───────────────────────────────────────────────────

  /**
   * Register a new webhook endpoint.
   * The server generates the HMAC signing secret and returns it once.
   * Store it securely — it is never shown again.
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

    const raw = await api.post<Record<string, unknown>>(
      `/api/org/${params.orgId}/webhooks`,
      { url: params.url, events: params.events }
    );

    const signingSecret = raw.signingSecret as string;
    const endpoint: WebhookEndpoint = mapEndpoint({
      ...raw,
      orgId: params.orgId,
      name: params.name,
      createdBy: params.createdBy,
    });

    return { endpoint, signingSecret };
  }

  /**
   * List all webhook endpoints for an org.
   * Signing secrets are never included in list responses.
   */
  async listEndpoints(orgId: string): Promise<WebhookEndpoint[]> {
    const rows = await api.get<Record<string, unknown>[]>(`/api/org/${orgId}/webhooks`);
    return (rows ?? []).map(mapEndpoint);
  }

  /**
   * List active endpoints that subscribe to a specific event.
   */
  async getEndpointsForEvent(
    orgId: string,
    event: WebhookEventType
  ): Promise<WebhookEndpoint[]> {
    const all = await this.listEndpoints(orgId);
    return all.filter((ep) => ep.isActive && ep.events.includes(event));
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
    await api.patch(`/api/org/${orgId}/webhooks/${webhookId}`, {
      url: updates.url,
      events: updates.events,
      isActive: updates.isActive,
    });
  }

  /**
   * Disable a webhook endpoint (soft delete — sets isActive = false).
   */
  async disableEndpoint(orgId: string, webhookId: string): Promise<void> {
    await api.delete(`/api/org/${orgId}/webhooks/${webhookId}`);
  }

  /**
   * Re-generate the HMAC signing secret for a webhook endpoint.
   * Returns the new secret — old secret is immediately invalidated on the server.
   */
  async rotateSigningSecret(orgId: string, webhookId: string): Promise<string> {
    const raw = await api.post<{ signingSecret: string }>(
      `/api/org/${orgId}/webhooks/${webhookId}/rotate-secret`,
      {}
    );
    return raw.signingSecret;
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
    const rows = await api.get<Record<string, unknown>[]>(
      `/api/org/${orgId}/webhooks/${webhookId}/deliveries?limit=${maxResults}`
    );
    return (rows ?? []).map(mapDelivery);
  }

  /**
   * Queue a webhook delivery.
   * NOTE: In the new architecture, webhook deliveries are dispatched server-side
   * by the vhiCycle and alert jobs. This client method is kept for compatibility
   * but the server-side dispatcher in `api/src/lib/webhookDispatcher.ts` is
   * the canonical delivery path.
   */
  async queueDelivery(params: {
    orgId: string;
    webhookId: string;
    event: WebhookEventType;
    payload: Record<string, unknown>;
  }): Promise<string> {
    // Deliveries are queued server-side by the dispatcher — return a local stub ID.
    // Client code should not need to queue deliveries directly.
    console.warn(
      "[webhookService] queueDelivery: deliveries are dispatched server-side. " +
        "No client-initiated delivery queue endpoint exists."
    );
    return `delivery_${Date.now()}`;
  }

  /**
   * Record the outcome of a delivery attempt.
   * This is a server responsibility — client code should not call this directly.
   */
  async recordDeliveryAttempt(
    _orgId: string,
    _webhookId: string,
    _deliveryId: string,
    _result: {
      success: boolean;
      responseCode?: number;
      responseBody?: string;
      error?: string;
      nextRetryAt?: Date;
    }
  ): Promise<void> {
    // Delivery outcomes are recorded server-side by the dispatcher.
    // No client-initiated outcome recording endpoint exists.
    console.warn(
      "[webhookService] recordDeliveryAttempt: delivery outcomes are recorded server-side."
    );
  }
}

export const webhookService = new WebhookService();
