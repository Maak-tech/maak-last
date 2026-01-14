# Vitals Ingestion API

## Overview

Structured API for ingesting vital readings with validation, normalization, alerting, and audit logging.

## Architecture

### Modules

```
functions/src/
├── modules/vitals/
│   └── ingest.ts           # Pure validation & normalization functions
├── api/
│   └── vitals.ts           # API handler orchestration
└── index.ts                # Function export: ingestVitalReading
```

### Flow

```
Client Request
    ↓
ingestVitalReading (Cloud Function)
    ↓
api/vitals.ts (Handler)
    ├→ 1. Auth Context Extraction
    ├→ 2. RBAC Permission Check
    ├→ 3. Input Validation (modules/vitals/ingest.ts)
    ├→ 4. Normalization (modules/vitals/ingest.ts)
    ├→ 5. Firestore Persistence (db/collections.ts)
    ├→ 6. Alert Check (modules/alerts/engine.ts)
    ├→ 7. Audit Log Recording
    └→ 8. Response
        ↓
Client Response
```

## API Endpoint

### Cloud Function

**Name:** `ingestVitalReading`

**Type:** HTTPS Callable Function

**Authentication:** Required

### Request Format

```typescript
{
  userId: string;               // Patient user ID
  type: VitalType;             // Vital type (see below)
  value: number;               // Numeric value
  unit: string;                // Unit of measurement
  systolic?: number;           // For blood pressure only
  diastolic?: number;          // For blood pressure only
  source?: string;             // 'manual' | 'device' | 'healthkit' | etc
  deviceId?: string;           // Optional device identifier
  timestamp?: string;          // ISO 8601 format (optional, defaults to now)
}
```

### Vital Types

Supported `type` values:
- `heartRate`
- `restingHeartRate`
- `heartRateVariability`
- `bloodPressure` (requires systolic and diastolic)
- `respiratoryRate`
- `oxygenSaturation`
- `bodyTemperature`
- `weight`

### Response Format

**Success:**
```typescript
{
  success: true;
  vitalId: string;
  alert?: {
    severity: 'critical' | 'warning';
    direction: 'low' | 'high';
    message: string;
  }
}
```

**Validation Error:**
```typescript
{
  success: false;
  errors: Array<{
    field: string;
    message: string;
  }>
}
```

## Usage Examples

### Client (TypeScript)

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const ingestVital = httpsCallable(functions, 'ingestVitalReading');

// Example 1: Heart Rate
const result1 = await ingestVital({
  userId: 'patient123',
  type: 'heartRate',
  value: 75,
  unit: 'bpm',
  source: 'manual'
});

// Example 2: Blood Pressure
const result2 = await ingestVital({
  userId: 'patient123',
  type: 'bloodPressure',
  value: 120, // Systolic value
  systolic: 120,
  diastolic: 80,
  unit: 'mmHg',
  source: 'device',
  deviceId: 'bp-monitor-001'
});

// Example 3: Temperature with timestamp
const result3 = await ingestVital({
  userId: 'patient123',
  type: 'bodyTemperature',
  value: 37.2,
  unit: '°C',
  source: 'manual',
  timestamp: new Date().toISOString()
});

// Check for alerts
if (result1.data.alert) {
  console.log('Alert detected:', result1.data.alert.message);
}
```

## Validation Rules

### Required Fields
- `userId` - Must not be empty
- `type` - Must be a valid vital type
- `value` - Must be a valid number
- `unit` - Must not be empty

### Value Ranges

| Vital Type | Min | Max | Unit |
|------------|-----|-----|------|
| heartRate | 20 | 250 | bpm |
| restingHeartRate | 20 | 200 | bpm |
| heartRateVariability | 0 | 200 | ms |
| bloodPressure | 40 | 300 | mmHg |
| respiratoryRate | 0 | 60 | breaths/min |
| oxygenSaturation | 0 | 100 | % |
| bodyTemperature | 25 | 45 | °C |
| weight | 0 | 500 | kg |

### Blood Pressure Specific
- `systolic`: Required, 40-300 mmHg
- `diastolic`: Required, 20-200 mmHg
- Systolic must be > diastolic

## Normalization

### Unit Conversion

The API automatically normalizes units:

**Temperature:**
- Fahrenheit (°F, f, fahrenheit) → Celsius (°C)
- Formula: (°F - 32) × 5/9

**Weight:**
- Pounds (lb, lbs, pound, pounds) → Kilograms (kg)
- Formula: lb × 0.453592

**Other Units:**
- Case-insensitive matching
- Standard abbreviations (bpm, %, mmHg, etc.)

### Value Rounding

Values are rounded to 2 decimal places for consistency.

## Security

### Authentication
- All requests must be authenticated (Firebase Auth)
- Anonymous requests are rejected

### Authorization (RBAC)
- **Owner (patient):** Can write own vitals
- **Caregiver:** Can write vitals for their patients (if permission granted)
- **Admin:** Can write vitals for family members

Permission check: `assertCanWritePatient()`

## Alerting

### Automatic Alert Detection

When a vital reading exceeds thresholds, an alert is:
1. Detected during ingestion
2. Returned in the response
3. Logged for notifications

**Alert Response:**
```typescript
{
  severity: 'critical' | 'warning';
  direction: 'low' | 'high';
  message: 'heart rate is above normal range: 150 bpm'
}
```

### Alert Notifications

Notifications to family members are handled asynchronously by the `checkVitalBenchmarks` Firestore trigger (existing functionality).

## Audit Logging

Every vital ingestion is logged to the `audit` collection:

```typescript
{
  userId: string;          // Who performed the action
  action: 'create';
  resourceType: 'vital';
  resourceId: string;      // Vital ID
  targetUserId: string;    // Patient ID
  familyId?: string;
  timestamp: Timestamp;
}
```

## Observability

All operations are logged with structured format:

```json
{
  "level": "info",
  "msg": "Vital ingestion started",
  "traceId": "trace_abc123",
  "uid": "user123",
  "patientId": "patient456",
  "fn": "ingestVital"
}
```

**Log Events:**
- Vital ingestion started
- Permission denied
- Invalid input
- Vital persisted
- Alert detected
- Audit event recorded
- Vital ingestion completed
- Vital ingestion failed

## Error Handling

### Validation Errors
```typescript
{
  success: false,
  errors: [
    { field: 'value', message: 'Value must be between 20 and 250 bpm' }
  ]
}
```

### Authentication Errors
```typescript
throw new HttpsError('unauthenticated', 'User must be authenticated');
```

### Permission Errors
```typescript
throw new HttpsError('permission-denied', 'You do not have permission...');
```

### Internal Errors
```typescript
throw new HttpsError('internal', 'Failed to ingest vital reading');
```

## Migration from Direct Firestore Writes

### Current Pattern (Client-side)
```typescript
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Current: Direct Firestore write
await addDoc(collection(db, 'vitals'), {
  userId: user.id,
  type: 'heartRate',
  value: 75,
  unit: 'bpm',
  timestamp: new Date()
});
```

### New Pattern (API)
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const ingestVital = httpsCallable(functions, 'ingestVitalReading');

// New: API with validation, normalization, and alerting
const result = await ingestVital({
  userId: user.id,
  type: 'heartRate',
  value: 75,
  unit: 'bpm'
});

// Check for alerts
if (result.data.alert) {
  // Handle alert in UI
  showAlert(result.data.alert);
}
```

### Benefits of Migration
1. **Validation** - Data is validated before persisting
2. **Normalization** - Units are automatically converted
3. **Security** - RBAC checks enforced server-side
4. **Audit** - All writes are logged
5. **Alerts** - Immediate feedback on threshold violations
6. **Type Safety** - TypeScript types for request/response

## oRPC Integration (Optional)

The function is also available via oRPC router for type-safe RPC:

```typescript
// functions/orpc/router.ts
export const appRouter = {
  vitals: {
    ingest: ingestVital,
  },
};

// Client usage (with oRPC client)
const result = await client.vitals.ingest({
  userId: 'patient123',
  type: 'heartRate',
  value: 75,
  unit: 'bpm'
});
```

## Testing

### Unit Tests

Pure validation and normalization functions can be tested independently:

```typescript
import { validateVitalInput, createVitalReading } from './modules/vitals/ingest';

// Test validation
const result = validateVitalInput({
  userId: 'user123',
  type: 'heartRate',
  value: 75,
  unit: 'bpm'
});
assert(result.isValid === true);

// Test normalization
const vital = createVitalReading({
  userId: 'user123',
  type: 'bodyTemperature',
  value: 98.6, // Fahrenheit
  unit: '°F'
});
assert(vital.value === 37); // Converted to Celsius
assert(vital.unit === '°C');
```

### Integration Tests

Use Firebase emulators to test the complete flow:

```typescript
import * as testing from 'firebase-functions-test';
const test = testing();

const wrapped = test.wrap(ingestVitalReading);
const result = await wrapped({
  userId: 'test123',
  type: 'heartRate',
  value: 75,
  unit: 'bpm'
}, {
  auth: { uid: 'test123' }
});

assert(result.success === true);
```

## Deployment

```bash
# Build
npm run build

# Deploy single function
firebase deploy --only functions:ingestVitalReading

# Deploy all functions
firebase deploy --only functions
```

## Performance

- **Validation:** Pure functions, < 1ms
- **Authorization:** Single Firestore read (cached)
- **Persistence:** Single Firestore write
- **Audit:** Single Firestore write (non-blocking if fails)
- **Total:** ~100-200ms typical response time

## Roadmap

- [ ] Add batch ingestion endpoint
- [ ] Add WebSocket support for real-time updates
- [ ] Add data quality scoring
- [ ] Add trend calculation
- [ ] Add integration with wearable devices
- [ ] Add GraphQL endpoint option
