export type VHIDimension = {
  currentValue: number | null;
  baselineValue: number | null;
  zScore: number | null;
  direction: "above" | "below" | "stable" | "unknown";
  deviation: "none" | "mild" | "moderate" | "significant";
  trend7d: "worsening" | "stable" | "improving" | "insufficient";
  lastDataAt: string | null; // ISO string
  isStale: boolean;
};

export type RiskComponent = {
  score: number; // 0-100
  drivers: string[];
  confidence: number;
};

export type VHIAction = {
  id: string;
  target: "patient" | "caregiver" | "provider";
  priority: "urgent" | "high" | "normal" | "low";
  actionType: "nudge" | "caregiver_alert" | "provider_alert" | "follow_up_reminder";
  title: string;
  rationale: string;
  dispatched: boolean;
  acknowledged: boolean;
};

export type ElevatingFactor = {
  factor: string;
  category: "genetic" | "behavioral" | "clinical" | "environmental";
  impact: "high" | "medium" | "low";
  source: string[];
  explanation: string;
};

export type DecliningFactor = {
  factor: string;
  category: "genetic" | "behavioral" | "clinical" | "environmental";
  impact: "high" | "medium" | "low";
  source: string[];
  explanation: string;
  recommendation: string;
};

export type VirtualHealthIdentity = {
  userId: string;
  version: number;
  computedAt: string; // ISO string

  geneticBaseline: {
    hasGeneticData: boolean;
    prsScores: Array<{
      condition: string;
      percentile: number;
      level: "low" | "average" | "elevated" | "high";
    }>;
    protectiveVariants: string[];
    riskVariants: string[];
    pharmacogenomics: Array<{
      drug: string;
      interaction: "standard" | "reduced_efficacy" | "increased_toxicity" | "contraindicated";
      gene: string;
    }>;
    ancestryGroup: string;
  } | null;

  currentState: {
    overallScore: number; // 0-100
    baselineConfidence: number; // 0-1
    /** 13-dimension grid — present when the server has baseline data; absent on first VHI. */
    dimensions?: {
      heartRate: VHIDimension;
      hrv: VHIDimension;
      sleepHours: VHIDimension;
      steps: VHIDimension;
      mood: VHIDimension;
      symptomBurden: VHIDimension;
      medicationAdherence: VHIDimension;
      bloodPressure: VHIDimension;
      bloodGlucose: VHIDimension;
      oxygenSaturation: VHIDimension;
      weight: VHIDimension;
      respiratoryRate: VHIDimension;
      bodyTemperature: VHIDimension;
    };
    riskScores: {
      fallRisk: RiskComponent;
      adherenceRisk: RiskComponent;
      deteriorationRisk: RiskComponent;
      geneticRiskLoad: RiskComponent;
      compositeRisk: number;
      /** Computed trajectory over the last 24 h of VHI cycles. */
      trajectory?: "worsening" | "stable" | "improving";
    };
  };

  /** Care-context layer — populated from clinical notes, labs, medications. */
  careContext?: {
    activeConditions: string[];
    activeAllergies: Array<{ substance: string; severity: string }>;
    activeMedications: Array<{ name: string; adherence: number }>;
    labAbnormalities: Array<{ test: string; value: string; flag: "high" | "low" | "critical" }>;
    recentDoctorNotes: Array<{
      date: string; // ISO string
      provider: string;
      keyPoints: string[];
    }>;
    lastClinicianVisit?: string; // ISO string
    pendingFollowUps: string[];
  };

  elevatingFactors: ElevatingFactor[];
  decliningFactors: DecliningFactor[];

  noraContextBlock: string;

  pendingActions: VHIAction[];
  /** Actions completed or acknowledged in the current VHI cycle. */
  recentActions?: VHIAction[];
};
