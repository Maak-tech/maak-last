/**
 * FHIR R4 Mappers — API edition.
 *
 * Pure functions that convert Nuralix Drizzle row types to HL7 FHIR R4 resources.
 * Used by the SDK FHIR export endpoint (`GET /sdk/v1/patients/:id/fhir/Bundle`).
 *
 * Reference: https://www.hl7.org/fhir/R4/
 */

// ── FHIR R4 type definitions ──────────────────────────────────────────────────

type FhirCoding = { system: string; code: string; display?: string };
type FhirCodeableConcept = { coding?: FhirCoding[]; text?: string };
type FhirQuantity = { value: number; unit: string; system?: string; code?: string };
type FhirReference = { reference: string };

export type FhirPatient = {
  resourceType: "Patient";
  id: string;
  identifier?: Array<{ system: string; value: string }>;
  name?: Array<{ use?: string; text?: string; given?: string[]; family?: string }>;
  birthDate?: string;
  gender?: "male" | "female" | "other" | "unknown";
  telecom?: Array<{ system: string; value: string; use?: string }>;
};

export type FhirObservation = {
  resourceType: "Observation";
  id: string;
  status: "final";
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  effectiveDateTime: string;
  valueQuantity?: FhirQuantity;
  component?: Array<{ code: FhirCodeableConcept; valueQuantity: FhirQuantity }>;
};

export type FhirMedicationRequest = {
  resourceType: "MedicationRequest";
  id: string;
  status: "active" | "stopped" | "unknown";
  intent: "order";
  medicationCodeableConcept: FhirCodeableConcept;
  subject: FhirReference;
  authoredOn?: string;
  dosageInstruction?: Array<{ text: string }>;
};

type FhirResource = FhirPatient | FhirObservation | FhirMedicationRequest;

export type FhirBundle = {
  resourceType: "Bundle";
  id: string;
  type: "collection";
  total: number;
  entry: Array<{ fullUrl: string; resource: FhirResource }>;
};

// ── LOINC / UCUM vocabulary ───────────────────────────────────────────────────

const LOINC = "http://loinc.org";
const UCUM = "http://unitsofmeasure.org";
const OBS_CATEGORY = "http://terminology.hl7.org/CodeSystem/observation-category";

type VitalLoinc = { code: string; display: string; ucum: string; displayUnit: string };

/** Keyed by vital type strings used in the `vitals` table (snake_case and camelCase aliases). */
const VITAL_LOINC: Record<string, VitalLoinc> = {
  heart_rate:       { code: "8867-4",  display: "Heart rate",                          ucum: "/min",    displayUnit: "bpm" },
  heartRate:        { code: "8867-4",  display: "Heart rate",                          ucum: "/min",    displayUnit: "bpm" },
  blood_oxygen:     { code: "59408-5", display: "Oxygen saturation by pulse oximetry", ucum: "%",       displayUnit: "%" },
  oxygenSaturation: { code: "59408-5", display: "Oxygen saturation by pulse oximetry", ucum: "%",       displayUnit: "%" },
  temperature:      { code: "8310-5",  display: "Body temperature",                    ucum: "Cel",     displayUnit: "°C" },
  bodyTemperature:  { code: "8310-5",  display: "Body temperature",                    ucum: "Cel",     displayUnit: "°C" },
  respiratory_rate: { code: "9279-1",  display: "Respiratory rate",                    ucum: "/min",    displayUnit: "breaths/min" },
  respiratoryRate:  { code: "9279-1",  display: "Respiratory rate",                    ucum: "/min",    displayUnit: "breaths/min" },
  blood_glucose:    { code: "2339-0",  display: "Glucose [Mass/volume] in Blood",      ucum: "mg/dL",   displayUnit: "mg/dL" },
  bloodGlucose:     { code: "2339-0",  display: "Glucose [Mass/volume] in Blood",      ucum: "mg/dL",   displayUnit: "mg/dL" },
  weight:           { code: "29463-7", display: "Body weight",                         ucum: "kg",      displayUnit: "kg" },
  height:           { code: "8302-2",  display: "Body height",                         ucum: "cm",      displayUnit: "cm" },
  hrv:              { code: "80404-7", display: "Heart rate variability",              ucum: "ms",      displayUnit: "ms" },
  steps:            { code: "55423-8", display: "Number of steps in unspecified time", ucum: "1",       displayUnit: "steps" },
  sleep_hours:      { code: "93832-4", display: "Sleep duration",                      ucum: "h",       displayUnit: "h" },
};

const BP_PANEL  = { code: "85354-9", display: "Blood pressure panel", ucum: "",       displayUnit: "" };
const SYSTOLIC  = { code: "8480-6",  display: "Systolic blood pressure",  ucum: "mm[Hg]", displayUnit: "mmHg" };
const DIASTOLIC = { code: "8462-4",  display: "Diastolic blood pressure", ucum: "mm[Hg]", displayUnit: "mmHg" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function obsCategory(): FhirCodeableConcept {
  return { coding: [{ system: OBS_CATEGORY, code: "vital-signs", display: "Vital Signs" }] };
}

function loincCC(l: VitalLoinc): FhirCodeableConcept {
  return { coding: [{ system: LOINC, code: l.code, display: l.display }], text: l.display };
}

function qty(value: number, l: VitalLoinc): FhirQuantity {
  return { value, unit: l.displayUnit, system: UCUM, code: l.ucum };
}

// ── Row types (shapes of Drizzle SELECT results) ──────────────────────────────

export type VitalRow = {
  id: string;
  type: string;
  value: string | null;          // Drizzle maps numeric → string
  valueSecondary: string | null; // diastolic for blood_pressure
  unit: string | null;
  recordedAt: Date;
};

export type UserRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
};

export type MedicationRow = {
  id: string;
  name: string;
  dosage: string | null;
  frequency: string | null;
  isActive: boolean | null;
  startDate: Date | null;
  instructions: string | null;
};

// ── Mappers ───────────────────────────────────────────────────────────────────

/**
 * Map a Nuralix user row to a FHIR R4 Patient resource.
 */
export function userToFhirPatient(row: UserRow): FhirPatient {
  const parts = (row.name ?? "").trim().split(/\s+/).filter(Boolean);
  const given = parts.slice(0, -1);
  const family = parts.at(-1);

  const rawGender = row.gender?.toLowerCase();
  const gender: FhirPatient["gender"] =
    rawGender === "male"
      ? "male"
      : rawGender === "female"
        ? "female"
        : rawGender
          ? "other"
          : "unknown";

  const telecom: NonNullable<FhirPatient["telecom"]> = [];
  if (row.email) telecom.push({ system: "email", value: row.email, use: "home" });
  if (row.phone) telecom.push({ system: "phone", value: row.phone });

  return {
    resourceType: "Patient",
    id: row.id,
    identifier: [{ system: "urn:nuralix:patient", value: row.id }],
    name: row.name
      ? [
          {
            use: "official",
            text: row.name,
            given: given.length > 0 ? given : [row.name],
            family,
          },
        ]
      : undefined,
    birthDate: row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : undefined,
    gender,
    telecom: telecom.length > 0 ? telecom : undefined,
  };
}

/**
 * Map a Nuralix vital row to a FHIR R4 Observation.
 * Blood-pressure rows produce a compound Observation with systolic + diastolic components.
 */
export function vitalToFhirObservation(row: VitalRow, patientId: string): FhirObservation {
  const subject: FhirReference = { reference: `Patient/${patientId}` };
  const effectiveDateTime = row.recordedAt.toISOString();

  const isBP = row.type === "blood_pressure" || row.type === "bloodPressure";

  if (isBP) {
    const sys = parseFloat(row.value ?? "0");
    const dia = row.valueSecondary !== null ? parseFloat(row.valueSecondary) : undefined;

    const component: FhirObservation["component"] = [
      { code: loincCC(SYSTOLIC), valueQuantity: qty(sys, SYSTOLIC) },
    ];
    if (dia !== undefined) {
      component.push({ code: loincCC(DIASTOLIC), valueQuantity: qty(dia, DIASTOLIC) });
    }

    return {
      resourceType: "Observation",
      id: row.id,
      status: "final",
      category: [obsCategory()],
      code: loincCC(BP_PANEL),
      subject,
      effectiveDateTime,
      component,
    };
  }

  const loinc = VITAL_LOINC[row.type];
  const numVal = parseFloat(row.value ?? "0");

  return {
    resourceType: "Observation",
    id: row.id,
    status: "final",
    category: [obsCategory()],
    code: loinc ? loincCC(loinc) : { text: row.type },
    subject,
    effectiveDateTime,
    valueQuantity: loinc ? qty(numVal, loinc) : { value: numVal, unit: row.unit ?? "" },
  };
}

/**
 * Map a Nuralix medication row to a FHIR R4 MedicationRequest.
 */
export function medicationToFhirMedicationRequest(
  row: MedicationRow,
  patientId: string
): FhirMedicationRequest {
  const dosageParts = [row.dosage, row.frequency, row.instructions].filter(Boolean) as string[];

  return {
    resourceType: "MedicationRequest",
    id: row.id,
    status: row.isActive ? "active" : "stopped",
    intent: "order",
    medicationCodeableConcept: { text: row.name },
    subject: { reference: `Patient/${patientId}` },
    authoredOn: row.startDate ? row.startDate.toISOString() : undefined,
    dosageInstruction:
      dosageParts.length > 0 ? [{ text: dosageParts.join(", ") }] : undefined,
  };
}

// ── Bundle builder ────────────────────────────────────────────────────────────

/**
 * Wrap patient FHIR resources into a FHIR R4 Bundle (type = collection).
 */
export function buildFhirBundle(
  patient: FhirPatient,
  observations: FhirObservation[],
  medicationRequests: FhirMedicationRequest[],
  baseUrl: string
): FhirBundle {
  const allResources: FhirResource[] = [patient, ...observations, ...medicationRequests];

  return {
    resourceType: "Bundle",
    id: `patient-summary-${patient.id}-${Date.now()}`,
    type: "collection",
    total: allResources.length,
    entry: allResources.map((r) => ({
      fullUrl: `${baseUrl}/${r.resourceType}/${r.id}`,
      resource: r,
    })),
  };
}
