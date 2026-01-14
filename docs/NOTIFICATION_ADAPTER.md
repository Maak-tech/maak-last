# Unified Notification Service

## Overview

Created a single entrypoint for all push notification sending with proper tracking, PHI-safe logging, and graceful error handling.

## Architecture

### New Structure

```
functions/src/services/notifications/
├── index.ts              # ✅ NEW: Unified notification service
├── userTokens.ts         # FCM token retrieval
└── preferences.ts        # Preference checking
```

### Key Functions

#### 1. `sendToUser(userId, options)`

Send notification to a single user.

```typescript
const result = await sendToUser('user123', {
  traceId: 'trace_abc',
  title: 'Alert Title',
  body: 'Alert message',
  data: { alertId: 'alert456' },
  type: 'vital_alert',
  priority: 'high',
});

// Result:
// {
//   success: true,
//   sent: 2,      // Sent to 2 devices
//   failed: 0,
//   skipped: 0
// }
```

#### 2. `sendToMany(userIds, options)`

Send notification to multiple users.

```typescript
const result = await sendToMany(['user1', 'user2', 'user3'], {
  traceId: 'trace_abc',
  title: 'Alert Title',
  body: 'Alert message',
  type: 'fall_alert',
  priority: 'high',
});

// Result:
// {
//   success: true,
//   sent: 5,      // Total devices across all users
//   failed: 1,
//   skipped: 1,   // One user had no tokens
//   errors: ['...']
// }
```

#### 3. `sendPushNotificationCompat(userIds, notification, type, traceId)`

Backward-compatible wrapper for existing code.

```typescript
const result = await sendPushNotificationCompat(
  ['user1', 'user2'],
  {
    title: 'Alert',
    body: 'Message',
    data: { key: 'value' },
    priority: 'high',
  },
  'vital_alert',
  'trace_abc'
);

// Result:
// {
//   success: true,
//   successCount: 3,
//   failureCount: 0,
//   skippedCount: 0,
//   message: 'Sent to 3/2 users'
// }
```

## Notification Tracking

### notificationAttempts Collection

Every notification attempt is recorded in Firestore:

```typescript
{
  traceId: string;           // Correlation ID
  userId: string;            // User ID
  type: NotificationType;    // Type of notification
  status: 'sent' | 'failed' | 'skipped';
  tokensCount: number;       // Number of FCM tokens
  reason?: string;           // Reason for failure/skip
  createdAt: Timestamp;      // When attempted
}
```

### Example Records

**Successful send:**
```json
{
  "traceId": "trace_abc123",
  "userId": "user123",
  "type": "vital_alert",
  "status": "sent",
  "tokensCount": 2,
  "reason": null,
  "createdAt": "2026-01-13T10:30:00Z"
}
```

**No tokens (skipped):**
```json
{
  "traceId": "trace_abc123",
  "userId": "user456",
  "type": "fall_alert",
  "status": "skipped",
  "tokensCount": 0,
  "reason": "No FCM tokens found",
  "createdAt": "2026-01-13T10:30:00Z"
}
```

**Failed send:**
```json
{
  "traceId": "trace_abc123",
  "userId": "user789",
  "type": "symptom_alert",
  "status": "failed",
  "tokensCount": 1,
  "reason": "1 tokens failed",
  "createdAt": "2026-01-13T10:30:00Z"
}
```

## PHI-Safe Logging

### What's Logged

✅ **Safe to log:**
- User IDs (`uid`, `userId`)
- Trace IDs (`traceId`)
- Notification types (`type`)
- Status (`status`, `sent`, `failed`, `skipped`)
- Counts (`tokenCount`, `userCount`, `sent`, `failed`)
- Function names (`fn`)

❌ **Never logged:**
- Notification titles (may contain names)
- Notification body (may contain PHI)
- Notification data values
- FCM token values

### Example Logs

```json
{
  "level": "info",
  "msg": "Sending notification to user",
  "traceId": "trace_abc",
  "uid": "user123",
  "type": "vital_alert",
  "fn": "sendToUser"
}
```

```json
{
  "level": "info",
  "msg": "Notification sent to user",
  "traceId": "trace_abc",
  "uid": "user123",
  "type": "vital_alert",
  "sent": 2,
  "failed": 0,
  "fn": "sendToUser"
}
```

```json
{
  "level": "info",
  "msg": "Sending notification to multiple users",
  "traceId": "trace_abc",
  "type": "fall_alert",
  "userCount": 5,
  "fn": "sendToMany"
}
```

## Token Handling

### Graceful Degradation

**No tokens found:**
```typescript
{
  success: true,  // Not an error
  sent: 0,
  failed: 0,
  skipped: 1      // User skipped
}
```

**Invalid tokens:**
- Automatically detected by FCM
- Cleaned up from Firestore
- Logged for monitoring

### Token Cleanup

Invalid tokens are automatically removed:

```typescript
// Finds users with invalid tokens
// Removes fcmToken field from user document
// Logs cleanup for monitoring
```

## Integration with index.ts

### Before

```typescript
// ~150 lines of inline FCM logic
const tokens: string[] = [];
for (const userId of userIds) {
  const userTokens = await getUserTokens(userId);
  tokens.push(...userTokens);
}

const message = {
  notification: { title, body },
  data: { ... },
  android: { ... },
  apns: { ... },
  tokens,
};

const response = await admin.messaging().sendEachForMulticast(message);

// Handle failures...
// Clean up tokens...
// Log results...
```

### After

```typescript
// 5 lines
const result = await sendPushNotificationCompat(
  userIds,
  notification,
  notificationType,
  traceId
);
```

### Updated Functions

1. **`sendPushNotification` (Cloud Function)**
   - Now uses `sendPushNotificationCompat`
   - Still checks preferences
   - Returns same response format

2. **`sendPushNotificationHttp` (HTTP endpoint)**
   - Now uses `sendPushNotificationCompat`
   - Same response format

3. **All internal calls** (`exports.sendPushNotification`)
   - No changes needed
   - Works through the callable function

## Notification Types

```typescript
type NotificationType = 
  | 'fall_alert'
  | 'vital_alert'
  | 'symptom_alert'
  | 'trend_alert'
  | 'medication_alert'
  | 'family_update'
  | 'general';
```

## Options Interface

```typescript
interface SendNotificationOptions {
  traceId?: string;          // Correlation ID
  title: string;             // Notification title
  body: string;              // Notification body
  data?: Record<string, string>; // Custom data (must be strings)
  type?: NotificationType;   // Notification type
  priority?: 'high' | 'normal'; // Priority level
  sound?: string;            // Sound file
  badge?: number;            // Badge count
  imageUrl?: string;         // Image URL
  clickAction?: string;      // Click action
  color?: string;            // Notification color
}
```

## Result Interface

```typescript
interface SendNotificationResult {
  success: boolean;          // Overall success
  sent: number;              // Successfully sent
  failed: number;            // Failed to send
  skipped: number;           // Skipped (no tokens)
  errors?: string[];         // Error messages
}
```

## Error Handling

### Graceful Failures

All errors are caught and logged:

```typescript
try {
  // Send notification
} catch (error) {
  logger.error('Failed to send notification', error, {
    traceId,
    uid: userId,
    type,
    fn: 'sendToUser',
  });
  
  // Record failed attempt
  await recordNotificationAttempt(
    traceId,
    userId,
    type,
    'failed',
    0,
    error.message
  );
  
  // Return failure result (doesn't throw)
  return {
    success: false,
    sent: 0,
    failed: 1,
    skipped: 0,
    errors: [error.message],
  };
}
```

### No Tokens

Not treated as an error:

```typescript
if (tokens.length === 0) {
  // Log as info, not error
  logger.info('No FCM tokens for user, skipping', { ... });
  
  // Record as skipped
  await recordNotificationAttempt(
    traceId,
    userId,
    type,
    'skipped',
    0,
    'No FCM tokens found'
  );
  
  // Return success with skip
  return {
    success: true,
    sent: 0,
    failed: 0,
    skipped: 1,
  };
}
```

## Usage Examples

### Example 1: Send to Single User

```typescript
import { sendToUser } from './services/notifications';

const result = await sendToUser('patient123', {
  traceId: createTraceId(),
  title: 'Critical Alert: Heart Rate',
  body: 'Heart rate is critically high: 165 bpm',
  data: {
    alertId: 'alert456',
    vitalType: 'heartRate',
    value: '165',
  },
  type: 'vital_alert',
  priority: 'high',
  color: '#EF4444',
});

if (result.sent > 0) {
  console.log(`Notification sent to ${result.sent} devices`);
}
```

### Example 2: Send to Multiple Users

```typescript
import { sendToMany } from './services/notifications';

const caregiverIds = ['caregiver1', 'caregiver2', 'caregiver3'];

const result = await sendToMany(caregiverIds, {
  traceId: createTraceId(),
  title: 'Fall Detected',
  body: 'Potential fall detected. Please check on patient.',
  type: 'fall_alert',
  priority: 'high',
});

console.log(`Sent: ${result.sent}, Failed: ${result.failed}, Skipped: ${result.skipped}`);
```

### Example 3: Backward Compatible

```typescript
// Existing code still works
const result = await exports.sendPushNotification(
  {
    userIds: ['user1', 'user2'],
    notification: {
      title: 'Alert',
      body: 'Message',
      data: { key: 'value' },
    },
    notificationType: 'general',
  },
  { auth: { uid: 'system' } }
);
```

## Querying Notification Attempts

### Get Recent Attempts

```typescript
const attempts = await db
  .collection('notificationAttempts')
  .where('userId', '==', 'user123')
  .orderBy('createdAt', 'desc')
  .limit(50)
  .get();

attempts.docs.forEach(doc => {
  const data = doc.data();
  console.log(`${data.type}: ${data.status} (${data.tokensCount} tokens)`);
});
```

### Get Failed Attempts

```typescript
const failed = await db
  .collection('notificationAttempts')
  .where('status', '==', 'failed')
  .where('createdAt', '>', oneDayAgo)
  .get();

console.log(`Failed attempts in last 24h: ${failed.size}`);
```

### Get Attempts by Trace ID

```typescript
const attempts = await db
  .collection('notificationAttempts')
  .where('traceId', '==', 'trace_abc123')
  .get();

console.log(`Attempts for trace: ${attempts.size}`);
```

## Benefits

### Code Quality
- ✅ Single entrypoint for all notifications
- ✅ ~150 lines removed from index.ts
- ✅ Reusable across all functions
- ✅ Consistent error handling

### Observability
- ✅ All attempts tracked in Firestore
- ✅ Structured logging with traceId
- ✅ PHI-safe (only IDs logged)
- ✅ Easy to query and analyze

### Reliability
- ✅ Graceful token handling
- ✅ Automatic token cleanup
- ✅ No-throw error handling
- ✅ Detailed error tracking

### Maintainability
- ✅ One place to update FCM logic
- ✅ Type-safe interfaces
- ✅ Clear separation of concerns
- ✅ Easy to test

## Testing

### Build Status

```bash
npm run build
# ✅ SUCCESS

npm run test
# ✅ All tests pass
```

### Manual Testing

```typescript
// Test single user
const result1 = await sendToUser('test-user', {
  title: 'Test',
  body: 'Test message',
  type: 'general',
});
console.log('Single user result:', result1);

// Test multiple users
const result2 = await sendToMany(['user1', 'user2'], {
  title: 'Test',
  body: 'Test message',
  type: 'general',
});
console.log('Multiple users result:', result2);

// Check Firestore
const attempts = await db.collection('notificationAttempts').get();
console.log('Recorded attempts:', attempts.size);
```

## Migration Summary

### Files Created
- ✅ `services/notifications/index.ts` (400+ lines)

### Files Updated
- ✅ `index.ts` - Now uses notification service

### Lines Removed
- ~150 lines of inline FCM logic

### Lines Added
- ~5 lines per notification call

### Backward Compatibility
- ✅ All existing calls work unchanged
- ✅ Same response formats
- ✅ Same behavior

## Next Steps

### Recommended Enhancements

1. **Batch Processing**
   - Process users in batches for large sends
   - Parallel processing for speed

2. **Retry Logic**
   - Retry failed sends with exponential backoff
   - Store retry attempts

3. **Analytics**
   - Dashboard for notification metrics
   - Success/failure rates
   - Token health monitoring

4. **Templates**
   - Predefined notification templates
   - Multi-language support
   - Dynamic content injection

## Summary

✅ **Unified Service** - Single entrypoint for all notifications  
✅ **Tracking** - All attempts recorded in Firestore  
✅ **PHI-Safe** - Only IDs logged, no content  
✅ **Graceful** - Handles missing tokens elegantly  
✅ **Backward Compatible** - Existing code works unchanged  
✅ **Type Safe** - Full TypeScript support  
✅ **Production Ready** - Error handling, logging, monitoring  

The notification service provides a clean, maintainable, and observable way to send push notifications throughout the application!
