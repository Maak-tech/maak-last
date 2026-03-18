import { Elysia, t } from "elysia";
import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import crypto from "node:crypto";
import { alerts, apiKeys, cohortMembers, cohorts, genetics, healthTimeline, medications, patientRosters, users, vhi, vitals, webhookEndpoints } from "../db/schema";
import { db as dbInstance } from "../db";
import type { DB } from "../db";
import {
  buildFhirBundle,
  medicationToFhirMedicationRequest,
  userToFhirPatient,
  vitalToFhirObservation,
} from "../lib/fhirMappers";
import { subscribeToUser, unsubscribeFromUser } from "./realtime";

// ── Roster guard ──────────────────────────────────────────────────────────────

/**
 * Verifies that `patientId` is on `orgId`'s active patient roster.
 * Throws a 403-style Error if not — SDK callers must only access their own patients.
 */
async function assertPatientInRoster(
  db: DB,
  orgId: string,
  patientId: string
): Promise<void> {
  const [row] = await db
    .select({ id: patientRosters.id })
    .from(patientRosters)
    .where(
      and(
        eq(patientRosters.orgId, orgId),
        eq(patientRosters.userId, patientId),
        eq(patientRosters.status, "active")
      )
    )
    .limit(1);

  if (!row) {
    throw Object.assign(new Error("Patient not found in your organisation's roster"), {
      statusCode: 403,
    });
  }
}

// API key authentication middleware for SDK routes
const requireApiKey = new Elysia({ name: "require-api-key" })
  .decorate("db", dbInstance)
  .derive(
  { as: "global" },
  async ({ request, db, set }) => {
    const authHeader = request.headers.get("authorization");
    const key = authHeader?.replace("Bearer ", "");

    if (!key || !key.startsWith("nk_")) {
      set.status = 401;
      throw new Error("Valid API key required");
    }

    // Hash the key and look up in DB
    const keyHash = crypto.createHash("sha256").update(key).digest("hex");
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (!apiKey || !apiKey.isActive) {
      set.status = 401;
      throw new Error("Invalid or inactive API key");
    }

    // Update last used timestamp (async, non-blocking)
    db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKey.id)).catch(console.error);

    return { orgId: apiKey.orgId, apiKeyId: apiKey.id, scopes: apiKey.scopes ?? [] };
  }
);

export const sdkRoutes = new Elysia({ prefix: "/sdk/v1" })
  .decorate("db", null as unknown as import("../db").DB) // will be overridden by parent
  .use(requireApiKey)

  // ── Patient VHI ─────────────────────────────────────────────────────────────
  .get(
    "/patients/:patientId/vhi",
    async ({ db, params, scopes, orgId }) => {
      if (!scopes.includes("vhi:read") && !scopes.includes("*")) {
        throw new Error("Insufficient scope: vhi:read required");
      }
      await assertPatientInRoster(db, orgId, params.patientId);

      const [patientVhi] = await db
        .select()
        .from(vhi)
        .where(eq(vhi.userId, params.patientId))
        .limit(1);

      if (!patientVhi) return null;

      // Return sanitized VHI — no raw rsids, no clinical note text
      return {
        userId: patientVhi.userId,
        computedAt: patientVhi.computedAt,
        overallScore: patientVhi.data?.currentState?.overallScore,
        riskLevel:
          (patientVhi.data?.currentState?.riskScores?.compositeRisk ?? 0) >= 75
            ? "high"
            : (patientVhi.data?.currentState?.riskScores?.compositeRisk ?? 0) >= 50
              ? "moderate"
              : "low",
        trajectory: patientVhi.data?.currentState?.riskScores?.trajectory,
        riskScores: patientVhi.data?.currentState?.riskScores,
        elevatingFactors: patientVhi.data?.elevatingFactors,
        decliningFactors: patientVhi.data?.decliningFactors,
        pendingActions: patientVhi.data?.pendingActions,
      };
    },
    {
      params: t.Object({ patientId: t.String() }),
      detail: { tags: ["sdk"], summary: "[SDK] Get patient's VHI summary" },
    }
  )

  // ── Patient Genetic Risk (condition-level only) ───────────────────────────────
  .get(
    "/patients/:patientId/genetics",
    async ({ db, params, scopes, orgId }) => {
      if (!scopes.includes("genetics:read") && !scopes.includes("*")) {
        throw new Error("Insufficient scope: genetics:read required");
      }
      await assertPatientInRoster(db, orgId, params.patientId);

      const [patientGenetics] = await db
        .select({
          prsScores: genetics.prsScores,
          pharmacogenomics: genetics.pharmacogenomics,
          twinRelevantConditions: genetics.twinRelevantConditions,
          familySharingConsent: genetics.familySharingConsent,
          processingStatus: genetics.processingStatus,
        })
        .from(genetics)
        .where(eq(genetics.userId, params.patientId))
        .limit(1);

      if (!patientGenetics?.familySharingConsent) {
        return { error: "Patient has not consented to genetic data sharing", code: "NO_CONSENT" };
      }

      // Return only condition-level summaries — no rsids, no raw variants
      return {
        processingStatus: patientGenetics.processingStatus,
        conditions: (patientGenetics.prsScores as Array<{condition: string; percentile: number; level: string}> | null)?.map(({ condition, percentile, level }) => ({
          condition,
          percentile,
          level,
        })) ?? [],
        pharmacogenomicsAlerts: patientGenetics.pharmacogenomics as Array<{drug: string; interaction: string}> | null ?? [],
        relevantConditions: patientGenetics.twinRelevantConditions,
      };
    },
    {
      params: t.Object({ patientId: t.String() }),
      detail: { tags: ["sdk"], summary: "[SDK] Get patient genetic risk profile (condition-level only)" },
    }
  )

  // ── Patient Risk Scores ──────────────────────────────────────────────────────
  .get(
    "/patients/:patientId/risk",
    async ({ db, params, scopes, set, orgId }) => {
      if (!scopes.includes("vhi:read") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: vhi:read required");
      }
      await assertPatientInRoster(db, orgId, params.patientId);

      const [patientVhi] = await db
        .select({ data: vhi.data, computedAt: vhi.computedAt })
        .from(vhi)
        .where(eq(vhi.userId, params.patientId))
        .limit(1);

      if (!patientVhi) {
        set.status = 404;
        return { error: "VHI not found for patient" };
      }

      const riskScores = patientVhi.data?.currentState?.riskScores;
      return {
        computedAt: patientVhi.computedAt,
        compositeRisk: riskScores?.compositeRisk ?? null,
        fallRisk: riskScores?.fallRisk?.score ?? null,
        adherenceRisk: riskScores?.adherenceRisk?.score ?? null,
        deteriorationRisk: riskScores?.deteriorationRisk?.score ?? null,
        riskLevel:
          (riskScores?.compositeRisk ?? 0) >= 75
            ? "high"
            : (riskScores?.compositeRisk ?? 0) >= 50
              ? "moderate"
              : "low",
        drivers: {
          fall: riskScores?.fallRisk?.drivers ?? [],
          adherence: riskScores?.adherenceRisk?.drivers ?? [],
          deterioration: riskScores?.deteriorationRisk?.drivers ?? [],
        },
      };
    },
    {
      params: t.Object({ patientId: t.String() }),
      detail: { tags: ["sdk"], summary: "[SDK] Get patient risk scores" },
    }
  )

  // ── Patient Health Timeline ───────────────────────────────────────────────────
  .get(
    "/patients/:patientId/timeline",
    async ({ db, params, query, scopes, set, orgId }) => {
      if (!scopes.includes("timeline:read") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: timeline:read required");
      }
      await assertPatientInRoster(db, orgId, params.patientId);

      let q = db
        .select({
          id: healthTimeline.id,
          occurredAt: healthTimeline.occurredAt,
          source: healthTimeline.source,
          domain: healthTimeline.domain,
          value: healthTimeline.value,
          unit: healthTimeline.unit,
          zScoreAtIngestion: healthTimeline.zScoreAtIngestion,
        })
        .from(healthTimeline)
        .where(eq(healthTimeline.userId, params.patientId))
        .orderBy(desc(healthTimeline.occurredAt))
        .$dynamic();

      if (query.from) {
        q = q.where(gte(healthTimeline.occurredAt, new Date(query.from))) as typeof q;
      }
      if (query.to) {
        q = q.where(lte(healthTimeline.occurredAt, new Date(query.to))) as typeof q;
      }
      if (query.domain) {
        q = q.where(eq(healthTimeline.domain, query.domain)) as typeof q;
      }

      const events = await q.limit(query.limit ?? 100);
      return { events, count: events.length };
    },
    {
      params: t.Object({ patientId: t.String() }),
      query: t.Object({
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        domain: t.Optional(t.String()),
        limit: t.Optional(t.Number({ maximum: 500 })),
      }),
      detail: { tags: ["sdk"], summary: "[SDK] Get patient health timeline" },
    }
  )

  // ── Patient Active Alerts ─────────────────────────────────────────────────────
  .get(
    "/patients/:patientId/alerts",
    async ({ db, params, query, scopes, set, orgId }) => {
      if (!scopes.includes("alerts:read") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: alerts:read required");
      }
      await assertPatientInRoster(db, orgId, params.patientId);

      let q = db
        .select({
          id: alerts.id,
          type: alerts.type,
          severity: alerts.severity,
          title: alerts.title,
          body: alerts.body,
          isAcknowledged: alerts.isAcknowledged,
          resolvedAt: alerts.resolvedAt,
          createdAt: alerts.createdAt,
        })
        .from(alerts)
        .where(eq(alerts.userId, params.patientId))
        .orderBy(desc(alerts.createdAt))
        .$dynamic();

      // Optionally filter to only unacknowledged (active) alerts
      if (query.activeOnly) {
        q = q.where(eq(alerts.isAcknowledged, false)) as typeof q;
      }

      const results = await q.limit(query.limit ?? 50);
      return { alerts: results, count: results.length };
    },
    {
      params: t.Object({ patientId: t.String() }),
      query: t.Object({
        activeOnly: t.Optional(t.Boolean()),
        limit: t.Optional(t.Number({ maximum: 200 })),
      }),
      detail: { tags: ["sdk"], summary: "[SDK] Get patient alerts" },
    }
  )

  // ── Patient AI Health Insights ───────────────────────────────────────────────
  .get(
    "/patients/:patientId/insights",
    async ({ db, params, scopes, set, orgId }) => {
      if (!scopes.includes("vhi:read") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: vhi:read required");
      }
      await assertPatientInRoster(db, orgId, params.patientId);

      const [patientVhi] = await db
        .select({ data: vhi.data, computedAt: vhi.computedAt })
        .from(vhi)
        .where(eq(vhi.userId, params.patientId))
        .limit(1);

      if (!patientVhi) {
        set.status = 404;
        return { error: "No VHI found for patient" };
      }

      // Surface the top elevating and declining factors as pre-formatted insights
      const elevating = (patientVhi.data?.elevatingFactors ?? []).slice(0, 5).map((f) => ({
        type: "elevating" as const,
        factor: f.factor,
        category: f.category,
        impact: f.impact,
        explanation: f.explanation,
      }));

      const declining = (patientVhi.data?.decliningFactors ?? []).slice(0, 5).map((f) => ({
        type: "declining" as const,
        factor: f.factor,
        category: f.category,
        impact: f.impact,
        explanation: f.explanation,
        recommendation: f.recommendation,
      }));

      return {
        computedAt: patientVhi.computedAt,
        overallScore: patientVhi.data?.currentState?.overallScore,
        insights: [...declining, ...elevating],
        pendingActions: (patientVhi.data?.pendingActions ?? []).filter((a) => !a.acknowledged),
      };
    },
    {
      params: t.Object({ patientId: t.String() }),
      detail: { tags: ["sdk"], summary: "[SDK] Get AI-generated patient health insights" },
    }
  )

  // ── FHIR R4 Bundle Export ────────────────────────────────────────────────────

  /**
   * GET /sdk/v1/patients/:patientId/fhir/Bundle
   *
   * Export a patient's health record as a FHIR R4 Bundle (type = collection).
   *
   * The bundle contains:
   *   • Patient resource (demographics)
   *   • Observation resources (last 90 days of vitals, mapped to LOINC codes)
   *   • MedicationRequest resources (active medications only)
   *
   * No raw genetic variants, clinical note text, or rsids are included.
   * Requires scope: `timeline:read`
   */
  .get(
    "/patients/:patientId/fhir/Bundle",
    async ({ db, params, scopes, set, orgId, request }) => {
      if (!scopes.includes("timeline:read") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: timeline:read required");
      }
      await assertPatientInRoster(db, orgId, params.patientId);

      // 1. Patient demographics
      const [userRow] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          dateOfBirth: users.dateOfBirth,
          gender: users.gender,
        })
        .from(users)
        .where(eq(users.id, params.patientId))
        .limit(1);

      if (!userRow) {
        set.status = 404;
        return { error: "Patient not found" };
      }

      // 2. Last 90 days of vitals
      const since = new Date(Date.now() - 90 * 24 * 3600_000);
      const vitalRows = await db
        .select({
          id: vitals.id,
          type: vitals.type,
          value: vitals.value,
          valueSecondary: vitals.valueSecondary,
          unit: vitals.unit,
          recordedAt: vitals.recordedAt,
        })
        .from(vitals)
        .where(and(eq(vitals.userId, params.patientId), gte(vitals.recordedAt, since)))
        .orderBy(desc(vitals.recordedAt))
        .limit(500);

      // 3. Active medications
      const medRows = await db
        .select({
          id: medications.id,
          name: medications.name,
          dosage: medications.dosage,
          frequency: medications.frequency,
          isActive: medications.isActive,
          startDate: medications.startDate,
          instructions: medications.instructions,
        })
        .from(medications)
        .where(and(eq(medications.userId, params.patientId), eq(medications.isActive, true)));

      // 4. Assemble FHIR R4 Bundle
      const baseUrl = new URL(request.url).origin;
      const patient = userToFhirPatient(userRow);
      const observations = vitalRows.map((v) => vitalToFhirObservation(v, params.patientId));
      const medRequests = medRows.map((m) =>
        medicationToFhirMedicationRequest(m, params.patientId)
      );

      return buildFhirBundle(patient, observations, medRequests, baseUrl);
    },
    {
      params: t.Object({ patientId: t.String() }),
      detail: {
        tags: ["sdk"],
        summary: "[SDK] Export patient data as FHIR R4 Bundle",
        description:
          "Returns a FHIR R4 Bundle (type=collection) containing Patient demographics, " +
          "Observation resources for the last 90 days of vitals (LOINC-coded), " +
          "and MedicationRequest resources for active medications.",
      },
    }
  )

  // ── Webhook Registration ─────────────────────────────────────────────────────
  .post(
    "/webhooks",
    async ({ db, orgId, body, scopes, set }) => {
      if (!scopes.includes("webhook:write") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: webhook:write required");
      }
      const id = crypto.randomUUID();
      const secret = crypto.randomBytes(32).toString("hex");

      const [webhook] = await db
        .insert(webhookEndpoints)
        .values({ id, orgId, url: body.url, events: body.events, secret, isActive: true })
        .returning();

      return {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        // Return secret once — store it, it won't be shown again
        secret,
        message: "Store the secret. It will not be shown again. Use it to verify webhook signatures.",
      };
    },
    {
      body: t.Object({
        url: t.String(),
        events: t.Array(t.String()),
      }),
      detail: { tags: ["sdk"], summary: "[SDK] Register a webhook endpoint" },
    }
  )

  .delete(
    "/webhooks/:webhookId",
    async ({ db, orgId, params, set, scopes }) => {
      if (!scopes.includes("webhook:write") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: webhook:write required");
      }
      // Verify the webhook belongs to this org before deactivating
      const [existing] = await db
        .select({ id: webhookEndpoints.id, orgId: webhookEndpoints.orgId })
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, params.webhookId))
        .limit(1);

      if (!existing || existing.orgId !== orgId) {
        set.status = 404;
        return { error: "Webhook not found" };
      }

      await db
        .update(webhookEndpoints)
        .set({ isActive: false })
        .where(eq(webhookEndpoints.id, params.webhookId));
      return { ok: true };
    },
    {
      params: t.Object({ webhookId: t.String() }),
      detail: { tags: ["sdk"], summary: "[SDK] Remove a webhook endpoint" },
    }
  )

  // ── API Key Management ───────────────────────────────────────────────────────

  /**
   * Create a new API key for the caller's organisation.
   * The raw key is returned once — store it securely.
   * Requires scope: key:manage or *
   */
  .post(
    "/keys",
    async ({ db, orgId, body, scopes, set }) => {
      if (!scopes.includes("key:manage") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: key:manage required");
      }
      const rawKey = `nk_${crypto.randomBytes(32).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      const keyPrefix = rawKey.slice(0, 12) + "...";
      const id = crypto.randomUUID();

      const [created] = await db
        .insert(apiKeys)
        .values({
          id,
          orgId,
          keyHash,
          keyPrefix,
          name: body.name,
          scopes: body.scopes,
          isActive: true,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          scopes: apiKeys.scopes,
          keyPrefix: apiKeys.keyPrefix,
          createdAt: apiKeys.createdAt,
        });

      return {
        id: created.id,
        name: created.name,
        scopes: created.scopes,
        keyPrefix: created.keyPrefix,
        createdAt: created.createdAt,
        // Raw key returned ONCE — never stored in plain text
        key: rawKey,
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        scopes: t.Array(t.String(), { minItems: 1 }),
      }),
      detail: { tags: ["sdk"], summary: "[SDK] Create a new API key" },
    }
  )

  /**
   * List all active API keys for the caller's organisation.
   * Raw key values are never returned here.
   * Requires scope: key:manage or *
   */
  .get(
    "/keys",
    async ({ db, orgId, scopes, set }) => {
      if (!scopes.includes("key:manage") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: key:manage required");
      }
      const keys = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          scopes: apiKeys.scopes,
          keyPrefix: apiKeys.keyPrefix,
          isActive: apiKeys.isActive,
          lastUsedAt: apiKeys.lastUsedAt,
          createdAt: apiKeys.createdAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.orgId, orgId));

      return keys;
    },
    {
      detail: { tags: ["sdk"], summary: "[SDK] List all API keys for this org" },
    }
  )

  /**
   * Revoke an API key immediately. The key will be rejected on next use.
   * Requires scope: key:manage or *
   */
  .delete(
    "/keys/:keyId",
    async ({ db, orgId, params, set, scopes }) => {
      if (!scopes.includes("key:manage") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: key:manage required");
      }
      const [existing] = await db
        .select({ id: apiKeys.id, orgId: apiKeys.orgId })
        .from(apiKeys)
        .where(eq(apiKeys.id, params.keyId))
        .limit(1);

      if (!existing || existing.orgId !== orgId) {
        set.status = 404;
        throw new Error("API key not found");
      }

      await db
        .update(apiKeys)
        .set({ isActive: false })
        .where(eq(apiKeys.id, params.keyId));

      return { ok: true };
    },
    {
      params: t.Object({ keyId: t.String() }),
      detail: { tags: ["sdk"], summary: "[SDK] Revoke an API key" },
    }
  )

  // ── Cohort management ─────────────────────────────────────────────────────

  /**
   * GET /sdk/v1/cohorts
   * List all cohorts for the caller's organisation, with live patient counts.
   * Requires scope: roster:read or *
   */
  .get(
    "/cohorts",
    async ({ db, orgId, scopes, set }) => {
      if (!scopes.includes("roster:read") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: roster:read required");
      }

      const rows = await db
        .select()
        .from(cohorts)
        .where(eq(cohorts.orgId, orgId))
        .orderBy(cohorts.name);

      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);
      const memberCounts = await db
        .select({ cohortId: cohortMembers.cohortId, n: count(cohortMembers.id) })
        .from(cohortMembers)
        .where(inArray(cohortMembers.cohortId, ids))
        .groupBy(cohortMembers.cohortId);

      const countMap: Record<string, number> = {};
      for (const c of memberCounts) countMap[c.cohortId] = Number(c.n);

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        condition: r.condition,
        program: r.program,
        createdAt: r.createdAt,
        patientCount: countMap[r.id] ?? 0,
      }));
    },
    {
      detail: { tags: ["sdk"], summary: "[SDK] List org cohorts with patient counts" },
    }
  )

  /**
   * GET /sdk/v1/cohorts/:cohortId/members
   * List all patients enrolled in a specific cohort.
   * Requires scope: roster:read or *
   */
  .get(
    "/cohorts/:cohortId/members",
    async ({ db, orgId, params, scopes, set }) => {
      if (!scopes.includes("roster:read") && !scopes.includes("*")) {
        set.status = 403;
        throw new Error("Insufficient scope: roster:read required");
      }

      // Verify cohort belongs to this org
      const [cohort] = await db
        .select({ id: cohorts.id, name: cohorts.name })
        .from(cohorts)
        .where(and(eq(cohorts.id, params.cohortId), eq(cohorts.orgId, orgId)))
        .limit(1);

      if (!cohort) {
        set.status = 404;
        throw new Error("Cohort not found");
      }

      const members = await db
        .select({
          userId: cohortMembers.userId,
          enrolledAt: cohortMembers.enrolledAt,
        })
        .from(cohortMembers)
        .where(eq(cohortMembers.cohortId, params.cohortId))
        .orderBy(cohortMembers.enrolledAt);

      return {
        cohortId: cohort.id,
        cohortName: cohort.name,
        members,
        count: members.length,
      };
    },
    {
      params: t.Object({ cohortId: t.String() }),
      detail: { tags: ["sdk"], summary: "[SDK] List patients in a cohort" },
    }
  )

  // ── Real-time Patient Subscription (WebSocket) ────────────────────────────
  /**
   * WebSocket endpoint for real-time patient health events.
   *
   * Browser WebSocket clients cannot set custom `Authorization` headers, so the
   * API key is passed as the `?key=nk_...` query parameter instead.
   *
   * On connect the server validates the key, checks the patient is on the org's
   * active roster, and then delivers every event broadcast to that patient's
   * health channel:
   *
   *   { event: "vhi.updated",       data: {...}, timestamp: "..." }
   *   { event: "alert.triggered",   data: {...}, timestamp: "..." }
   *   { event: "medication.missed", data: {...}, timestamp: "..." }
   *   { event: "genetics.processed",data: {...}, timestamp: "..." }
   *
   * Requires scope: `vhi:read`
   *
   * Send "ping" to receive "pong" (keep-alive).
   *
   * @see NurulixClient.subscribe() in the @nuralix/sdk package
   */
  .ws("/patients/:patientId/subscribe", {
    query: t.Object({ key: t.String() }),
    async open(ws) {
      const patientId = ws.data.params.patientId;
      const apiKey = ws.data.query.key;

      // API key must start with the "nk_" prefix
      if (!apiKey.startsWith("nk_")) {
        ws.close(1008, "Invalid API key format");
        return;
      }

      // Hash and look up the key in the database
      const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
      const [keyRow] = await dbInstance
        .select({
          id: apiKeys.id,
          orgId: apiKeys.orgId,
          scopes: apiKeys.scopes,
          isActive: apiKeys.isActive,
        })
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1);

      if (!keyRow || !keyRow.isActive) {
        ws.close(1008, "Invalid or inactive API key");
        return;
      }

      // Require vhi:read scope (or wildcard *)
      if (!keyRow.scopes?.includes("vhi:read") && !keyRow.scopes?.includes("*")) {
        ws.close(1008, "Insufficient scope: vhi:read required");
        return;
      }

      // Patient must be on the org's active roster
      const [rosterRow] = await dbInstance
        .select({ id: patientRosters.id })
        .from(patientRosters)
        .where(
          and(
            eq(patientRosters.orgId, keyRow.orgId),
            eq(patientRosters.userId, patientId),
            eq(patientRosters.status, "active")
          )
        )
        .limit(1);

      if (!rosterRow) {
        ws.close(1008, "Patient not found in your organisation's roster");
        return;
      }

      // Register in the shared real-time subscriber map so all broadcasters
      // (vhiCycle, alertsRoute, dnaParsingJob, etc.) reach this WS client.
      const send = (msg: unknown) => ws.send(msg as string);
      subscribeToUser(patientId, send);
      (ws.data as Record<string, unknown>).__send = send;

      // Bump lastUsedAt non-blocking
      dbInstance
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, keyRow.id))
        .catch(console.error);

      ws.send(
        JSON.stringify({
          event: "connected",
          patientId,
          timestamp: new Date().toISOString(),
        })
      );
    },
    close(ws) {
      const patientId = ws.data.params.patientId;
      const send = (ws.data as Record<string, unknown>).__send as
        | ((d: unknown) => void)
        | undefined;
      if (send) unsubscribeFromUser(patientId, send);
    },
    message(ws, message) {
      // Simple keep-alive
      if (message === "ping") ws.send("pong");
    },
  });
