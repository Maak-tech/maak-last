/**
 * Health metrics catalog — defines which metrics each provider supports
 * and their display metadata.
 */

export type HealthProvider =
  | "apple_health"
  | "health_connect"
  | "fitbit"
  | "garmin"
  | "oura"
  | "withings"
  | "samsung_health"
  | "dexcom"
  | "manual";

export interface HealthMetricDefinition {
  key: string;
  labelEn: string;
  labelAr: string;
  unit: string;
  category: "vitals" | "activity" | "sleep" | "body" | "nutrition" | "glucose";
  /** Which providers can supply this metric */
  supportedProviders: HealthProvider[];
  /** Expected typical range for a healthy adult [min, max] */
  normalRange?: [number, number];
}

export const HEALTH_METRICS_CATALOG: HealthMetricDefinition[] = [
  {
    key: "heartRate",
    labelEn: "Heart Rate",
    labelAr: "معدل ضربات القلب",
    unit: "bpm",
    category: "vitals",
    supportedProviders: ["apple_health", "health_connect", "fitbit", "garmin", "oura", "withings", "samsung_health"],
    normalRange: [50, 100],
  },
  {
    key: "hrv",
    labelEn: "Heart Rate Variability",
    labelAr: "تقلب معدل ضربات القلب",
    unit: "ms",
    category: "vitals",
    supportedProviders: ["apple_health", "health_connect", "garmin", "oura"],
    normalRange: [20, 80],
  },
  {
    key: "bloodPressure",
    labelEn: "Blood Pressure",
    labelAr: "ضغط الدم",
    unit: "mmHg",
    category: "vitals",
    supportedProviders: ["apple_health", "health_connect", "withings"],
    normalRange: [60, 140],
  },
  {
    key: "oxygenSaturation",
    labelEn: "Blood Oxygen",
    labelAr: "تشبع الأكسجين",
    unit: "%",
    category: "vitals",
    supportedProviders: ["apple_health", "health_connect", "garmin", "oura"],
    normalRange: [95, 100],
  },
  {
    key: "steps",
    labelEn: "Steps",
    labelAr: "الخطوات",
    unit: "steps",
    category: "activity",
    supportedProviders: ["apple_health", "health_connect", "fitbit", "garmin", "samsung_health"],
    normalRange: [5000, 15000],
  },
  {
    key: "sleepHours",
    labelEn: "Sleep",
    labelAr: "النوم",
    unit: "hrs",
    category: "sleep",
    supportedProviders: ["apple_health", "health_connect", "fitbit", "garmin", "oura", "samsung_health"],
    normalRange: [7, 9],
  },
  {
    key: "weight",
    labelEn: "Weight",
    labelAr: "الوزن",
    unit: "kg",
    category: "body",
    supportedProviders: ["apple_health", "health_connect", "withings"],
    normalRange: [40, 200],
  },
  {
    key: "bloodGlucose",
    labelEn: "Blood Glucose",
    labelAr: "سكر الدم",
    unit: "mg/dL",
    category: "glucose",
    supportedProviders: ["apple_health", "health_connect", "dexcom"],
    normalRange: [70, 140],
  },
];

export function getMetricsForProvider(provider: HealthProvider): HealthMetricDefinition[] {
  return HEALTH_METRICS_CATALOG.filter((m) => m.supportedProviders.includes(provider));
}
