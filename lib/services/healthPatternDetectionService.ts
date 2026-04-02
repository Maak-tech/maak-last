export interface VitalSample {
  id: string;
  type: string;
  value: number;
  unit?: string;
  timestamp: Date;
  source?: string;
}

export interface PatternInsight {
  type: string;
  title: string;
  description: string;
  confidence: number; // 0–100
  actionable?: boolean;
  recommendation?: string;
}

// ─── Stubs ─────────────────────────────────────────────────────────────────────
// These are full implementations in the ML service layer; the mobile service
// only calls them and renders results — logic lives server-side.

export async function detectVitalTrends(
  _userId: string,
  _vitals: VitalSample[]
): Promise<PatternInsight[]> {
  return [];
}

export async function detectTemporalPatterns(
  _userId: string,
  _vitals: VitalSample[]
): Promise<PatternInsight[]> {
  return [];
}

export async function detectMedicationCorrelations(
  _userId: string,
  _vitals: VitalSample[]
): Promise<PatternInsight[]> {
  return [];
}

export async function detectIntegrationSpecificInsights(
  _userId: string
): Promise<PatternInsight[]> {
  return [];
}
