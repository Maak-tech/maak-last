# Zeina AI Analysis Service

**HIPAA-safe AI orchestration for health alert analysis**

## Overview

Zeina is a HIPAA-compliant AI service that analyzes health alerts and provides structured, actionable recommendations. It is designed with **PHI safety** as a core principle and implements a **fail-closed** architecture to ensure system reliability.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Alert Handler                            │
│                  (contains PHI)                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  runZeinaAnalysis()  │
            │   (index.ts)         │
            └──────────┬───────────┘
                       │
         ┌─────────────┼─────────────┐
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│ inputBuilder.ts │         │ guardrails.ts   │
│ PHI → AI-safe   │         │ Validation      │
└────────┬────────┘         └────────┬────────┘
         │                           │
         └─────────┬─────────────────┘
                   │
                   ▼
         ┌──────────────────┐
         │   analyze.ts     │
         │   LLM Call       │
         │   (NO PHI)       │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │ guardrails.ts    │
         │ Validation       │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │ outputMapper.ts  │
         │ AI → Actions     │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │ Backend Actions  │
         │ (deterministic)  │
         └──────────────────┘
```

## PHI Boundaries

### ⚠️ CRITICAL: PHI is NEVER sent to external LLMs

**PHI-containing data structures:**
- `AlertContext` - Raw alert data from backend (MAY contain PHI)

**PHI-free data structures:**
- `ZeinaInput` - Sanitized input for AI (NO PHI)
- `ZeinaOutput` - Structured output from AI (NO PHI)
- `BackendActions` - Deterministic actions (NO PHI)

### PHI Sanitization Process

The `inputBuilder.ts` module is the **ONLY** place where PHI is processed. It transforms raw alert data into AI-safe context:

**Transformations:**
1. **Exact values → Buckets**
   - Heart rate: 120 bpm → "high"
   - Age: 68 → "senior"
   
2. **Lists → Counts**
   - ["Medication A", "Medication B"] → `hasMedications: true`
   
3. **IDs stripped**
   - Patient ID, alert ID only used for backend correlation
   - NEVER sent to AI

4. **Text sanitization**
   - Names → [NAME]
   - Emails → [EMAIL]
   - Phone numbers → [PHONE]

### Example Transformation

**Input (AlertContext - contains PHI):**
```typescript
{
  alertId: "alert_123",
  patientId: "patient_456",
  alertType: "vital",
  severity: "warning",
  vitalType: "heartRate",
  vitalValue: 125,  // PHI
  patientAge: 68,   // PHI
  medicationCount: 3
}
```

**Output (ZeinaInput - NO PHI):**
```typescript
{
  alertType: "vital",
  severity: "warning",
  vitalType: "heartRate",
  vitalLevel: "high",      // Bucketed value
  ageGroup: "senior",      // Bucketed age
  hasMedications: true     // Boolean flag
}
```

## Guardrails

### Input Validation
- Required fields check
- Enum validation (alertType, severity)
- Value range checks

### Output Validation
Strict schema enforcement with **ONLY** allowed fields:
- ✅ `riskScore` (0-100)
- ✅ `summary` (short, non-diagnostic)
- ✅ `recommendedActionCode` (enum)
- ✅ `escalationLevel` (none | caregiver | emergency)

### Prohibited Content
- ❌ Medical diagnoses
- ❌ Free-text medical advice
- ❌ Diagnostic language ("you have...", "diagnosis:", "disease")
- ❌ Treatment recommendations
- ❌ Prescription suggestions

### Medical Safety Constraints
- Critical severity → riskScore ≥ 60
- Emergency escalation → riskScore ≥ 70
- Info severity → riskScore ≤ 60
- No escalation → riskScore ≤ 50

## Fail-Closed Architecture

**Principle:** Zeina NEVER blocks critical health alerts

### Failure Handling
1. **LLM unavailable** → Deterministic fallback
2. **LLM timeout** → Deterministic fallback
3. **Invalid response** → Deterministic fallback
4. **Guardrail block** → Deterministic fallback
5. **Any error** → Deterministic fallback

### Deterministic Fallback
When AI fails, the system uses rule-based logic:
- Risk score calculated from severity + vital level
- Action code based on alert type
- Escalation level based on severity

**Result:** The alert ALWAYS gets processed, even if AI is down.

## Output Mapping

ZeinaOutput is mapped to **deterministic backend actions**:

### RecommendedActionCode → App CTA
| Action Code | App Action | Priority |
|-------------|------------|----------|
| MONITOR | view_alert | low |
| CHECK_VITALS | record_vitals | medium |
| CONTACT_PATIENT | call_patient | high |
| IMMEDIATE_ATTENTION | call_emergency | critical |

### EscalationLevel → Alert Recipients
| Escalation | Recipients |
|------------|------------|
| none | [] |
| caregiver | [caregiver, family] |
| emergency | [caregiver, family, emergency] |

### Automated Actions
- `RECHECK_IN_1H` → Schedule follow-up
- `NOTIFY_CAREGIVER` → Send push notification
- `IMMEDIATE_ATTENTION` → Escalate to emergency + log critical event

## Usage

### Basic Usage

```typescript
import { runZeinaAnalysis } from './services/zeina';

// In your alert handler
const result = await runZeinaAnalysis({
  traceId: 'trace_abc123',
  alertContext: {
    alertId: 'alert_456',
    patientId: 'patient_789',
    alertType: 'vital',
    severity: 'warning',
    vitalType: 'heartRate',
    vitalValue: 125,
    patientAge: 68,
  },
});

if (result.success && result.output) {
  // Execute backend actions
  const actions = await executeZeinaActions(
    result.output,
    alertContext,
    traceId
  );
  
  // Send alerts
  if (actions.sendAlert) {
    await sendAlertsToRecipients(actions.alertRecipients);
  }
  
  // Trigger automated actions
  for (const action of actions.autoActions) {
    await executeAutomatedAction(action);
  }
  
  // Audit log
  await auditZeinaAnalysis(result.output, alertContext, traceId);
}
```

### Configuration

Environment variables:
- `ZEINA_ENABLED` - Enable/disable AI (default: true)
- `ZEINA_LLM_PROVIDER` - LLM provider (default: 'openai')
- `ZEINA_MODEL` - Model name (default: 'gpt-4o-mini')
- `ZEINA_TIMEOUT_MS` - LLM timeout (default: 8000)
- `ZEINA_MAX_RETRIES` - Max retry attempts (default: 2)
- `OPENAI_API_KEY` - OpenAI API key (required if enabled)

## Observability

### Metrics
- `zeina.calls` - Total analysis calls
- `zeina.failures` - Analysis failures
- `zeina.guardrail_blocks` - Guardrail validation failures
- `zeina.llm_calls` - LLM API calls
- `zeina.llm_timeouts` - LLM timeout errors
- `zeina.duration.*` - Duration buckets

### Logging
All logs include:
- ✅ `traceId` - Request correlation
- ✅ `alertId` - Alert identifier
- ✅ `patientId` - Patient identifier (ID only, not PHI)
- ❌ NO PHI (no names, values, notes)

## Testing

### Run Tests
```bash
npm test -- services/zeina/__tests__
```

### Test Coverage
- Input validation
- Output validation
- Safety constraints
- Deterministic mapping
- PHI sanitization

## Compliance

### HIPAA Requirements Met
✅ **Minimum Necessary:** Only de-identified data sent to AI  
✅ **No PHI Storage:** AI responses not stored with PHI  
✅ **Audit Logging:** All analyses logged with traceId  
✅ **Business Associate:** OpenAI BAA required for production  
✅ **Fail-Safe:** System never blocks critical alerts  

### Non-Diagnostic Disclaimer
Zeina provides **informational risk assessment** only. It does NOT:
- Provide medical diagnoses
- Recommend specific treatments
- Replace professional medical judgment
- Make autonomous medical decisions

## Future Enhancements

- [ ] Anthropic Claude integration
- [ ] Multi-language support
- [ ] Custom risk models per patient
- [ ] Real-time learning from outcomes
- [ ] Advanced trend analysis
- [ ] Integration with EHR systems

## Support

For issues or questions:
1. Check logs with traceId
2. Review guardrail errors
3. Verify environment configuration
4. Check metric dashboards

## License

Proprietary - Maak Health Technologies
