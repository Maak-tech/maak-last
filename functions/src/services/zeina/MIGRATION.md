# Zeina Migration Guide

## Overview

The Zeina AI service has been refactored to be **HIPAA-safe by design**. This guide explains how to migrate from the old API to the new one.

## What Changed?

### Old Architecture (Deprecated)
```typescript
// Old: analyze.ts exported analyze() directly
import { analyze } from './services/zeina/analyze';

const result = await analyze({
  patientId: 'patient_123',
  alert: { /* AlertInfo */ },
  recentVitalsSummary: vitals,
  patientContext: { age: 68 },
});
```

**Problems:**
- ❌ PHI could leak to LLM (exact ages, values)
- ❌ No strict output validation
- ❌ Free-text responses possible
- ❌ No deterministic action mapping

### New Architecture (Current)
```typescript
// New: index.ts exports runZeinaAnalysis()
import { runZeinaAnalysis } from './services/zeina';

const result = await runZeinaAnalysis({
  traceId: 'trace_abc',
  alertContext: {
    alertId: 'alert_123',
    patientId: 'patient_456',
    alertType: 'vital',
    severity: 'warning',
    vitalType: 'heartRate',
    vitalValue: 125,  // Will be bucketed
    patientAge: 68,   // Will be grouped
  },
});
```

**Benefits:**
- ✅ PHI automatically sanitized (bucketing, grouping)
- ✅ Strict output schema (only 4 fields)
- ✅ Deterministic action mapping
- ✅ Fail-closed architecture
- ✅ HIPAA-compliant by design

## Migration Paths

### Option 1: Use Backward Compatibility Adapter (Recommended for Quick Migration)

The old `analyze()` function is still available through the adapter:

```typescript
// This still works - adapter bridges to new implementation
import { analyze } from './services/zeina';

const result = await analyze({
  patientId: 'patient_123',
  alert: alertInfo,
  recentVitalsSummary: vitals,
});

// Returns old format (ZeinaAnalysisResult)
// - riskScore
// - riskLevel
// - summary
// - recommendedActions[]
```

**When to use:**
- ✅ Quick migration without code changes
- ✅ Existing code already uses analyze()
- ✅ Need time to refactor to new API

**Limitations:**
- ⚠️ Adapter converts between old/new formats (slight overhead)
- ⚠️ Doesn't expose new features (action codes, escalation levels)

### Option 2: Migrate to New API (Recommended for New Code)

Use the new `runZeinaAnalysis()` for full control:

```typescript
import { 
  runZeinaAnalysis, 
  executeZeinaActions 
} from './services/zeina';

// 1. Run analysis
const result = await runZeinaAnalysis({
  traceId: createTraceId(),
  alertContext: {
    alertId: 'alert_123',
    patientId: 'patient_456',
    alertType: 'vital',
    severity: 'warning',
    vitalType: 'heartRate',
    vitalValue: 125,
    patientAge: 68,
    medicationCount: 3,
  },
});

// 2. Execute actions
if (result.success && result.output) {
  const actions = await executeZeinaActions(
    result.output,
    alertContext,
    traceId
  );
  
  // 3. Handle actions
  if (actions.sendAlert) {
    await sendAlerts(actions.alertRecipients);
  }
  
  if (actions.appCTA) {
    await createNotification(actions.appCTA);
  }
  
  for (const action of actions.autoActions) {
    await executeAction(action);
  }
}
```

**When to use:**
- ✅ New alert handlers
- ✅ Need deterministic action mapping
- ✅ Want full control over execution
- ✅ Building new features

## Code Examples

### Example 1: Vital Alert Handler (Old → New)

**Before (Old API):**
```typescript
// Old code
const alertInfo: AlertInfo = {
  type: 'vital',
  severity: 'warning',
  title: 'High Heart Rate',
  body: 'Heart rate is 125 bpm',
  data: { vitalType: 'heartRate', value: 125, unit: 'bpm' },
};

const analysis = await analyze({
  patientId: userId,
  alert: alertInfo,
  recentVitalsSummary: vitals,
  patientContext: { age: 68 },
});

// Manual action handling
if (analysis.riskScore >= 70) {
  await sendCriticalAlert(userId);
}
```

**After (New API):**
```typescript
// New code
const result = await runZeinaAnalysis({
  traceId: createTraceId(),
  alertContext: {
    alertId: alertId,
    patientId: userId,
    alertType: 'vital',
    severity: 'warning',
    vitalType: 'heartRate',
    vitalValue: 125,
    patientAge: 68,
  },
});

// Deterministic action handling
if (result.success && result.output) {
  const actions = await executeZeinaActions(
    result.output,
    alertContext,
    traceId
  );
  
  // Actions are automatically determined
  if (actions.sendAlert) {
    await sendAlerts(actions.alertRecipients);
  }
}
```

### Example 2: Symptom Alert Handler

**New Implementation:**
```typescript
import { runZeinaAnalysis } from './services/zeina';

async function handleSymptomAlert(
  symptomId: string,
  patientId: string,
  symptomType: string,
  severity: number
) {
  const traceId = createTraceId();
  
  const result = await runZeinaAnalysis({
    traceId,
    alertContext: {
      alertId: symptomId,
      patientId,
      alertType: 'symptom',
      severity: severity >= 8 ? 'critical' : 'warning',
      // Symptom-specific data can be added to types
    },
  });
  
  if (result.success && result.output) {
    // Handle based on escalation level
    switch (result.output.escalationLevel) {
      case 'emergency':
        await triggerEmergencyProtocol(patientId);
        break;
      case 'caregiver':
        await notifyCaregivers(patientId);
        break;
      case 'none':
        await logForReview(patientId);
        break;
    }
  }
}
```

### Example 3: Fall Detection

**New Implementation:**
```typescript
import { runZeinaAnalysis } from './services/zeina';

async function handleFallDetection(
  patientId: string,
  location?: string
) {
  const traceId = createTraceId();
  
  // Falls are always critical
  const result = await runZeinaAnalysis({
    traceId,
    alertContext: {
      alertId: `fall_${Date.now()}`,
      patientId,
      alertType: 'fall',
      severity: 'critical',
    },
  });
  
  // Zeina will automatically escalate falls
  if (result.success && result.output) {
    const actions = await executeZeinaActions(
      result.output,
      alertContext,
      traceId
    );
    
    // Falls typically trigger emergency escalation
    // actions.escalationLevel === 'emergency'
    // actions.alertRecipients === ['caregiver', 'family', 'emergency']
  }
}
```

## API Comparison

### Input Comparison

| Old API | New API | Notes |
|---------|---------|-------|
| `patientId` | `alertContext.patientId` | Same |
| `alert: AlertInfo` | `alertContext.*` | Flattened structure |
| `recentVitalsSummary` | Auto-detected from `vitalValue` | Simplified |
| `patientContext.age` | `alertContext.patientAge` | Will be bucketed |
| `traceId` (optional) | `traceId` (required) | Now required |

### Output Comparison

| Old API | New API | Notes |
|---------|---------|-------|
| `riskScore` | `output.riskScore` | Same (0-100) |
| `riskLevel` | `output.escalationLevel` | Different enum |
| `summary` | `output.summary` | Same (non-diagnostic) |
| `recommendedActions[]` | `output.recommendedActionCode` | Now enum-based |
| N/A | `output.escalationLevel` | New field |
| N/A | Backend actions via `executeZeinaActions()` | New deterministic mapping |

## Breaking Changes

### 1. Output Structure Changed

**Old:**
```typescript
{
  riskScore: 75,
  riskLevel: 'high',
  summary: 'Elevated heart rate...',
  recommendedActions: [
    { priority: 'immediate', action: 'Contact patient...' },
    { priority: 'high', action: 'Review medications...' }
  ]
}
```

**New:**
```typescript
{
  riskScore: 75,
  summary: 'Elevated heart rate...',
  recommendedActionCode: 'CONTACT_PATIENT',
  escalationLevel: 'caregiver',
  metadata: { analysisType: 'ai', model: 'gpt-4o-mini', ... }
}
```

**Migration:**
- Use adapter for old format
- OR map `recommendedActionCode` to actions manually
- OR use `executeZeinaActions()` for automatic mapping

### 2. Input Structure Changed

**Old:**
```typescript
{
  patientId: 'patient_123',
  alert: {
    type: 'vital',
    severity: 'warning',
    title: 'High Heart Rate',
    body: 'Heart rate is 125 bpm',
    data: { vitalType: 'heartRate', value: 125 }
  }
}
```

**New:**
```typescript
{
  traceId: 'trace_abc',
  alertContext: {
    alertId: 'alert_123',
    patientId: 'patient_456',
    alertType: 'vital',
    severity: 'warning',
    vitalType: 'heartRate',
    vitalValue: 125
  }
}
```

**Migration:**
- Use adapter (handles conversion automatically)
- OR restructure input to new format

### 3. Fail-Closed Behavior

**Old:** Could throw errors
```typescript
try {
  const result = await analyze(input);
} catch (error) {
  // Handle error
}
```

**New:** Always succeeds
```typescript
const result = await runZeinaAnalysis(request);
// result.success is always true
// Falls back to deterministic if AI fails
```

## Testing

### Unit Tests

Old tests still work with adapter:
```typescript
import { analyze } from './services/zeina';

test('should analyze vital alert', async () => {
  const result = await analyze({
    patientId: 'test_patient',
    alert: testAlert,
  });
  
  expect(result.riskScore).toBeGreaterThan(0);
});
```

New tests use new API:
```typescript
import { runZeinaAnalysis } from './services/zeina';

test('should analyze vital alert', async () => {
  const result = await runZeinaAnalysis({
    traceId: 'test_trace',
    alertContext: testContext,
  });
  
  expect(result.success).toBe(true);
  expect(result.output?.riskScore).toBeGreaterThan(0);
});
```

## Rollout Strategy

### Phase 1: Backward Compatibility (Current)
- ✅ Old code continues working via adapter
- ✅ No immediate changes required
- ✅ New implementation runs under the hood

### Phase 2: Gradual Migration (Recommended)
1. Update vital alert handlers to new API
2. Update symptom alert handlers to new API
3. Update fall detection to new API
4. Add new alert types using new API only

### Phase 3: Deprecation (Future)
- Mark adapter as deprecated
- Migrate remaining old code
- Remove adapter in next major version

## Troubleshooting

### Issue: "Type mismatch on analyze()"

**Solution:** Import from adapter instead of analyze.ts
```typescript
// Wrong
import { analyze } from './services/zeina/analyze';

// Correct
import { analyze } from './services/zeina';
// or
import { analyze } from './services/zeina/adapter';
```

### Issue: "Missing recommendedActions in output"

**Solution:** Use adapter for old format, or map action code
```typescript
// Option 1: Use adapter
import { analyze } from './services/zeina';
const result = await analyze(input);
// result.recommendedActions available

// Option 2: Map action code
import { runZeinaAnalysis, executeZeinaActions } from './services/zeina';
const result = await runZeinaAnalysis(request);
const actions = await executeZeinaActions(result.output, context, traceId);
// actions.appCTA, actions.autoActions available
```

### Issue: "PHI in logs"

**Solution:** Use new API (automatically sanitizes)
```typescript
// Old: Might log exact values
logger.info('Alert', { value: 125 }); // PHI!

// New: Only logs IDs
// PHI automatically stripped before AI call
// Logs only contain traceId, alertId, patientId
```

## Support

For questions or issues:
1. Check README.md for architecture details
2. Check IMPLEMENTATION.md for complete spec
3. Review example-usage.ts for patterns
4. Check unit tests for examples

---

**Migration Status:** ✅ Backward compatible - no immediate action required

**Recommended Action:** Gradually migrate to new API for new code

**Timeline:** Adapter will be maintained for at least 6 months
