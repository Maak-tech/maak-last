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
  | "freestyle_libre"
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
  /** Optional human-readable display name (overrides labelEn when set) */
  displayName?: string;
  /** Samsung Health data type mapping */
  samsungHealth?: { dataType: string; field?: string; endpoint?: string };
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

export function getMetricByKey(key: string): HealthMetricDefinition | undefined {
  return HEALTH_METRICS_CATALOG.find((m) => m.key === key);
}

/** Alias — returns the same result as getMetricsForProvider */
export function getAvailableMetricsForProvider(
  provider: HealthProvider
): HealthMetricDefinition[] {
  return getMetricsForProvider(provider);
}

// ── Provider-specific OAuth scope helpers ─────────────────────────────────────

/** Maps a list of metric keys to the Fitbit OAuth scopes required to read them. */
export function getFitbitScopesForMetrics(metricKeys: string[]): string[] {
  const scopeMap: Record<string, string> = {
    heartRate: "heartrate",
    hrv: "heartrate",
    steps: "activity",
    sleepHours: "sleep",
    weight: "weight",
    bloodOxygen: "oxygen_saturation",
    oxygenSaturation: "oxygen_saturation",
  };
  const scopes = new Set<string>();
  for (const key of metricKeys) {
    const scope = scopeMap[key];
    if (scope) scopes.add(scope);
  }
  return Array.from(scopes);
}

/** Maps metric keys to the Oura OAuth scopes required to read them. */
export function getOuraScopesForMetrics(metricKeys: string[]): string[] {
  const scopeMap: Record<string, string> = {
    heartRate: "heartrate",
    hrv: "heartrate",
    sleepHours: "daily.sleep",
    steps: "daily.activity",
    oxygenSaturation: "daily.readiness",
  };
  const scopes = new Set<string>();
  for (const key of metricKeys) {
    const scope = scopeMap[key];
    if (scope) scopes.add(scope);
  }
  return Array.from(scopes);
}

/** Maps metric keys to the Withings OAuth scopes required to read them. */
export function getWithingsScopesForMetrics(metricKeys: string[]): string[] {
  const scopeMap: Record<string, string> = {
    weight: "user.metrics",
    bloodPressure: "user.metrics",
    heartRate: "user.metrics",
    sleepHours: "user.sleepevents",
    steps: "user.activity",
  };
  const scopes = new Set<string>();
  for (const key of metricKeys) {
    const scope = scopeMap[key];
    if (scope) scopes.add(scope);
  }
  return Array.from(scopes);
}

/** Maps metric keys to the Samsung Health permissions required to read them. */
export function getSamsungHealthScopesForMetrics(metricKeys: string[]): string[] {
  const scopeMap: Record<string, string> = {
    heartRate: "com.samsung.health.heart_rate",
    steps: "com.samsung.health.step_count",
    sleepHours: "com.samsung.health.sleep",
    weight: "com.samsung.health.weight",
    oxygenSaturation: "com.samsung.health.oxygen_saturation",
  };
  const scopes = new Set<string>();
  for (const key of metricKeys) {
    const scope = scopeMap[key];
    if (scope) scopes.add(scope);
  }
  return Array.from(scopes);
}

/** Maps metric keys to the Dexcom OAuth scopes required to read them. */
export function getDexcomScopesForMetrics(metricKeys: string[]): string[] {
  // Dexcom only has a few scopes; EGV covers glucose readings
  const scopeMap: Record<string, string> = {
    bloodGlucose: "offline_access egv",
    glucoseTrend: "offline_access egv",
  };
  const scopes = new Set<string>(["offline_access"]);
  for (const key of metricKeys) {
    const mapped = scopeMap[key];
    if (mapped) {
      for (const s of mapped.split(" ")) scopes.add(s);
    }
  }
  return Array.from(scopes);
}
