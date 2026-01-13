# Helper Functions Extraction

## Overview

Extracted three helper functions from `functions/src/index.ts` into dedicated modules for better organization, reusability, and observability.

## Extracted Functions

### 1. getUserTokens → `services/notifications/userTokens.ts`

**Purpose:** Retrieve FCM tokens for push notifications

**Signature:**
```typescript
async function getUserTokens(
  userId: string,
  traceId?: string
): Promise<string[]>
```

**Changes:**
- ✅ Added `traceId` parameter for correlation
- ✅ Added structured logging (start, end, error)
- ✅ Logs only IDs and counts (PHI-safe)
- ✅ Same Firestore logic (reads `users/{userId}`)
- ✅ Supports both legacy (single token) and new (array) formats
- ✅ Returns empty array on error (graceful degradation)

**Logging:**
```json
{
  "level": "debug",
  "msg": "Getting FCM tokens for user",
  "traceId": "trace_abc",
  "uid": "user123",
  "fn": "getUserTokens"
}
```

```json
{
  "level": "debug",
  "msg": "FCM tokens retrieved",
  "traceId": "trace_abc",
  "uid": "user123",
  "tokenCount": 2,
  "fn": "getUserTokens"
}
```

### 2. getFamilyMemberIds → `modules/family/familyMembers.ts`

**Purpose:** Get family member IDs for a user

**Signature:**
```typescript
async function getFamilyMemberIds(
  userId: string,
  excludeUserId: boolean = true,
  traceId?: string
): Promise<string[]>
```

**Changes:**
- ✅ Added `traceId` parameter for correlation
- ✅ Added structured logging (start, end, error)
- ✅ Logs only IDs, booleans, and counts (PHI-safe)
- ✅ Same Firestore logic (reads `users/{userId}`, queries by `familyId`)
- ✅ Returns empty array on error (graceful degradation)

**Logging:**
```json
{
  "level": "debug",
  "msg": "Getting family member IDs",
  "traceId": "trace_abc",
  "uid": "user123",
  "excludeUserId": true,
  "fn": "getFamilyMemberIds"
}
```

```json
{
  "level": "debug",
  "msg": "Family members retrieved",
  "traceId": "trace_abc",
  "uid": "user123",
  "familyId": "family456",
  "memberCount": 3,
  "fn": "getFamilyMemberIds"
}
```

### 3. shouldSendNotification → `services/notifications/preferences.ts`

**Purpose:** Check if notification should be sent based on user preferences

**Signature:**
```typescript
async function shouldSendNotification(
  userId: string,
  notificationType: NotificationType,
  traceId?: string
): Promise<boolean>
```

**Changes:**
- ✅ Added `traceId` parameter for correlation
- ✅ Added `NotificationType` type for type safety
- ✅ Added structured logging (start, end, error)
- ✅ Logs only IDs, type, and boolean result (PHI-safe)
- ✅ Same Firestore logic (reads `users/{userId}/preferences/notifications`)
- ✅ Returns `true` on error (fail-open for notifications)

**Logging:**
```json
{
  "level": "debug",
  "msg": "Checking notification preferences",
  "traceId": "trace_abc",
  "uid": "user123",
  "notificationType": "vital",
  "fn": "shouldSendNotification"
}
```

```json
{
  "level": "debug",
  "msg": "Notification preference checked",
  "traceId": "trace_abc",
  "uid": "user123",
  "notificationType": "vital",
  "shouldSend": true,
  "fn": "shouldSendNotification"
}
```

## File Structure

```
functions/src/
├── services/
│   └── notifications/
│       ├── index.ts              # Main notification service
│       ├── userTokens.ts         # ✅ NEW: FCM token retrieval
│       └── preferences.ts        # ✅ NEW: Preference checking
├── modules/
│   └── family/
│       └── familyMembers.ts      # ✅ NEW: Family member queries
└── index.ts                      # ✅ UPDATED: Imports from modules
```

## Changes to index.ts

**Before:**
```typescript
// 100+ lines of helper functions inline

async function getUserTokens(userId: string): Promise<string[]> {
  // Implementation...
}

async function getFamilyMemberIds(
  userId: string,
  excludeUserId = true
): Promise<string[]> {
  // Implementation...
}

async function shouldSendNotification(
  userId: string,
  notificationType: string
): Promise<boolean> {
  // Implementation...
}
```

**After:**
```typescript
import { getUserTokens } from "./services/notifications/userTokens";
import { getFamilyMemberIds } from "./modules/family/familyMembers";
import { shouldSendNotification } from "./services/notifications/preferences";
```

**Result:** ~100 lines removed from `index.ts`

## Backward Compatibility

### Function Signatures

All functions maintain the same core signatures:

| Function | Old Signature | New Signature | Compatible? |
|----------|--------------|---------------|-------------|
| getUserTokens | `(userId: string)` | `(userId: string, traceId?: string)` | ✅ Yes (optional param) |
| getFamilyMemberIds | `(userId: string, excludeUserId = true)` | `(userId: string, excludeUserId = true, traceId?: string)` | ✅ Yes (optional param) |
| shouldSendNotification | `(userId: string, notificationType: string)` | `(userId: string, notificationType: NotificationType, traceId?: string)` | ✅ Yes (compatible types) |

### Firestore Operations

All Firestore reads remain identical:

| Function | Collection | Query | Fields |
|----------|-----------|-------|--------|
| getUserTokens | `users/{userId}` | - | `fcmToken` |
| getFamilyMemberIds | `users/{userId}` | `where('familyId', '==', familyId)` | `familyId` |
| shouldSendNotification | `users/{userId}` | - | `preferences.notifications.*` |

### Return Values

All return values remain identical:

- `getUserTokens`: `string[]` (empty array on error)
- `getFamilyMemberIds`: `string[]` (empty array on error)
- `shouldSendNotification`: `boolean` (true on error)

## Type Safety

### Strict Types

All functions use strict TypeScript types:

```typescript
// ✅ No implicit any
// ✅ Explicit return types
// ✅ Typed parameters
// ✅ Typed Firestore data

async function getUserTokens(
  userId: string,        // ✅ Explicit type
  traceId?: string       // ✅ Optional, explicit type
): Promise<string[]> {   // ✅ Explicit return type
  // ...
}
```

### NotificationType

Added type for notification types:

```typescript
export type NotificationType = 
  | 'fall' 
  | 'medication' 
  | 'symptom' 
  | 'vital' 
  | 'trend' 
  | 'family'
  | string; // Allow other types for compatibility
```

## PHI Safety

### What's Logged

✅ **Safe to log:**
- User IDs (`uid`, `userId`)
- Family IDs (`familyId`)
- Trace IDs (`traceId`)
- Counts (`tokenCount`, `memberCount`)
- Booleans (`excludeUserId`, `shouldSend`)
- Notification types (`notificationType`)
- Function names (`fn`)

❌ **Never logged:**
- User names
- Email addresses
- FCM tokens (actual values)
- Notification content
- Preference values (only boolean results)

### Example Safe Logs

```json
{
  "level": "debug",
  "msg": "FCM tokens retrieved",
  "traceId": "trace_abc123",
  "uid": "user123",
  "tokenCount": 2,
  "fn": "getUserTokens"
}
```

```json
{
  "level": "debug",
  "msg": "Family members retrieved",
  "traceId": "trace_abc123",
  "uid": "user123",
  "familyId": "family456",
  "memberCount": 3,
  "fn": "getFamilyMemberIds"
}
```

## Error Handling

All functions handle errors gracefully:

### getUserTokens
- **On error:** Returns `[]` (empty array)
- **Rationale:** Notification fails gracefully, doesn't crash

### getFamilyMemberIds
- **On error:** Returns `[]` (empty array)
- **Rationale:** No family members to notify, doesn't crash

### shouldSendNotification
- **On error:** Returns `true`
- **Rationale:** Fail-open for notifications (better to send than miss critical alert)

## Usage Examples

### With traceId (Recommended)

```typescript
const traceId = createTraceId();

// Get tokens with correlation
const tokens = await getUserTokens(userId, traceId);

// Get family members with correlation
const familyIds = await getFamilyMemberIds(userId, true, traceId);

// Check preferences with correlation
const shouldSend = await shouldSendNotification(userId, 'vital', traceId);
```

### Without traceId (Backward Compatible)

```typescript
// Still works without traceId
const tokens = await getUserTokens(userId);
const familyIds = await getFamilyMemberIds(userId, true);
const shouldSend = await shouldSendNotification(userId, 'vital');
```

## Testing

### Build Status

```bash
npm run build
# ✅ SUCCESS - All TypeScript compiles

npm run test
# ✅ All tests pass
```

### Manual Testing

Test each function independently:

```typescript
// Test getUserTokens
const tokens = await getUserTokens('test-user-id', 'test-trace');
console.log('Tokens:', tokens);

// Test getFamilyMemberIds
const members = await getFamilyMemberIds('test-user-id', true, 'test-trace');
console.log('Family members:', members);

// Test shouldSendNotification
const should = await shouldSendNotification('test-user-id', 'vital', 'test-trace');
console.log('Should send:', should);
```

## Migration Checklist

- [x] Extract `getUserTokens` to `services/notifications/userTokens.ts`
- [x] Extract `getFamilyMemberIds` to `modules/family/familyMembers.ts`
- [x] Extract `shouldSendNotification` to `services/notifications/preferences.ts`
- [x] Add structured logging to all functions
- [x] Add `traceId` parameter to all functions
- [x] Ensure PHI-safe logging (IDs only)
- [x] Add strict TypeScript types
- [x] Update imports in `index.ts`
- [x] Remove old function definitions from `index.ts`
- [x] Verify build succeeds
- [x] Verify tests pass
- [x] Document changes

## Benefits

### Code Organization
- ✅ Cleaner `index.ts` (~100 lines removed)
- ✅ Logical grouping (notifications, family)
- ✅ Easier to find and maintain

### Reusability
- ✅ Can be imported by other modules
- ✅ Consistent interfaces
- ✅ Single source of truth

### Observability
- ✅ Structured logging with `traceId`
- ✅ Start/end/error logs
- ✅ PHI-safe (IDs only)
- ✅ Easy to trace requests

### Type Safety
- ✅ Strict TypeScript types
- ✅ No implicit `any`
- ✅ Typed notification types
- ✅ Better IDE support

### Testability
- ✅ Isolated functions
- ✅ Easy to mock
- ✅ Unit testable
- ✅ Clear dependencies

## Next Steps

### Recommended Enhancements

1. **Add Unit Tests**
   ```typescript
   // functions/src/services/notifications/userTokens.test.ts
   describe('getUserTokens', () => {
     it('should return tokens for user with single token', async () => {
       // Test implementation
     });
     
     it('should return tokens for user with array of tokens', async () => {
       // Test implementation
     });
     
     it('should return empty array if no tokens', async () => {
       // Test implementation
     });
   });
   ```

2. **Add Caching**
   ```typescript
   // Cache family member lookups
   const familyCache = new Map<string, string[]>();
   ```

3. **Add Metrics**
   ```typescript
   // Track function performance
   const startTime = Date.now();
   // ... function logic
   const duration = Date.now() - startTime;
   logger.debug('Function completed', { duration, fn: 'getUserTokens' });
   ```

4. **Migrate Other Helpers**
   - `getFamilyAdmins` → `modules/family/familyAdmins.ts`
   - `cleanupInvalidTokens` → `services/notifications/tokenCleanup.ts`
   - `getUserById` → `modules/users/userQueries.ts`

## Summary

✅ **3 functions extracted** into dedicated modules  
✅ **~100 lines removed** from `index.ts`  
✅ **Structured logging** added with `traceId`  
✅ **PHI-safe** logging (IDs only)  
✅ **Strict types** (no implicit `any`)  
✅ **Backward compatible** (optional `traceId` parameter)  
✅ **Same behavior** (identical Firestore operations)  
✅ **Build passes** ✅ **Tests pass**  

The helper functions are now properly organized, observable, and reusable across the codebase!
