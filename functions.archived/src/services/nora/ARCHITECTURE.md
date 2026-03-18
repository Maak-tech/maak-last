# Nora AI Architecture

Visual architecture diagrams and data flow documentation.

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         NURALIX BACKEND                             │
│                     (Firebase Functions)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ALERT HANDLER                               │
│  (Vitals, Symptoms, Falls, Medications, Trends)                 │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Alert Detected (heart rate 125 bpm, age 68)         │   │
│  └────────────────────┬────────────────────────────────────┘   │
└────────────────────────┼──────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   runNoraAnalysis()          │
         │   (index.ts - Public API)     │
         └───────────┬───────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────┐
    │  INPUT VALIDATION (guardrails.ts)      │
    │  - Check required fields               │
    │  - Validate enums                      │
    │  - Verify data ranges                  │
    └────────────┬───────────────────────────┘
                 │ ✅ Valid
                 ▼
    ┌────────────────────────────────────────┐
    │  PHI SANITIZATION (inputBuilder.ts)    │
    │                                         │
    │  PHI Input          →    AI-Safe       │
    │  ─────────────────────────────────     │
    │  Age: 68            →    "senior"      │
    │  HR: 125 bpm        →    "high"        │
    │  Meds: [A,B,C]      →    hasMeds:true  │
    │  Name: "John"       →    [NAME]        │
    └────────────┬───────────────────────────┘
                 │ 🔒 NO PHI
                 ▼
    ┌────────────────────────────────────────┐
    │  LLM CALL (analyze.ts)                 │
    │                                         │
    │  ┌──────────────────────────────────┐  │
    │  │  Try: OpenAI API                 │  │
    │  │  - Timeout: 8s                   │  │
    │  │  - Retry: 2x                     │  │
    │  │  - Model: gpt-4o-mini            │  │
    │  └─────────┬────────────────────────┘  │
    │            │                            │
    │            ├─ Success → AI Response    │
    │            └─ Failure → Deterministic  │
    └────────────┬───────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  OUTPUT VALIDATION (guardrails.ts)     │
    │  - Verify schema (4 fields only)       │
    │  - Block diagnostic language           │
    │  - Apply safety constraints            │
    │  - Normalize values                    │
    └────────────┬───────────────────────────┘
                 │ ✅ Valid
                 ▼
    ┌────────────────────────────────────────┐
    │  ACTION MAPPING (outputMapper.ts)      │
    │                                         │
    │  AI Output          →    Actions       │
    │  ─────────────────────────────────     │
    │  ActionCode         →    App CTA       │
    │  EscalationLevel    →    Recipients    │
    │  RiskScore          →    Automation    │
    └────────────┬───────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │  OBSERVABILITY (observability.ts)      │
    │  - Log metrics (NO PHI)                │
    │  - Track duration                      │
    │  - Record analysis type                │
    └────────────┬───────────────────────────┘
                 │
                 ▼
         ┌───────────────────────────────┐
         │   NoraAnalysisResult         │
         │   - success: true             │
         │   - output: NoraOutput       │
         └───────────┬───────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ALERT HANDLER                                 │
│                                                                   │
│  executeNoraActions(output)                                     │
│  ├─ Send alerts to recipients                                    │
│  ├─ Create app notifications                                     │
│  ├─ Trigger automated actions                                    │
│  └─ Audit log                                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔒 PHI Boundary

**CRITICAL: PHI never leaves inputBuilder.ts**

```
┌─────────────────────────────────────────────────────────────────┐
│                         PHI ZONE                                 │
│  (Contains protected health information)                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ AlertContext                                             │   │
│  │ ├─ alertId: "alert_123"                                 │   │
│  │ ├─ patientId: "patient_456"                             │   │
│  │ ├─ vitalValue: 125 ◄────── PHI                          │   │
│  │ ├─ patientAge: 68  ◄────── PHI                          │   │
│  │ └─ medications: 3                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
            ┏━━━━━━━━━━━━━━━━━━━━━━━━━┓
            ┃   inputBuilder.ts       ┃
            ┃   (PHI SANITIZATION)    ┃
            ┃                         ┃
            ┃   125 bpm  →  "high"    ┃
            ┃   68 years →  "senior"  ┃
            ┗━━━━━━━━━━━┯━━━━━━━━━━━━━┛
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PHI-FREE ZONE                               │
│  (Safe to send to external APIs)                                │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ NoraInput                                               │   │
│  │ ├─ alertType: "vital"                                    │   │
│  │ ├─ severity: "warning"                                   │   │
│  │ ├─ vitalLevel: "high"     ◄── Bucketed (NO PHI)         │   │
│  │ ├─ ageGroup: "senior"     ◄── Grouped (NO PHI)          │   │
│  │ └─ hasMedications: true   ◄── Boolean (NO PHI)          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│                   ┌─────────────┐                               │
│                   │  OpenAI API │ ✅ Safe to call                │
│                   └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### Scenario: High Heart Rate Alert

```
1. ALERT DETECTION
   ├─ Patient ID: patient_123
   ├─ Heart Rate: 125 bpm (measured)
   ├─ Age: 68 years
   └─ Severity: warning
          │
          ▼
2. INPUT VALIDATION
   ├─ Check: patientId exists ✅
   ├─ Check: vitalValue valid ✅
   ├─ Check: severity enum ✅
   └─ Result: VALID
          │
          ▼
3. PHI SANITIZATION
   ├─ 125 bpm → "high" (bucketed)
   ├─ 68 years → "senior" (grouped)
   ├─ 3 meds → hasMedications: true
   └─ Result: NoraInput (NO PHI)
          │
          ▼
4. LLM ANALYSIS
   ├─ Provider: OpenAI
   ├─ Model: gpt-4o-mini
   ├─ Timeout: 8000ms
   ├─ Input: NoraInput (safe)
   └─ Output: RawAIResponse
          │
          ▼
5. OUTPUT VALIDATION
   ├─ Check: Has riskScore ✅
   ├─ Check: Has actionCode ✅
   ├─ Check: No diagnostic terms ✅
   └─ Result: VALID
          │
          ▼
6. ACTION MAPPING
   ├─ riskScore: 65
   ├─ actionCode: CHECK_VITALS
   ├─ escalation: caregiver
   └─ Recipients: [caregiver, family]
          │
          ▼
7. EXECUTION
   ├─ Send alert to caregivers
   ├─ Create app notification
   ├─ Schedule follow-up in 1h
   └─ Log to audit trail
          │
          ▼
8. OBSERVABILITY
   ├─ Metric: nora.calls +1
   ├─ Metric: nora.llm_calls +1
   ├─ Duration: 1,250ms
   └─ Log: analysis complete (NO PHI)
```

---

## 🛡️ Fail-Closed Architecture

**Principle: Nora NEVER blocks critical alerts**

```
                    runNoraAnalysis()
                            │
                ┌───────────┴───────────┐
                │ Input Validation      │
                └───────┬───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │ VALID         │               │ INVALID
        ▼               │               ▼
┌──────────────┐        │      ┌─────────────────┐
│ Sanitize PHI │        │      │ Use Deterministic│
└──────┬───────┘        │      │    Fallback     │
       │                │      └────────┬─────────┘
       ▼                │               │
┌──────────────┐        │               │
│  Call LLM    │        │               │
└──────┬───────┘        │               │
       │                │               │
    ┌──┴──┐             │               │
    │ OK? │             │               │
    └──┬──┘             │               │
       │                │               │
   ┌───┴───┐            │               │
   │YES│NO │            │               │
   │   │   │            │               │
   ▼   ▼   ▼            │               │
   │   │   │            │               │
   │   │   └─────────┐  │               │
   │   │             │  │               │
   │   └─────────┐   │  │               │
   │             │   │  │               │
   ▼             ▼   ▼  │               │
┌────────┐  ┌────────┐  │               │
│Validate│  │Fallback│  │               │
│Output  │  │Result  │  │               │
└───┬────┘  └───┬────┘  │               │
    │           │       │               │
 ┌──┴──┐        │       │               │
 │VALID│        │       │               │
 └──┬──┘        │       │               │
    │           │       │               │
    ▼           ▼       ▼               ▼
    └───────────┴───────┴───────────────┘
                    │
                    ▼
            NoraAnalysisResult
            success: TRUE ✅
            (ALWAYS succeeds)
```

---

## 📊 Component Interaction

```
┌─────────────────────────────────────────────────────────┐
│                     NORA SERVICE                        │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │ inputBuilder │◄───┤   guardrails │                  │
│  └──────┬───────┘    └──────┬───────┘                  │
│         │                    │                          │
│         ▼                    │                          │
│  ┌──────────────┐            │                          │
│  │   analyze    │◄───────────┘                          │
│  └──────┬───────┘                                       │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │ outputMapper │────►│ observability│                  │
│  └──────┬───────┘    └──────────────┘                  │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                       │
│  │  monitoring  │                                       │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🔌 External Integrations

```
┌──────────────────────────────────────────────────────────┐
│                    NURALIX BACKEND                          │
│                                                          │
│  ┌────────────────┐       ┌────────────────┐           │
│  │ Vital Triggers │───────►│ Nora Service │           │
│  └────────────────┘       └────────┬───────┘           │
│                                    │                    │
│  ┌────────────────┐                │                    │
│  │Symptom Triggers│────────────────┤                    │
│  └────────────────┘                │                    │
│                                    │                    │
│  ┌────────────────┐                │                    │
│  │ Fall Detection │────────────────┤                    │
│  └────────────────┘                │                    │
└────────────────────────────────────┼────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────┐
        │                            │                │
        ▼                            ▼                ▼
┌──────────────┐          ┌──────────────┐  ┌──────────────┐
│  OpenAI API  │          │  Firestore   │  │ Cloud Logs   │
│              │          │              │  │              │
│ - gpt-4o-mini│          │ - Alerts     │  │ - Metrics    │
│ - Timeout: 8s│          │ - Analysis   │  │ - Traces     │
│ - Retry: 2x  │          │ - Audit      │  │ - Errors     │
└──────────────┘          └──────────────┘  └──────────────┘
```

---

## 🎯 Decision Tree

```
                    Alert Detected
                          │
                          ▼
                ┌─────────────────┐
                │ Severity Level? │
                └────────┬─────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌───────┐      ┌─────────┐      ┌──────────┐
    │ Info  │      │ Warning │      │ Critical │
    └───┬───┘      └────┬────┘      └────┬─────┘
        │               │                 │
        │               │                 │
        ▼               ▼                 ▼
    Risk≤30         Risk:30-60        Risk≥60
        │               │                 │
        ▼               ▼                 ▼
    ┌───────┐      ┌─────────┐      ┌──────────┐
    │Monitor│      │ Check   │      │ Contact  │
    │       │      │ Vitals  │      │ Patient  │
    └───┬───┘      └────┬────┘      └────┬─────┘
        │               │                 │
        │               │                 │
        ▼               ▼                 ▼
    Escalation:     Escalation:      Escalation:
       none          caregiver        emergency
        │               │                 │
        │               │                 │
        ▼               ▼                 ▼
    Recipients:     Recipients:      Recipients:
        []         [caregiver,      [caregiver,
                    family]          family,
                                    emergency]
```

---

## 📈 Scalability

```
Current Capacity:
├─ Functions: 1000 concurrent
├─ OpenAI: Rate limited by API key tier
├─ Firestore: 1M writes/day
└─ Monitoring: Unlimited logs

Expected Load:
├─ Alerts: ~100-500/day
├─ Nora Calls: ~100-500/day
├─ LLM Calls: ~50-250/day (50% AI rate)
└─ Storage: ~1GB/month (logs + analysis)

Bottlenecks:
1. OpenAI API rate limits
   └─ Solution: Upgrade to higher tier
2. LLM latency (1-3s)
   └─ Solution: Already has timeout + fallback
3. Function cold starts
   └─ Solution: Firebase keeps warm

Scaling Strategy:
├─ Horizontal: Functions auto-scale
├─ Caching: Can add Redis for common patterns
├─ Batching: Can batch low-priority alerts
└─ Fallback: Deterministic mode always available
```

---

## 🔐 Security Layers

```
Layer 1: Input Validation
├─ Check required fields
├─ Validate enums
├─ Sanitize strings
└─ Verify data ranges

Layer 2: PHI Sanitization
├─ Bucket numeric values
├─ Group age ranges
├─ Convert lists to booleans
└─ Strip identifying text

Layer 3: LLM Call
├─ HTTPS only
├─ API key in secrets
├─ Timeout protection
└─ No data retention

Layer 4: Output Validation
├─ Strict schema (4 fields)
├─ Block diagnostic terms
├─ Enforce safety constraints
└─ Normalize values

Layer 5: Observability
├─ Log IDs only (no PHI)
├─ Encrypted logs
├─ Audit trail
└─ Metrics aggregated
```

---

## 📖 Summary

**Key Architectural Principles:**

1. **PHI Safety** - Single sanitization point (inputBuilder.ts)
2. **Fail-Closed** - Always succeeds with fallback
3. **Observable** - Complete metrics + logging (NO PHI)
4. **Deterministic** - Predictable action mapping
5. **Scalable** - Auto-scaling + caching ready
6. **Secure** - Multiple validation layers

**Data never leaves the system in identifiable form.**

**Alerts are never blocked by AI failures.**

**All operations are logged and auditable.**
