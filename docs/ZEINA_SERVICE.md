# Zeina AI Analysis Service

## Overview

Zeina is an intelligent analysis service that provides AI-powered risk assessment and recommendations for patient alerts. It enriches alerts with risk scores, summaries, and actionable recommendations before notifications are sent to caregivers.

## Current Implementation

**Type:** Deterministic rule-based analysis (stub)  
**Future:** Can be replaced with OpenAI GPT API integration

The current implementation uses a sophisticated rule-based system that:
- Calculates risk scores based on alert severity and type
- Analyzes recent vital trends
- Generates contextual summaries
- Provides prioritized recommended actions

## Architecture

### Location

```
functions/src/services/zeina/
└── index.ts                    # Complete Zeina service
```

### Integration Points

```
Alert Trigger (e.g., checkVitalBenchmarks)
    ↓
Create Alert Document in Firestore
    ↓
[OPTIONAL] Zeina Analysis
    ├→ Get recent vitals summary
    ├→ Calculate risk score
    ├→ Generate summary
    ├→ Generate recommended actions
    └→ Enrich alert document
        ↓
Send Notifications to Caregivers
```

## API

### Primary Function: `analyze()`

Analyzes a patient alert and returns risk assessment with recommendations.

```typescript
import { analyze } from './services/zeina';

const result = await analyze({
  patientId: 'patient123',
  alert: {
    type: 'vital',
    severity: 'critical',
    title: 'Critical Alert: Heart Rate',
    body: 'Heart rate is critically high',
    data: {
      vitalType: 'heartRate',
      value: 165,
      unit: 'bpm',
      direction: 'high',
    },
  },
  recentVitalsSummary: {
    heartRate: {
      current: 165,
      avg: 85,
      trend: 'increasing',
    },
    oxygenSaturation: {
      current: 94,
      avg: 97,
      trend: 'decreasing',
    },
  },
  traceId: 'trace_abc123',
});

console.log(result);
// {
//   riskScore: 95,
//   riskLevel: 'critical',
//   summary: 'CRITICAL RISK: heartRate high threshold detected...',
//   recommendedActions: [
//     {
//       priority: 'immediate',
//       action: 'Contact patient immediately to assess condition',
//       rationale: 'Critical alert requires immediate response'
//     },
//     ...
//   ],
//   analysisMetadata: {
//     analysisType: 'deterministic',
//     version: '1.0.0',
//     timestamp: Date
//   }
// }
```

### Helper Function: `enrichAlertWithAnalysis()`

Stores Zeina analysis results on an alert document.

```typescript
import { enrichAlertWithAnalysis } from './services/zeina';

await enrichAlertWithAnalysis(alertId, analysisResult, traceId);

// Alert document now has:
// {
//   ...existing fields,
//   zeinaAnalysis: {
//     riskScore: 95,
//     riskLevel: 'critical',
//     summary: '...',
//     recommendedActions: [...],
//     analyzedAt: Timestamp,
//     version: '1.0.0'
//   }
// }
```

### Helper Function: `getRecentVitalsSummary()`

Fetches and aggregates recent vital readings for a patient.

```typescript
import { getRecentVitalsSummary } from './services/zeina';

const vitals = await getRecentVitalsSummary('patient123', 24); // Last 24 hours

console.log(vitals);
// {
//   heartRate: { current: 85, avg: 78, trend: 'increasing' },
//   bloodPressure: {
//     systolic: { current: 145, avg: 135 },
//     diastolic: { current: 95, avg: 88 },
//     trend: 'increasing'
//   },
//   oxygenSaturation: { current: 97, avg: 98, trend: 'stable' }
// }
```

## Types

### ZeinaAnalysisInput

```typescript
interface ZeinaAnalysisInput {
  patientId: string;
  alert: AlertInfo;
  recentVitalsSummary?: VitalsSummary;
  patientContext?: {
    age?: number;
    gender?: string;
    medicalHistory?: string[];
    medications?: string[];
  };
  traceId?: string;
}
```

### AlertInfo

```typescript
interface AlertInfo {
  type: 'vital' | 'symptom' | 'fall' | 'trend' | 'medication';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  body: string;
  data: {
    vitalType?: string;
    value?: number;
    unit?: string;
    direction?: 'low' | 'high';
    symptomType?: string;
    symptomSeverity?: number;
    [key: string]: any;
  };
}
```

### VitalsSummary

```typescript
interface VitalsSummary {
  heartRate?: { 
    current: number; 
    avg: number; 
    trend: 'stable' | 'increasing' | 'decreasing' 
  };
  bloodPressure?: { 
    systolic: { current: number; avg: number }; 
    diastolic: { current: number; avg: number };
    trend: 'stable' | 'increasing' | 'decreasing';
  };
  oxygenSaturation?: { current: number; avg: number; trend: string };
  // ... other vitals
}
```

### ZeinaAnalysisResult

```typescript
interface ZeinaAnalysisResult {
  riskScore: number;              // 0-100
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  summary: string;
  recommendedActions: RecommendedAction[];
  analysisMetadata: {
    analysisType: 'deterministic' | 'ai';
    version: string;
    timestamp: Date;
  };
}
```

### RecommendedAction

```typescript
interface RecommendedAction {
  priority: 'immediate' | 'high' | 'moderate' | 'low';
  action: string;
  rationale?: string;
}
```

## Risk Scoring

### Risk Score Calculation

**Base Score (from alert severity):**
- Critical: 80
- Warning: 50
- Info: 20

**Adjustments (alert type):**
- Fall: +15 (always serious)
- Vital (heart rate/oxygen): +10
- Symptom (severity ≥8): +15
- Trend: +5

**Adjustments (vitals trends):**
- 2+ increasing trends: +10
- Heart rate >150 or <40: +15
- Oxygen saturation <90: +20
- Temperature >39°C: +10

**Final Score:** Capped at 100

### Risk Levels

| Score | Level | Description |
|-------|-------|-------------|
| 0-30 | Low | Routine monitoring |
| 31-60 | Moderate | Attention needed |
| 61-85 | High | Urgent attention |
| 86-100 | Critical | Immediate action |

## Analysis Logic

### Summary Generation

The summary provides a concise risk assessment:

```
{riskLevel} RISK: {alert description}. {trend information}
```

**Examples:**

```
CRITICAL RISK: heartRate high threshold detected (165 bpm). Recent trend: increasing.

HIGH RISK: Patient reported chest pain with severity 9/10.

MODERATE RISK: Blood pressure elevated: 145/95 mmHg. Recent trend: stable.
```

### Recommended Actions

Actions are prioritized based on risk level and alert type:

#### Immediate Priority (Critical Risk)
- Contact patient immediately
- Check for injuries (falls)
- Consider emergency services (critical vitals)

#### High Priority
- Review recent vital trends
- Schedule follow-up measurements
- Monitor concerning trends

#### Moderate Priority
- Document in care log
- Assess need for medical consultation
- Gather symptom details

#### Low Priority (Always Included)
- Update family members
- Continue regular monitoring

## Integration Example

### In `sendVitalAlertToAdmins` (index.ts)

```typescript
// Create alert document
const alertDoc = await db.collection("alerts").add({
  userId,
  type: "vital",
  severity,
  title: alertMessage.title,
  body: alertMessage.message,
  data: { vitalType, value, unit, direction },
  isAcknowledged: false,
  timestamp: FieldValue.serverTimestamp(),
});

const alertId = alertDoc.id;

// Optional: Zeina AI Analysis enrichment
try {
  // Get recent vitals
  const recentVitals = await getRecentVitalsSummary(userId, 24);

  // Prepare alert info
  const alertInfo: AlertInfo = {
    type: "vital",
    severity,
    title: alertMessage.title,
    body: alertMessage.message,
    data: { vitalType, value, unit, direction },
  };

  // Run analysis
  const analysis = await zeinaAnalyze({
    patientId: userId,
    alert: alertInfo,
    recentVitalsSummary: recentVitals,
    traceId,
  });

  // Enrich alert
  await enrichAlertWithAnalysis(alertId, analysis, traceId);

  logger.info("Zeina analysis completed", {
    traceId,
    alertId,
    riskScore: analysis.riskScore,
  });
} catch (zeinaError) {
  // Don't fail alert if Zeina fails
  logger.warn("Zeina analysis failed, continuing", zeinaError);
}

// Continue with notifications...
```

## Alert Document Structure

After Zeina enrichment, alert documents contain:

```typescript
{
  // Standard alert fields
  userId: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  data: object;
  isAcknowledged: boolean;
  timestamp: Timestamp;
  createdAt: Timestamp;
  
  // Zeina analysis (added by enrichment)
  zeinaAnalysis: {
    riskScore: number;
    riskLevel: string;
    summary: string;
    recommendedActions: [
      {
        priority: string;
        action: string;
        rationale: string;
      }
    ];
    analyzedAt: Timestamp;
    version: string;
  };
}
```

## Privacy & Security

### PHI Safety

**✅ Safe to Store:**
- Risk scores (numeric)
- Risk levels (categorical)
- Generic summaries (no names)
- Action recommendations (generic)
- Metadata (timestamps, versions)

**❌ Never Stored:**
- Raw chat logs
- Patient names in analysis
- Detailed medical history
- Personal identifiers

### Logging

All logs are PHI-safe:

```json
{
  "level": "info",
  "msg": "Zeina analysis started",
  "traceId": "trace_abc",
  "patientId": "patient123",
  "alertType": "vital",
  "alertSeverity": "critical",
  "fn": "zeina.analyze"
}
```

```json
{
  "level": "info",
  "msg": "Zeina analysis completed",
  "traceId": "trace_abc",
  "patientId": "patient123",
  "riskScore": 95,
  "riskLevel": "critical",
  "actionCount": 5,
  "fn": "zeina.analyze"
}
```

## Error Handling

### Graceful Degradation

Zeina is designed to fail gracefully:

```typescript
try {
  const analysis = await zeinaAnalyze({...});
  await enrichAlertWithAnalysis(alertId, analysis);
} catch (zeinaError) {
  // Alert still goes out even if Zeina fails
  logger.warn("Zeina failed, continuing with alert", zeinaError);
}
```

### Fallback Result

If analysis fails, a safe fallback is returned:

```typescript
{
  riskScore: 50,
  riskLevel: 'moderate',
  summary: 'Unable to complete detailed analysis. Please review alert manually.',
  recommendedActions: [
    {
      priority: 'high',
      action: 'Review alert details and patient history',
      rationale: 'Automated analysis unavailable'
    }
  ]
}
```

## Usage in Client Apps

### Fetching Alert with Zeina Analysis

```typescript
// Fetch alert document
const alertDoc = await db.collection('alerts').doc(alertId).get();
const alert = alertDoc.data();

// Check if Zeina analysis is available
if (alert.zeinaAnalysis) {
  const { riskScore, riskLevel, summary, recommendedActions } = alert.zeinaAnalysis;
  
  // Display in UI
  console.log(`Risk: ${riskLevel} (${riskScore}/100)`);
  console.log(`Summary: ${summary}`);
  
  // Show recommended actions
  recommendedActions.forEach(action => {
    console.log(`[${action.priority}] ${action.action}`);
  });
}
```

### UI Display Example

```
┌─────────────────────────────────────────┐
│ 🚨 Critical Alert: Heart Rate           │
├─────────────────────────────────────────┤
│ Risk Score: 95/100 (CRITICAL)           │
│                                         │
│ CRITICAL RISK: heartRate high threshold │
│ detected (165 bpm). Recent trend:       │
│ increasing.                             │
│                                         │
│ Recommended Actions:                    │
│ 🔴 IMMEDIATE:                           │
│   • Contact patient immediately         │
│   • Consider emergency services         │
│                                         │
│ 🟠 HIGH:                                │
│   • Review recent vital trends          │
│   • Schedule follow-up measurement      │
│                                         │
│ 🟡 MODERATE:                            │
│   • Document in care log                │
│   • Assess need for consultation        │
└─────────────────────────────────────────┘
```

## Future Enhancements

### OpenAI Integration

Replace deterministic logic with GPT-4:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyze(input: ZeinaAnalysisInput): Promise<ZeinaAnalysisResult> {
  const prompt = `
You are Zeina, a medical AI assistant analyzing patient alerts.

Patient Alert:
- Type: ${input.alert.type}
- Severity: ${input.alert.severity}
- Details: ${input.alert.body}

Recent Vitals:
${JSON.stringify(input.recentVitalsSummary, null, 2)}

Provide:
1. Risk score (0-100)
2. Risk level (low/moderate/high/critical)
3. Brief summary
4. Prioritized recommended actions

Format as JSON.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(response.choices[0].message.content);
  
  return {
    ...result,
    analysisMetadata: {
      analysisType: 'ai',
      version: '2.0.0',
      timestamp: new Date(),
    },
  };
}
```

### Additional Features

- [ ] Multi-language support
- [ ] Patient context integration (age, history, medications)
- [ ] Trend prediction
- [ ] Severity escalation detection
- [ ] Care plan suggestions
- [ ] Integration with medical knowledge bases
- [ ] Personalized recommendations based on patient profile

## Performance

**Typical Latency:**
- Deterministic analysis: ~50ms
- Vitals summary fetch: ~100ms
- Alert enrichment: ~50ms
- **Total: ~200ms**

**Future (with OpenAI):**
- GPT-4 API call: ~2-5 seconds
- Caching strategies needed

## Testing

### Unit Tests (Future)

```typescript
import { analyze } from './services/zeina';

describe('Zeina Analysis', () => {
  it('should calculate critical risk for high heart rate', async () => {
    const result = await analyze({
      patientId: 'test',
      alert: {
        type: 'vital',
        severity: 'critical',
        title: 'Heart Rate Alert',
        body: 'Heart rate is high',
        data: { vitalType: 'heartRate', value: 165, unit: 'bpm' },
      },
    });

    expect(result.riskLevel).toBe('critical');
    expect(result.riskScore).toBeGreaterThan(85);
  });

  it('should include immediate actions for critical alerts', async () => {
    const result = await analyze({...});
    
    const immediateActions = result.recommendedActions.filter(
      a => a.priority === 'immediate'
    );
    
    expect(immediateActions.length).toBeGreaterThan(0);
  });
});
```

## Deployment

```bash
# Build
npm run build

# Deploy
firebase deploy --only functions
```

## Summary

✅ **Intelligent Risk Assessment** - Calculates risk scores based on multiple factors  
✅ **Contextual Summaries** - Generates human-readable analysis  
✅ **Actionable Recommendations** - Provides prioritized next steps  
✅ **Optional Enrichment** - Doesn't block alerts if it fails  
✅ **PHI-Safe** - No raw chat logs or personal data stored  
✅ **Extensible** - Easy to replace with OpenAI GPT  

Zeina enhances the alert system by providing caregivers with intelligent context and guidance, helping them respond more effectively to patient alerts.
