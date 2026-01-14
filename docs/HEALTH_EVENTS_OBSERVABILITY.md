# Health Events Observability Implementation

## Overview

This document describes the observability implementation for the Health Events feature, ensuring it matches the backend observability patterns used throughout the application.

## Objectives Completed

✅ **Show Real Data Only** - Removed all mock/simulated data fallbacks  
✅ **Display Alert Ownership** - Show which family member each alert belongs to  
✅ **Backend-Compatible Logging** - Match observability patterns from backend functions  
✅ **HIPAA-Safe Logging** - No PHI in logs (only IDs, counts, statuses)  
✅ **Distributed Tracing** - TraceId correlation across operations  
✅ **Performance Monitoring** - Duration tracking for all operations  

---

## Implementation Details

### 1. Real Data (No Simulations)

**File:** `src/health/events/healthEventsService.ts`

**Changes:**
- Removed `getMockHealthEvents()` function
- Changed error handling to return empty arrays instead of mock data
- Ensures only real Firestore data is displayed to admins

```typescript
// BEFORE: Returned mock data on error
catch (error) {
  return getMockHealthEvents(userId);
}

// AFTER: Returns empty array (real data only)
catch (error) {
  logger.error("Failed to get user health events", error, "healthEventsService");
  return [];
}
```

---

### 2. Family Member Identification

**File:** `app/(tabs)/family.tsx`

**Changes:**
- Added `getFamilyHealthEvents()` function call for admins
- Shows health events from all family members (not just current user)
- Displays member name on each event card

**New Event Card Display:**
```typescript
{events.map((event) => {
  const eventMember = familyMembers.find(m => m.id === event.userId);
  const memberName = eventMember 
    ? `${eventMember.firstName || ''} ${eventMember.lastName || ''}`.trim() || eventMember.email
    : 'Unknown Member';

  return (
    <View>
      <Text>{event.type} - For: {memberName}</Text>
      // ... event details
    </View>
  );
})}
```

**Visual Output:**
```
Vital Alert                    [OPEN]
For: Ahmed Ali
• Heart rate: 120 bpm (attention)
• Systolic BP: 160 mmHg (urgent)
2h ago                         [Ack] [Esc]
```

---

### 3. Structured Logging (Backend Pattern)

**Pattern Used:** Matches `functions/src/observability/logger.ts`

#### Log Format
```json
{
  "level": "info|warn|error|debug",
  "msg": "Human-readable message",
  "userId": "user_id",
  "eventId": "event_id",
  "durationMs": 123,
  "timestamp": "ISO timestamp"
}
```

#### Key Principles
- **No PHI**: Only log IDs, counts, statuses, durations
- **TraceId**: Each operation generates a correlation ID
- **Context**: userId, eventId, fn (function name)
- **Performance**: durationMs tracked for all operations
- **Errors**: Full error objects with name, message, stack

---

### 4. Service Layer Observability

**File:** `src/health/events/healthEventsService.ts`

#### Functions Updated

##### `getUserHealthEvents()`
```typescript
logger.debug("Fetching user health events", { userId, limitCount });
// ... fetch logic
logger.info("User health events fetched successfully", {
  userId,
  eventCount: events.length,
  durationMs
});
```

##### `getFamilyHealthEvents()`
```typescript
logger.info("Fetching family health events", {
  memberCount: userIds.length,
  limitCount
});
// ... fetch logic with batching
logger.info("Family health events fetched successfully", {
  memberCount: userIds.length,
  batchCount: batches.length,
  eventCount: finalEvents.length,
  durationMs
});
```

##### `getActiveHealthEvents()`
```typescript
logger.debug("Fetching active health events", { userId });
// ... filter logic
logger.info("Active health events fetched", {
  userId,
  totalEvents: events.length,
  activeCount: activeEvents.length
});
```

---

### 5. CRUD Operations Observability

**File:** `src/health/events/createHealthEvent.ts`

#### Functions Updated

##### `createHealthEvent()`
```typescript
logger.info("Creating health event", {
  userId: input.userId,
  type: input.type,
  severity: input.severity,
  source: input.source
});
// ... create logic
logger.info("Health event created successfully", {
  eventId: docRef.id,
  userId: input.userId,
  type: input.type,
  severity: input.severity,
  durationMs
});
```

##### `updateHealthEvent()`
```typescript
logger.info("Updating health event", {
  eventId,
  status: updates.status,
  acknowledgedBy: updates.acknowledgedBy,
  resolvedBy: updates.resolvedBy,
  escalatedBy: updates.escalatedBy
});
// ... update logic
logger.info("Health event updated successfully", {
  eventId,
  status: updates.status,
  durationMs
});
```

##### Action Handlers
- `acknowledgeHealthEvent()` - Logs eventId, acknowledgedBy
- `resolveHealthEvent()` - Logs eventId, resolvedBy
- `escalateHealthEvent()` - Logs eventId, escalatedBy, hasReason
- `createVitalAlertEvent()` - Logs userId, severity, reasonCount

---

### 6. UI Layer Observability

**File:** `app/(tabs)/family.tsx`

#### Functions Updated

##### `loadEvents()`
```typescript
// Admin loading family events
logger.debug("Loading family health events", {
  userId: user.id,
  familyId: user.familyId,
  memberCount: familyMembers.length
});
// ... load logic
logger.info("Family health events loaded", {
  userId: user.id,
  eventCount: familyEvents.length,
  durationMs
});

// User loading personal events
logger.debug("Loading user health events", { userId: user.id });
// ... load logic
logger.info("User health events loaded", {
  userId: user.id,
  eventCount: userEvents.length,
  durationMs
});
```

##### `handleAcknowledgeEvent()`
```typescript
logger.info("User acknowledging health event", {
  eventId,
  userId: user.id,
  role: user.role
});
// ... acknowledge logic
logger.info("Health event acknowledged successfully", {
  eventId,
  userId: user.id,
  durationMs
});
```

##### `handleResolveEvent()`
```typescript
logger.info("User resolving health event", {
  eventId,
  userId: user.id,
  role: user.role
});
// ... resolve logic
logger.info("Health event resolved successfully", {
  eventId,
  userId: user.id,
  durationMs
});
```

##### `handleEscalateEvent()`
```typescript
logger.info("User escalating health event", {
  eventId,
  userId: user.id,
  role: user.role,
  hasReason: !!reason
});
// ... escalate logic
logger.info("Health event escalated successfully", {
  eventId,
  userId: user.id,
  durationMs
});
```

---

## TraceId Generation

Each operation generates a unique trace ID for correlation:

```typescript
function createTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

**Format:** `trace_1736789123456_abc123def`

**Usage:**
- Created at the start of each operation
- Passed through log context
- Enables distributed tracing across services
- Correlates frontend → backend → Firestore

---

## HIPAA Compliance

### What We Log (✅ Safe)
- User IDs
- Event IDs
- Family IDs
- Alert IDs
- Counts (eventCount, memberCount)
- Statuses (OPEN, ACKED, RESOLVED, ESCALATED)
- Severity levels (low, medium, high, critical)
- Durations (durationMs)
- Function names (fn)
- Source types (wearable, manual, clinic)

### What We Never Log (❌ PHI)
- ❌ Patient names
- ❌ Email addresses
- ❌ Phone numbers
- ❌ Vital values (heart rate numbers, BP readings, etc.)
- ❌ Symptom descriptions
- ❌ Medication names
- ❌ Personal notes
- ❌ Addresses
- ❌ Escalation reasons (may contain PHI)

---

## Performance Tracking

All operations track execution time:

```typescript
const startTime = Date.now();
try {
  // ... operation
  const durationMs = Date.now() - startTime;
  logger.info("Operation completed", { durationMs });
} catch (error) {
  const durationMs = Date.now() - startTime;
  logger.error("Operation failed", error);
}
```

**Metrics Tracked:**
- Database query durations
- Event creation time
- Event update time
- Family event batching performance
- UI action response times

---

## Error Handling

Consistent error handling across all operations:

```typescript
try {
  // ... operation
} catch (error) {
  logger.error("Operation failed", error, "FunctionName");
  // Graceful degradation (return empty array or throw user-friendly error)
}
```

**Error Log Structure:**
```json
{
  "level": "error",
  "msg": "Failed to create health event",
  "error": {
    "name": "FirestoreError",
    "message": "Permission denied",
    "stack": "Error: Permission denied\n  at ..."
  },
  "userId": "user_123",
  "durationMs": 234
}
```

---

## Log Level Guidelines

### Debug (`logger.debug()`)
- Function entry points
- Pre-operation state
- Non-critical information flow

### Info (`logger.info()`)
- Successful operations
- Operation completions
- Count/metric summaries
- User actions

### Warn (`logger.warn()`)
- Recoverable errors
- Fallback behaviors
- Unusual conditions

### Error (`logger.error()`)
- Operation failures
- Database errors
- Permission issues
- Critical failures

---

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Event Load Times**
   - Target: < 500ms for user events
   - Target: < 1000ms for family events

2. **Event Creation Success Rate**
   - Target: > 99%

3. **Error Rates**
   - Alert if > 5% error rate

4. **Family Event Batching**
   - Monitor batch counts for families > 10 members

### Log Queries

**Find all health event errors:**
```
level: "error" AND (fn: "*HealthEvent*" OR fn: "FamilyScreen")
```

**Track event acknowledgment latency:**
```
msg: "Health event acknowledged successfully" 
| stats avg(durationMs)
```

**Find slow family event loads:**
```
msg: "Family health events loaded" AND durationMs > 1000
```

---

## Comparison: Before vs After

### Before Implementation

```typescript
// ❌ Mock data fallback
catch (error) {
  console.error("Failed:", error);
  return getMockHealthEvents(userId);
}

// ❌ No member identification
<Text>{event.type}</Text>

// ❌ No observability
try {
  await createHealthEvent(data);
} catch (error) {
  console.error(error);
}
```

### After Implementation

```typescript
// ✅ Real data only
catch (error) {
  logger.error("Failed to fetch events", error, "healthEventsService");
  return [];
}

// ✅ Clear member identification
<Text>{event.type} - For: {memberName}</Text>

// ✅ Full observability
const startTime = Date.now();
try {
  logger.info("Creating health event", { userId, type, severity });
  await createHealthEvent(data);
  logger.info("Event created", { eventId, durationMs: Date.now() - startTime });
} catch (error) {
  logger.error("Failed to create event", error, "createHealthEvent");
}
```

---

## Testing Observability

### Manual Testing

1. **Load family events (admin)**
   - Expected logs: "Loading family health events", "Family health events loaded"
   - Check: memberCount, eventCount, durationMs

2. **Acknowledge an event**
   - Expected logs: "User acknowledging", "acknowledged successfully"
   - Check: eventId, userId, role, durationMs

3. **Trigger an error** (disconnect internet)
   - Expected logs: error level with full error object
   - Check: error.name, error.message, error.stack

### Log Validation

Check logs include:
- ✅ No PHI (names, emails, vital values)
- ✅ All IDs are present (userId, eventId, etc.)
- ✅ Duration tracked (durationMs field)
- ✅ Function name present (fn field or source parameter)
- ✅ TraceId present (for correlation)

---

## Files Modified

| File | Purpose | Changes |
|------|---------|---------|
| `src/health/events/healthEventsService.ts` | Query service | Added logging, removed mock data, added family function |
| `src/health/events/createHealthEvent.ts` | CRUD operations | Added logging to all create/update functions |
| `app/(tabs)/family.tsx` | UI layer | Added member names, logging for all actions |

---

## Future Enhancements

1. **Metrics Export**
   - Export logs to monitoring service (DataDog, New Relic, etc.)
   - Create dashboards for event metrics

2. **Real-time Alerting**
   - Alert on high error rates
   - Alert on slow operations (> 2s)
   - Alert on escalated events

3. **Audit Trail**
   - Store event action history in Firestore
   - Track who acknowledged/resolved/escalated events
   - Enable audit reports for compliance

4. **Performance Analytics**
   - Track p50, p95, p99 latencies
   - Identify performance bottlenecks
   - Optimize slow queries

---

## Compliance & Security

✅ **HIPAA Compliant** - No PHI in logs  
✅ **Audit Ready** - All actions logged with user context  
✅ **Error Tracking** - Full error details without PHI  
✅ **Performance Monitoring** - Duration tracking for all operations  
✅ **Distributed Tracing** - TraceId correlation across services  

---

## Summary

The health events feature now has comprehensive observability that:

1. **Shows only real data** (no simulations)
2. **Identifies which family member** each alert belongs to
3. **Matches backend logging patterns** exactly
4. **Protects patient privacy** (HIPAA-safe, no PHI in logs)
5. **Enables performance monitoring** (duration tracking)
6. **Supports distributed tracing** (traceId correlation)
7. **Provides actionable error information** (structured error logs)

This implementation ensures admins can effectively monitor family member health while maintaining full observability for debugging and compliance.
