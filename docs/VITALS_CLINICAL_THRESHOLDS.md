# Vitals Clinical Thresholds

This document outlines the medical thresholds used in the Maak Health app's vitals monitoring system. These thresholds are based on established clinical guidelines and represent hard red lines where medical intervention may be needed.

## Overview

The vitals screen displays health metrics with status indicators:
- **Normal**: Values within acceptable clinical ranges
- **Needs Attention (Warning)**: Values outside normal ranges that may require medical attention

## Clinical Thresholds

### 1. Heart Rate (Resting)

**Normal Range**: 60-100 bpm  
**Needs Attention**: < 60 bpm or > 100 bpm

**Clinical Basis**: 
- Normal resting heart rate for adults is 60-100 beats per minute
- Bradycardia (< 60 bpm) may indicate heart conduction issues
- Tachycardia (> 100 bpm) may indicate stress, fever, or cardiac issues

**Implementation**: `v < 60 || v > 100`

---

### 2. Resting Heart Rate

**Normal Range**: 60-100 bpm  
**Needs Attention**: < 60 bpm or > 100 bpm

**Clinical Basis**: Same as Heart Rate (Resting) - represents the heart rate when the body is at rest.

**Implementation**: `v < 60 || v > 100`

---

### 3. Blood Pressure - Systolic

**Normal Range**: < 120 mmHg  
**Needs Attention**: ≥ 140 mmHg

**Clinical Basis**: 
- Normal systolic blood pressure is < 120 mmHg
- Hypertension Stage 1 begins at ≥ 140 mmHg (per AHA/ACC guidelines)
- Systolic pressure ≥ 140 mmHg requires medical evaluation

**Implementation**: `systolic >= 140`

---

### 4. Blood Pressure - Diastolic

**Normal Range**: < 80 mmHg  
**Needs Attention**: ≥ 90 mmHg

**Clinical Basis**: 
- Normal diastolic blood pressure is < 80 mmHg
- Hypertension Stage 1 begins at ≥ 90 mmHg (per AHA/ACC guidelines)
- Diastolic pressure ≥ 90 mmHg requires medical evaluation

**Implementation**: `diastolic >= 90`

---

### 5. Body Temperature

**Normal Range**: 36.1-37.2°C (97.0-99.0°F)  
**Needs Attention**: ≥ 38°C (100.4°F)

**Clinical Basis**: 
- Normal body temperature ranges from 36.1-37.2°C
- Fever is defined as temperature ≥ 38°C (100.4°F)
- Fever may indicate infection or other medical conditions requiring attention

**Implementation**: `v >= 38`

---

### 6. Oxygen Saturation (SpO₂)

**Normal Range**: ≥ 95%  
**Needs Attention**: < 95%

**Clinical Basis**: 
- Normal oxygen saturation is ≥ 95%
- SpO₂ < 95% indicates hypoxemia and may require medical evaluation
- Values < 95% are clinically significant and warrant medical attention

**Implementation**: `v < 95`

---

### 7. Respiratory Rate

**Normal Range**: 12-20 breaths/min  
**Needs Attention**: < 12 breaths/min or > 20 breaths/min

**Clinical Basis**: 
- Normal respiratory rate for adults is 12-20 breaths per minute
- Bradypnea (< 12 breaths/min) may indicate respiratory depression or CNS issues
- Tachypnea (> 20 breaths/min) may indicate respiratory distress, fever, or metabolic acidosis

**Implementation**: `v < 12 || v > 20`

---

## Metrics Without Clinical Thresholds

The following metrics are displayed but do not have clinical warning thresholds (always show as "normal"):

- **Weight**: No automatic warning threshold (weight changes should be monitored by healthcare providers)
- **Height**: Static measurement, no threshold needed
- **Heart Rate Variability**: Individual variation, no universal threshold
- **Walking Heart Rate Average**: Context-dependent, no universal threshold
- **Body Mass Index (BMI)**: Currently uses general thresholds (> 30 or < 18.5) but these are lifestyle indicators, not acute medical alerts
- **Body Fat Percentage**: Individual variation, no universal threshold
- **Active Energy**: Activity-dependent, no universal threshold
- **Basal Energy**: Individual variation, no universal threshold
- **Distance Walking/Running**: Activity-dependent, no universal threshold
- **Flights Climbed**: Activity-dependent, no universal threshold
- **Exercise Minutes**: Currently uses lifestyle threshold (< 30 min), not a clinical alert
- **Stand Time**: Currently uses lifestyle threshold (< 60 min), not a clinical alert
- **Water Intake**: Currently uses general guideline (< 2000 ml), not a clinical alert
- **Workouts**: Activity count, no clinical threshold
- **Blood Glucose**: Currently uses general thresholds (> 140 or < 70 mg/dL) - these may need clinical review for diabetes management

---

## Implementation Notes

### Status Determination Logic

The app uses a `getStatus` helper function that:
1. Returns "normal" if the value is `undefined` (no data available)
2. Applies the clinical threshold check function
3. Returns "warning" if the threshold is exceeded, otherwise "normal"

### Code Location

Thresholds are implemented in: `app/(tabs)/vitals.tsx`

Each vital card includes:
- A status check function that implements the clinical threshold
- Comments documenting the medical guideline range
- Visual indicators (color coding) for status

---

## Clinical References

These thresholds are based on:
- **American Heart Association (AHA)** guidelines for blood pressure
- **American College of Cardiology (ACC)** guidelines for cardiovascular metrics
- **World Health Organization (WHO)** guidelines for vital signs
- Standard medical textbooks and clinical practice guidelines for:
  - Normal vital sign ranges
  - Fever definitions
  - Hypoxemia thresholds
  - Respiratory rate norms

---

## Important Notes

⚠️ **These thresholds are non-negotiable** - they represent established clinical guidelines based on medical consensus, not user preferences.

⚠️ **These are screening thresholds** - they indicate when values may require medical attention but are not diagnostic. Always consult healthcare providers for medical decisions.

⚠️ **Individual variation exists** - some individuals may have baseline values outside these ranges that are normal for them. These thresholds serve as general guidelines.

⚠️ **Context matters** - values should be interpreted in context of:
- Patient age and medical history
- Medications
- Activity level at time of measurement
- Other concurrent symptoms

---

## Future Considerations

- Consider adding age-specific thresholds (pediatric vs. adult vs. geriatric)
- Review BMI thresholds for clinical vs. lifestyle indicators
- Review blood glucose thresholds for diabetes-specific management
- Consider adding trend-based alerts (e.g., rapid changes in vital signs)
- Consider adding user-specific baseline adjustments (with medical oversight)

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Maintained By**: Maak Health Development Team

