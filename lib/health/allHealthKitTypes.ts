/**
 * Comprehensive list of HealthKit read permissions
 * 
 * This includes essential HealthKit types for core health tracking.
 * Optimized to 68 types (down from 180+) by removing:
 * - Sensitive reproductive health details
 * - Alcohol consumption data
 * - Advanced clinical/research metrics
 * - Overly granular nutrition vitamins/minerals
 * - Specialized sports metrics
 * 
 * Last updated: December 23, 2025
 * Build: 26
 */

export const ALL_HEALTHKIT_READ_TYPES = [
  // Heart & Cardiovascular
  "HKQuantityTypeIdentifierHeartRate",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKQuantityTypeIdentifierWalkingHeartRateAverage",
  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  "HKQuantityTypeIdentifierBloodPressureSystolic",
  "HKQuantityTypeIdentifierBloodPressureDiastolic",
  "HKQuantityTypeIdentifierVO2Max",
  
  // Respiratory
  "HKQuantityTypeIdentifierRespiratoryRate",
  "HKQuantityTypeIdentifierOxygenSaturation",
  
  // Body Measurements
  "HKQuantityTypeIdentifierBodyMass",
  "HKQuantityTypeIdentifierHeight",
  "HKQuantityTypeIdentifierBodyMassIndex",
  "HKQuantityTypeIdentifierBodyFatPercentage",
  "HKQuantityTypeIdentifierLeanBodyMass",
  "HKQuantityTypeIdentifierWaistCircumference",
  
  // Temperature
  "HKQuantityTypeIdentifierBodyTemperature",
  "HKQuantityTypeIdentifierBasalBodyTemperature",
  
  // Activity & Fitness
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierDistanceWalkingRunning",
  "HKQuantityTypeIdentifierDistanceCycling",
  "HKQuantityTypeIdentifierDistanceSwimming",
  "HKQuantityTypeIdentifierBasalEnergyBurned",
  "HKQuantityTypeIdentifierActiveEnergyBurned",
  "HKQuantityTypeIdentifierFlightsClimbed",
  "HKQuantityTypeIdentifierAppleExerciseTime",
  "HKQuantityTypeIdentifierAppleMoveTime",
  "HKQuantityTypeIdentifierAppleStandTime",
  "HKCategoryTypeIdentifierAppleStandHour",
  
  // Workouts
  "HKWorkoutTypeIdentifier",
  
  // Sleep & Mindfulness
  "HKCategoryTypeIdentifierSleepAnalysis",
  "HKQuantityTypeIdentifierAppleSleepingWristTemperature",
  "HKCategoryTypeIdentifierMindfulSession",
  
  // Nutrition (Basic Macros Only)
  "HKQuantityTypeIdentifierDietaryWater",
  "HKQuantityTypeIdentifierDietaryCaffeine",
  "HKQuantityTypeIdentifierDietaryCalories",
  "HKQuantityTypeIdentifierDietaryCarbohydrates",
  "HKQuantityTypeIdentifierDietaryFatTotal",
  "HKQuantityTypeIdentifierDietaryFatSaturated",
  "HKQuantityTypeIdentifierDietaryCholesterol",
  "HKQuantityTypeIdentifierDietarySodium",
  "HKQuantityTypeIdentifierDietarySugar",
  "HKQuantityTypeIdentifierDietaryEnergyConsumed",
  "HKQuantityTypeIdentifierDietaryProtein",
  
  // Glucose
  "HKQuantityTypeIdentifierBloodGlucose",
  "HKQuantityTypeIdentifierInsulinDelivery",
  
  // Reproductive Health (Basic Only)
  "HKCategoryTypeIdentifierMenstrualFlow",
  "HKCategoryTypeIdentifierIntermenstrualBleeding",
  "HKQuantityTypeIdentifierBasalBodyTemperature",
  
  // Hearing
  "HKQuantityTypeIdentifierEnvironmentalAudioExposure",
  "HKQuantityTypeIdentifierHeadphoneAudioExposure",
  
  // Mobility
  "HKQuantityTypeIdentifierAppleWalkingSteadiness",
  "HKCategoryTypeIdentifierAppleWalkingSteadinessEvent",
  "HKQuantityTypeIdentifierWalkingSpeed",
  "HKQuantityTypeIdentifierWalkingStepLength",
  
  // Other Metrics
  "HKQuantityTypeIdentifierNumberOfTimesFallen",
  "HKQuantityTypeIdentifierInhalerUsage",
  "HKCorrelationTypeIdentifierBloodPressure",
  "HKCategoryTypeIdentifierHighHeartRateEvent",
  "HKCategoryTypeIdentifierLowHeartRateEvent",
  "HKCategoryTypeIdentifierIrregularHeartRhythmEvent",
  "HKCategoryTypeIdentifierLowCardioFitnessEvent",
  
  // UV Exposure
  "HKQuantityTypeIdentifierUVExposure",
  
  // Characteristic Types (read-only, set once)
  "HKCharacteristicTypeIdentifierBiologicalSex",
  "HKCharacteristicTypeIdentifierBloodType",
  "HKCharacteristicTypeIdentifierDateOfBirth",
  "HKCharacteristicTypeIdentifierFitzpatrickSkinType",
  "HKCharacteristicTypeIdentifierWheelchairUse",
  "HKCharacteristicTypeIdentifierActivityMoveMode",
];

/**
 * Get all HealthKit read types as a single array
 * This is used when requesting permissions for all available metrics
 */
export const getAllHealthKitReadTypes = (): string[] => {
  return [...ALL_HEALTHKIT_READ_TYPES];
};

