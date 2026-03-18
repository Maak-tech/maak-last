// ── Core VHI types ─────────────────────────────────────────────────────────────

export type PRSLevel = "low" | "average" | "elevated" | "high";
export type RiskTrajectory = "worsening" | "stable" | "improving";
export type RiskLevel = "low" | "moderate" | "high";
export type Pathogenicity = "benign" | "likely_benign" | "vus" | "likely_pathogenic" | "pathogenic";
export type DrugInteraction = "standard" | "reduced_efficacy" | "increased_toxicity" | "contraindicated";
export type ImpactLevel = "high" | "medium" | "low";
export type FactorCategory = "genetic" | "behavioral" | "clinical" | "environmental";
export type ActionPriority = "urgent" | "high" | "normal" | "low";
export type ActionType = "nudge" | "caregiver_alert" | "provider_alert" | "follow_up_reminder";
export type ActionTarget = "patient" | "caregiver" | "provider";

export interface PRSCondition {
  condition: string;
  percentile: number;
  level: PRSLevel;
}

export interface PharmacogenomicAlert {
  gene: string;
  drug: string;
  interaction: DrugInteraction;
  clinicalAnnotation?: string;
}

export interface RiskComponent {
  score: number;
  drivers: string[];
  confidence: number;
}

export interface RiskScores {
  fallRisk: RiskComponent;
  adherenceRisk: RiskComponent;
  deteriorationRisk: RiskComponent;
  geneticRiskLoad: RiskComponent;
  compositeRisk: number;
  trajectory: RiskTrajectory;
}

export interface ElevatingFactor {
  factor: string;
  category: FactorCategory;
  impact: ImpactLevel;
  source: string[];
  explanation: string;
}

export interface DecliningFactor {
  factor: string;
  category: FactorCategory;
  impact: ImpactLevel;
  source: string[];
  explanation: string;
  recommendation: string;
}

export interface VHIAction {
  id: string;
  target: ActionTarget;
  priority: ActionPriority;
  actionType: ActionType;
  title: string;
  rationale: string;
  dispatched: boolean;
  dispatchedAt?: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
}

/** Sanitised VHI returned by the SDK (no raw rsids / clinical note text). */
export interface PatientVHI {
  userId: string;
  computedAt: string | null;
  overallScore: number;
  riskLevel: RiskLevel;
  trajectory: RiskTrajectory;
  riskScores: RiskScores;
  elevatingFactors: ElevatingFactor[];
  decliningFactors: DecliningFactor[];
  pendingActions: VHIAction[];
}

/** Condition-level genetic summary (no raw rsids). */
export interface PatientGenetics {
  processingStatus: "pending" | "processing" | "processed" | "failed" | "none";
  conditions: PRSCondition[];
  pharmacogenomicsAlerts: PharmacogenomicAlert[];
  relevantConditions: string[] | null;
}

// ── Risk endpoint ─────────────────────────────────────────────────────────────

export interface PatientRisk {
  computedAt: string | null;
  compositeRisk: number | null;
  fallRisk: number | null;
  adherenceRisk: number | null;
  deteriorationRisk: number | null;
  riskLevel: RiskLevel;
  drivers: {
    fall: string[];
    adherence: string[];
    deterioration: string[];
  };
}

// ── Timeline endpoint ─────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  occurredAt: string;
  source: string;
  domain: string | null;
  value: string | null;
  unit: string | null;
  zScoreAtIngestion: string | null;
}

export interface PatientTimeline {
  events: TimelineEvent[];
  count: number;
}

// ── Alerts endpoint ───────────────────────────────────────────────────────────

export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertType = "fall" | "medication" | "vital" | "vhi" | "emergency";

export interface PatientAlertItem {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string | null;
  isAcknowledged: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export interface PatientAlerts {
  alerts: PatientAlertItem[];
  count: number;
}

// ── Insights endpoint ─────────────────────────────────────────────────────────

export interface PatientInsightItem {
  type: "elevating" | "declining";
  factor: string;
  category: FactorCategory;
  impact: ImpactLevel;
  explanation: string;
  recommendation?: string;
}

export interface PatientInsights {
  computedAt: string | null;
  overallScore: number | null;
  insights: PatientInsightItem[];
  pendingActions: VHIAction[];
}

// ── Webhook types ──────────────────────────────────────────────────────────────

export type WebhookEvent =
  | "vhi.updated"
  | "vhi.risk_elevated"
  | "genetics.processed"
  | "alert.triggered"
  | "alert.resolved"
  | "medication.missed"
  | "*";

export interface WebhookRegistration {
  id: string;
  url: string;
  events: WebhookEvent[];
  /** Returned once on creation — store securely, never shown again. */
  secret?: string;
  message?: string;
}

// ── API key management ────────────────────────────────────────────────────────

export interface APIKey {
  id: string;
  name: string;
  scopes: string[];
  /** Short prefix shown for identification (e.g. `nk_abc123...`). Never the full key. */
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
  /** Full API key — returned ONLY at creation. Store it securely. */
  key?: string;
}

// ── FHIR R4 types ─────────────────────────────────────────────────────────────

export interface FhirCoding {
  system: string;
  code: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirQuantity {
  value: number;
  unit: string;
  system?: string;
  code?: string;
}

export interface FhirPatientResource {
  resourceType: "Patient";
  id: string;
  identifier?: Array<{ system: string; value: string }>;
  name?: Array<{ use?: string; text?: string; given?: string[]; family?: string }>;
  birthDate?: string;
  gender?: "male" | "female" | "other" | "unknown";
  telecom?: Array<{ system: string; value: string; use?: string }>;
}

export interface FhirObservationResource {
  resourceType: "Observation";
  id: string;
  status: "final" | "preliminary" | "amended";
  category: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject: { reference: string };
  effectiveDateTime: string;
  valueQuantity?: FhirQuantity;
  component?: Array<{ code: FhirCodeableConcept; valueQuantity: FhirQuantity }>;
}

export interface FhirMedicationRequestResource {
  resourceType: "MedicationRequest";
  id: string;
  status: "active" | "stopped" | "completed" | "unknown";
  intent: "order" | "plan" | "proposal";
  medicationCodeableConcept: FhirCodeableConcept;
  subject: { reference: string };
  authoredOn?: string;
  dosageInstruction?: Array<{ text: string }>;
}

export type FhirResource =
  | FhirPatientResource
  | FhirObservationResource
  | FhirMedicationRequestResource;

/** FHIR R4 Bundle (type = collection) returned by `exportFHIR()`. */
export interface FhirBundle {
  resourceType: "Bundle";
  id: string;
  type: "collection";
  total: number;
  entry: Array<{ fullUrl: string; resource: FhirResource }>;
}

// ── Cohort types ───────────────────────────────────────────────────────────────

/** An org-scoped patient grouping by condition, program, or custom criteria. */
export interface Cohort {
  id: string;
  name: string;
  description: string | null;
  condition: string | null;
  program: string | null;
  createdAt: string | null;
  /** Live count of enrolled patients. */
  patientCount: number;
}

/** A single patient enrolled in a cohort. */
export interface CohortMember {
  userId: string;
  enrolledAt: string;
}

export interface CohortMembersResponse {
  cohortId: string;
  cohortName: string;
  members: CohortMember[];
  count: number;
}

// ── SDK options ────────────────────────────────────────────────────────────────

export interface NurulixClientOptions {
  /** API key starting with `nk_` */
  apiKey: string;
  /** Base URL of the Nuralix API. Defaults to https://api.nuralix.ai */
  baseURL?: string;
  /** Request timeout in milliseconds. Default: 30 000 */
  timeoutMs?: number;
}

// ── Error ─────────────────────────────────────────────────────────────────────

export class NurulixError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "NurulixError";
  }
}
