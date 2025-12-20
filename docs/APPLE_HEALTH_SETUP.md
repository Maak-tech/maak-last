# Apple Health Integration Setup Guide

## ✅ Implementation Complete

The Apple Health integration is now fully implemented for iOS devices. This guide covers setup, usage, and testing.

## 📋 What's Been Implemented

### Core Components

1. **Health Metrics Catalog** (`lib/health/healthMetricsCatalog.ts`)
   - Complete catalog of 30+ health metrics across 8 categories
   - Provider-specific mappings for Apple HealthKit types
   - Helper functions for metric selection and grouping

2. **Apple Health Service** (`lib/services/appleHealthService.ts`)
   - HealthKit availability checking
   - Permission requesting with granular metric selection
   - Data fetching and normalization

3. **Unified Sync Module** (`lib/health/healthSync.ts`)
   - Provider-agnostic sync logic
   - Connection status management
   - Backend sync payload creation

4. **User Interface Screens**
   - **Health Integrations Screen** (`app/profile/health-integrations.tsx`) - Provider selection hub
   - **Apple Health Intro** (`app/profile/health/apple-intro.tsx`) - Pre-permission explanation
   - **Apple Health Permissions** (`app/profile/health/apple-permissions.tsx`) - Metric selection
   - **Apple Health Connected** (`app/profile/health/apple-connected.tsx`) - Status and sync controls

5. **iOS Configuration**
   - Updated `Info.plist` with HealthKit permission descriptions
   - Added navigation routes
   - Integrated into Profile screen

## 🚀 Setup Instructions

### 1. Install Dependencies

The `react-native-health` package is already in `package.json`. If you need to reinstall:

```bash
cd ios
pod install
cd ..
```

### 2. iOS Configuration

The `Info.plist` has been updated with:
- `NSHealthShareUsageDescription` - Explains read-only access
- `NSHealthUpdateUsageDescription` - Required for secure read access

### 3. Backend Endpoint

Ensure your backend has a `/health/sync` endpoint that accepts:

```typescript
{
  provider: "apple_health",
  selectedMetrics: string[],
  range: { startDate: string, endDate: string },
  device: { platform: "ios", model?: string, osVersion?: string, appVersion?: string },
  metrics: NormalizedMetricPayload[]
}
```

## 📱 User Flow

1. **Access**: Profile → Settings → "Health Integrations"
2. **Select Provider**: Tap "Apple Health" (iOS only)
3. **Read Intro**: Learn about benefits and privacy
4. **Select Metrics**: Choose which metrics to sync (with "Select All" option)
5. **Authorize**: iOS permission dialog appears
6. **View Status**: See granted/denied metrics, sync data, manage permissions

## 🔐 Privacy & Permissions

### Key Privacy Features

- **Read-Only**: App never writes to Apple Health
- **User Control**: Users select exactly which metrics to share
- **Granular Permissions**: Each metric requires explicit authorization
- **Transparent**: Clear explanation of what data is accessed and why

### Permission Handling

- Users can deny individual metrics
- Denied metrics are shown in the Connected screen
- Users can manage permissions via iOS Settings
- Connection can be revoked at any time

## 📊 Supported Metrics

### Heart & Cardiovascular
- Heart Rate
- Resting Heart Rate
- Heart Rate Variability
- Walking Heart Rate Average
- Blood Pressure (Systolic/Diastolic)

### Respiratory
- Respiratory Rate
- Blood Oxygen (SpO2)

### Temperature
- Body Temperature

### Body Measurements
- Weight
- Height
- Body Mass Index
- Body Fat Percentage

### Activity & Fitness
- Steps
- Active Energy Burned
- Basal Energy Burned
- Distance Walking/Running
- Flights Climbed
- Exercise Minutes
- Stand Time
- Workouts

### Sleep
- Sleep Analysis

### Nutrition
- Water Intake

### Glucose
- Blood Glucose

## 🧪 Testing Checklist

### Basic Flow
- [ ] Navigate to Health Integrations from Profile
- [ ] See Apple Health as available (iOS) or unavailable (Android)
- [ ] Tap Apple Health → See intro screen
- [ ] Continue → See metric selection screen
- [ ] Select metrics → Tap "Authorize"
- [ ] iOS permission dialog appears
- [ ] Grant permissions → Navigate to Connected screen
- [ ] See granted metrics listed
- [ ] Tap "Sync Now" → Data syncs successfully

### Edge Cases
- [ ] Deny all permissions → See appropriate error
- [ ] Deny some metrics → See granted/denied lists
- [ ] Disconnect → Return to provider selection
- [ ] Reconnect → Previous selections remembered
- [ ] Sync with no data → Handle gracefully
- [ ] Network error during sync → Show error, allow retry

### Permissions Management
- [ ] Open iOS Settings → Health → Privacy → See app listed
- [ ] Revoke permissions in Settings → App reflects changes
- [ ] Re-enable permissions → App works correctly

## 🐛 Troubleshooting

### HealthKit Not Available
- Ensure running on physical iOS device (not simulator for some metrics)
- Check iOS version (HealthKit requires iOS 8.0+)
- Verify `react-native-health` is properly linked

### Permissions Not Requesting
- Check `Info.plist` has correct permission strings
- Verify `react-native-health` is properly installed
- Check iOS device capabilities

### Sync Failing
- Verify backend endpoint is accessible
- Check network connectivity
- Review sync logs in Connected screen
- Ensure date range is valid

### Data Not Appearing
- Verify metrics are granted in iOS Settings
- Check if data exists in Apple Health app
- Ensure date range includes data
- Review service logs for errors

## 📝 Code Notes

### react-native-health API

The service uses `react-native-health` with callbacks. Key methods:

```typescript
// Check availability
AppleHealthKit.isAvailable()

// Request permissions
AppleHealthKit.initHealthKit({ permissions: { read: [...], write: [] } }, callback)

// Fetch samples
AppleHealthKit.getSamples(options, callback)
AppleHealthKit.getCategorySamples(options, callback)
AppleHealthKit.getWorkouts(options, callback)
```

### Data Normalization

All health data is normalized to `NormalizedMetricPayload` format:
- Provider-agnostic structure
- Consistent date formats (ISO 8601)
- Standardized units
- Source attribution

### Storage

Connection status stored in AsyncStorage:
- `@health/apple_health_connection` - Connection metadata
- Includes selected metrics, granted metrics, timestamps

## 🔄 Future Enhancements

- Real-time sync scheduling
- Background sync
- Data visualization
- Trend analysis
- Export functionality

## 📚 References

- [react-native-health Documentation](https://github.com/agencyenterprise/react-native-health)
- [Apple HealthKit Documentation](https://developer.apple.com/documentation/healthkit)
- [iOS Privacy Guidelines](https://developer.apple.com/app-store/review/guidelines/#privacy)

