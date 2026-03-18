/**
 * FHIR R4 Mappers
 *
 * Pure functions that convert Nuralix internal data to HL7 FHIR R4 resources.
 * Reference: https://www.hl7.org/fhir/R4/
 *
 * Vital type naming in Firestore uses camelCase (heartRate, oxygenSaturation, …)
 * This module maps them to standard LOINC codes and UCUM units.
 */

// ─── FHIR Resource Types ──────────────────────────────────────────────────────

export type FhirCoding = {
  system: string;
  code: string;
  display?: string;
};

export type FhirCodeableConcept = {
  coding?: FhirCoding[];
  text?: string;
};

export type FhirQuantity = {
  value: number;
  unit: string;
  system?: string;
  code?: string;
};

export type FhirReference = {
  reference: string;
  display?: string;
};

export type FhirHumanName = {
  use?: string;
  text?: string;
  family?: string;
  given?: string[];
};

export type FhirPatient = {
  resourceType: "Patient";
  id: string;
  identifier?: Array<{ system: string; value: string }>;
  name?: FhirHumanName[];
  birthDate?: string;
  gender?: "male" | "female" | "other" | "unknown";
  telecom?: Array<{ system: string; value: string; use?: string }>;
};

export type FhirObservationComponent = {
  code: FhirCodeableConcept;
  valueQuantity: FhirQuantity;
};

export type FhirObservation = {
  resourceType: "Observation";
  id: string;
  status: "final" | "preliminary" | "amended";
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: FhirReference;
  effectiveDateTime: string;
  valueQuantity?: FhirQuantity;
  component?: FhirObservationComponent[];
};

export type FhirDosageInstruction = {
  text?: string;
  timing?: {
    repeat?: {
      frequency?: number;
      period?: number;
      periodUnit?: "s" | "min" | "h" | "d" | "wk" | "mo" | "a";
    };
  };
};

export type FhirMedicationRequest = {
  resourceType: "MedicationRequest";
  id: string;
  status: "active" | "completed" | "stopped" | "cancelled" | "unknown";
  intent: "order" | "plan" | "proposal";
  medicationCodeableConcept: FhirCodeableConcept;
  subject: FhirReference;
  authoredOn?: string;
  dosageInstruction?: FhirDosageInstruction[];
};

export type FhirResource =
  | FhirPatient
  | FhirObservation
  | FhirMedicationRequest;

export type FhirBundleEntry = {
  fullUrl: string;
  resource: FhirResource;
};

export type FhirBundle = {
  resourceType: "Bundle";
  id: string;
  type: "searchset" | "collection" | "document";
  total?: number;
  entry?: FhirBundleEntry[];
};

// ─── LOINC / UCUM Vocabulary ──────────────────────────────────────────────────

const LOINC = "http://loinc.org";
const UCUM = "http://unitsofmeasure.org";
const OBS_CATEGORY =
  "http://terminology.hl7.org/CodeSystem/observation-category";

type VitalLoinc = {
  code: string;
  display: string;
  ucum: string;
  displayUnit: string;
};

// Keyed by Firestore camelCase vital type
const VITAL_LOINC: Record<string, VitalLoinc> = {
  heartRate: {
    code: "8867-4",
    display: "Heart rate",
    ucum: "/min",
    displayUnit: "bpm",
  },
  oxygenSaturation: {
    code: "59408-5",
    display: "Oxygen saturation by pulse oximetry",
    ucum: "%",
    displayUnit: "%",
  },
  bodyTemperature: {
    code: "8310-5",
    display: "Body temperature",
    ucum: "Cel",
    displayUnit: "°C",
  },
  respiratoryRate: {
    code: "9279-1",
    display: "Respiratory rate",
    ucum: "/min",
    displayUnit: "breaths/min",
  },
  bloodGlucose: {
    code: "2339-0",
    display: "Glucose [Mass/volume] in Blood",
    ucum: "mg/dL",
    displayUnit: "mg/dL",
  },
  weight: {
    code: "29463-7",
    display: "Body weight",
    ucum: "kg",
    displayUnit: "kg",
  },
  height: {
    code: "8302-2",
    display: "Body height",
    ucum: "cm",
    displayUnit: "cm",
  },
  bmi: {
    code: "39156-5",
    display: "Body mass index (BMI) [Ratio]",
    ucum: "kg/m2",
    displayUnit: "kg/m²",
  },
  // snake_case aliases (rules engine format — same LOINC)
  heart_rate: {
    code: "8867-4",
    display: "Heart rate",
    ucum: "/min",
    displayUnit: "bpm",
  },
  blood_oxygen: {
    code: "59408-5",
    display: "Oxygen saturation by pulse oximetry",
    ucum: "%",
    displayUnit: "%",
  },
  temperature: {
    code: "8310-5",
    display: "Body temperature",
    ucum: "Cel",
    displayUnit: "°C",
  },
  blood_glucose: {
    code: "2339-0",
    display: "Glucose [Mass/volume] in Blood",
    ucum: "mg/dL",
    displayUnit: "mg/dL",
  },
};

const BP_PANEL: VitalLoinc = {
  code: "85354-9",
  display: "Blood pressure panel with all children optional",
  ucum: "",
  displayUnit: "",
};

const SYSTOLIC_BP: VitalLoinc = {
  code: "8480-6",
  display: "Systolic blood pressure",
  ucum: "mm[Hg]",
  displayUnit: "mmHg",
};

const DIASTOLIC_BP: VitalLoinc = {
  code: "8462-4",
  display: "Diastolic blood pressure",
  ucum: "mm[Hg]",
  displayUnit: "mmHg",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIso(value: unknown): string {
  if (
    value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function vitalSignCategory(): FhirCodeableConcept {
  return {
    coding: [
      { system: OBS_CATEGORY, code: "vital-signs", display: "Vital Signs" },
    ],
  };
}

function loincCoding(loinc: VitalLoinc): FhirCodeableConcept {
  return {
    coding: [{ system: LOINC, code: loinc.code, display: loinc.display }],
    text: loinc.display,
  };
}

function quantity(value: number, loinc: VitalLoinc): FhirQuantity {
  return { value, unit: loinc.displayUnit, system: UCUM, code: loinc.ucum };
}

function isBP(type: string): boolean {
  return (
    type === "bloodPressure" ||
    type === "blood_pressure" ||
    type === "systolic_bp" ||
    type === "diastolicBP"
  );
}

// ─── Vital → Observation ──────────────────────────────────────────────────────

/**
 * Map a Nuralix vital document to a FHIR R4 Observation.
 */
export function vitalToObservation(
  id: string,
  data: Record<string, unknown>,
  patientId: string
): FhirObservation {
  const type = (data.type as string) ?? "";
  const effectiveDateTime = toIso(data.timestamp);
  const subject: FhirReference = { reference: `Patient/${patientId}` };

  // Blood pressure — compound observation
  if (isBP(type)) {
    const systolicVal =
      (data.systolic as number) ?? (data.value as number) ?? 0;
    const diastolicVal = data.diastolic as number | undefined;

    const components: FhirObservationComponent[] = [
      {
        code: loincCoding(SYSTOLIC_BP),
        valueQuantity: quantity(systolicVal, SYSTOLIC_BP),
      },
    ];

    if (diastolicVal !== undefined) {
      components.push({
        code: loincCoding(DIASTOLIC_BP),
        valueQuantity: quantity(diastolicVal, DIASTOLIC_BP),
      });
    }

    return {
      resourceType: "Observation",
      id,
      status: "final",
      category: [vitalSignCategory()],
      code: loincCoding(BP_PANEL),
      subject,
      effectiveDateTime,
      component: components,
    };
  }

  // Standard single-value vital
  const loinc = VITAL_LOINC[type];
  const value = data.value as number;
  const unit = (data.unit as string) ?? loinc?.displayUnit ?? "";

  return {
    resourceType: "Observation",
    id,
    status: "final",
    category: [vitalSignCategory()],
    code: loinc ? loincCoding(loinc) : { text: type },
    subject,
    effectiveDateTime,
    valueQuantity: loinc ? quantity(value, loinc) : { value, unit },
  };
}

// ─── Medication → MedicationRequest ──────────────────────────────────────────

/**
 * Map a Nuralix medication document to a FHIR R4 MedicationRequest.
 */
export function medicationToMedicationRequest(
  id: string,
  data: Record<string, unknown>,
  patientId: string
): FhirMedicationRequest {
  const rawStatus = (data.status as string) ?? "active";
  const status: FhirMedicationRequest["status"] =
    rawStatus === "active"
      ? "active"
      : rawStatus === "completed"
        ? "completed"
        : rawStatus === "stopped" || rawStatus === "discontinued"
          ? "stopped"
          : "unknown";

  const authoredOn = data.createdAt ? toIso(data.createdAt) : undefined;

  const dosageParts: string[] = [];
  if (data.dosage) dosageParts.push(String(data.dosage));
  if (data.frequency) dosageParts.push(String(data.frequency));
  if (data.instructions) dosageParts.push(String(data.instructions));

  return {
    resourceType: "MedicationRequest",
    id,
    status,
    intent: "order",
    medicationCodeableConcept: {
      coding: data.rxcui
        ? [
            {
              system: "http://www.nlm.nih.gov/research/umls/rxnorm",
              code: String(data.rxcui),
            },
          ]
        : [],
      text: (data.name as string) ?? "Unknown medication",
    },
    subject: { reference: `Patient/${patientId}` },
    authoredOn,
    dosageInstruction:
      dosageParts.length > 0 ? [{ text: dosageParts.join(", ") }] : undefined,
  };
}

// ─── User → Patient ───────────────────────────────────────────────────────────

/**
 * Map a Nuralix user document to a FHIR R4 Patient resource.
 */
export function userToPatient(
  id: string,
  data: Record<string, unknown>
): FhirPatient {
  // Support current firstName/lastName schema and legacy name field.
  const firstName = (data.firstName as string | undefined)?.trim();
  const lastName = (data.lastName as string | undefined)?.trim();
  const legacyName = (data.name as string | undefined)?.trim();
  const fullName =
    firstName || lastName
      ? [firstName, lastName].filter(Boolean).join(" ")
      : legacyName;

  const parts = fullName?.split(/\s+/) ?? [];
  const given = parts.slice(0, -1);
  const family = parts.at(-1);

  const rawGender = (data.gender as string | undefined)?.toLowerCase();
  const gender: FhirPatient["gender"] =
    rawGender === "male"
      ? "male"
      : rawGender === "female"
        ? "female"
        : rawGender
          ? "other"
          : "unknown";

  const dob = data.dateOfBirth ?? data.birthDate;
  const birthDate = dob ? toIso(dob).slice(0, 10) : undefined;

  const telecom: FhirPatient["telecom"] = [];
  if (data.email) {
    telecom.push({ system: "email", value: data.email as string, use: "home" });
  }
  // Support current phoneNumber field and legacy phone field.
  const phone = (data.phoneNumber ?? data.phone) as string | undefined;
  if (phone) {
    telecom.push({ system: "phone", value: phone });
  }

  return {
    resourceType: "Patient",
    id,
    identifier: [{ system: "urn:nuralix:patient", value: id }],
    name: fullName
      ? [
          {
            use: "official",
            text: fullName,
            given: given.length > 0 ? given : [fullName],
            family,
          },
        ]
      : undefined,
    birthDate,
    gender,
    telecom: telecom.length > 0 ? telecom : undefined,
  };
}

// ─── Bundle Builder ───────────────────────────────────────────────────────────

/**
 * Wrap a list of FHIR resources in a searchset Bundle.
 */
export function buildSearchBundle(
  resources: FhirResource[],
  baseUrl: string
): FhirBundle {
  return {
    resourceType: "Bundle",
    id: `bundle-${Date.now()}`,
    type: "searchset",
    total: resources.length,
    entry: resources.map((r) => ({
      fullUrl: `${baseUrl}/${r.resourceType}/${r.id}`,
      resource: r,
    })),
  };
}

/**
 * Build a complete patient summary Bundle (type=collection).
 * Contains Patient + Observations + MedicationRequests.
 */
export function buildPatientBundle(
  patient: FhirPatient,
  observations: FhirObservation[],
  medicationRequests: FhirMedicationRequest[],
  baseUrl: string
): FhirBundle {
  const allResources: FhirResource[] = [
    patient,
    ...observations,
    ...medicationRequests,
  ];

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
