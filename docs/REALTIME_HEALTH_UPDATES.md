# Real-time Health Updates via WebSocket

This document describes the real-time health updates system that replaces polling with WebSocket-like subscriptions using Firestore real-time listeners.

## Overview

The system provides real-time updates for:
1. **Critical Trend Alerts** - Immediate notifications when concerning health trends are detected
2. **Family Member Updates** - Live updates when family members' health data changes

## Architecture

### Components

1. **`realtimeHealthService.ts`** - Core service managing Firestore real-time listeners
2. **`useRealtimeHealth.ts`** - React hook for easy subscription management
3. **`trendDetectionService.ts`** - Enhanced with `createTrendAlert()` function

### How It Works

- Uses **Firestore real-time listeners** (`onSnapshot`) which are WebSocket-based under the hood
- Automatically handles reconnection and error recovery
- Efficiently batches updates and only sends changes (not full snapshots)
- Lower latency than polling (instant vs 5-30 second delays)
- Better battery life (no constant polling)

## Usage

### Basic Usage in Components

```typescript
import { useRealtimeHealth } from "@/hooks/useRealtimeHealth";

function MyComponent() {
  const { user } = useAuth();
  
  useRealtimeHealth({
    userId: user?.id,
    familyId: user?.familyId,
    familyMemberIds: familyMembers.map(m => m.id),
    onTrendAlert: (alert) => {
      // Handle critical trend alert
      if (alert.severity === "critical") {
        Alert.alert("Critical Alert", alert.trendAnalysis.message);
      }
    },
    onFamilyMemberUpdate: (update) => {
      // Handle family member update
      console.log("Member update:", update);
    },
    onAlertCreated: (alert) => {
      // Handle new alert
      console.log("New alert:", alert);
    },
    enabled: !!user?.id,
  });
}
```

### Creating Trend Alerts

When trend detection finds a concerning trend:

```typescript
import { createTrendAlert, analyzeVitalTrend } from "@/lib/services/trendDetectionService";

// Analyze trend
const analysis = analyzeVitalTrend(vitalReadings, "heartRate", "bpm", 7);

if (analysis && isTrendConcerning(analysis)) {
  // Create alert (will be picked up by real-time listeners)
  await createTrendAlert(userId, analysis, "vital_trend");
}
```

### Manual Subscription (Advanced)

For more control, use the service directly:

```typescript
import { realtimeHealthService } from "@/lib/services/realtimeHealthService";

// Subscribe to trend alerts
const unsubscribe = realtimeHealthService.subscribeToTrendAlerts(
  userId,
  (alert) => {
    console.log("Trend alert:", alert);
  }
);

// Later, unsubscribe
unsubscribe();
```

## Integration Points

### Profile Screen (`app/(tabs)/profile.tsx`)

- **Replaced**: 5-second polling interval for sync status
- **With**: Real-time subscriptions to alerts and vitals
- **Benefit**: Instant updates, better battery life

### Family Screen (`app/(tabs)/family.tsx`)

- **Replaced**: Manual refresh on focus
- **With**: Real-time subscriptions to family member updates
- **Benefit**: Live updates when family members' data changes

## Event Types

### TrendAlert

```typescript
{
  id: string;
  userId: string;
  type: "vital_trend" | "symptom_trend";
  severity: "critical" | "warning";
  trendAnalysis: TrendAnalysis | SymptomTrendAnalysis;
  timestamp: Date;
  acknowledged?: boolean;
}
```

### FamilyMemberUpdate

```typescript
{
  memberId: string;
  updateType: 
    | "vital_added"
    | "symptom_added"
    | "alert_created"
    | "alert_resolved"
    | "medication_taken"
    | "status_change";
  data: any;
  timestamp: Date;
}
```

## Performance Considerations

### Firestore Query Limits

- `in` queries support up to 10 items
- Service automatically chunks family member IDs into batches of 10
- Multiple listeners are combined efficiently

### Subscription Management

- Subscriptions are automatically cleaned up on component unmount
- Use `enabled` flag to pause/resume subscriptions
- Service tracks all subscriptions and can unsubscribe all at once

### Network Efficiency

- Firestore listeners only send changes (deltas), not full snapshots
- Automatic reconnection on network issues
- Offline support - updates sync when connection restored

## Backend Integration

Trend alerts are created in two ways:

1. **Client-side**: Using `createTrendAlert()` when trends are detected locally
2. **Backend**: Cloud Functions can create alerts in Firestore, which are automatically picked up by listeners

Example backend alert creation:

```typescript
// In Cloud Function
await db.collection("alerts").add({
  userId,
  type: "vital_trend",
  severity: "critical",
  message: "Heart rate trending upward",
  timestamp: Timestamp.now(),
  resolved: false,
  metadata: {
    trendAnalysis: {
      vitalType: "heartRate",
      trend: "increasing",
      severity: "critical",
      // ... other fields
    }
  }
});
```

## Migration from Polling

### Before (Polling)

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    checkSyncStatus();
    loadData();
  }, 5000);
  
  return () => clearInterval(interval);
}, []);
```

### After (Real-time)

```typescript
useRealtimeHealth({
  userId: user?.id,
  onAlertCreated: () => checkSyncStatus(),
  onFamilyMemberUpdate: () => loadData(),
});
```

## Benefits

1. **Lower Latency**: Instant updates vs 5-30 second delays
2. **Better Battery**: No constant polling
3. **Reduced Server Load**: Only sends changes, not full data
4. **Offline Support**: Queues updates when offline
5. **Automatic Reconnection**: Handles network issues gracefully

## Troubleshooting

### Subscriptions Not Working

- Check that `enabled` is `true`
- Verify user is authenticated (`user?.id` exists)
- Check Firestore security rules allow read access
- Review console for Firestore errors

### Too Many Updates

- Use `limit()` in queries (already implemented)
- Filter updates in handlers before processing
- Use debouncing for UI updates if needed

### Memory Leaks

- Ensure `unsubscribe()` is called in cleanup
- Use the hook's automatic cleanup (recommended)
- Check that subscriptions are not created multiple times

## Future Enhancements

1. **Custom WebSocket Server**: For even lower latency (if needed)
2. **Message Queuing**: For guaranteed delivery
3. **Compression**: For large payloads
4. **Rate Limiting**: To prevent spam
5. **Analytics**: Track subscription health and performance
