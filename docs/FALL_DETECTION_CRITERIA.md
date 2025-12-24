# Fall Detection Alert Criteria

## Current Alert Criteria

A fall alert is triggered when **ALL** of the following conditions are met:

### Phase 1: Freefall Detection ✅
**Required Conditions:**
- **Acceleration drops below 0.4 G** (normal is ~1.0 G)
- **Duration: 150-1000 milliseconds**
- **Low activity level** (< 1.5 G) to prevent false positives from walking/running

**Purpose:** Detects the weightlessness phase before impact

### Phase 2: Impact Detection ✅
**Required Conditions:**
- **Must follow a valid freefall phase** (150-1000ms)
- **Impact detected via ONE of:**
  - Acceleration spike: **2.0-15.0 G** (after freefall ends)
  - OR Jerk threshold: **≥ 5.0 m/s³** (sudden acceleration change)

**Purpose:** Confirms the body hit the ground

### Phase 3: Post-Impact Confidence Scoring ✅
**Required: ≥ 70% total confidence** from weighted factors:

| Factor | Weight | Criteria | Points |
|--------|--------|----------|--------|
| **Stillness** | 40% | Variance < 0.25 G | 0.4 |
| | | Variance < 0.375 G | 0.2 |
| **Orientation Change** | 30% | Rotation ≥ 45° | 0.3 |
| | | Rotation ≥ 22.5° | 0.15 |
| **Duration** | 20% | Post-impact ≥ 800ms | 0.2 |
| | | Proportional to duration | 0-0.2 |
| **Activity Level** | 10% | Low activity after impact | 0.1 |
| **Fall Direction** | 5% | Clear direction detected | 0.05 |

**Total Required:** ≥ 0.7 (70%)

### Additional Safety Features
- **Cooldown Period:** 30 seconds between alerts (prevents duplicates)
- **Baseline Calibration:** 100 samples (5 seconds) to establish normal activity
- **Adaptive Thresholds:** Adjusts based on user's normal activity patterns
- **Outlier Filtering:** Removes sensor noise and errors

---

## Proposed Enhancements

### 1. Enhanced Gyroscope Analysis 🔄
**Current:** Only uses accelerometer data
**Enhancement:** Add gyroscope rotation rate analysis

```typescript
// New criteria:
GYROSCOPE_ROTATION_THRESHOLD: 2.0, // rad/s (rapid rotation during fall)
GYROSCOPE_VARIANCE_THRESHOLD: 0.5, // rad/s (rotation variance)
```

**Benefits:**
- Better detection of rotational falls
- Distinguishes phone drops from body falls
- More accurate orientation change detection

### 2. Impact Magnitude Analysis 🔄
**Current:** Simple threshold check
**Enhancement:** Analyze impact severity and pattern

```typescript
// New criteria:
IMPACT_SEVERITY_LOW: 2.0,    // G-force (gentle fall)
IMPACT_SEVERITY_MEDIUM: 4.0,  // G-force (moderate fall)
IMPACT_SEVERITY_HIGH: 8.0,    // G-force (severe fall)
IMPACT_PATTERN_WINDOW: 200,   // ms (analyze impact pattern)
```

**Benefits:**
- Severity classification (low/medium/high)
- Better false positive filtering
- More accurate impact detection

### 3. Pre-Fall Activity Pattern 🔄
**Current:** Only checks current activity
**Enhancement:** Analyze activity pattern before freefall

```typescript
// New criteria:
PRE_FALL_WINDOW: 1000,        // ms (analyze 1 second before)
PRE_FALL_ACTIVITY_THRESHOLD: 1.2, // G-force (normal walking)
PRE_FALL_STABILITY_CHECK: true,   // Check for stable activity
```

**Benefits:**
- Distinguishes falls from intentional movements (sitting, lying down)
- Reduces false positives from controlled movements
- Better context awareness

### 4. Multiple Impact Detection 🔄
**Current:** Single impact detection
**Enhancement:** Detect multiple impacts (bouncing, rolling)

```typescript
// New criteria:
MULTIPLE_IMPACT_WINDOW: 500,  // ms (window for multiple impacts)
MAX_IMPACT_COUNT: 3,          // Maximum impacts to consider
IMPACT_DECAY_FACTOR: 0.7,     // Decay factor for subsequent impacts
```

**Benefits:**
- Catches falls with multiple impacts
- Better detection of rolling falls
- More accurate impact pattern recognition

### 5. Recovery Detection 🔄
**Current:** Only checks stillness
**Enhancement:** Detect recovery attempts vs. unconsciousness

```typescript
// New criteria:
RECOVERY_WINDOW: 2000,        // ms (window to detect recovery)
RECOVERY_ACTIVITY_THRESHOLD: 0.8, // G-force (recovery movement)
RECOVERY_CONFIDENCE_BOOST: 0.1,   // Additional confidence if no recovery
```

**Benefits:**
- Distinguishes conscious vs. unconscious falls
- Higher alert priority for unconscious falls
- Better medical context

### 6. Time-of-Day Context 🔄
**Current:** No time context
**Enhancement:** Adjust sensitivity based on time

```typescript
// New criteria:
NIGHT_HOURS: [22, 23, 0, 1, 2, 3, 4, 5], // Night hours (more sensitive)
DAY_HOURS_SENSITIVITY: 0.9,   // Slightly less sensitive during day
NIGHT_HOURS_SENSITIVITY: 1.1,  // More sensitive at night
```

**Benefits:**
- More sensitive during sleep hours
- Context-aware detection
- Better false positive reduction during active hours

### 7. User Activity Context 🔄
**Current:** Basic activity threshold
**Enhancement:** Learn user's normal activity patterns

```typescript
// New criteria:
ACTIVITY_PROFILE_WINDOW: 300000, // 5 minutes (learn activity profile)
ACTIVITY_PROFILE_SAMPLES: 100,   // Samples to establish profile
ACTIVITY_DEVIATION_THRESHOLD: 2.0, // Standard deviations
```

**Benefits:**
- Personalized detection thresholds
- Adapts to user's lifestyle
- Better accuracy for different activity levels

### 8. Enhanced Fall Direction Analysis 🔄
**Current:** Basic direction detection (5% weight)
**Enhancement:** Comprehensive direction and angle analysis

```typescript
// New criteria:
DIRECTION_CONFIDENCE_THRESHOLD: 0.8, // Confidence in direction
FALL_ANGLE_THRESHOLD: 30,            // degrees (fall angle)
DIRECTION_WEIGHT: 0.15,              // Increased weight (15%)
```

**Benefits:**
- More accurate fall direction
- Better impact angle analysis
- Improved confidence scoring

### 9. Impact Pattern Analysis 🔄
**Current:** Single impact check
**Enhancement:** Analyze impact waveform pattern

```typescript
// New criteria:
IMPACT_PEAK_DURATION: 50,      // ms (peak duration)
IMPACT_DECAY_RATE: 0.5,        // Decay rate after peak
IMPACT_PATTERN_MATCH: 0.8,     // Pattern match threshold
```

**Benefits:**
- Distinguishes body impacts from object impacts
- Better pattern recognition
- More accurate detection

### 10. Machine Learning Features 🔄
**Current:** Rule-based algorithm
**Enhancement:** Add ML-based pattern recognition

```typescript
// New criteria:
ML_MODEL_ENABLED: false,       // Enable ML model
ML_CONFIDENCE_THRESHOLD: 0.75, // ML confidence threshold
ML_WEIGHT: 0.3,                // Weight in final confidence
```

**Benefits:**
- Learns from real fall patterns
- Continuous improvement
- Better accuracy over time

---

## Implementation Priority

### High Priority (Immediate Impact)
1. ✅ **Enhanced Gyroscope Analysis** - Better accuracy
2. ✅ **Impact Magnitude Analysis** - Severity classification
3. ✅ **Pre-Fall Activity Pattern** - Reduce false positives

### Medium Priority (Significant Improvement)
4. ✅ **Multiple Impact Detection** - Catch complex falls
5. ✅ **Recovery Detection** - Better medical context
6. ✅ **Enhanced Fall Direction** - Improved confidence

### Low Priority (Nice to Have)
7. ⏳ **Time-of-Day Context** - Context awareness
8. ⏳ **User Activity Context** - Personalization
9. ⏳ **Impact Pattern Analysis** - Advanced pattern recognition
10. ⏳ **Machine Learning** - Long-term improvement

---

## Configuration Options

Users should be able to adjust:
- **Sensitivity Level:** Low / Medium / High
- **Alert Priority:** Standard / High / Critical
- **Time Context:** Enable/disable time-based adjustments
- **Activity Profile:** Enable/disable personalization

---

## Testing Recommendations

1. **Controlled Testing:** Use test button (no real falls)
2. **Simulation:** Drop phone on soft surface
3. **Validation:** Compare with known fall patterns
4. **False Positive Tracking:** Monitor and adjust thresholds

---

**Last Updated:** January 2025  
**Version:** 1.0

