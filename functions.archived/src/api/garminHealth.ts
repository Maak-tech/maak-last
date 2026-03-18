/**
 * Garmin Connect Developer Program - Health API (Push integration)
 *
 * Implements:
 * - OAuth2 authorization code exchange (server-side)
 * - Push webhooks for summary data + user endpoints notifications
 *
 * Notes from Garmin guides:
 * - Server-to-server only (no client secret in mobile/web bundles).
 * - Webhooks must respond with HTTP 200 quickly; do not block on heavy work.
 */

import { Timestamp } from "firebase-admin/firestore";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { getDb, getVitalsCollection } from "../db/collections";
import {
  createVitalReading,
  type VitalInput,
  validateVitalInput,
} from "../modules/vitals/ingest";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";
import {
  GARMIN_CLIENT_ID,
  GARMIN_CLIENT_SECRET,
  GARMIN_OAUTH_AUTH_URL,
  GARMIN_OAUTH_SCOPE,
  GARMIN_OAUTH_TOKEN_URL,
  GARMIN_REDIRECT_URI,
  getSecretValue,
} from "../secrets";

type GarminTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  [key: string]: unknown;
};

type GarminUserIdResponse = {
  userId?: string;
};

type GarminOAuthStateDoc = {
  uid?: string;
  selectedMetrics?: string[];
  expiresAt?: Timestamp;
  usedAt?: Timestamp | null;
};

const GARMIN_API_BASE = "https://apis.garmin.com";
const GARMIN_USER_ID_URL = `${GARMIN_API_BASE}/wellness-api/rest/user/id`;

const STATE_TTL_MS = 15 * 60 * 1000;

function requireString(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required config: ${name}`);
  }
  return value;
}

function getGarminConfig(): {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  redirectUri: string;
} {
  const clientId = requireString(
    "GARMIN_CLIENT_ID",
    getSecretValue(GARMIN_CLIENT_ID)
  );
  const clientSecret = requireString(
    "GARMIN_CLIENT_SECRET",
    getSecretValue(GARMIN_CLIENT_SECRET)
  );
  const authUrl = requireString(
    "GARMIN_OAUTH_AUTH_URL",
    getSecretValue(GARMIN_OAUTH_AUTH_URL)
  );
  const tokenUrl = requireString(
    "GARMIN_OAUTH_TOKEN_URL",
    getSecretValue(GARMIN_OAUTH_TOKEN_URL)
  );
  const redirectUri = requireString(
    "GARMIN_REDIRECT_URI",
    getSecretValue(GARMIN_REDIRECT_URI)
  );

  const scope =
    getSecretValue(GARMIN_OAUTH_SCOPE) ||
    process.env.GARMIN_OAUTH_SCOPE ||
    "HEALTH_EXPORT";

  return { clientId, clientSecret, authUrl, tokenUrl, scope, redirectUri };
}

function buildAuthorizationUrl(params: {
  authUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
}): string {
  const url = new URL(params.authUrl);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scope);
  url.searchParams.set("state", params.state);
  return url.toString();
}

async function fetchGarminUserId(accessToken: string): Promise<string> {
  const response = await fetch(GARMIN_USER_ID_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to fetch Garmin userId (${response.status}): ${body}`
    );
  }

  const data = (await response.json()) as GarminUserIdResponse;
  if (!data.userId) {
    throw new Error("Garmin userId response missing userId");
  }
  return data.userId;
}

async function exchangeAuthorizationCode(params: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<
  Required<Pick<GarminTokenResponse, "access_token">> & GarminTokenResponse
> {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", params.code);
  body.set("client_id", params.clientId);
  body.set("client_secret", params.clientSecret);
  body.set("redirect_uri", params.redirectUri);

  const response = await fetch(params.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const json = (await response.json().catch(() => ({}))) as GarminTokenResponse;
  if (!response.ok) {
    throw new Error(
      `Garmin token exchange failed (${response.status}): ${JSON.stringify(json)}`
    );
  }

  if (!json.access_token) {
    throw new Error("Garmin token exchange response missing access_token");
  }

  return json as Required<Pick<GarminTokenResponse, "access_token">> &
    GarminTokenResponse;
}

async function loadAndValidateGarminOAuthState(params: {
  stateRef: FirebaseFirestore.DocumentReference;
  uid: string;
}): Promise<{ selectedMetrics: string[] }> {
  const { stateRef, uid } = params;
  const stateSnap = await stateRef.get();

  if (!stateSnap.exists) {
    throw new Error("Invalid state");
  }

  const stateData = stateSnap.data() as GarminOAuthStateDoc;

  if (stateData.uid !== uid) {
    throw new Error("State does not match user");
  }

  if (stateData.usedAt) {
    throw new Error("State already used");
  }

  const expiresAtMillis = stateData.expiresAt?.toMillis?.() ?? 0;
  if (expiresAtMillis && Date.now() > expiresAtMillis) {
    throw new Error("State expired");
  }

  return {
    selectedMetrics: Array.isArray(stateData.selectedMetrics)
      ? stateData.selectedMetrics.filter(
          (v): v is string => typeof v === "string"
        )
      : [],
  };
}

export const garminCreateAuthUrl = onCall(
  {
    secrets: [
      GARMIN_CLIENT_ID,
      GARMIN_CLIENT_SECRET,
      GARMIN_OAUTH_AUTH_URL,
      GARMIN_OAUTH_TOKEN_URL,
      GARMIN_OAUTH_SCOPE,
      GARMIN_REDIRECT_URI,
    ],
  },
  async (request) => {
    const traceId = createTraceId();
    const uid = request.auth?.uid;
    if (!uid) {
      throw new Error("Unauthenticated");
    }

    const selectedMetrics = Array.isArray(request.data?.selectedMetrics)
      ? (request.data.selectedMetrics as unknown[]).filter(
          (v): v is string => typeof v === "string"
        )
      : [];

    const config = getGarminConfig();

    const db = getDb();
    const stateRef = db.collection("garminOAuthStates").doc();
    const now = Date.now();
    await stateRef.set({
      uid,
      selectedMetrics,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(now + STATE_TTL_MS),
      usedAt: null,
    });

    const url = buildAuthorizationUrl({
      authUrl: config.authUrl,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scope: config.scope,
      state: stateRef.id,
    });

    logger.info("Created Garmin auth URL", {
      traceId,
      uid,
      fn: "garminCreateAuthUrl",
    });

    return {
      url,
      redirectUri: config.redirectUri,
      state: stateRef.id,
      scope: config.scope,
    };
  }
);

export const garminExchangeAuthCode = onCall(
  {
    secrets: [
      GARMIN_CLIENT_ID,
      GARMIN_CLIENT_SECRET,
      GARMIN_OAUTH_AUTH_URL,
      GARMIN_OAUTH_TOKEN_URL,
      GARMIN_OAUTH_SCOPE,
      GARMIN_REDIRECT_URI,
    ],
  },
  async (request) => {
    const traceId = createTraceId();
    const uid = request.auth?.uid;
    if (!uid) {
      throw new Error("Unauthenticated");
    }

    const code =
      typeof request.data?.code === "string" ? request.data.code : "";
    const state =
      typeof request.data?.state === "string" ? request.data.state : "";
    if (!(code && state)) {
      throw new Error("Missing code or state");
    }

    const config = getGarminConfig();
    const db = getDb();
    const stateRef = db.collection("garminOAuthStates").doc(state);
    const { selectedMetrics } = await loadAndValidateGarminOAuthState({
      stateRef,
      uid,
    });

    const tokenJson = await exchangeAuthorizationCode({
      tokenUrl: config.tokenUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      code,
    });

    const accessToken = tokenJson.access_token;
    const refreshToken =
      typeof tokenJson.refresh_token === "string"
        ? tokenJson.refresh_token
        : null;
    const expiresAt =
      typeof tokenJson.expires_in === "number"
        ? Date.now() + tokenJson.expires_in * 1000
        : null;

    const garminUserId = await fetchGarminUserId(accessToken);

    await db
      .collection("garminConnections")
      .doc(uid)
      .set(
        {
          uid,
          garminUserId,
          accessToken,
          refreshToken,
          tokenType: tokenJson.token_type ?? "Bearer",
          scopeGranted: tokenJson.scope ?? config.scope,
          expiresAt,
          selectedMetrics,
          connectedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );

    await db.collection("garminUserIndex").doc(garminUserId).set(
      {
        uid,
        garminUserId,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    await stateRef.set({ usedAt: Timestamp.now() }, { merge: true });

    logger.info("Garmin OAuth exchange complete", {
      traceId,
      uid,
      garminUserId,
      fn: "garminExchangeAuthCode",
    });

    return { connected: true, garminUserId, selectedMetrics };
  }
);

export const garminDisconnect = onCall(
  {
    secrets: [GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET],
  },
  async (request) => {
    const traceId = createTraceId();
    const uid = request.auth?.uid;
    if (!uid) {
      throw new Error("Unauthenticated");
    }

    const db = getDb();
    const connRef = db.collection("garminConnections").doc(uid);
    const connSnap = await connRef.get();
    if (!connSnap.exists) {
      return { disconnected: true };
    }
    const conn = connSnap.data() as {
      accessToken?: string;
      garminUserId?: string;
    };
    const accessToken =
      typeof conn.accessToken === "string" ? conn.accessToken : null;
    const garminUserId =
      typeof conn.garminUserId === "string" ? conn.garminUserId : null;

    if (accessToken) {
      const response = await fetch(
        `${GARMIN_API_BASE}/wellness-api/rest/user/registration`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!(response.ok || response.status === 204)) {
        const body = await response.text();
        throw new Error(
          `Garmin deregistration failed (${response.status}): ${body}`
        );
      }
    }

    await connRef.delete();
    if (garminUserId) {
      await db.collection("garminUserIndex").doc(garminUserId).delete();
    }

    logger.info("Garmin disconnected", {
      traceId,
      uid,
      garminUserId,
      fn: "garminDisconnect",
    });

    return { disconnected: true };
  }
);

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toIsoDateFromRecord(record: Record<string, unknown>): string {
  const candidates: unknown[] = [
    record.timestampInSeconds,
    record.startTimeInSeconds,
    record.endTimeInSeconds,
    record.calendarDate,
    record.startTimeLocal,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      // Heuristic: treat as seconds if it looks like a unix timestamp (10 digits-ish)
      const ms = candidate > 10_000_000_000 ? candidate : candidate * 1000;
      return new Date(ms).toISOString();
    }
    if (typeof candidate === "string" && candidate.trim() !== "") {
      const d = new Date(candidate);
      if (!Number.isNaN(d.getTime())) {
        return d.toISOString();
      }
    }
  }

  return new Date().toISOString();
}

function extractHeartRateSamples(params: {
  uid: string;
  record: Record<string, unknown>;
  defaultTimestamp: Date;
}): VitalInput[] {
  const { uid, record, defaultTimestamp } = params;
  const samples: VitalInput[] = [];

  const heartRateValues = Array.isArray(record.heartRateValues)
    ? (record.heartRateValues as unknown[])
    : null;

  if (!heartRateValues) {
    return samples;
  }

  for (const item of heartRateValues) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const hr = item as Record<string, unknown>;
    const value = coerceNumber(hr.heartRate) ?? coerceNumber(hr.value) ?? null;
    const ts =
      typeof hr.timestampInSeconds === "number"
        ? new Date(hr.timestampInSeconds * 1000)
        : defaultTimestamp;

    if (value === null) {
      continue;
    }

    samples.push({
      userId: uid,
      type: "heartRate",
      value,
      unit: "bpm",
      source: "garmin",
      timestamp: ts,
    });
  }

  return samples;
}

function extractSummaryVitalSamples(params: {
  uid: string;
  record: Record<string, unknown>;
  timestamp: Date;
}): VitalInput[] {
  const { uid, record, timestamp } = params;
  const samples: VitalInput[] = [];

  const pushSample = (
    vital: Omit<VitalInput, "userId" | "source" | "timestamp">
  ) => {
    samples.push({
      userId: uid,
      source: "garmin",
      timestamp,
      ...vital,
    });
  };

  const averageHeartRate =
    coerceNumber(record.averageHeartRate) ??
    coerceNumber(record.heartRate) ??
    coerceNumber(record.value);
  if (averageHeartRate !== null) {
    pushSample({ type: "heartRate", value: averageHeartRate, unit: "bpm" });
  }

  const restingHeartRate = coerceNumber(record.restingHeartRate);
  if (restingHeartRate !== null) {
    pushSample({
      type: "restingHeartRate",
      value: restingHeartRate,
      unit: "bpm",
    });
  }

  const hrv =
    coerceNumber(record.hrvValue) ??
    coerceNumber(record.weeklyAvg) ??
    coerceNumber(record.lastNightAvg);
  if (hrv !== null) {
    pushSample({ type: "heartRateVariability", value: hrv, unit: "ms" });
  }

  const spo2 =
    coerceNumber(record.averageSpO2) ??
    coerceNumber(record.spo2Value) ??
    coerceNumber(record.value);
  if (spo2 !== null) {
    pushSample({ type: "oxygenSaturation", value: spo2, unit: "%" });
  }

  const respiration =
    coerceNumber(record.avgWakingRespirationValue) ??
    coerceNumber(record.avgSleepingRespirationValue) ??
    coerceNumber(record.value);
  if (respiration !== null) {
    pushSample({
      type: "respiratoryRate",
      value: respiration,
      unit: "breaths/min",
    });
  }

  const weightInGrams = coerceNumber(record.weightInGrams);
  const weightKg =
    coerceNumber(record.weight) ??
    (weightInGrams !== null ? weightInGrams / 1000 : null);
  if (weightKg !== null) {
    pushSample({ type: "weight", value: weightKg, unit: "kg" });
  }

  return samples;
}

function extractVitalsFromGarminRecord(params: {
  uid: string;
  record: Record<string, unknown>;
}): VitalInput[] {
  const { uid, record } = params;
  const timestamp = new Date(toIsoDateFromRecord(record));
  return [
    ...extractHeartRateSamples({ uid, record, defaultTimestamp: timestamp }),
    ...extractSummaryVitalSamples({ uid, record, timestamp }),
  ];
}

function tryGetUserId(record: unknown): string | null {
  if (!record || typeof record !== "object") {
    return null;
  }
  const r = record as Record<string, unknown>;
  const userId = r.userId;
  return typeof userId === "string" && userId.trim() !== "" ? userId : null;
}

async function processGarminWebhookRecord(params: {
  traceId: string;
  type: string;
  garminUserId: string;
  receivedAt: Timestamp;
  recordUnknown: unknown;
  db: ReturnType<typeof getDb>;
  vitalsCollection: ReturnType<typeof getVitalsCollection>;
}): Promise<void> {
  const {
    traceId,
    type,
    garminUserId,
    receivedAt,
    recordUnknown,
    db,
    vitalsCollection,
  } = params;

  const indexSnap = await db
    .collection("garminUserIndex")
    .doc(garminUserId)
    .get();
  const uid = (indexSnap.data() as { uid?: string } | undefined)?.uid || null;

  const rawRef = db.collection("garminWebhookEvents").doc();
  await rawRef.set({
    traceId,
    type,
    garminUserId,
    uid,
    receivedAt,
    payload: recordUnknown,
  });

  if (!uid) {
    return;
  }

  if (!recordUnknown || typeof recordUnknown !== "object") {
    return;
  }

  const vitals = extractVitalsFromGarminRecord({
    uid,
    record: recordUnknown as Record<string, unknown>,
  });

  for (const vital of vitals) {
    const validation = validateVitalInput(vital);
    if (!validation.isValid) {
      continue;
    }
    const reading = createVitalReading(vital);
    await vitalsCollection.add({
      ...reading,
      timestamp: reading.timestamp,
      createdAt: Timestamp.now(),
    });
  }
}

export const garminPushWebhook = onRequest(
  {
    secrets: [GARMIN_CLIENT_ID],
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    const traceId = createTraceId();

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const expectedClientId = getSecretValue(GARMIN_CLIENT_ID);
    const headerClientIdRaw = req.header("garmin-client-id");
    if (
      expectedClientId &&
      headerClientIdRaw &&
      headerClientIdRaw !== expectedClientId
    ) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const payload =
      typeof req.body === "string"
        ? (JSON.parse(req.body) as unknown)
        : (req.body as unknown);

    if (!payload || typeof payload !== "object") {
      res.status(400).json({ ok: false, error: "Invalid JSON body" });
      return;
    }

    const db = getDb();
    const vitalsCollection = getVitalsCollection();

    const body = payload as Record<string, unknown>;
    const keys = Object.keys(body);

    const receivedAt = Timestamp.now();
    const processed: Array<{ key: string; count: number }> = [];

    // Best-effort processing: store raw + extract key vitals
    const writes: Promise<unknown>[] = [];

    for (const key of keys) {
      const value = body[key];
      if (!Array.isArray(value)) {
        continue;
      }

      processed.push({ key, count: value.length });

      for (const recordUnknown of value) {
        const garminUserId = tryGetUserId(recordUnknown);
        if (!garminUserId) {
          continue;
        }

        writes.push(
          processGarminWebhookRecord({
            traceId,
            type: key,
            garminUserId,
            receivedAt,
            recordUnknown,
            db,
            vitalsCollection,
          })
        );
      }
    }

    try {
      // Keep processing bounded; webhook must return quickly.
      await Promise.allSettled(writes);
      res.status(200).json({ ok: true, processed });
    } catch (error: unknown) {
      logger.error("Garmin push webhook processing failed", error as Error, {
        traceId,
        fn: "garminPushWebhook",
      });
      // Still return 200 to avoid repeated retries storms; raw events may be partial.
      res.status(200).json({ ok: true, processed, warning: "partial_failure" });
    }
  }
);
