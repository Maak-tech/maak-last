# Maak Health - HealthKit Permissions Requested

## Overview

This document lists all HealthKit data types that Maak Health requests access to, organized by category.

**Last Updated**: December 23, 2025  
**Build Number**: 26  
**Total Types**: 68 types (cleaned and optimized)

## Build Configuration

✅ **HealthKit Entitlement**: Enabled (`com.apple.developer.healthkit: true`)  
✅ **Plugin**: `react-native-health` configured  
✅ **Info.plist**: NSHealthShareUsageDescription and NSHealthUpdateUsageDescription set  
✅ **Build Number**: 26

## Permission Request Behavior

The app requests permissions in two ways:

1. **"Select All" or No Selection**: Requests ALL available HealthKit types (68 types)
2. **Specific Selection**: Requests only the selected metrics mapped to their HealthKit types

---

## HealthKit Data Types Requested

### When "Select All" is chosen, the app requests:

#### **Heart & Cardiovascular** (7 types)
- `HKQuantityTypeIdentifierHeartRate` - Heart Rate
- `HKQuantityTypeIdentifierRestingHeartRate` - Resting Heart Rate
- `HKQuantityTypeIdentifierWalkingHeartRateAverage` - Walking Heart Rate Average
- `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` - Heart Rate Variability
- `HKQuantityTypeIdentifierBloodPressureSystolic` - Blood Pressure (Systolic)
- `HKQuantityTypeIdentifierBloodPressureDiastolic` - Blood Pressure (Diastolic)
- `HKQuantityTypeIdentifierVO2Max` - VO2 Max

#### **Respiratory** (2 types)
- `HKQuantityTypeIdentifierRespiratoryRate` - Respiratory Rate
- `HKQuantityTypeIdentifierOxygenSaturation` - Blood Oxygen (SpO2)

#### **Body Measurements** (6 types)
- `HKQuantityTypeIdentifierBodyMass` - Weight
- `HKQuantityTypeIdentifierHeight` - Height
- `HKQuantityTypeIdentifierBodyMassIndex` - Body Mass Index (BMI)
- `HKQuantityTypeIdentifierBodyFatPercentage` - Body Fat Percentage
- `HKQuantityTypeIdentifierLeanBodyMass` - Lean Body Mass
- `HKQuantityTypeIdentifierWaistCircumference` - Waist Circumference

#### **Temperature** (2 types)
- `HKQuantityTypeIdentifierBodyTemperature` - Body Temperature
- `HKQuantityTypeIdentifierBasalBodyTemperature` - Basal Body Temperature

#### **Activity & Fitness** (11 types)
- `HKQuantityTypeIdentifierStepCount` - Steps
- `HKQuantityTypeIdentifierDistanceWalkingRunning` - Distance Walking/Running
- `HKQuantityTypeIdentifierDistanceCycling` - Distance Cycling
- `HKQuantityTypeIdentifierDistanceSwimming` - Distance Swimming
- `HKQuantityTypeIdentifierBasalEnergyBurned` - Basal Energy Burned
- `HKQuantityTypeIdentifierActiveEnergyBurned` - Active Energy Burned
- `HKQuantityTypeIdentifierFlightsClimbed` - Flights Climbed
- `HKQuantityTypeIdentifierAppleExerciseTime` - Exercise Time
- `HKQuantityTypeIdentifierAppleMoveTime` - Move Time
- `HKQuantityTypeIdentifierAppleStandTime` - Stand Time
- `HKCategoryTypeIdentifierAppleStandHour` - Stand Hours

#### **Workouts** (1 type)
- `HKWorkoutTypeIdentifier` - Workouts

#### **Sleep & Mindfulness** (3 types)
- `HKCategoryTypeIdentifierSleepAnalysis` - Sleep Analysis
- `HKQuantityTypeIdentifierAppleSleepingWristTemperature` - Sleeping Wrist Temperature
- `HKCategoryTypeIdentifierMindfulSession` - Mindful Session

#### **Nutrition** (11 types - Basic Macros Only)
- `HKQuantityTypeIdentifierDietaryWater` - Water
- `HKQuantityTypeIdentifierDietaryCaffeine` - Caffeine
- `HKQuantityTypeIdentifierDietaryCalories` - Calories
- `HKQuantityTypeIdentifierDietaryCarbohydrates` - Carbohydrates
- `HKQuantityTypeIdentifierDietaryFatTotal` - Total Fat
- `HKQuantityTypeIdentifierDietaryFatSaturated` - Saturated Fat
- `HKQuantityTypeIdentifierDietaryCholesterol` - Cholesterol
- `HKQuantityTypeIdentifierDietarySodium` - Sodium
- `HKQuantityTypeIdentifierDietarySugar` - Sugar
- `HKQuantityTypeIdentifierDietaryEnergyConsumed` - Energy Consumed
- `HKQuantityTypeIdentifierDietaryProtein` - Protein

#### **Glucose** (2 types)
- `HKQuantityTypeIdentifierBloodGlucose` - Blood Glucose
- `HKQuantityTypeIdentifierInsulinDelivery` - Insulin Delivery

#### **Reproductive Health** (3 types - Basic Only)
- `HKCategoryTypeIdentifierMenstrualFlow` - Menstrual Flow
- `HKCategoryTypeIdentifierIntermenstrualBleeding` - Intermenstrual Bleeding
- `HKQuantityTypeIdentifierBasalBodyTemperature` - Basal Body Temperature

#### **Hearing** (2 types)
- `HKQuantityTypeIdentifierEnvironmentalAudioExposure` - Environmental Audio Exposure
- `HKQuantityTypeIdentifierHeadphoneAudioExposure` - Headphone Audio Exposure

#### **Mobility** (4 types)
- `HKQuantityTypeIdentifierAppleWalkingSteadiness` - Apple Walking Steadiness
- `HKCategoryTypeIdentifierAppleWalkingSteadinessEvent` - Walking Steadiness Event
- `HKQuantityTypeIdentifierWalkingSpeed` - Walking Speed
- `HKQuantityTypeIdentifierWalkingStepLength` - Walking Step Length

#### **Other Metrics** (7 types)
- `HKQuantityTypeIdentifierNumberOfTimesFallen` - Number of Times Fallen
- `HKQuantityTypeIdentifierInhalerUsage` - Inhaler Usage
- `HKCorrelationTypeIdentifierBloodPressure` - Blood Pressure (Correlation)
- `HKCategoryTypeIdentifierHighHeartRateEvent` - High Heart Rate Event
- `HKCategoryTypeIdentifierLowHeartRateEvent` - Low Heart Rate Event
- `HKCategoryTypeIdentifierIrregularHeartRhythmEvent` - Irregular Heart Rhythm Event
- `HKCategoryTypeIdentifierLowCardioFitnessEvent` - Low Cardio Fitness Event

#### **UV Exposure** (1 type)
- `HKQuantityTypeIdentifierUVExposure` - UV Exposure

#### **Characteristic Types** (6 types - Read-only, set once)
- `HKCharacteristicTypeIdentifierBiologicalSex` - Biological Sex
- `HKCharacteristicTypeIdentifierBloodType` - Blood Type
- `HKCharacteristicTypeIdentifierDateOfBirth` - Date of Birth
- `HKCharacteristicTypeIdentifierFitzpatrickSkinType` - Fitzpatrick Skin Type
- `HKCharacteristicTypeIdentifierWheelchairUse` - Wheelchair Use
- `HKCharacteristicTypeIdentifierActivityMoveMode` - Activity Move Mode

---

## User-Selectable Metrics (Default Options)

When users select specific metrics, the app requests only these mapped types:

### **Heart & Cardiovascular** (5 metrics)
1. **Heart Rate** → `HKQuantityTypeIdentifierHeartRate`
2. **Resting Heart Rate** → `HKQuantityTypeIdentifierRestingHeartRate`
3. **Heart Rate Variability** → `HKQuantityTypeIdentifierHeartRateVariabilitySDNN`
4. **Walking Heart Rate Average** → `HKQuantityTypeIdentifierWalkingHeartRateAverage`
5. **Blood Pressure (Systolic)** → `HKQuantityTypeIdentifierBloodPressureSystolic`
6. **Blood Pressure (Diastolic)** → `HKQuantityTypeIdentifierBloodPressureDiastolic`

### **Respiratory** (2 metrics)
1. **Respiratory Rate** → `HKQuantityTypeIdentifierRespiratoryRate`
2. **Blood Oxygen (SpO2)** → `HKQuantityTypeIdentifierOxygenSaturation`

### **Body Measurements** (4 metrics)
1. **Weight** → `HKQuantityTypeIdentifierBodyMass`
2. **Height** → `HKQuantityTypeIdentifierHeight`
3. **Body Mass Index** → `HKQuantityTypeIdentifierBodyMassIndex`
4. **Body Fat Percentage** → `HKQuantityTypeIdentifierBodyFatPercentage`

### **Temperature** (1 metric)
1. **Body Temperature** → `HKQuantityTypeIdentifierBodyTemperature`

### **Activity & Fitness** (5 metrics)
1. **Steps** → `HKQuantityTypeIdentifierStepCount`
2. **Active Energy Burned** → `HKQuantityTypeIdentifierActiveEnergyBurned`
3. **Basal Energy Burned** → `HKQuantityTypeIdentifierBasalEnergyBurned`
4. **Distance Walking/Running** → `HKQuantityTypeIdentifierDistanceWalkingRunning`
5. **Flights Climbed** → `HKQuantityTypeIdentifierFlightsClimbed`

### **Sleep** (1 metric)
1. **Sleep Analysis** → `HKCategoryTypeIdentifierSleepAnalysis`

---

## Write Permissions

The app currently requests **READ-ONLY** access to all HealthKit data types.  
Write permissions are configured but not actively used:
- `HKQuantityTypeIdentifierStepCount` (write)
- `HKQuantityTypeIdentifierBodyMass` (write)
- `HKQuantityTypeIdentifierHeight` (write)

---

## Total Count

- **Total HealthKit Types Available**: 68 types (cleaned and optimized)
- **User-Selectable Metrics**: ~24 metrics
- **Default Selected**: All metrics (when "Select All" is chosen)

---

## Recent Updates (December 23, 2025)

### Cleanup Summary
- ✅ **Removed**: ~112 types (sensitive, clinical, or overly granular)
- ✅ **Kept**: 68 essential types focused on core health tracking
- ✅ **Reduction**: 62% fewer permissions

### Removed Categories
- ❌ Sensitive reproductive health details (sexual activity, contraceptive, test results)
- ❌ Alcohol consumption data
- ❌ Advanced running metrics (speed, stride length, power, etc.)
- ❌ Detailed nutrition vitamins/minerals (23 types)
- ❌ Clinical/research metrics (lung function tests, AFib burden, etc.)
- ❌ Specialized sports metrics (swimming strokes, snow sports, etc.)
- ❌ Hearing exposure events
- ❌ Self-care events (toothbrushing, handwashing)

### Benefits
- ✅ **Simpler permission dialog** - Users see 68 categories instead of 180+
- ✅ **Reduced privacy concerns** - No sensitive reproductive or alcohol data
- ✅ **Better App Store approval** - Focused permission set shows responsible data handling
- ✅ **Faster user decisions** - Users can quickly understand what's being requested

---

## Privacy & Security

All HealthKit data access is:
- ✅ **Read-only** by default
- ✅ **User-controlled** - users choose which metrics to share
- ✅ **Encrypted** in transit and at rest
- ✅ **Revocable** - users can revoke permissions anytime in iOS Settings
- ✅ **Focused** - Only essential health tracking data requested

---

## Notes

- The app uses `react-native-health` library version `^1.19.0`
- HealthKit requires a **native rebuild** after configuration changes
- HealthKit only works on **real iOS devices** (not simulators)
- Users must grant permissions through the iOS native permission dialog
- All type identifiers match Apple's official HealthKit documentation

---

## App Store Compliance

This permission set is designed to:
- ✅ Request only data necessary for core health tracking features
- ✅ Avoid sensitive data that could raise privacy concerns
- ✅ Provide clear justification for each permission category
- ✅ Maintain user trust through focused, responsible data requests
