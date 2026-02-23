/**
 * Maak Public REST API
 *
 * Authenticated via API key (see middleware/apiAuth.ts).
 * All patient-level data access requires:
 *   1. Patient enrolled in the org's patient roster
 *   2. Active patient consent for the org
 *
 * Routes:
 *   GET  /v1/patients/:patientId/vitals?from=&to=&type=
 *   GET  /v1/patients/:patientId/anomalies?days=&severity=
 *   GET  /v1/patients/:patientId/risk-score
 *   GET  /v1/patients/:patientId/medications?status=
 *   GET  /v1/cohorts/:cohortId/summary
 *   GET  /v1/org/:orgId/alerts?unacknowledged=true
 *   POST /v1/patients/:patientId/vitals
 */

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import type { Response } from "firebase-functions/v1";
import {
  authenticateApiKey,
  assertScope,
  type ApiRequest,
} from "../middleware/apiAuth";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";

const db = () => getFirestore();

// ─── Route Parsing ─────────────────────────────────────────────────────────────

type ParsedRoute =
  | { route: "patient_vitals"; patientId: string }
  | { route: "patient_anomalies"; patientId: string }
  | { route: "patient_risk_score"; patientId: string }
  | { route: "patient_medications"; patientId: string }
  | { route: "cohort_summary"; cohortId: string }
  | { route: "org_alerts"; orgId: string }
  | null;

function parseRoute(path: string): ParsedRoute {
  // Strip leading slash and split
  const parts = path.replace(/^\//, "").split("/");

  if (parts[0] !== "v1") return null;

  const resource = parts[1];
  const id = parts[2];
  const action = parts[3];

  if (!resource || !id || !action) return null;

  if (resource === "patients") {
    if (action === "vitals") return { route: "patient_vitals", patientId: id };
    if (action === "anomalies") return { route: "patient_anomalies", patientId: id };
    if (action === "risk-score") return { route: "patient_risk_score", patientId: id };
    if (action === "medications") return { route: "patient_medications", patientId: id };
  }

  if (resource === "cohorts" && action === "summary") {
    return { route: "cohort_summary", cohortId: id };
  }

  if (resource === "org" && action === "alerts") {
    return { route: "org_alerts", orgId: id };
  }

  return null;
}

// ─── Access Guard ─────────────────────────────────────────────────────────────

/**
 * Verify patient is enrolled in the org's roster and has active consent.
 * Returns false and sends 403 if the check fails.
 */
async function assertPatientAccess(
  res: Response,
  orgId: string,
  patientId: string
): Promise<boolean> {
  const rosterId = `${orgId}_${patientId}`;

  const [rosterSnap, consentSnap] = await Promise.all([
    db().collection("patient_roster").doc(rosterId).get(),
    db()
      .collection("consents")
      .doc(patientId)
      .collection("organizations")
      .doc(orgId)
      .get(),
  ]);

  if (!rosterSnap.exists || rosterSnap.data()?.status !== "active") {
    res.status(403).json({
      error: "Patient not found in organization roster or not active",
      code: "forbidden",
    });
    return false;
  }

  if (!consentSnap.exists || !consentSnap.data()?.isActive) {
    res.status(403).json({
      error: "Patient has not consented to data access by this organization",
      code: "forbidden",
    });
    return false;
  }

  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a Firestore timestamp-like value to an ISO string. */
function toIso(value: unknown): string {
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

/** Serialize a Firestore document snapshot into a plain JSON-safe object. */
function serializeDoc(
  id: string,
  data: FirebaseFirestore.DocumentData
): Record<string, unknown> {
  const result: Record<string, unknown> = { id };
  for (const [key, val] of Object.entries(data)) {
    if (val && typeof (val as { toDate?: () => Date }).toDate === "function") {
      result[key] = (val as { toDate: () => Date }).toDate().toISOString();
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

async function handleGetVitals(
  req: ApiRequest,
  res: Response,
  patientId: string
): Promise<void> {
  if (!assertScope(req, res, "vitals:read")) return;
  if (!(await assertPatientAccess(res, req.apiAuth!.orgId, patientId))) return;

  const { from, to, type } = req.query as Record<string, string>;

  let ref = db()
    .collection("vitals")
    .where("userId", "==", patientId) as FirebaseFirestore.Query;

  if (type) {
    ref = ref.where("type", "==", type);
  }

  if (from) {
    ref = ref.where("timestamp", ">=", Timestamp.fromDate(new Date(from)));
  }

  if (to) {
    ref = ref.where("timestamp", "<=", Timestamp.fromDate(new Date(to)));
  }

  ref = ref.orderBy("timestamp", "desc").limit(200);

  const snap = await ref.get();
  const vitals = snap.docs.map((d) => serializeDoc(d.id, d.data()));

  res.json({ data: vitals, count: vitals.length });
}

async function handleGetAnomalies(
  req: ApiRequest,
  res: Response,
  patientId: string
): Promise<void> {
  if (!assertScope(req, res, "anomalies:read")) return;
  if (!(await assertPatientAccess(res, req.apiAuth!.orgId, patientId))) return;

  const { days = "7", severity } = req.query as Record<string, string>;
  const daysNum = Math.min(Math.max(parseInt(days, 10) || 7, 1), 90);
  const since = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

  let ref = db()
    .collection("users")
    .doc(patientId)
    .collection("anomalies")
    .where("detectedAt", ">=", Timestamp.fromDate(since)) as FirebaseFirestore.Query;

  if (severity) {
    ref = ref.where("severity", "==", severity);
  }

  ref = ref.orderBy("detectedAt", "desc").limit(100);

  const snap = await ref.get();
  const anomalies = snap.docs.map((d) => serializeDoc(d.id, d.data()));

  res.json({ data: anomalies, count: anomalies.length, days: daysNum });
}

async function handleGetRiskScore(
  req: ApiRequest,
  res: Response,
  patientId: string
): Promise<void> {
  if (!assertScope(req, res, "risk:read")) return;
  if (!(await assertPatientAccess(res, req.apiAuth!.orgId, patientId))) return;

  const rosterId = `${req.apiAuth!.orgId}_${patientId}`;

  // Get risk score from patient roster (set by our population health service)
  const rosterSnap = await db().collection("patient_roster").doc(rosterId).get();
  const rosterData = rosterSnap.data() ?? {};

  // Also fetch recent anomaly count for context
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentAnomaliesSnap = await db()
    .collection("users")
    .doc(patientId)
    .collection("anomalies")
    .where("detectedAt", ">=", Timestamp.fromDate(since))
    .get();

  const criticalCount = recentAnomaliesSnap.docs.filter(
    (d) => d.data().severity === "critical"
  ).length;

  res.json({
    patientId,
    riskScore: (rosterData.riskScore as number) ?? 0,
    riskLevel: (rosterData.riskLevel as string) ?? "normal",
    lastContact: rosterData.lastContact ? toIso(rosterData.lastContact) : null,
    enrolledAt: rosterData.enrolledAt ? toIso(rosterData.enrolledAt) : null,
    recentAnomalies: {
      total: recentAnomaliesSnap.size,
      critical: criticalCount,
      days: 7,
    },
  });
}

async function handleGetMedications(
  req: ApiRequest,
  res: Response,
  patientId: string
): Promise<void> {
  if (!assertScope(req, res, "medications:read")) return;
  if (!(await assertPatientAccess(res, req.apiAuth!.orgId, patientId))) return;

  const { status = "active" } = req.query as Record<string, string>;

  let ref = db()
    .collection("medications")
    .where("userId", "==", patientId) as FirebaseFirestore.Query;

  if (status !== "all") {
    ref = ref.where("status", "==", status);
  }

  ref = ref.orderBy("createdAt", "desc").limit(100);

  const snap = await ref.get();
  const medications = snap.docs.map((d) => serializeDoc(d.id, d.data()));

  res.json({ data: medications, count: medications.length });
}

async function handleGetCohortSummary(
  req: ApiRequest,
  res: Response,
  cohortId: string
): Promise<void> {
  if (!assertScope(req, res, "org:read")) return;

  const orgId = req.apiAuth!.orgId;

  // Verify cohort belongs to this org
  const cohortSnap = await db()
    .collection("organizations")
    .doc(orgId)
    .collection("cohorts")
    .doc(cohortId)
    .get();

  if (!cohortSnap.exists) {
    res.status(404).json({ error: "Cohort not found", code: "not_found" });
    return;
  }

  const cohortData = cohortSnap.data() ?? {};

  // Get all patients in this cohort from the roster
  const rosterSnap = await db()
    .collection("patient_roster")
    .where("orgId", "==", orgId)
    .where("cohortIds", "array-contains", cohortId)
    .where("status", "==", "active")
    .get();

  const totalPatients = rosterSnap.size;

  // Count risk levels
  const riskCounts = { critical: 0, high: 0, elevated: 0, normal: 0 };
  for (const doc of rosterSnap.docs) {
    const level = doc.data().riskLevel as keyof typeof riskCounts | undefined;
    if (level && level in riskCounts) {
      riskCounts[level]++;
    } else {
      riskCounts.normal++;
    }
  }

  res.json({
    cohortId,
    name: cohortData.name,
    description: cohortData.description,
    totalPatients,
    riskDistribution: riskCounts,
    updatedAt: new Date().toISOString(),
  });
}

async function handleGetOrgAlerts(
  req: ApiRequest,
  res: Response,
  targetOrgId: string
): Promise<void> {
  if (!assertScope(req, res, "alerts:read")) return;

  const orgId = req.apiAuth!.orgId;

  // Org can only query their own alerts
  if (targetOrgId !== orgId) {
    res.status(403).json({
      error: "Cannot access alerts for another organization",
      code: "forbidden",
    });
    return;
  }

  const { unacknowledged } = req.query as Record<string, string>;

  // Get all active patient IDs for this org
  const rosterSnap = await db()
    .collection("patient_roster")
    .where("orgId", "==", orgId)
    .where("status", "==", "active")
    .limit(500)
    .get();

  const patientIds = rosterSnap.docs.map((d) => d.data().userId as string);

  if (patientIds.length === 0) {
    res.json({ data: [], count: 0 });
    return;
  }

  // Query alerts in chunks of 30 (Firestore "in" limit)
  const CHUNK_SIZE = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < patientIds.length; i += CHUNK_SIZE) {
    chunks.push(patientIds.slice(i, i + CHUNK_SIZE));
  }

  const alertSnaps = await Promise.all(
    chunks.map((chunk) => {
      let ref = db()
        .collection("alerts")
        .where("userId", "in", chunk) as FirebaseFirestore.Query;

      if (unacknowledged === "true") {
        ref = ref.where("resolved", "==", false);
      }

      return ref.orderBy("timestamp", "desc").limit(100).get();
    })
  );

  const allAlerts = alertSnaps.flatMap((snap) =>
    snap.docs.map((d) => serializeDoc(d.id, d.data()))
  );

  // Sort by timestamp descending and cap at 200
  allAlerts.sort((a, b) => {
    const aTs = typeof a.timestamp === "string" ? a.timestamp : "";
    const bTs = typeof b.timestamp === "string" ? b.timestamp : "";
    return bTs.localeCompare(aTs);
  });

  res.json({ data: allAlerts.slice(0, 200), count: allAlerts.length });
}

async function handlePostVitals(
  req: ApiRequest,
  res: Response,
  patientId: string
): Promise<void> {
  if (!assertScope(req, res, "vitals:write")) return;
  if (!(await assertPatientAccess(res, req.apiAuth!.orgId, patientId))) return;

  const { type, value, unit, systolic, diastolic, source, deviceId, timestamp } =
    req.body as Record<string, unknown>;

  // Basic validation
  if (!type || value === undefined || value === null || !unit) {
    res.status(400).json({
      error: "Missing required fields: type, value, unit",
      code: "bad_request",
    });
    return;
  }

  if (typeof value !== "number") {
    res.status(400).json({
      error: "value must be a number",
      code: "bad_request",
    });
    return;
  }

  const ts = timestamp
    ? Timestamp.fromDate(new Date(timestamp as string))
    : Timestamp.now();

  const vitalData: Record<string, unknown> = {
    userId: patientId,
    type,
    value,
    unit,
    source: source ?? "api",
    deviceId: deviceId ?? null,
    timestamp: ts,
    createdAt: FieldValue.serverTimestamp(),
  };

  if (systolic !== undefined) vitalData.systolic = systolic;
  if (diastolic !== undefined) vitalData.diastolic = diastolic;

  const ref = await db().collection("vitals").add(vitalData);

  res.status(201).json({
    success: true,
    vitalId: ref.id,
    patientId,
    type,
    value,
    unit,
    timestamp: ts.toDate().toISOString(),
  });
}

// ─── Main Cloud Function ──────────────────────────────────────────────────────

/**
 * Maak Public API — single Cloud Function with internal routing.
 *
 * Deploy URL:
 *   https://<region>-<project>.cloudfunctions.net/maakApi/v1/...
 */
export const maakApi = functions.https.onRequest(async (rawReq, res) => {
  const req = rawReq as ApiRequest;
  const traceId = createTraceId();

  // CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key, X-Org-Id"
  );

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  // Authenticate all requests
  const authenticated = await authenticateApiKey(req, res);
  if (!authenticated) return;

  const route = parseRoute(req.path);

  logger.info("Public API request", {
    traceId,
    method: req.method,
    path: req.path,
    route: route?.route ?? "unknown",
    orgId: req.apiAuth?.orgId,
    fn: "maakApi",
  });

  if (!route) {
    res.status(404).json({
      error: "Route not found",
      code: "not_found",
      availableRoutes: [
        "GET /v1/patients/:patientId/vitals",
        "GET /v1/patients/:patientId/anomalies",
        "GET /v1/patients/:patientId/risk-score",
        "GET /v1/patients/:patientId/medications",
        "GET /v1/cohorts/:cohortId/summary",
        "GET /v1/org/:orgId/alerts",
        "POST /v1/patients/:patientId/vitals",
      ],
    });
    return;
  }

  try {
    switch (route.route) {
      case "patient_vitals":
        if (req.method === "GET") {
          await handleGetVitals(req, res, route.patientId);
        } else if (req.method === "POST") {
          await handlePostVitals(req, res, route.patientId);
        } else {
          res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
        }
        break;

      case "patient_anomalies":
        if (req.method !== "GET") {
          res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
          return;
        }
        await handleGetAnomalies(req, res, route.patientId);
        break;

      case "patient_risk_score":
        if (req.method !== "GET") {
          res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
          return;
        }
        await handleGetRiskScore(req, res, route.patientId);
        break;

      case "patient_medications":
        if (req.method !== "GET") {
          res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
          return;
        }
        await handleGetMedications(req, res, route.patientId);
        break;

      case "cohort_summary":
        if (req.method !== "GET") {
          res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
          return;
        }
        await handleGetCohortSummary(req, res, route.cohortId);
        break;

      case "org_alerts":
        if (req.method !== "GET") {
          res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
          return;
        }
        await handleGetOrgAlerts(req, res, route.orgId);
        break;

      default:
        res.status(404).json({ error: "Route not found", code: "not_found" });
    }
  } catch (err) {
    logger.error("Public API handler error", err as Error, {
      traceId,
      method: req.method,
      path: req.path,
      route: route.route,
      fn: "maakApi",
    });
    res.status(500).json({
      error: "Internal server error",
      code: "internal",
    });
  }
});
