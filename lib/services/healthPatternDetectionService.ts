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

export function detectVitalTrends(
  _vitals: unknown[],
  _isArabic?: boolean,
  _userId?: string,
  _flag?: boolean
): PatternInsight[] {
  return [];
}

export function detectTemporalPatterns(
  _symptoms: unknown[],
  _moods: unknown[],
  _isArabic?: boolean
): PatternInsight[] {
  return [];
}

export function detectMedicationCorrelations(
  _symptoms: unknown[],
  _medications: unknown[],
  _isArabic?: boolean
): PatternInsight[] {
  return [];
}

export function detectIntegrationSpecificInsights(
  _vitals: unknown[],
  _isArabic?: boolean
): PatternInsight[] {
  return [];
}

export function detectTrends(
  _symptoms: unknown[],
  _moods: unknown[],
  _isArabic?: boolean,
  _userId?: string,
  _flag?: boolean
): PatternInsight[] {
  return [];
}

export function detectVitalRanges(
  _vitals: unknown[],
  _isArabic?: boolean
): PatternInsight[] {
  return [];
}
