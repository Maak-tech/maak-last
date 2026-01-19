/**
 * Health Metrics Catalog
 * Unified metric definitions across all health providers
 */

export type MetricGroup =
  | "heart_cardiovascular"
  | "respiratory"
  | "temperature"
  | "body_measurements"
  | "activity_fitness"
  | "sleep"
  | "nutrition"
  | "glucose";

export type HealthProvider =
  | "apple_health"
  | "health_connect"
  | "fitbit"
  | "samsung_health"
  | "garmin"
  | "withings"
  | "oura"
  | "dexcom"
  | "freestyle_libre";

export interface HealthMetric {
  key: string;
  displayName: string;
  group: MetricGroup;
  unit?: string;
  description?: string;
  // Provider availability
  appleHealth?: {
    available: boolean;
    type: string; // HKQuantityTypeIdentifier or HKCategoryTypeIdentifier
  };
  healthConnect?: {
    available: boolean;
    recordType: string; // Health Connect record type
    permission: string; // Health Connect permission string
  };
  fitbit?: {
    available: boolean;
    scope: string; // Fitbit OAuth scope
    endpoint?: string; // Fitbit API endpoint path
  };
  samsungHealth?: {
    available: boolean;
    scope: string; // Samsung Health OAuth scope
    endpoint?: string; // Samsung Health API endpoint path
  };
  garmin?: {
    available: boolean;
    scope: string; // Garmin OAuth scope
    endpoint?: string; // Garmin API endpoint path
  };
  withings?: {
    available: boolean;
    scope: string; // Withings OAuth scope
    category: number; // Withings measurement category
  };
  oura?: {
    available: boolean;
    scope: string; // Oura OAuth scope
    endpoint?: string; // Oura API endpoint path
  };
  dexcom?: {
    available: boolean;
    scope: string; // Dexcom OAuth scope
  };
  freestyleLibre?: {
    available: boolean;
    scope: string; // Freestyle Libre OAuth scope
  };
}

/**
 * Complete catalog of health metrics
 */
export const HEALTH_METRICS_CATALOG: HealthMetric[] = [
  // Heart & Cardiovascular
  {
    key: "heart_rate",
    displayName: "Heart Rate",
    group: "heart_cardiovascular",
    unit: "bpm",
    description: "Beats per minute",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierHeartRate",
    },
    healthConnect: {
      available: true,
      recordType: "HeartRateRecord",
      permission: "android.permission.health.READ_HEART_RATE",
    },
    fitbit: {
      available: true,
      scope: "heartrate",
      endpoint: "/1/user/-/activities/heart/date/{date}/1d.json",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.heart_rate",
      endpoint: "/users/me/health-data/heart-rate/daily/{date}",
    },
    garmin: {
      available: true,
      scope: "heartrate",
      endpoint: "/wellness-api/rest/heartRate",
    },
    oura: {
      available: true,
      scope: "heartrate",
      endpoint: "/v2/usercollection/heartrate",
    },
    withings: {
      available: true,
      scope: "user.metrics",
      category: 11, // Pulse/Heart rate category
    },
  },
  {
    key: "resting_heart_rate",
    displayName: "Resting Heart Rate",
    group: "heart_cardiovascular",
    unit: "bpm",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierRestingHeartRate",
    },
    healthConnect: {
      available: true,
      recordType: "RestingHeartRateRecord",
      permission: "android.permission.health.READ_RESTING_HEART_RATE",
    },
    fitbit: {
      available: true,
      scope: "heartrate",
      endpoint: "/1/user/-/activities/heart/date/{date}/1d.json",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.heart_rate",
    },
    garmin: {
      available: true,
      scope: "heartrate",
      endpoint: "/wellness-api/rest/dailies",
    },
    oura: {
      available: true,
      scope: "heartrate",
      endpoint: "/v2/usercollection/daily_sleep",
    },
  },
  {
    key: "heart_rate_variability",
    displayName: "Heart Rate Variability",
    group: "heart_cardiovascular",
    unit: "ms",
    description: "SDNN in milliseconds",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
    },
    healthConnect: {
      available: true,
      recordType: "HeartRateVariabilityRmssdRecord",
      permission: "android.permission.health.READ_HEART_RATE_VARIABILITY",
    },
    fitbit: {
      available: true,
      scope: "heartrate",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.heart_rate",
      endpoint: "/users/me/health-data/heart-rate-variability/daily/{date}",
    },
    garmin: {
      available: true,
      scope: "heartrate",
      endpoint: "/wellness-api/rest/hrv",
    },
    oura: {
      available: true,
      scope: "heartrate",
      endpoint: "/v2/usercollection/daily_cardiovascular_age",
    },
  },
  {
    key: "walking_heart_rate_average",
    displayName: "Walking Heart Rate Average",
    group: "heart_cardiovascular",
    unit: "bpm",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierWalkingHeartRateAverage",
    },
    healthConnect: {
      available: false,
      recordType: "",
      permission: "",
    },
    fitbit: {
      available: false,
      scope: "",
    },
  },
  {
    key: "blood_pressure_systolic",
    displayName: "Blood Pressure (Systolic)",
    group: "heart_cardiovascular",
    unit: "mmHg",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierBloodPressureSystolic",
    },
    healthConnect: {
      available: true,
      recordType: "BloodPressureRecord",
      permission: "android.permission.health.READ_BLOOD_PRESSURE",
    },
    fitbit: {
      available: false,
      scope: "",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.blood_pressure",
    },
    withings: {
      available: true,
      scope: "user.metrics",
      category: 10, // Withings blood pressure category
    },
  },
  {
    key: "blood_pressure_diastolic",
    displayName: "Blood Pressure (Diastolic)",
    group: "heart_cardiovascular",
    unit: "mmHg",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierBloodPressureDiastolic",
    },
    healthConnect: {
      available: true,
      recordType: "BloodPressureRecord",
      permission: "android.permission.health.READ_BLOOD_PRESSURE",
    },
    fitbit: {
      available: false,
      scope: "",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.blood_pressure",
      endpoint: "/users/me/health-data/blood-pressure/{date}",
    },
    withings: {
      available: true,
      scope: "user.metrics",
      category: 9, // Withings diastolic blood pressure category
    },
  },

  // Respiratory
  {
    key: "respiratory_rate",
    displayName: "Respiratory Rate",
    group: "respiratory",
    unit: "breaths/min",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierRespiratoryRate",
    },
    healthConnect: {
      available: true,
      recordType: "RespiratoryRateRecord",
      permission: "android.permission.health.READ_RESPIRATORY_RATE",
    },
    fitbit: {
      available: true,
      scope: "respiratory_rate",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.respiratory_rate",
      endpoint: "/users/me/health-data/respiratory-rate/{date}",
    },
    garmin: {
      available: true,
      scope: "respiratory",
      endpoint: "/wellness-api/rest/respiration",
    },
    oura: {
      available: true,
      scope: "daily",
      endpoint: "/v2/usercollection/daily_sleep",
    },
  },
  {
    key: "blood_oxygen",
    displayName: "Blood Oxygen (SpO2)",
    group: "respiratory",
    unit: "%",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierOxygenSaturation",
    },
    healthConnect: {
      available: true,
      recordType: "OxygenSaturationRecord",
      permission: "android.permission.health.READ_OXYGEN_SATURATION",
    },
    fitbit: {
      available: true,
      scope: "oxygen_saturation",
      endpoint: "/1/user/-/spo2/date/{date}.json",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.oxygen_saturation",
      endpoint: "/users/me/health-data/oxygen-saturation/{date}",
    },
    garmin: {
      available: true,
      scope: "pulse_ox",
      endpoint: "/wellness-api/rest/pulseOx",
    },
    oura: {
      available: true,
      scope: "daily",
      endpoint: "/v2/usercollection/daily_spo2",
    },
    withings: {
      available: true,
      scope: "user.metrics",
      category: 54, // SpO2 category
    },
  },

  // Temperature
  {
    key: "body_temperature",
    displayName: "Body Temperature",
    group: "temperature",
    unit: "°C",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierBodyTemperature",
    },
    healthConnect: {
      available: true,
      recordType: "BodyTemperatureRecord",
      permission: "android.permission.health.READ_BODY_TEMPERATURE",
    },
    fitbit: {
      available: true,
      scope: "temperature",
      endpoint: "/1/user/-/temp/skin/date/{date}.json",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.body_temperature",
      endpoint: "/users/me/health-data/body-temperature/{date}",
    },
    oura: {
      available: true,
      scope: "daily",
      endpoint: "/v2/usercollection/daily_readiness",
    },
    withings: {
      available: true,
      scope: "user.metrics",
      category: 12, // Body temperature category
    },
  },

  // Body Measurements
  {
    key: "weight",
    displayName: "Weight",
    group: "body_measurements",
    unit: "kg",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierBodyMass",
    },
    healthConnect: {
      available: true,
      recordType: "WeightRecord",
      permission: "android.permission.health.READ_WEIGHT",
    },
    fitbit: {
      available: true,
      scope: "weight",
      endpoint: "/1/user/-/body/log/weight/date/{date}/1m.json",
    },
    withings: {
      available: true,
      scope: "user.metrics",
      category: 1, // Weight category
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.body_composition",
      endpoint: "/users/me/health-data/body-composition/{date}",
    },
    garmin: {
      available: true,
      scope: "body_composition",
      endpoint: "/wellness-api/rest/bodyComposition",
    },
  },
  {
    key: "height",
    displayName: "Height",
    group: "body_measurements",
    unit: "cm",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierHeight",
    },
    healthConnect: {
      available: true,
      recordType: "HeightRecord",
      permission: "android.permission.health.READ_HEIGHT",
    },
    fitbit: {
      available: false,
      scope: "",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.user_profile",
      endpoint: "/users/me/profile",
    },
    withings: {
      available: true,
      scope: "user.metrics",
      category: 4, // Height category
    },
  },
  {
    key: "body_mass_index",
    displayName: "Body Mass Index",
    group: "body_measurements",
    unit: "kg/m²",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierBodyMassIndex",
    },
    healthConnect: {
      available: true,
      recordType: "BodyMassIndexRecord",
      permission: "android.permission.health.READ_BODY_MASS_INDEX",
    },
    fitbit: {
      available: true,
      scope: "weight",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.body_composition",
      endpoint: "/users/me/health-data/body-composition/{date}",
    },
    garmin: {
      available: true,
      scope: "body_composition",
      endpoint: "/wellness-api/rest/bodyComposition",
    },
    withings: {
      available: true,
      scope: "user.metrics",
      category: 1, // Calculated from weight/height
    },
  },
  {
    key: "body_fat_percentage",
    displayName: "Body Fat Percentage",
    group: "body_measurements",
    unit: "%",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierBodyFatPercentage",
    },
    healthConnect: {
      available: true,
      recordType: "BodyFatRecord",
      permission: "android.permission.health.READ_BODY_FAT",
    },
    fitbit: {
      available: true,
      scope: "weight",
      endpoint: "/1/user/-/body/log/fat/date/{date}/1m.json",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.body_composition",
      endpoint: "/users/me/health-data/body-composition/{date}",
    },
    garmin: {
      available: true,
      scope: "body_composition",
      endpoint: "/wellness-api/rest/bodyComposition",
    },
    withings: {
      available: true,
      scope: "user.metrics",
      category: 6, // Fat ratio category
    },
  },

  // Activity & Fitness
  {
    key: "steps",
    displayName: "Steps",
    group: "activity_fitness",
    unit: "count",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierStepCount",
    },
    healthConnect: {
      available: true,
      recordType: "StepsRecord",
      permission: "android.permission.health.READ_STEPS",
    },
    fitbit: {
      available: true,
      scope: "activity",
      endpoint: "/1/user/-/activities/steps/date/{date}/1d.json",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.step_count",
      endpoint: "/users/me/health-data/step-count/daily/{date}",
    },
    garmin: {
      available: true,
      scope: "activity",
      endpoint: "/wellness-api/rest/dailies",
    },
    oura: {
      available: true,
      scope: "daily",
      endpoint: "/v2/usercollection/daily_activity",
    },
  },
  {
    key: "active_energy",
    displayName: "Active Energy Burned",
    group: "activity_fitness",
    unit: "kcal",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierActiveEnergyBurned",
    },
    healthConnect: {
      available: true,
      recordType: "ActiveCaloriesBurnedRecord",
      permission: "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
    },
    fitbit: {
      available: true,
      scope: "activity",
      endpoint: "/1/user/-/activities/calories/date/{date}/1d.json",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.activity",
      endpoint: "/users/me/health-data/activity-summary/daily/{date}",
    },
    garmin: {
      available: true,
      scope: "activity",
      endpoint: "/wellness-api/rest/dailies",
    },
    oura: {
      available: true,
      scope: "daily",
      endpoint: "/v2/usercollection/daily_activity",
    },
  },
  {
    key: "basal_energy",
    displayName: "Basal Energy Burned",
    group: "activity_fitness",
    unit: "kcal",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierBasalEnergyBurned",
    },
    healthConnect: {
      available: true,
      recordType: "BasalMetabolicRateRecord",
      permission: "android.permission.health.READ_BASAL_METABOLIC_RATE",
    },
    fitbit: {
      available: true,
      scope: "activity",
    },
    garmin: {
      available: true,
      scope: "activity",
      endpoint: "/wellness-api/rest/dailies",
    },
  },
  {
    key: "distance_walking_running",
    displayName: "Distance Walking/Running",
    group: "activity_fitness",
    unit: "km",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierDistanceWalkingRunning",
    },
    healthConnect: {
      available: true,
      recordType: "DistanceRecord",
      permission: "android.permission.health.READ_DISTANCE",
    },
    fitbit: {
      available: true,
      scope: "activity",
      endpoint: "/1/user/-/activities/distance/date/{date}/1d.json",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.activity",
      endpoint: "/users/me/health-data/activity-summary/daily/{date}",
    },
    garmin: {
      available: true,
      scope: "activity",
      endpoint: "/wellness-api/rest/dailies",
    },
    oura: {
      available: true,
      scope: "daily",
      endpoint: "/v2/usercollection/daily_activity",
    },
  },
  {
    key: "flights_climbed",
    displayName: "Flights Climbed",
    group: "activity_fitness",
    unit: "count",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierFlightsClimbed",
    },
    healthConnect: {
      available: true,
      recordType: "FloorsClimbedRecord",
      permission: "android.permission.health.READ_FLOORS_CLIMBED",
    },
    fitbit: {
      available: true,
      scope: "activity",
      endpoint: "/1/user/-/activities/floors/date/{date}/1d.json",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.floors_climbed",
      endpoint: "/users/me/health-data/floors-climbed/daily/{date}",
    },
    garmin: {
      available: true,
      scope: "activity",
      endpoint: "/wellness-api/rest/dailies",
    },
  },
  {
    key: "exercise_minutes",
    displayName: "Exercise Minutes",
    group: "activity_fitness",
    unit: "min",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierAppleExerciseTime",
    },
    healthConnect: {
      available: true,
      recordType: "ExerciseSessionRecord",
      permission: "android.permission.health.READ_EXERCISE",
    },
    fitbit: {
      available: true,
      scope: "activity",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.exercise",
      endpoint: "/users/me/health-data/exercise/{date}",
    },
  },
  {
    key: "stand_time",
    displayName: "Stand Time",
    group: "activity_fitness",
    unit: "min",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierAppleStandTime",
    },
    healthConnect: {
      available: false,
      recordType: "",
      permission: "",
    },
    fitbit: {
      available: false,
      scope: "",
    },
  },
  {
    key: "workouts",
    displayName: "Workouts",
    group: "activity_fitness",
    description: "Exercise sessions with type, duration, calories, distance",
    appleHealth: {
      available: true,
      type: "HKWorkoutTypeIdentifier",
    },
    healthConnect: {
      available: true,
      recordType: "ExerciseSessionRecord",
      permission: "android.permission.health.READ_EXERCISE",
    },
    fitbit: {
      available: true,
      scope: "activity",
      endpoint: "/1/user/-/activities/date/{date}.json",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.exercise",
      endpoint: "/users/me/health-data/exercise/{date}",
    },
    garmin: {
      available: true,
      scope: "activity",
      endpoint: "/wellness-api/rest/activities",
    },
    oura: {
      available: true,
      scope: "workout",
      endpoint: "/v2/usercollection/workout",
    },
  },

  // Sleep
  {
    key: "sleep_analysis",
    displayName: "Sleep Analysis",
    group: "sleep",
    description: "Sleep stages and duration",
    appleHealth: {
      available: true,
      type: "HKCategoryTypeIdentifierSleepAnalysis",
    },
    healthConnect: {
      available: true,
      recordType: "SleepSessionRecord",
      permission: "android.permission.health.READ_SLEEP",
    },
    fitbit: {
      available: true,
      scope: "sleep",
      endpoint: "/1.2/user/-/sleep/date/{date}.json",
    },
    oura: {
      available: true,
      scope: "sleep",
      endpoint: "/v2/usercollection/sleep",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.sleep",
      endpoint: "/users/me/health-data/sleep/{date}",
    },
    garmin: {
      available: true,
      scope: "sleep",
      endpoint: "/wellness-api/rest/sleep",
    },
  },

  // Nutrition
  {
    key: "water_intake",
    displayName: "Water Intake",
    group: "nutrition",
    unit: "ml",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierDietaryWater",
    },
    healthConnect: {
      available: true,
      recordType: "HydrationRecord",
      permission: "android.permission.health.READ_HYDRATION",
    },
    fitbit: {
      available: true,
      scope: "nutrition",
      endpoint: "/1/user/-/foods/log/water/date/{date}.json",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.water_intake",
      endpoint: "/users/me/health-data/water-intake/{date}",
    },
    garmin: {
      available: true,
      scope: "nutrition",
      endpoint: "/wellness-api/rest/hydration",
    },
  },

  // Glucose
  {
    key: "blood_glucose",
    displayName: "Blood Glucose",
    group: "glucose",
    unit: "mg/dL",
    appleHealth: {
      available: true,
      type: "HKQuantityTypeIdentifierBloodGlucose",
    },
    healthConnect: {
      available: true,
      recordType: "BloodGlucoseRecord",
      permission: "android.permission.health.READ_BLOOD_GLUCOSE",
    },
    fitbit: {
      available: false,
      scope: "",
    },
    dexcom: {
      available: true,
      scope: "offline_access",
    },
    samsungHealth: {
      available: true,
      scope: "com.samsung.health.blood_glucose",
      endpoint: "/users/me/health-data/blood-glucose/{date}",
    },
  },
];

/**
 * Get metrics grouped by category
 */
export const getMetricsByGroup = (group: MetricGroup): HealthMetric[] =>
  HEALTH_METRICS_CATALOG.filter((metric) => metric.group === group);

/**
 * Get available metrics for a specific provider
 */
export const getAvailableMetricsForProvider = (
  provider: HealthProvider
): HealthMetric[] =>
  HEALTH_METRICS_CATALOG.filter((metric) => {
    switch (provider) {
      case "apple_health":
        return metric.appleHealth?.available;
      case "health_connect":
        return metric.healthConnect?.available;
      case "fitbit":
        return metric.fitbit?.available;
      case "samsung_health":
        return metric.samsungHealth?.available;
      case "garmin":
        return metric.garmin?.available;
      case "withings":
        return metric.withings?.available;
      case "oura":
        return metric.oura?.available;
      case "dexcom":
        return metric.dexcom?.available;
      case "freestyle_libre":
        return metric.freestyleLibre?.available;
      default:
        return false;
    }
  });

/**
 * Get metric by key
 */
export const getMetricByKey = (key: string): HealthMetric | undefined =>
  HEALTH_METRICS_CATALOG.find((metric) => metric.key === key);

/**
 * Get group display name
 */
export const getGroupDisplayName = (
  group: MetricGroup,
  language = "en"
): string => {
  const namesEn: Record<MetricGroup, string> = {
    heart_cardiovascular: "Heart & Cardiovascular",
    respiratory: "Respiratory",
    temperature: "Temperature",
    body_measurements: "Body Measurements",
    activity_fitness: "Activity & Fitness",
    sleep: "Sleep",
    nutrition: "Nutrition",
    glucose: "Glucose",
  };
  const namesAr: Record<MetricGroup, string> = {
    heart_cardiovascular: "القلب والأوعية الدموية",
    respiratory: "التنفس",
    temperature: "درجة الحرارة",
    body_measurements: "قياسات الجسم",
    activity_fitness: "النشاط واللياقة",
    sleep: "النوم",
    nutrition: "التغذية",
    glucose: "السكر",
  };
  return language === "ar" ? namesAr[group] : namesEn[group];
};

/**
 * Get all unique groups
 */
export const getAllGroups = (): MetricGroup[] => [
  "heart_cardiovascular",
  "respiratory",
  "temperature",
  "body_measurements",
  "activity_fitness",
  "sleep",
  "nutrition",
  "glucose",
];

/**
 * Get Fitbit scopes needed for selected metrics
 */
export const getFitbitScopesForMetrics = (metricKeys: string[]): string[] => {
  const scopes = new Set<string>();
  metricKeys.forEach((key) => {
    const metric = getMetricByKey(key);
    if (metric?.fitbit?.scope) {
      scopes.add(metric.fitbit.scope);
    }
  });
  return Array.from(scopes);
};

/**
 * Get Samsung Health scopes for selected metrics
 */
export const getSamsungHealthScopesForMetrics = (
  metricKeys: string[]
): string[] => {
  const scopes = new Set<string>();
  metricKeys.forEach((key) => {
    const metric = getMetricByKey(key);
    if (metric?.samsungHealth?.scope) {
      scopes.add(metric.samsungHealth.scope);
    }
  });
  return Array.from(scopes);
};

/**
 * Get Garmin scopes for selected metrics
 */
export const getGarminScopesForMetrics = (metricKeys: string[]): string[] => {
  const scopes = new Set<string>();
  metricKeys.forEach((key) => {
    const metric = getMetricByKey(key);
    if (metric?.garmin?.scope) {
      scopes.add(metric.garmin.scope);
    }
  });
  return Array.from(scopes);
};

/**
 * Get Withings scopes for selected metrics
 */
export const getWithingsScopesForMetrics = (metricKeys: string[]): string[] => {
  const scopes = new Set<string>();
  metricKeys.forEach((key) => {
    const metric = getMetricByKey(key);
    if (metric?.withings?.scope) {
      scopes.add(metric.withings.scope);
    }
  });
  return Array.from(scopes);
};

/**
 * Get Oura scopes for selected metrics
 */
export const getOuraScopesForMetrics = (metricKeys: string[]): string[] => {
  const scopes = new Set<string>();
  metricKeys.forEach((key) => {
    const metric = getMetricByKey(key);
    if (metric?.oura?.scope) {
      scopes.add(metric.oura.scope);
    }
  });
  return Array.from(scopes);
};

/**
 * Get Dexcom scopes for selected metrics
 */
export const getDexcomScopesForMetrics = (metricKeys: string[]): string[] => {
  const scopes = new Set<string>();
  metricKeys.forEach((key) => {
    const metric = getMetricByKey(key);
    if (metric?.dexcom?.scope) {
      scopes.add(metric.dexcom.scope);
    }
  });
  return Array.from(scopes);
};

/**
 * Get Freestyle Libre scopes for selected metrics
 */
export const getFreestyleLibreScopesForMetrics = (
  metricKeys: string[]
): string[] => {
  const scopes = new Set<string>();
  metricKeys.forEach((key) => {
    const metric = getMetricByKey(key);
    if (metric?.freestyleLibre?.scope) {
      scopes.add(metric.freestyleLibre.scope);
    }
  });
  return Array.from(scopes);
};

/**
 * Get Health Connect permissions for selected metrics
 */
export const getHealthConnectPermissionsForMetrics = (
  metricKeys: string[]
): string[] => {
  const permissions = new Set<string>();
  metricKeys.forEach((key) => {
    const metric = getMetricByKey(key);
    if (metric?.healthConnect?.permission) {
      permissions.add(metric.healthConnect.permission);
    }
  });
  return Array.from(permissions);
};
