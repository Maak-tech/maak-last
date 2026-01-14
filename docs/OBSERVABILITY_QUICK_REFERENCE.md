# Observability Quick Reference Guide

## 🎯 Quick Start

This guide provides a quick reference for the observability patterns implemented across the health monitoring system.

---

## 📊 Log Format

### Standard Structure
```typescript
logger.info("Operation completed", {
  userId: "user_id",
  eventId: "event_id",
  durationMs: 123,
}, "ComponentName");
```

### Output
```json
{
  "level": "info",
  "msg": "Operation completed",
  "userId": "user_id",
  "eventId": "event_id",
  "durationMs": 123,
  "timestamp": "2026-01-13T10:30:00.000Z"
}
```

---

## 🔍 Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `debug` | Function entry, pre-operation state | `logger.debug("Fetching events", { userId })` |
| `info` | Successful operations, completions | `logger.info("Events loaded", { eventCount })` |
| `warn` | Recoverable errors, fallbacks | `logger.warn("Using fallback", { reason })` |
| `error` | Operation failures, exceptions | `logger.error("Failed to load", error)` |

---

## ⏱️ Performance Tracking Pattern

```typescript
const startTime = Date.now();
try {
  // ... operation
  const durationMs = Date.now() - startTime;
  logger.info("Success", { durationMs });
} catch (error) {
  const durationMs = Date.now() - startTime;
  logger.error("Failed", error);
}
```

---

## 🔑 TraceId Generation

```typescript
function createTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

---

## ✅ What to Log (HIPAA-Safe)

| Data Type | Example | Safe? |
|-----------|---------|-------|
| User IDs | `userId: "user123"` | ✅ Yes |
| Event IDs | `eventId: "evt_789"` | ✅ Yes |
| Alert IDs | `alertId: "alert_456"` | ✅ Yes |
| Counts | `eventCount: 12` | ✅ Yes |
| Statuses | `status: "OPEN"` | ✅ Yes |
| Severity | `severity: "high"` | ✅ Yes |
| Durations | `durationMs: 245` | ✅ Yes |
| Roles | `role: "admin"` | ✅ Yes |

---

## ❌ What NOT to Log (PHI)

| Data Type | Why Prohibited |
|-----------|----------------|
| Names | Directly identifiable |
| Emails | Directly identifiable |
| Phone numbers | Directly identifiable |
| Vital values | Health information |
| Symptom descriptions | Health information |
| Medication names | Health information |
| Personal notes | May contain PHI |

---

## 📝 Common Patterns

### Loading Data
```typescript
const startTime = Date.now();
try {
  logger.debug("Loading data", { userId });
  const data = await fetchData(userId);
  const durationMs = Date.now() - startTime;
  logger.info("Data loaded", { userId, count: data.length, durationMs });
} catch (error) {
  const durationMs = Date.now() - startTime;
  logger.error("Failed to load data", error);
}
```

### User Actions
```typescript
const startTime = Date.now();
try {
  logger.info("User action initiated", { userId, actionType, targetId });
  await performAction();
  const durationMs = Date.now() - startTime;
  logger.info("Action completed", { userId, actionType, durationMs });
} catch (error) {
  const durationMs = Date.now() - startTime;
  logger.error("Action failed", error);
}
```

### Batch Operations
```typescript
logger.info("Starting batch operation", { itemCount: items.length });
for (const item of items) {
  try {
    await processItem(item);
    logger.debug("Item processed", { itemId: item.id });
  } catch (error) {
    logger.warn("Item failed", error, { itemId: item.id });
  }
}
logger.info("Batch complete", { successCount, failCount });
```

---

## 🔍 Monitoring Queries

### Find Errors
```
level: "error"
```

### Find Slow Operations
```
durationMs > 1000
```

### Track User Actions
```
msg: "*action*" AND userId: "user123"
```

### Monitor Event Creation
```
msg: "Health event created" 
| stats count by hour
```

---

## 🚨 Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | > 5% | Alert ops team |
| Operation duration | > 2s | Investigate |
| Failed loads | > 10/hour | Check backend |
| No data | > 1 hour | Check connectivity |

---

## 📚 Files Reference

| File | Purpose |
|------|---------|
| `lib/utils/logger.ts` | Frontend logger utility |
| `functions/src/observability/logger.ts` | Backend logger |
| `functions/src/observability/correlation.ts` | TraceId management |

---

## 🧪 Testing Checklist

- [ ] Logs include userId/eventId
- [ ] Duration tracked (durationMs)
- [ ] No PHI in logs
- [ ] Errors have full context
- [ ] TraceId present
- [ ] Function name included

---

## 📞 Quick Help

### I need to log...

**A successful operation:**
```typescript
logger.info("Operation completed", { userId, resultCount, durationMs });
```

**An error:**
```typescript
logger.error("Operation failed", error, "ComponentName");
```

**Debug information:**
```typescript
logger.debug("Processing item", { itemId, status });
```

**A warning:**
```typescript
logger.warn("Using fallback", { reason: "Primary failed" });
```

---

## 🔗 Related Documentation

- **Detailed Guide:** `HEALTH_EVENTS_OBSERVABILITY.md`
- **Complete Summary:** `OBSERVABILITY_IMPLEMENTATION_SUMMARY.md`
- **Backend Patterns:** `functions/src/observability/`

---

**Quick Reference Version:** 1.0  
**Last Updated:** 2026-01-13
