/**
 * Comprehensive list of all available HealthKit read permissions
 * This includes all HealthKit types that can be requested for reading
 */

export const ALL_HEALTHKIT_READ_TYPES = [
  // Heart & Cardiovascular
  "HKQuantityTypeIdentifierHeartRate",
  "HKQuantityTypeIdentifierRestingHeartRate",
  "HKQuantityTypeIdentifierWalkingHeartRateAverage",
  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  "HKQuantityTypeIdentifierBloodPressureSystolic",
  "HKQuantityTypeIdentifierBloodPressureDiastolic",
  "HKQuantityTypeIdentifierPeripheralPerfusionIndex",
  "HKQuantityTypeIdentifierVO2Max",
  "HKQuantityTypeIdentifierCardioFitness",
  
  // Respiratory
  "HKQuantityTypeIdentifierRespiratoryRate",
  "HKQuantityTypeIdentifierOxygenSaturation",
  "HKQuantityTypeIdentifierForcedVitalCapacity",
  "HKQuantityTypeIdentifierForcedExpiratoryVolume1",
  "HKQuantityTypeIdentifierPeakExpiratoryFlowRate",
  
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
  "HKQuantityTypeIdentifierDistanceWheelchair",
  "HKQuantityTypeIdentifierFlightsClimbed",
  "HKQuantityTypeIdentifierActiveEnergyBurned",
  "HKQuantityTypeIdentifierBasalEnergyBurned",
  "HKQuantityTypeIdentifierAppleExerciseTime",
  "HKQuantityTypeIdentifierAppleStandTime",
  "HKQuantityTypeIdentifierPushCount",
  "HKQuantityTypeIdentifierWheelchairDistance",
  "HKQuantityTypeIdentifierNikeFuel",
  "HKQuantityTypeIdentifierAppleMoveTime",
  
  // Workouts
  "HKWorkoutTypeIdentifier",
  
  // Sleep
  "HKCategoryTypeIdentifierSleepAnalysis",
  
  // Nutrition
  "HKQuantityTypeIdentifierDietaryWater",
  "HKQuantityTypeIdentifierDietaryCaffeine",
  "HKQuantityTypeIdentifierDietaryCalories",
  "HKQuantityTypeIdentifierDietaryCarbohydrates",
  "HKQuantityTypeIdentifierDietaryFatTotal",
  "HKQuantityTypeIdentifierDietaryFatSaturated",
  "HKQuantityTypeIdentifierDietaryFatMonounsaturated",
  "HKQuantityTypeIdentifierDietaryFatPolyunsaturated",
  "HKQuantityTypeIdentifierDietaryCholesterol",
  "HKQuantityTypeIdentifierDietarySodium",
  "HKQuantityTypeIdentifierDietarySugar",
  "HKQuantityTypeIdentifierDietaryEnergyConsumed",
  "HKQuantityTypeIdentifierDietaryProtein",
  "HKQuantityTypeIdentifierDietaryVitaminA",
  "HKQuantityTypeIdentifierDietaryVitaminB6",
  "HKQuantityTypeIdentifierDietaryVitaminB12",
  "HKQuantityTypeIdentifierDietaryVitaminC",
  "HKQuantityTypeIdentifierDietaryVitaminD",
  "HKQuantityTypeIdentifierDietaryVitaminE",
  "HKQuantityTypeIdentifierDietaryVitaminK",
  "HKQuantityTypeIdentifierDietaryCalcium",
  "HKQuantityTypeIdentifierDietaryIron",
  "HKQuantityTypeIdentifierDietaryThiamin",
  "HKQuantityTypeIdentifierDietaryRiboflavin",
  "HKQuantityTypeIdentifierDietaryNiacin",
  "HKQuantityTypeIdentifierDietaryFolate",
  "HKQuantityTypeIdentifierDietaryBiotin",
  "HKQuantityTypeIdentifierDietaryPantothenicAcid",
  "HKQuantityTypeIdentifierDietaryPhosphorus",
  "HKQuantityTypeIdentifierDietaryIodine",
  "HKQuantityTypeIdentifierDietaryMagnesium",
  "HKQuantityTypeIdentifierDietaryZinc",
  "HKQuantityTypeIdentifierDietarySelenium",
  "HKQuantityTypeIdentifierDietaryCopper",
  "HKQuantityTypeIdentifierDietaryManganese",
  "HKQuantityTypeIdentifierDietaryChromium",
  "HKQuantityTypeIdentifierDietaryMolybdenum",
  "HKQuantityTypeIdentifierDietaryChloride",
  "HKQuantityTypeIdentifierDietaryPotassium",
  
  // Glucose
  "HKQuantityTypeIdentifierBloodGlucose",
  "HKQuantityTypeIdentifierInsulinDelivery",
  
  // Reproductive Health
  "HKCategoryTypeIdentifierMenstrualFlow",
  "HKCategoryTypeIdentifierCervicalMucusQuality",
  "HKCategoryTypeIdentifierBasalBodyTemperature",
  "HKCategoryTypeIdentifierOvulationTestResult",
  "HKCategoryTypeIdentifierPregnancy",
  "HKCategoryTypeIdentifierLactation",
  "HKCategoryTypeIdentifierContraceptive",
  "HKCategoryTypeIdentifierSexualActivity",
  "HKCategoryTypeIdentifierIntermenstrualBleeding",
  
  // Vital Signs
  "HKQuantityTypeIdentifierBloodGlucose",
  "HKQuantityTypeIdentifierBloodAlcoholContent",
  
  // Hearing
  "HKQuantityTypeIdentifierEnvironmentalAudioExposure",
  "HKQuantityTypeIdentifierHeadphoneAudioExposure",
  
  // Mobility
  "HKQuantityTypeIdentifierWalkingSpeed",
  "HKQuantityTypeIdentifierWalkingDoubleSupportPercentage",
  "HKQuantityTypeIdentifierWalkingAsymmetryPercentage",
  "HKQuantityTypeIdentifierWalkingStepLength",
  "HKQuantityTypeIdentifierSixMinuteWalkTestDistance",
  "HKQuantityTypeIdentifierStairAscentSpeed",
  "HKQuantityTypeIdentifierStairDescentSpeed",
  
  // Other Metrics
  "HKQuantityTypeIdentifierNumberOfTimesFallen",
  "HKQuantityTypeIdentifierElectrodermalActivity",
  "HKQuantityTypeIdentifierInhalerUsage",
  "HKQuantityTypeIdentifierBloodPressure",
  "HKQuantityTypeIdentifierMindfulSession",
  "HKCategoryTypeIdentifierHighHeartRateEvent",
  "HKCategoryTypeIdentifierLowHeartRateEvent",
  "HKCategoryTypeIdentifierIrregularHeartRhythmEvent",
  "HKCategoryTypeIdentifierAudioExposureEvent",
  "HKCategoryTypeIdentifierToothbrushingEvent",
  "HKCategoryTypeIdentifierHandwashingEvent",
  "HKCategoryTypeIdentifierLowCardioFitnessEvent",
  "HKCategoryTypeIdentifierAppleWalkingSteadinessEvent",
  
  // Characteristic Types (read-only, set once)
  "HKCharacteristicTypeIdentifierBiologicalSex",
  "HKCharacteristicTypeIdentifierBloodType",
  "HKCharacteristicTypeIdentifierDateOfBirth",
  "HKCharacteristicTypeIdentifierFitzpatrickSkinType",
  "HKCharacteristicTypeIdentifierWheelchairUse",
];

/**
 * Get all HealthKit read types as a single array
 * This is used when requesting permissions for all available metrics
 */
export const getAllHealthKitReadTypes = (): string[] => {
  return [...ALL_HEALTHKIT_READ_TYPES];
};

