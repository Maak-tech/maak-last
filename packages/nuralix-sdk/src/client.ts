import type {
  NurulixClientOptions,
  PatientVHI,
  PatientGenetics,
  PatientRisk,
  PatientTimeline,
  PatientAlerts,
  PatientInsights,
  FhirBundle,
  WebhookEvent,
  WebhookRegistration,
  APIKey,
  Cohort,
  CohortMembersResponse,
} from "./types.js";
import { NurulixError } from "./types.js";
import { NurulixSubscription, type SubscriptionCallback } from "./websocket.js";

const DEFAULT_BASE_URL = "https://api.nuralix.ai";
const DEFAULT_TIMEOUT = 30_000;

export class NurulixClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly timeoutMs: number;

  constructor(options: NurulixClientOptions) {
    if (!options.apiKey?.startsWith("nk_")) {
      throw new Error('Nuralix API key must start with "nk_"');
    }
    this.apiKey = options.apiKey;
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  }

  // ── Internal fetch helper ────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseURL}/sdk/v1${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "@nuralix/sdk",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        throw new NurulixError(
          (json.message as string) ?? res.statusText,
          res.status,
          json.code as string | undefined
        );
      }

      return json as T;
    } catch (err) {
      if (err instanceof NurulixError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new NurulixError(`Request timed out after ${this.timeoutMs}ms`, 408);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Patient VHI ──────────────────────────────────────────────────────────────

  /**
   * Get a patient's Virtual Health Identity summary.
   *
   * Requires scope: `vhi:read`
   *
   * @example
   * const vhi = await client.getPatientVHI("user_abc123");
   * console.log(vhi.overallScore, vhi.riskLevel);
   */
  async getPatientVHI(patientId: string): Promise<PatientVHI | null> {
    return this.request<PatientVHI | null>("GET", `/patients/${patientId}/vhi`);
  }

  // ── Patient Genetics ─────────────────────────────────────────────────────────

  /**
   * Get a patient's genetic risk profile (condition-level only — no raw rsids).
   * Patient must have consented to family/provider sharing.
   *
   * Requires scope: `genetics:read`
   *
   * @example
   * const genetics = await client.getPatientGenetics("user_abc123");
   * genetics.conditions.forEach(c => console.log(c.condition, c.percentile));
   */
  async getPatientGenetics(patientId: string): Promise<PatientGenetics> {
    return this.request<PatientGenetics>("GET", `/patients/${patientId}/genetics`);
  }

  // ── Patient Risk ─────────────────────────────────────────────────────────────

  /**
   * Get the full risk score breakdown for a patient.
   * Returns fall, adherence, deterioration, and composite risk scores (0–100).
   *
   * Requires scope: `vhi:read`
   *
   * @example
   * const risk = await client.getPatientRisk("user_abc123");
   * if (risk.compositeRisk > 75) console.log("High-risk patient");
   */
  async getPatientRisk(patientId: string): Promise<PatientRisk> {
    return this.request<PatientRisk>("GET", `/patients/${patientId}/risk`);
  }

  // ── Patient Health Timeline ───────────────────────────────────────────────────

  /**
   * Get a longitudinal health event stream for a patient.
   * Events include vitals, symptom logs, medication events, and VHI updates.
   *
   * Requires scope: `timeline:read`
   *
   * @example
   * const { events } = await client.getPatientTimeline("user_abc123", {
   *   from: "2026-01-01",
   *   domain: "vitals",
   *   limit: 200,
   * });
   */
  async getPatientTimeline(
    patientId: string,
    opts?: { from?: string; to?: string; domain?: string; limit?: number }
  ): Promise<PatientTimeline> {
    const params = new URLSearchParams();
    if (opts?.from) params.set("from", opts.from);
    if (opts?.to) params.set("to", opts.to);
    if (opts?.domain) params.set("domain", opts.domain);
    if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return this.request<PatientTimeline>("GET", `/patients/${patientId}/timeline${qs ? `?${qs}` : ""}`);
  }

  // ── Patient Alerts ────────────────────────────────────────────────────────────

  /**
   * Get the alert history for a patient.
   *
   * Requires scope: `alerts:read`
   *
   * @example
   * const { alerts } = await client.getPatientAlerts("user_abc123", { activeOnly: true });
   */
  async getPatientAlerts(
    patientId: string,
    opts?: { activeOnly?: boolean; limit?: number }
  ): Promise<PatientAlerts> {
    const params = new URLSearchParams();
    if (opts?.activeOnly) params.set("activeOnly", "true");
    if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return this.request<PatientAlerts>("GET", `/patients/${patientId}/alerts${qs ? `?${qs}` : ""}`);
  }

  // ── Patient AI Health Insights ────────────────────────────────────────────────

  /**
   * Get pre-formatted AI health insights derived from the patient's VHI.
   * Returns the top elevating and declining factors, overall score, and pending actions.
   *
   * Requires scope: `vhi:read`
   *
   * @example
   * const insights = await client.getPatientInsights("user_abc123");
   * insights.insights.filter(i => i.type === "declining").forEach(i => {
   *   console.log(i.factor, "→", i.recommendation);
   * });
   */
  async getPatientInsights(patientId: string): Promise<PatientInsights> {
    return this.request<PatientInsights>("GET", `/patients/${patientId}/insights`);
  }

  // ── FHIR R4 Export ───────────────────────────────────────────────────────────

  /**
   * Export a patient's health record as a FHIR R4 Bundle.
   *
   * The bundle contains:
   * - `Patient` resource (demographics)
   * - `Observation` resources (last 90 days of vitals, LOINC-coded)
   * - `MedicationRequest` resources (active medications only)
   *
   * No raw genetic variants, clinical note text, or rsids are included.
   *
   * Requires scope: `timeline:read`
   *
   * @example
   * const bundle = await client.exportFHIR("user_abc123");
   * const observations = bundle.entry
   *   .filter(e => e.resource.resourceType === "Observation");
   * console.log(`${observations.length} vital observations`);
   */
  async exportFHIR(patientId: string): Promise<FhirBundle> {
    return this.request<FhirBundle>("GET", `/patients/${patientId}/fhir/Bundle`);
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────────

  /**
   * Register a webhook endpoint to receive real-time events.
   *
   * The returned `secret` is shown **once** — store it immediately.
   * Use it to verify the `X-Nuralix-Signature` header on each delivery:
   * ```
   * const sig = createHmac("sha256", secret).update(rawBody).digest("hex");
   * assert(sig === req.headers["x-nuralix-signature"].replace("sha256=", ""));
   * ```
   *
   * @example
   * const wh = await client.registerWebhook({
   *   url: "https://your-server.com/webhooks/nuralix",
   *   events: ["genetics.processed", "vhi.updated"],
   * });
   * console.log("Store this secret:", wh.secret);
   */
  async registerWebhook(opts: {
    url: string;
    events: WebhookEvent[];
  }): Promise<WebhookRegistration> {
    return this.request<WebhookRegistration>("POST", "/webhooks", opts);
  }

  /**
   * Deactivate a previously registered webhook.
   */
  async deleteWebhook(webhookId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("DELETE", `/webhooks/${webhookId}`);
  }

  // ── API keys ─────────────────────────────────────────────────────────────────

  /**
   * Create a new API key for your organisation.
   * The raw key value is returned **once** — store it securely.
   *
   * @example
   * const { key } = await client.createAPIKey({
   *   name: "prod-ehr-integration",
   *   scopes: ["vhi:read", "genetics:read"],
   * });
   */
  async createAPIKey(opts: {
    name: string;
    scopes: string[];
  }): Promise<APIKey> {
    return this.request<APIKey>("POST", "/keys", opts);
  }

  /**
   * List all active API keys for your organisation.
   */
  async listAPIKeys(): Promise<APIKey[]> {
    return this.request<APIKey[]>("GET", "/keys");
  }

  /**
   * Revoke an API key immediately.
   */
  async revokeAPIKey(keyId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("DELETE", `/keys/${keyId}`);
  }

  // ── Cohorts ───────────────────────────────────────────────────────────────

  /**
   * List all cohorts for your organisation, with live patient counts.
   *
   * Requires scope: `roster:read`
   *
   * @example
   * const cohorts = await client.listCohorts();
   * cohorts.forEach(c => console.log(c.name, c.patientCount));
   */
  async listCohorts(): Promise<Cohort[]> {
    return this.request<Cohort[]>("GET", "/cohorts");
  }

  /**
   * Get all patients enrolled in a specific cohort.
   *
   * Requires scope: `roster:read`
   *
   * @example
   * const { members } = await client.getCohortMembers("cohort_abc123");
   * console.log(`${members.length} patients in cohort`);
   */
  async getCohortMembers(cohortId: string): Promise<CohortMembersResponse> {
    return this.request<CohortMembersResponse>("GET", `/cohorts/${cohortId}/members`);
  }

  // ── Real-time subscriptions ───────────────────────────────────────────────

  /**
   * Open a real-time WebSocket subscription for a patient's health events.
   *
   * The connection is established immediately and reconnects automatically on
   * disconnect using exponential back-off (1 s → 2 s → 4 s → 30 s cap).
   *
   * Requires scope: `vhi:read`
   *
   * Known event names:
   *   `"vhi.updated"`         — VHI recomputed (fires every ~15 min or on demand)
   *   `"vhi.risk_elevated"`   — composite risk crossed the elevated threshold
   *   `"alert.triggered"`     — a new emergency alert was created
   *   `"alert.resolved"`      — an alert was resolved by a caregiver
   *   `"medication.missed"`   — a scheduled dose was missed
   *   `"genetics.processed"`  — DNA analysis completed
   *
   * @example
   * const sub = client.subscribe("user_abc123", (msg) => {
   *   if (msg.event === "vhi.updated") {
   *     console.log("VHI updated:", msg.data);
   *   }
   * });
   *
   * // When done monitoring:
   * sub.unsubscribe();
   */
  subscribe(
    patientId: string,
    callback: SubscriptionCallback
  ): NurulixSubscription {
    // Convert the HTTP base URL to a WebSocket URL
    const wsURL = this.baseURL
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://");
    return new NurulixSubscription(patientId, this.apiKey, wsURL, callback);
  }
}
