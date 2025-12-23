# Recommended HealthKit Types to Remove

## Rationale

Removing these types will:
- ✅ Reduce privacy concerns (fewer sensitive permissions)
- ✅ Improve App Store approval chances
- ✅ Simplify permission dialog for users
- ✅ Focus on core health tracking features
- ✅ Avoid requesting data you don't actively use

---

## 🔴 HIGH PRIORITY REMOVALS (Strongly Recommended)

### 1. **Reproductive Health - Highly Sensitive** ❌
**Reason**: Very private data, potential App Store review issues, not core to general health tracking

```typescript
// REMOVE ALL:
"HKCategorTypeIdentifierSexualActivity",              // Too sensitive
"HKCategorTypeIdentifierContraceptive",              // Too sensitive
"HKCategorTypeIdentifierCervicalMucusQuality",       // Too detailed/intimate
"HKCategorTypeIdentifierOvulationTestResult",        // Too specific
"HKCategorTypeIdentifierProgesteroneTestResult",     // Too specific
"HKCategorTypeIdentifierPregnancyTestResult",        // Too specific
"HKCategorTypeIdentifierInfrequentMenstrualCycles",  // Clinical diagnosis
"HKCategorTypeIdentifierIrregularMenstrualCycles",   // Clinical diagnosis
"HKCategorTypeIdentifierPersistentIntermenstrualBleeding", // Clinical
"HKCategorTypeIdentifierProlongedMenstrualPeriods",  // Clinical
```

**KEEP** (if you want basic reproductive health):
- `HKCategoryTypeIdentifierMenstrualFlow` - Basic cycle tracking
- `HKCategoryTypeIdentifierIntermenstrualBleeding` - Basic cycle tracking
- `HKQuantityTypeIdentifierBasalBodyTemperature` - Can be useful
- `HKCategoryTypeIdentifierPregnancy` - If relevant to your app
- `HKCategoryTypeIdentifierLactation` - If relevant to your app

### 2. **Alcohol Consumption** ❌
**Reason**: Sensitive, potential legal/liability concerns, not core health tracking

```typescript
// REMOVE:
"HKQuantityTypeIdentifierBloodAlcoholContent",
"HKQuantityTypeIdentifierNumberOfAlcoholicBeverages",
```

### 3. **Advanced Running Metrics** ❌
**Reason**: Too specific for general health app, most users don't need

```typescript
// REMOVE:
"HKQuantityTypeIdentifierRunningSpeed",
"HKQuantityTypeIdentifierRunningStrideLength",
"HKQuantityTypeIdentifierRunningPower",
"HKQuantityTypeIdentifierRunningGroundContactTime",
"HKQuantityTypeIdentifierRunningVerticalOscillation",
```

### 4. **Detailed Nutrition Vitamins/Minerals** ❌
**Reason**: Too granular, overwhelming permission dialog, rarely used

```typescript
// REMOVE (keep only basic macros):
"HKQuantityTypeIdentifierDietaryVitaminA",
"HKQuantityTypeIdentifierDietaryVitaminB6",
"HKQuantityTypeIdentifierDietaryVitaminB12",
"HKQuantityTypeIdentifierDietaryVitaminC",
"HKQuantityTypeIdentifierDietaryVitaminD",
"HKQuantityTypeIdentifierDietaryVitaminE",
"HKQuantityTypeIdentifierDietaryVitaminK",
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
```

**KEEP** (basic nutrition):
- `HKQuantityTypeIdentifierDietaryWater`
- `HKQuantityTypeIdentifierDietaryCaffeine`
- `HKQuantityTypeIdentifierDietaryCalories`
- `HKQuantityTypeIdentifierDietaryCarbohydrates`
- `HKQuantityTypeIdentifierDietaryFatTotal`
- `HKQuantityTypeIdentifierDietaryProtein`
- `HKQuantityTypeIdentifierDietarySodium`
- `HKQuantityTypeIdentifierDietarySugar`
- `HKQuantityTypeIdentifierDietaryEnergyConsumed`

---

## 🟡 MEDIUM PRIORITY REMOVALS (Consider Removing)

### 5. **Hearing Exposure Events** ⚠️
**Reason**: Less relevant for general health tracking

```typescript
// CONSIDER REMOVING:
"HKCategoryTypeIdentifierEnvironmentalAudioExposureEvent",
"HKCategoryTypeIdentifierHeadphoneAudioExposureEvent",
"HKCategoryTypeIdentifierAudioExposureEvent",
```

**KEEP** (if you want hearing data):
- `HKQuantityTypeIdentifierEnvironmentalAudioExposure`
- `HKQuantityTypeIdentifierHeadphoneAudioExposure`

### 6. **Advanced Mobility Metrics** ⚠️
**Reason**: Very specific, clinical/research-focused

```typescript
// CONSIDER REMOVING:
"HKQuantityTypeIdentifierWalkingAsymmetryPercentage",
"HKQuantityTypeIdentifierWalkingDoubleSupportPercentage",
"HKQuantityTypeIdentifierStairAscentSpeed",
"HKQuantityTypeIdentifierStairDescentSpeed",
"HKQuantityTypeIdentifierSixMinuteWalkTestDistance", // Clinical test
```

**KEEP** (basic mobility):
- `HKQuantityTypeIdentifierAppleWalkingSteadiness`
- `HKCategoryTypeIdentifierAppleWalkingSteadinessEvent`
- `HKQuantityTypeIdentifierWalkingSpeed`
- `HKQuantityTypeIdentifierWalkingStepLength`

### 7. **Specialized Sports Metrics** ⚠️
**Reason**: Too specific for general health app

```typescript
// CONSIDER REMOVING:
"HKQuantityTypeIdentifierSwimmingStrokeCount",
"HKQuantityTypeIdentifierDistanceDownhillSnowSports",
"HKQuantityTypeIdentifierNikeFuel", // Deprecated/Nike-specific
"HKQuantityTypeIdentifierPushCount", // Wheelchair-specific
"HKQuantityTypeIdentifierDistanceWheelchair", // Wheelchair-specific
```

### 8. **Clinical/Research Metrics** ⚠️
**Reason**: Too advanced for general health tracking

```typescript
// CONSIDER REMOVING:
"HKQuantityTypeIdentifierForcedVitalCapacity", // Lung function test
"HKQuantityTypeIdentifierForcedExpiratoryVolume1", // Lung function test
"HKQuantityTypeIdentifierPeakExpiratoryFlowRate", // Lung function test
"HKQuantityTypeIdentifierAtrialFibrillationBurden", // Clinical diagnosis
"HKQuantityTypeIdentifierElectrodermalActivity", // Research/clinical
"HKQuantityTypeIdentifierPeripheralPerfusionIndex", // Clinical
```

### 9. **Self-Care Events** ⚠️
**Reason**: Less relevant, can seem invasive

```typescript
// CONSIDER REMOVING:
"HKCategoryTypeIdentifierToothbrushingEvent",
"HKCategoryTypeIdentifierHandwashingEvent",
```

### 10. **Advanced Heart Metrics** ⚠️
**Reason**: Very specific, clinical

```typescript
// CONSIDER REMOVING:
"HKQuantityTypeIdentifierHeartRateRecoveryOneMinute", // Very specific
```

---

## ✅ KEEP (Core Health Metrics)

These are essential and should stay:

### Heart & Cardiovascular
- Heart Rate
- Resting Heart Rate
- Walking Heart Rate Average
- Heart Rate Variability
- Blood Pressure (Systolic/Diastolic)
- VO2 Max
- Heart rate events (High/Low/Irregular)

### Body Measurements
- Weight, Height, BMI
- Body Fat Percentage
- Lean Body Mass
- Waist Circumference

### Activity & Fitness
- Steps
- Distance Walking/Running
- Distance Cycling
- Active Energy Burned
- Basal Energy Burned
- Flights Climbed
- Exercise Time
- Stand Time
- Workouts

### Sleep & Mindfulness
- Sleep Analysis
- Mindful Session

### Basic Nutrition
- Water, Calories, Macros (Carbs, Fat, Protein)
- Sodium, Sugar, Caffeine

### Glucose
- Blood Glucose
- Insulin Delivery

### Basic Reproductive Health (if needed)
- Menstrual Flow
- Intermenstrual Bleeding
- Basal Body Temperature

### Basic Mobility
- Walking Speed
- Walking Step Length
- Apple Walking Steadiness

### Other Essentials
- Body Temperature
- Respiratory Rate
- Oxygen Saturation
- Number of Times Fallen
- Inhaler Usage
- UV Exposure

---

## Summary

### Recommended Removals:
- **High Priority**: ~35 types (Reproductive health details, Alcohol, Advanced running, Detailed vitamins)
- **Medium Priority**: ~15 types (Hearing events, Advanced mobility, Clinical metrics)

### Total Recommended Removals: ~50 types

### Result:
- **Before**: ~180 types
- **After**: ~130 types
- **Reduction**: ~28% fewer permissions

This makes the permission dialog more manageable and reduces privacy concerns while keeping all essential health tracking features.

