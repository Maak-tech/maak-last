# Firestore Index Fix - Emergency Alerts

## Issue

When loading family alerts, the app was failing with the error:

```
FirebaseError: The query requires an index. You can create it here: 
https://console.firebase.google.com/...
```

## Root Cause

The `getFamilyAlerts()` function in `lib/services/alertService.ts` uses a compound query:

```typescript
const q = query(
  collection(db, "alerts"),
  where("userId", "in", userIds),        // Filter by family member IDs
  where("resolved", "==", false),         // Only unresolved alerts
  orderBy("timestamp", "desc"),           // Most recent first
  limit(limitCount)
);
```

This requires a Firestore composite index on the `alerts` collection with:
- `resolved` (ASCENDING)
- `userId` (ASCENDING)
- `timestamp` (DESCENDING)

## Solution

### 1. Added Missing Index

Updated `firestore.indexes.json` to include the required index:

```json
{
  "collectionGroup": "alerts",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "resolved",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "userId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "timestamp",
      "order": "DESCENDING"
    }
  ]
}
```

### 2. Deployed Index

```bash
firebase deploy --only firestore:indexes
```

**Status:** ✅ Deployed successfully

### 3. Improved Error Handling

Updated `app/components/AlertsCard.tsx` to handle index building gracefully:

```typescript
// Check if it's an index error
const isIndexError = error && typeof error === 'object' && 
  'code' in error && error.code === 'failed-precondition';

if (isIndexError) {
  logger.warn("Firestore index not ready for alerts query", {
    userId: user.id,
    familyId: user.familyId,
    durationMs,
  }, "AlertsCard");
} else {
  logger.error("Failed to load family alerts", error, "AlertsCard");
}
```

## Index Building Time

⏱️ **Firestore indexes typically take 2-10 minutes to build**, depending on the amount of existing data.

### How to Check Index Status

1. Go to [Firebase Console](https://console.firebase.google.com/project/maak-5caad/firestore/indexes)
2. Look for the `alerts` collection index
3. Status should show:
   - 🟡 **Building** - Wait a few minutes
   - 🟢 **Enabled** - Ready to use
   - 🔴 **Error** - Check configuration

## Testing

Once the index is built (status shows "Enabled"), test by:

1. Open the app as an admin user
2. Navigate to the Family tab
3. Check that emergency alerts load without errors
4. Verify logs show successful load: `"Family emergency alerts loaded"`

## Prevention

To prevent similar issues in the future:

### 1. Always Check Index Requirements

When writing Firestore queries with:
- Multiple `where()` clauses
- `where()` + `orderBy()` on different fields
- `in` queries + other filters

→ An index is likely required

### 2. Test Locally First

Use the Firestore emulator to catch index issues before deployment:

```bash
firebase emulators:start
```

### 3. Monitor Index Errors

Check logs for `failed-precondition` errors:

```bash
grep "failed-precondition" logs
```

## Related Indexes

The `firestore.indexes.json` file includes indexes for:

| Collection | Fields | Purpose |
|------------|--------|---------|
| `alerts` | userId, timestamp | User-specific alerts |
| `alerts` | **resolved, userId, timestamp** | **Family unresolved alerts** |
| `healthEvents` | userId, createdAt | Health event queries |
| `symptoms` | userId, timestamp | Symptom history |
| `medications` | userId, startDate | Medication tracking |
| `vitals` | userId, timestamp | Vital signs queries |

## Observability

The fix includes proper logging:

**Before Index Ready:**
```json
{
  "level": "warn",
  "msg": "Firestore index not ready for alerts query",
  "userId": "user123",
  "familyId": "fam456",
  "durationMs": 156
}
```

**After Index Ready:**
```json
{
  "level": "info",
  "msg": "Family emergency alerts loaded",
  "userId": "user123",
  "familyId": "fam456",
  "memberCount": 5,
  "alertCount": 3,
  "durationMs": 245
}
```

## Documentation Updated

- ✅ `firestore.indexes.json` - Added required index
- ✅ `app/components/AlertsCard.tsx` - Improved error handling
- ✅ `docs/FIRESTORE_INDEX_FIX.md` - This document

## Status

- [x] Index configuration added
- [x] Index deployed to Firebase
- [x] Error handling improved
- [x] Documentation created
- [ ] Index building (wait 2-10 minutes)
- [ ] Verify alerts load successfully

**Expected Resolution Time:** 5-10 minutes from deployment

---

**Issue:** Firestore index missing for family alerts query  
**Fixed:** 2026-01-13  
**Status:** ✅ Deployed, building in progress
