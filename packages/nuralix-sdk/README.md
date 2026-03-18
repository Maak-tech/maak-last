# @nuralix/sdk

Official TypeScript SDK for the **Nuralix Virtual Health Identity (VHI)** platform.

Integrate patient health intelligence — risk scores, genetic baselines, elevating/declining factors, alerts, and real-time timelines — into any healthcare application in minutes.

---

## Installation

```bash
npm install @nuralix/sdk
# or
bun add @nuralix/sdk
```

---

## Quickstart

```typescript
import { NurulixClient } from "@nuralix/sdk";

const client = new NurulixClient({
  apiKey: "nk_live_your_api_key_here",
  // baseURL defaults to https://api.nuralix.ai
});

// Get a patient's Virtual Health Identity
const vhi = await client.getPatientVHI("patient_abc123");
console.log(`Overall score: ${vhi?.overallScore}/100`);
console.log(`Risk level: ${vhi?.riskLevel}`);   // "low" | "moderate" | "high"
console.log(`Top declining factor: ${vhi?.decliningFactors[0]?.factor}`);
```

---

## Authentication

All SDK calls require an **API key** scoped to your organisation. Keys start with `nk_`.

```typescript
// Create an API key (one-time, store the key immediately)
const { key } = await client.createAPIKey({
  name: "prod-ehr-integration",
  scopes: ["vhi:read", "genetics:read", "timeline:read"],
});
console.log("Store this key now:", key);
```

API keys support fine-grained **scopes**:

| Scope | Access |
|---|---|
| `vhi:read` | Read patient VHI, risk scores, elevating/declining factors |
| `genetics:read` | Read condition-level genetic risks (no raw rsids) |
| `timeline:read` | Read longitudinal health event stream |
| `alerts:read` | Read active and resolved patient alerts |
| `webhook:write` | Register and delete webhook endpoints |
| `key:manage` | Create, list, and revoke API keys |
| `*` | Full access (use sparingly — prefer narrow scopes in production) |

---

## API Reference

### Patient VHI

```typescript
const vhi = await client.getPatientVHI(patientId);
// Returns PatientVHI | null

vhi.overallScore          // 0–100 composite health score
vhi.riskLevel             // "low" | "moderate" | "high"
vhi.riskScores.fallRisk   // { score, drivers, confidence }
vhi.elevatingFactors      // Array<{ factor, impact, category, explanation }>
vhi.decliningFactors      // Array<{ factor, impact, recommendation, ... }>
vhi.pendingActions        // Array<{ title, priority, target, ... }>
```

### Patient Risk Scores

```typescript
const risk = await client.getPatientRisk(patientId);

risk.compositeRisk    // 0–100
risk.fallRisk         // 0–100
risk.adherenceRisk    // 0–100
risk.deteriorationRisk // 0–100
risk.riskLevel        // "low" | "moderate" | "high"
risk.drivers          // { fall, adherence, deterioration } — string[] each
```

### Patient Genetics

```typescript
// Returns condition-level risks only — no raw rsids are ever exposed
const genetics = await client.getPatientGenetics(patientId);

genetics.processingStatus     // "none" | "pending" | "processing" | "processed" | "failed"
genetics.conditions           // [{ condition, percentile, level }]
genetics.pharmacogenomicsAlerts // [{ drug, gene, interaction }]
```

Patient must have `familySharingConsent = true` (set in the Nuralix app) for
genetic data to be accessible via the SDK.

### Health Timeline

```typescript
const timeline = await client.getPatientTimeline(patientId, {
  from: "2026-01-01",
  to: "2026-03-31",
  domain: "vitals",   // "vitals" | "symptoms" | "behavior" | "twin" | "clinical"
  limit: 500,
});

timeline.events.forEach((e) => {
  console.log(e.occurredAt, e.source, e.domain, e.value);
});
```

### Patient Alerts

```typescript
const { alerts } = await client.getPatientAlerts(patientId, {
  activeOnly: true,   // only unresolved alerts
  limit: 20,
});

alerts.forEach((a) => {
  console.log(`[${a.severity}] ${a.title} (${a.type})`);
});
```

### AI Health Insights

```typescript
const insights = await client.getPatientInsights(patientId);

// Insights mix elevating and declining factors in one ranked list
insights.insights.forEach((i) => {
  if (i.type === "declining") {
    console.log(`Declining: ${i.factor} — ${i.recommendation}`);
  }
});
```

### FHIR R4 Bundle Export

```typescript
// Export a patient's record as a standard FHIR R4 Bundle
// Requires scope: timeline:read
const bundle = await client.exportFHIR(patientId);

console.log(`Bundle type: ${bundle.type}`);          // "collection"
console.log(`Total resources: ${bundle.total}`);

// Access individual resources by type
const patient    = bundle.entry.find(e => e.resource.resourceType === "Patient");
const vitals     = bundle.entry.filter(e => e.resource.resourceType === "Observation");
const medications = bundle.entry.filter(e => e.resource.resourceType === "MedicationRequest");

// Vitals are LOINC-coded Observations (last 90 days)
vitals.forEach(({ resource }) => {
  if (resource.resourceType === "Observation") {
    console.log(resource.code.text, resource.effectiveDateTime);
  }
});
```

The FHIR bundle includes:

| Resource type | Contents |
|---|---|
| `Patient` | Demographics (name, DOB, gender, email, phone) |
| `Observation` | Last 90 days of vitals, mapped to LOINC codes (heart rate, BP, glucose, SpO₂, weight, …) |
| `MedicationRequest` | Active medications with dosage instructions |

> **Note:** No raw genetic variants, clinical note text, or rsids are included in the FHIR export.

---

## Webhooks

Register a webhook to receive real-time events when a patient's health changes:

```typescript
const webhook = await client.registerWebhook({
  url: "https://your-server.com/webhooks/nuralix",
  events: [
    "vhi.updated",
    "vhi.risk_elevated",
    "genetics.processed",
    "alert.triggered",
    "alert.resolved",
    "medication.missed",
  ],
});

// Store the secret — it is shown ONCE
console.log("Webhook secret:", webhook.secret);
```

### Verifying webhook signatures

Every delivery includes an `X-Nuralix-Signature` header:

```typescript
import { createHmac } from "crypto";

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return signature === expected;
}
```

### Webhook event catalog

| Event | Trigger | Payload highlights |
|---|---|---|
| `vhi.updated` | VHI recomputed (every 15 min) | `overallScore`, `compositeRisk`, `riskLevel`, `trajectory` |
| `vhi.risk_elevated` | Composite risk ≥ 75 | `compositeRisk`, `topDecliningFactor` |
| `genetics.processed` | DNA parsing job completed | `snpCount`, `prsConditions[]` |
| `alert.triggered` | Any new emergency alert created | `alertId`, `type`, `severity`, `title` |
| `alert.resolved` | Alert closed by patient or caregiver | `alertId`, `type`, `severity`, `resolvedBy` |
| `medication.missed` | Patient missed 2+ consecutive doses | `consecutiveMissed`, `adherenceRate` |

> **Tip:** Check `data.type` on `alert.triggered` to distinguish fall alerts (`"fall"`), medication alerts (`"medication"`), vital alerts (`"vital"`), etc.

---

## Error Handling

All methods throw `NurulixError` on API errors:

```typescript
import { NurulixClient, NurulixError } from "@nuralix/sdk";

try {
  const vhi = await client.getPatientVHI(patientId);
} catch (err) {
  if (err instanceof NurulixError) {
    console.error(`[${err.status}] ${err.message}`);
  }
}
```

---

## Use Cases by Customer Type

| Customer | Recommended endpoints |
|---|---|
| **Telehealth platform** | `getPatientVHI`, `getPatientRisk`, `getPatientAlerts` — pre-visit patient briefing + triage |
| **EHR integration** | `exportFHIR` — FHIR R4 bundle for EHR ingestion; `getPatientTimeline` for raw event stream |
| **Wellness provider** | `getPatientInsights` — personalised coaching based on elevating/declining factors |
| **Insurance / actuary** | `getPatientRisk` + `getPatientGenetics` — risk stratification (consent required) |
| **Remote monitoring** | Webhooks: `vhi.risk_elevated`, `alert.fall_detected` — real-time care escalation |

---

## TypeScript Support

The SDK ships with full TypeScript types. All key shapes are exported:

```typescript
import type {
  PatientVHI,
  PatientRisk,
  PatientGenetics,
  ElevatingFactor,
  DecliningFactor,
  RiskScores,
  WebhookEvent,
  // FHIR R4 types
  FhirBundle,
  FhirPatientResource,
  FhirObservationResource,
  FhirMedicationRequestResource,
} from "@nuralix/sdk";
```

---

## Privacy & Security

- **No raw genetic variants** are ever returned. The SDK only exposes condition-level PRS percentiles and pharmacogenomics alerts.
- **No clinical note text** is returned. Only structured extracted data (pending actions, conditions) is surfaced.
- All data access requires explicit patient consent and an organisation-scoped API key.
- Webhook signatures use HMAC-SHA256. Always verify before processing payloads.

---

## Support

- Docs: https://docs.nuralix.ai
- API status: https://status.nuralix.ai
- Issues: https://github.com/nuralix/sdk/issues
