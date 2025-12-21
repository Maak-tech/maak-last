# Fall Detection Algorithm

## Overview

The fall detection system uses a **multi-phase pattern recognition algorithm** that analyzes device motion sensor data to detect falls with improved accuracy and reduced false positives compared to simple threshold-based approaches.

## How It Works

### Three-Phase Detection Pattern

Real falls follow a characteristic pattern that we detect in three phases:

```
Normal Activity → Freefall → Impact → Stillness
     ↓               ↓          ↓         ↓
   ~1.0 G        < 0.5 G    > 2.5 G   < 0.3 G variance
```

#### **Phase 1: Freefall Detection**
- **Trigger**: Total acceleration drops below **0.5 G** (normal is ~1.0 G)
- **Duration**: Must last **200-800 milliseconds**
- **Rationale**: When a person falls, they experience momentary weightlessness before hitting the ground
- **False Positive Prevention**: Too short = phone movement; Too long = sitting down

#### **Phase 2: Impact Detection**
- **Trigger**: Acceleration suddenly increases to **2.5-8.0 G** after valid freefall
- **Rationale**: The body hitting the ground causes a sharp acceleration spike
- **False Positive Prevention**: 
  - Only triggers if preceded by valid freefall
  - Upper limit (8.0 G) filters sensor errors
  - Ignores impacts without prior freefall (dropped phone)

#### **Phase 3: Post-Impact Stillness**
- **Duration**: Monitor for **1 second** after impact
- **Threshold**: Movement variance < **0.3 G**
- **Rationale**: After a fall, a person typically remains still/disoriented
- **False Positive Prevention**: Dropped phone will bounce/move; fallen person stays still

### Sensor Configuration

- **Update Rate**: 100ms (10 Hz)
  - Fast enough to catch brief freefall phases
  - Slow enough to remain stable on all devices
- **Data Window**: 20 readings (2 seconds)
  - Used for variance calculations
  - Helps filter transient spikes

### Cooldown Period

- **Duration**: 30 seconds between alerts
- **Purpose**: Prevent duplicate notifications for the same fall

## Configuration

All thresholds are defined in `hooks/useFallDetection.ts` in the `FALL_CONFIG` object:

```typescript
const FALL_CONFIG = {
  UPDATE_INTERVAL: 100,           // 10 Hz sensor rate
  FREEFALL_THRESHOLD: 0.5,        // G-force
  FREEFALL_MIN_DURATION: 200,     // milliseconds
  FREEFALL_MAX_DURATION: 800,     // milliseconds
  IMPACT_THRESHOLD: 2.5,          // G-force
  IMPACT_MAX_THRESHOLD: 8.0,      // G-force
  POST_IMPACT_THRESHOLD: 0.3,     // G-force variance
  POST_IMPACT_DURATION: 1000,     // milliseconds
  ALERT_COOLDOWN: 30000,          // milliseconds
  WINDOW_SIZE: 20,                // readings
};
```

## Tuning Guidelines

### If Too Many False Positives:
- ✅ **Increase** `IMPACT_THRESHOLD` (try 3.0 G)
- ✅ **Decrease** `FREEFALL_THRESHOLD` (try 0.4 G)
- ✅ **Increase** `POST_IMPACT_DURATION` (try 1500 ms)
- ✅ **Decrease** `POST_IMPACT_THRESHOLD` (try 0.2 G)

### If Missing Real Falls:
- ⚠️ **Decrease** `IMPACT_THRESHOLD` (try 2.0 G)
- ⚠️ **Increase** `FREEFALL_THRESHOLD` (try 0.6 G)
- ⚠️ **Increase** `FREEFALL_MAX_DURATION` (try 1000 ms)
- ⚠️ **Increase** `POST_IMPACT_THRESHOLD` (try 0.4 G)

### Trade-offs:
- **Lower thresholds** = More sensitive (catches more falls, but more false positives)
- **Higher thresholds** = More specific (fewer false positives, might miss gentle falls)

## Comparison to Previous Algorithm

| Aspect | Old Algorithm | New Algorithm |
|--------|--------------|---------------|
| **Update Rate** | 1000 ms (1 Hz) | 100 ms (10 Hz) |
| **Detection Method** | Single threshold | Multi-phase pattern |
| **Freefall Threshold** | 0.2 G (too low) | 0.5 G (realistic) |
| **Impact Threshold** | 4.0 G (too high) | 2.5 G (realistic) |
| **False Positive Filter** | Time window only | Freefall + Impact + Stillness |
| **Cooldown** | None | 30 seconds |
| **Dropped Phone Detection** | ❌ No | ✅ Yes (requires stillness) |

## Limitations

⚠️ **This is NOT a medical device and should not replace professional emergency monitoring systems.**

### Known Limitations:
1. **Phone Placement**: Works best when phone is on person (pocket, belt)
2. **Fall Types**: Optimized for standing → ground falls; may not detect:
   - Slow slides to ground
   - Falls onto soft surfaces (beds, couches)
   - Falls caught by another person
3. **Sensitivity**: Cannot detect 100% of falls without also having false positives
4. **Regulatory**: Not FDA-approved; does not meet medical device standards

### Best Practices:
- ✅ Keep phone charged and on person
- ✅ Ensure motion permissions are granted
- ✅ Test regularly using the "Test Fall Detection" button
- ✅ Use in conjunction with other safety measures
- ✅ Inform family members about system limitations

## Testing

### Test Button
The app includes a "Test Fall Detection" button that:
- Creates a simulated fall alert
- Sends notifications to family members
- Allows testing without actually falling

### Real-World Testing
⚠️ **Do NOT intentionally fall to test the system**

Safe testing methods:
1. Drop phone onto soft surface (pillow/bed) from standing height
2. Toss phone gently into the air and catch it
3. Place phone in pocket and do controlled movements (quick sit-downs)

## Future Improvements

Potential enhancements for future versions:
- [ ] Machine learning model trained on real fall data
- [ ] Integration with Apple Watch (which has FDA-cleared fall detection)
- [ ] Distinction between forward, backward, and sideways falls
- [ ] Altitude detection (stairs vs. flat ground)
- [ ] User-specific calibration based on activity patterns
- [ ] Integration with wearable heart rate monitors

## References

- Apple Watch Fall Detection: https://support.apple.com/en-us/HT208944
- Fall Detection Research: "Accelerometer-based Fall Detection" (IEEE)
- Typical fall acceleration patterns: 2-3 G impact, 0.3-0.5 s freefall

---

**Last Updated**: December 21, 2025  
**Algorithm Version**: 2.0  
**File**: `hooks/useFallDetection.ts`

