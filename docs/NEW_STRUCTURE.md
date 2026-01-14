# New Backend Structure (WIP)

## ✅ Implementation Complete

### Folder Structure

```
functions/src/
├── index.ts                     # ✅ Updated with logger integration
│
├── observability/              # ✅ Logging & tracing
│   ├── logger.ts              # Structured JSON logger
│   └── correlation.ts         # Trace ID management
│
├── db/                         # ✅ Database layer
│   ├── firestore.ts           # Type definitions
│   ├── collections.ts         # Typed collection refs
│   └── converters.ts          # Firestore converters
│
├── security/                   # ✅ Auth & permissions
│   ├── rbac.ts                # Role-based access control
│   └── authContext.ts         # Auth context extraction
│
├── modules/                    # 📁 Domain logic (placeholder)
│   └── README.md
│
├── services/                   # 📁 Service adapters (placeholder)
│   └── README.md
│
└── api/                        # 📁 API handlers (placeholder)
    └── README.md
```

## Implemented Components

### 1. Observability Layer

#### `observability/logger.ts` (128 lines)
Structured JSON logger with format: `{level, msg, traceId, uid?, patientId?, alertId?, fn}`

**Features:**
- Never logs PHI (no names, emails, notes, raw vitals)
- Only logs IDs: uid, patientId, caregiverId, familyId, alertId, vitalId, medicationId
- Log levels: debug, info, warn, error
- Child logger support

**Example:**
```typescript
import { logger } from './observability/logger';

logger.info('Processing vital reading', {
  uid: 'user123',
  patientId: 'patient456',
  vitalId: 'vital789',
  fn: 'processVitalReading'
});
```

#### `observability/correlation.ts` (51 lines)
Request correlation tracking with trace IDs

**Features:**
- Generate unique trace IDs
- Async local storage for context
- Run functions with trace context

**Example:**
```typescript
import { createTraceId, runWithTraceAsync } from './observability/correlation';

const traceId = createTraceId();
await runWithTraceAsync(async () => {
  // All logs in this context will have the same traceId
  logger.info('Processing request', { traceId });
});
```

### 2. Database Layer

#### `db/firestore.ts` (249 lines)
Type definitions for all collections

**Collections:**
- User - Accounts, roles, FCM tokens
- Patient - Patient profiles, medical history
- CareLink - Caregiver-patient relationships
- Vital - Health measurements (HR, BP, SpO2, etc.)
- Alert - Health alerts (fall, vital, symptom, medication, trend)
- Medication - Medication tracking and reminders
- AuditLog - Audit trail for compliance

**Example:**
```typescript
import type { User, Patient, Vital, Alert } from './db/firestore';
```

#### `db/collections.ts` (69 lines)
Typed collection references

**Functions:**
- `getUsersCollection()` - Type-safe Users collection
- `getPatientsCollection()` - Type-safe Patients collection
- `getCareLinksCollection()` - Type-safe CareLinks collection
- `getAlertsCollection()` - Type-safe Alerts collection
- `getVitalsCollection()` - Type-safe Vitals collection
- `getMedicationsCollection()` - Type-safe Medications collection
- `getAuditLogsCollection()` - Type-safe Audit logs collection

**Example:**
```typescript
import { getUsersCollection, getVitalsCollection } from './db/collections';

const user = await getUsersCollection().doc('user123').get();
const vitals = await getVitalsCollection()
  .where('userId', '==', 'user123')
  .limit(10)
  .get();
```

#### `db/converters.ts` (109 lines)
Firestore data converters for automatic type casting

### 3. Security Layer

#### `security/authContext.ts` (57 lines)
Authentication context extraction

**Functions:**
- `extractAuthContext()` - Extract from Functions context
- `enrichAuthContext()` - Add user data from Firestore
- `getAuthContext()` - Get full auth context

**Example:**
```typescript
import { getAuthContext } from './security/authContext';

const authContext = await getAuthContext(context);
if (!authContext) {
  throw new Error('Not authenticated');
}
```

#### `security/rbac.ts` (220 lines)
Role-based access control

**Roles:**
- `owner` - Patient who owns their data
- `caregiver` - Family member who can view/manage patient data
- `admin` - Family administrator with full permissions

**Key Functions:**
- `canReadPatient()` - Check read permissions
- `canWritePatient()` - Check write permissions
- `canAcknowledgeAlert()` - Check alert permissions
- `assertCanReadPatient()` - Assert or throw
- `assertCanWritePatient()` - Assert or throw
- `assertCanAcknowledgeAlert()` - Assert or throw

**Example:**
```typescript
import { assertCanReadPatient, assertCanWritePatient } from './security/rbac';

// Check permission and throw if denied
await assertCanReadPatient({
  actor: authContext,
  patientId: 'patient123'
});

// Or check manually
const canWrite = await canWritePatient({
  actor: authContext,
  patientId: 'patient123'
});
```

### 4. Updated index.ts

✅ **Integrated logger in 3+ places:**

1. **sendPushNotification** - Start, warn on unauth, success, error
2. **sendFallAlert** - Fall alert triggered
3. All use structured format with traceId, uid, patientId, alertId, fn

**Example from code:**
```typescript
const traceId = createTraceId();

logger.info("sendPushNotification called", {
  traceId,
  uid: context.auth?.uid,
  fn: "sendPushNotification",
});

logger.info("Fall alert triggered", {
  traceId,
  uid: context.auth?.uid,
  patientId: userId,
  alertId,
  fn: "sendFallAlert",
});
```

## Build Status

✅ **TypeScript compilation: SUCCESSFUL**

```bash
npm run build
# ✅ Compiles without errors
```

## Key Features

1. **PHI Protection** ✅
   - Logger only accepts IDs
   - No names, emails, notes, raw data
   - Safe for HIPAA compliance

2. **Type Safety** ✅
   - All collections have TypeScript types
   - Firestore converters provide automatic typing
   - No `any` types in new code

3. **Traceability** ✅
   - Every log has a traceId
   - Can track requests through system
   - Async local storage support

4. **RBAC Ready** ✅
   - Three roles: owner, caregiver, admin
   - Permission checks before operations
   - Family-scoped access control

5. **Zero Breaking Changes** ✅
   - All existing functions work unchanged
   - New structure is additive
   - Gradual migration possible

## Usage Examples

### Complete Flow Example

```typescript
import { createTraceId } from './observability/correlation';
import { logger } from './observability/logger';
import { getAuthContext } from './security/authContext';
import { assertCanReadPatient } from './security/rbac';
import { getUsersCollection, getVitalsCollection } from './db/collections';

export const getPatientVitals = functions.https.onCall(async (data, context) => {
  const traceId = createTraceId();
  const { patientId } = data;
  
  // 1. Extract auth context
  const authContext = await getAuthContext(context);
  if (!authContext) {
    logger.warn('Unauthenticated request', { traceId, fn: 'getPatientVitals' });
    throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
  }
  
  // 2. Check permissions
  await assertCanReadPatient({
    actor: authContext,
    patientId
  });
  
  // 3. Log operation
  logger.info('Fetching patient vitals', {
    traceId,
    uid: authContext.uid,
    patientId,
    fn: 'getPatientVitals'
  });
  
  // 4. Query with type safety
  const vitals = await getVitalsCollection()
    .where('userId', '==', patientId)
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();
  
  return vitals.docs.map(doc => doc.data());
});
```

## Next Steps

### Immediate
- ✅ Structure created
- ✅ Foundation implemented
- ✅ Logger integrated
- ✅ All compiling

### Phase 2 (modules/)
- Extract vital checking logic
- Extract alert generation logic
- Extract medication reminders

### Phase 3 (services/)
- FCM notification service
- Background job scheduler
- Zeina AI adapter

### Phase 4 (api/)
- HTTP handler wrappers
- oRPC procedures
- Request validation

## Design Principles

1. **PHI Protection First**
   - Only log IDs, never personal data
   - Sanitize all log contexts
   - Safe by default

2. **Type Safety**
   - Leverage TypeScript fully
   - Firestore converters for runtime safety
   - No escape hatches

3. **Separation of Concerns**
   - db/ - Data access only
   - security/ - Authorization only
   - observability/ - Logging only
   - modules/ - Business logic
   - services/ - External integrations
   - api/ - Request handling

4. **Testability**
   - Pure functions preferred
   - Clear interfaces
   - Dependency injection ready

## Benefits

✅ **Compliance** - PHI-safe logging for HIPAA
✅ **Debugging** - Trace IDs for distributed tracing
✅ **Security** - RBAC with family scoping
✅ **Type Safety** - Catch errors at compile time
✅ **Maintainability** - Organized by concern
✅ **No Breaking Changes** - Gradual migration
