/**
 * FHIR R4 API
 *
 * Exposes Maak health data as HL7 FHIR R4 resources, enabling integration
 * with EHR systems (Epic, Cerner) and care management platforms.
 *
 * Authenticated via API key (same as publicApi.ts), except:
 *   GET /.well-known/smart-configuration  — public, no auth
 *
 * Routes:
 *   GET  /.well-known/smart-configuration
 *   GET  /fhir/r4/Patient/:id
 *   GET  /fhir/r4/Observation?patient=:id[&category=vital-signs][&date=ge2024-01-01]
 *   GET  /fhir/r4/MedicationRequest?patient=:id[&status=active]
 *   GET  /fhir/r4/Bundle?patient=:id          (full patient summary)
 *   POST /fhir/r4/Observation                 (ingest vitals from clinic device)
 *
 * Patient access enforcement: same roster + consent check as publicApi.ts.
 *
 * SMART on FHIR:
 *   Discovery document served here at /.well-known/smart-configuration.
 *   Full OAuth 2.0 server (authorize, token, introspect, JWKS) is implemented
 *   in functions/src/auth/smartAuth.ts (exported as the `smartAuth` Cloud Function).
 *   In production, configure Firebase Hosting rewrites so that /auth/* and
 *   /.well-known/jwks.json route to the smartAuth function under the same domain.
 */

import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import type { Response } from "firebase-functions/v1";
import {
  buildPatientBundle,
  buildSearchBundle,
  type FhirMedicationRequest,
  type FhirObservation,
  medicationToMedicationRequest,
  userToPatient,
  vitalToObservation,
} from "../../../lib/utils/fhirMappers";
import {
  type ApiRequest,
  assertScope,
  authenticateApiKey,
} from "../middleware/apiAuth";
import { createTraceId } from "../observability/correlation";
import { logger } from "../observability/logger";

const db = () => getFirestore();

// ─── FHIR Content Type ────────────────────────────────────────────────────────

const FHIR_JSON = "application/fhir+json";

// ─── Date Prefix Parsing (FHIR search: ge/le/gt/lt) ──────────────────────────

function parseFhirDate(
  param: string | undefined
): { date: Date; prefix: "ge" | "le" | "gt" | "lt" | "eq" } | null {
  if (!param) return null;
  const match = param.match(/^(ge|le|gt|lt)?(\d{4}-\d{2}-\d{2}.*)$/);
  if (!match) return null;
  const prefix = (match[1] ?? "eq") as "ge" | "le" | "gt" | "lt" | "eq";
  return { date: new Date(match[2]), prefix };
}

// ─── Access Guard (same as publicApi.ts) ─────────────────────────────────────

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
    res
      .status(403)
      .type(FHIR_JSON)
      .json(operationOutcome("403", "Patient not in organization roster"));
    return false;
  }

  if (!(consentSnap.exists && consentSnap.data()?.isActive)) {
    res
      .status(403)
      .type(FHIR_JSON)
      .json(operationOutcome("403", "Missing active patient consent"));
    return false;
  }

  return true;
}

// ─── OperationOutcome (FHIR error format) ─────────────────────────────────────

function operationOutcome(code: string, details: string, severity = "error") {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity, code, details: { text: details } }],
  };
}

// ─── Base URL ─────────────────────────────────────────────────────────────────

function fhirBaseUrl(req: functions.https.Request): string {
  const host = req.headers.host ?? "maak.health";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  return `${proto}://${host}/fhir/r4`;
}

// ─── SMART Configuration ──────────────────────────────────────────────────────

function handleSmartConfiguration(
  req: functions.https.Request,
  res: Response
): void {
  const host = req.headers.host ?? "maak.health";
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const base = `${proto}://${host}`;

  res.type("application/json").json({
    issuer: `${base}`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    authorization_endpoint: `${base}/auth/authorize`,
    token_endpoint: `${base}/auth/token`,
    token_endpoint_auth_methods_supported: [
      "private_key_jwt",
      "client_secret_basic",
    ],
    grant_types_supported: ["authorization_code", "client_credentials"],
    registration_endpoint: `${base}/auth/register`,
    scopes_supported: [
      "openid",
      "fhirUser",
      "launch",
      "launch/patient",
      "patient/*.read",
      "patient/Observation.read",
      "patient/MedicationRequest.read",
      "patient/Patient.read",
      "system/*.read",
    ],
    response_types_supported: ["code"],
    capabilities: [
      "launch-ehr",
      "launch-standalone",
      "client-public",
      "client-confidential-symmetric",
      "sso-openid-connect",
      "context-banner",
      "permission-patient",
      "permission-user",
    ],
    code_challenge_methods_supported: ["S256"],
  });
}

// ─── Patient Handler ──────────────────────────────────────────────────────────

async function handleGetPatient(
  req: ApiRequest,
  res: Response,
  patientId: string
): Promise<void> {
  if (!assertScope(req, res, "patients:read")) return;
  if (!(await assertPatientAccess(res, req.apiAuth!.orgId, patientId))) return;

  const snap = await db().collection("users").doc(patientId).get();
  if (!snap.exists) {
    res
      .status(404)
      .type(FHIR_JSON)
      .json(operationOutcome("404", "Patient not found"));
    return;
  }

  const patient = userToPatient(
    patientId,
    snap.data() as Record<string, unknown>
  );
  res.type(FHIR_JSON).json(patient);
}

// ─── Observation Handler ──────────────────────────────────────────────────────

async function handleGetObservation(
  req: ApiRequest,
  res: Response
): Promise<void> {
  if (!assertScope(req, res, "vitals:read")) return;

  const {
    patient: patientId,
    category,
    date,
  } = req.query as Record<string, string>;

  if (!patientId) {
    res
      .status(400)
      .type(FHIR_JSON)
      .json(operationOutcome("400", "patient parameter required"));
    return;
  }

  if (!(await assertPatientAccess(res, req.apiAuth!.orgId, patientId))) return;

  let ref = db()
    .collection("vitals")
    .where("userId", "==", patientId) as FirebaseFirestore.Query;

  const parsedDate = parseFhirDate(date);
  if (parsedDate) {
    const ts = Timestamp.fromDate(parsedDate.date);
    if (parsedDate.prefix === "ge" || parsedDate.prefix === "gt") {
      ref = ref.where("timestamp", ">=", ts);
    } else {
      ref = ref.where("timestamp", "<=", ts);
    }
  }

  ref = ref.orderBy("timestamp", "desc").limit(200);

  const snap = await ref.get();
  let observations: FhirObservation[] = snap.docs.map((d) =>
    vitalToObservation(d.id, d.data(), patientId)
  );

  // Filter by category if specified (only vital-signs supported for now)
  if (category && category !== "vital-signs") {
    observations = [];
  }

  const bundle = buildSearchBundle(
    observations,
    fhirBaseUrl(req as functions.https.Request)
  );
  res.type(FHIR_JSON).json(bundle);
}

async function handlePostObservation(
  req: ApiRequest,
  res: Response
): Promise<void> {
  if (!assertScope(req, res, "vitals:write")) return;

  const body = req.body as Record<string, unknown>;

  if (body.resourceType !== "Observation") {
    res
      .status(400)
      .type(FHIR_JSON)
      .json(operationOutcome("400", "resourceType must be Observation"));
    return;
  }

  // Extract patient reference: "Patient/{id}"
  const subjectRef =
    (body.subject as Record<string, string> | undefined)?.reference ?? "";
  const patientId = subjectRef.replace(/^Patient\//, "");

  if (!patientId) {
    res
      .status(400)
      .type(FHIR_JSON)
      .json(
        operationOutcome("400", "subject.reference (Patient/{id}) required")
      );
    return;
  }

  if (!(await assertPatientAccess(res, req.apiAuth!.orgId, patientId))) return;

  // Extract value from FHIR Observation
  const valueQuantity = body.valueQuantity as
    | Record<string, unknown>
    | undefined;
  const code = body.code as Record<string, unknown> | undefined;
  const codingArr =
    (code?.coding as Record<string, string>[] | undefined) ?? [];
  const loincCode = codingArr[0]?.code ?? "unknown";

  const effective =
    (body.effectiveDateTime as string | undefined) ?? new Date().toISOString();

  const vitalData = {
    userId: patientId,
    type: loincCode, // Store LOINC code as type; can be mapped back on read
    value: (valueQuantity?.value as number) ?? 0,
    unit: (valueQuantity?.unit as string) ?? "",
    source: "api",
    deviceId: null,
    timestamp: Timestamp.fromDate(new Date(effective)),
    createdAt: FieldValue.serverTimestamp(),
    fhirSource: true,
  };

  const ref = await db().collection("vitals").add(vitalData);

  res
    .status(201)
    .type(FHIR_JSON)
    .json({
      resourceType: "Observation",
      id: ref.id,
      status: "final",
      ...body,
    });
}

// ─── MedicationRequest Handler ────────────────────────────────────────────────

async function handleGetMedicationRequest(
  req: ApiRequest,
  res: Response
): Promise<void> {
  if (!assertScope(req, res, "medications:read")) return;

  const { patient: patientId, status } = req.query as Record<string, string>;

  if (!patientId) {
    res
      .status(400)
      .type(FHIR_JSON)
      .json(operationOutcome("400", "patient parameter required"));
    return;
  }

  if (!(await assertPatientAccess(res, req.apiAuth!.orgId, patientId))) return;

  let ref = db()
    .collection("medications")
    .where("userId", "==", patientId) as FirebaseFirestore.Query;

  if (status && status !== "all") {
    ref = ref.where("status", "==", status);
  } else if (!status) {
    ref = ref.where("status", "==", "active");
  }

  ref = ref.orderBy("createdAt", "desc").limit(100);

  const snap = await ref.get();
  const meds: FhirMedicationRequest[] = snap.docs.map((d) =>
    medicationToMedicationRequest(d.id, d.data(), patientId)
  );

  const bundle = buildSearchBundle(
    meds,
    fhirBaseUrl(req as functions.https.Request)
  );
  res.type(FHIR_JSON).json(bundle);
}

// ─── Bundle Handler (full patient summary) ────────────────────────────────────

async function handleGetBundle(req: ApiRequest, res: Response): Promise<void> {
  if (!assertScope(req, res, "patients:read")) return;

  const { patient: patientId } = req.query as Record<string, string>;

  if (!patientId) {
    res
      .status(400)
      .type(FHIR_JSON)
      .json(operationOutcome("400", "patient parameter required"));
    return;
  }

  if (!(await assertPatientAccess(res, req.apiAuth!.orgId, patientId))) return;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

  const [userSnap, vitalsSnap, medsSnap] = await Promise.all([
    db().collection("users").doc(patientId).get(),
    db()
      .collection("vitals")
      .where("userId", "==", patientId)
      .where("timestamp", ">=", Timestamp.fromDate(since))
      .orderBy("timestamp", "desc")
      .limit(100)
      .get(),
    db()
      .collection("medications")
      .where("userId", "==", patientId)
      .where("status", "==", "active")
      .limit(50)
      .get(),
  ]);

  if (!userSnap.exists) {
    res
      .status(404)
      .type(FHIR_JSON)
      .json(operationOutcome("404", "Patient not found"));
    return;
  }

  const patient = userToPatient(
    patientId,
    userSnap.data() as Record<string, unknown>
  );
  const observations = vitalsSnap.docs.map((d) =>
    vitalToObservation(d.id, d.data(), patientId)
  );
  const medications = medsSnap.docs.map((d) =>
    medicationToMedicationRequest(d.id, d.data(), patientId)
  );

  const bundle = buildPatientBundle(
    patient,
    observations,
    medications,
    fhirBaseUrl(req as functions.https.Request)
  );

  res.type(FHIR_JSON).json(bundle);
}

// ─── Route Parsing ────────────────────────────────────────────────────────────

type FhirRoute =
  | { route: "smart_config" }
  | { route: "patient"; id: string }
  | { route: "observation" }
  | { route: "medication_request" }
  | { route: "bundle" }
  | null;

function parseFhirRoute(path: string): FhirRoute {
  if (path === "/.well-known/smart-configuration")
    return { route: "smart_config" };

  const parts = path.replace(/^\//, "").split("/");
  if (parts[0] !== "fhir" || parts[1] !== "r4") return null;

  const resource = parts[2];
  const id = parts[3]; // may be undefined for collection queries

  if (!resource) return null;

  if (resource === "Patient" && id) return { route: "patient", id };
  if (resource === "Observation") return { route: "observation" };
  if (resource === "MedicationRequest") return { route: "medication_request" };
  if (resource === "Bundle") return { route: "bundle" };

  return null;
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

/**
 * Maak FHIR R4 API — single Cloud Function with internal routing.
 *
 * Deploy URL:
 *   https://<region>-<project>.cloudfunctions.net/fhirApi/fhir/r4/...
 */
export const fhirApi = functions.https.onRequest(async (rawReq, res) => {
  const req = rawReq as ApiRequest;
  const traceId = createTraceId();

  // CORS — allow EHR iframe launchers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key, X-Org-Id, Accept"
  );

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const route = parseFhirRoute(req.path);

  logger.info("FHIR API request", {
    traceId,
    method: req.method,
    path: req.path,
    route: route?.route ?? "unknown",
    fn: "fhirApi",
  });

  // SMART configuration — public endpoint, no auth
  if (route?.route === "smart_config") {
    handleSmartConfiguration(rawReq, res);
    return;
  }

  if (!route) {
    res
      .status(404)
      .type(FHIR_JSON)
      .json(operationOutcome("404", `Route not found: ${req.path}`));
    return;
  }

  // Authenticate all other routes
  const authenticated = await authenticateApiKey(req, res);
  if (!authenticated) return;

  try {
    switch (route.route) {
      case "patient":
        if (req.method !== "GET") {
          res
            .status(405)
            .type(FHIR_JSON)
            .json(operationOutcome("405", "Method not allowed"));
          return;
        }
        await handleGetPatient(req, res, route.id);
        break;

      case "observation":
        if (req.method === "GET") {
          await handleGetObservation(req, res);
        } else if (req.method === "POST") {
          await handlePostObservation(req, res);
        } else {
          res
            .status(405)
            .type(FHIR_JSON)
            .json(operationOutcome("405", "Method not allowed"));
        }
        break;

      case "medication_request":
        if (req.method !== "GET") {
          res
            .status(405)
            .type(FHIR_JSON)
            .json(operationOutcome("405", "Method not allowed"));
          return;
        }
        await handleGetMedicationRequest(req, res);
        break;

      case "bundle":
        if (req.method !== "GET") {
          res
            .status(405)
            .type(FHIR_JSON)
            .json(operationOutcome("405", "Method not allowed"));
          return;
        }
        await handleGetBundle(req, res);
        break;

      default:
        res
          .status(404)
          .type(FHIR_JSON)
          .json(operationOutcome("404", "Resource type not supported"));
    }
  } catch (err) {
    logger.error("FHIR API handler error", err as Error, {
      traceId,
      method: req.method,
      path: req.path,
      fn: "fhirApi",
    });
    res
      .status(500)
      .type(FHIR_JSON)
      .json(operationOutcome("500", "Internal server error"));
  }
});
