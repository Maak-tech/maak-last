# Testing Setup

## ✅ Automated Tests Configured

### Test Framework
- **firebase-functions-test** (existing devDependency)
- **Node.js assert** (built-in, no additional dependencies)
- **No Jest/Vitest** - minimal setup as requested

### Test Structure

```
functions/src/modules/alerts/
├── engine.ts          ✅ Pure functions (no Firestore)
└── engine.test.ts     ✅ Tests using Node assert
```

### Running Tests

```bash
# Build and test
npm run build && npm run test

# Or individually
npm run build
npm run test
```

## Implemented Tests

### 1. Normal Reading => No Alert ✅

Tests that vital readings within normal range don't trigger alerts:
- Heart rate: 75 bpm (normal)
- Oxygen saturation: 98% (normal)
- Body temperature: 36.8°C (normal)

**Result:** No alerts generated

### 2. Warning Threshold => Warning Alert ✅

Tests that readings at warning thresholds trigger warning alerts:
- Heart rate low: 50 bpm → Warning
- Heart rate high: 120 bpm → Warning
- Oxygen saturation low: 92% → Warning
- Body temperature high: 38.0°C → Warning

**Result:** Warning severity alerts with correct direction

### 3. Critical Threshold => Critical Alert ✅

Tests that readings at critical thresholds trigger critical alerts:
- Heart rate low: 40 bpm → Critical
- Heart rate high: 150 bpm → Critical
- Oxygen saturation low: 88% → Critical
- Blood pressure high: 180 mmHg → Critical

**Result:** Critical severity alerts with correct direction

### 4. Duplicate Suppression Window Logic ✅

Tests alert suppression to prevent spam:

**Test Cases:**
- No recent alerts → Don't suppress ✅
- Recent alert within window → Suppress ✅
- Old alert outside window → Don't suppress ✅
- Different severity → Don't suppress ✅
- Different vital type → Don't suppress ✅

**Suppression Windows:**
- Critical alerts: 30 minutes
- Warning alerts: 2 hours

### 5. Edge Cases ✅

Tests boundary conditions:
- Exactly at warning threshold → Alert
- Exactly at critical threshold → Alert
- Just above threshold in normal range → No alert

## Pure Functions (No Firestore)

All functions in `engine.ts` are pure:

### `checkVitalBenchmark(vitalType, value): AlertResult`
- Input: Vital type and value
- Output: Alert result (isAlert, severity, direction)
- No side effects, no database calls

### `shouldSuppressAlert(newAlert, recentAlerts, windowMs): boolean`
- Input: New alert, list of recent alerts, time window
- Output: Boolean (should suppress or not)
- No side effects, pure comparison logic

### `getSuppressionWindow(severity): number`
- Input: Alert severity
- Output: Time window in milliseconds
- No side effects, pure calculation

### `createAlertMessage(vitalType, value, unit, severity, direction): {title, message}`
- Input: Alert details
- Output: Formatted message
- No side effects, pure string formatting

## Test Output

```
🧪 Testing: Normal readings => No alert
✅ Normal readings correctly produce no alerts

🧪 Testing: Warning threshold => Warning alert
✅ Warning thresholds correctly produce warning alerts

🧪 Testing: Critical threshold => Critical alert
✅ Critical thresholds correctly produce critical alerts

🧪 Testing: Duplicate suppression window logic
✅ Duplicate suppression logic works correctly

🧪 Testing: Suppression window calculation
✅ Suppression window calculation correct

🧪 Testing: Alert message creation
✅ Alert message creation works correctly

🧪 Testing: Edge cases
✅ Edge cases handled correctly

==================================================
✅ All tests passed!
==================================================
```

## Vital Benchmarks

Configured for 8 vital types:

1. **Heart Rate**
   - Critical: ≤40 or ≥150 bpm
   - Warning: ≤50 or ≥120 bpm
   - Normal: 60-100 bpm

2. **Resting Heart Rate**
   - Critical: ≤35 or ≥120 bpm
   - Warning: ≤45 or ≥100 bpm
   - Normal: 50-90 bpm

3. **Heart Rate Variability**
   - Critical: ≤10 or ≥100 ms
   - Warning: ≤15 or ≥80 ms
   - Normal: 20-60 ms

4. **Blood Pressure** (systolic)
   - Critical: ≤80 or ≥180 mmHg
   - Warning: ≤85 or ≥140 mmHg
   - Normal: 90-120 mmHg

5. **Respiratory Rate**
   - Critical: ≤8 or ≥30 breaths/min
   - Warning: ≤10 or ≥24 breaths/min
   - Normal: 12-20 breaths/min

6. **Oxygen Saturation**
   - Critical: ≤88%
   - Warning: ≤92%
   - Normal: 95-100%

7. **Body Temperature**
   - Critical: ≤35.0 or ≥40.0°C
   - Warning: ≤35.5 or ≥38.0°C
   - Normal: 36.1-37.2°C

8. **Weight**
   - Critical: ≤40 or ≥200 kg
   - Warning: ≤45 or ≥150 kg
   - Normal: 50-120 kg

## Adding New Tests

To add more tests, edit `functions/src/modules/alerts/engine.test.ts`:

```typescript
console.log('\n🧪 Testing: Your test name');

function testYourFeature() {
  // Your test code
  const result = checkVitalBenchmark('heartRate', 75);
  assert.strictEqual(result.isAlert, false);
  
  console.log('✅ Your feature works correctly');
}

testYourFeature();
```

## Benefits

✅ **Fast** - No external test framework, pure Node.js
✅ **Simple** - Easy to understand and maintain
✅ **Reliable** - Pure functions, no mocking needed
✅ **Comprehensive** - Covers all alert logic scenarios
✅ **No Dependencies** - Uses existing firebase-functions-test
✅ **CI Ready** - Can run in any Node.js environment

## Next Steps

To integrate with CI/CD:

```yaml
# .github/workflows/test.yml
- name: Build and Test
  run: |
    cd functions
    npm install
    npm run build
    npm run test
```

## Future Enhancements

- Add more vital types
- Test trend analysis
- Test batch alert processing
- Integration tests with Firestore emulator
