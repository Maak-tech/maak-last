# 📱 Push Notifications Implementation Guide

## 🚀 Overview

The Maak Health app features a comprehensive push notification system that includes:
- **Fall detection alerts** - Emergency notifications when falls are detected
- **Medication reminders** - Scheduled reminders for medication times
- **Symptom alerts** - Family notifications for severe symptoms
- **Family updates** - Keep family members informed
- **User preferences** - Granular control over notification types

## 🏗️ Architecture

### Components

1. **Firebase Cloud Functions** (`/functions/src/index.ts`)
   - Enhanced notification delivery system
   - Scheduled medication reminders
   - Family member targeting
   - Notification preference checking
   - Device token management

2. **Push Notification Service** (`/lib/services/pushNotificationService.ts`)
   - Cloud Function integration
   - Fallback to local notifications
   - Multiple notification types
   - Smart retry logic

3. **Notification Settings UI** (`/app/profile/notification-settings.tsx`)
   - User preference management
   - Granular notification controls
   - Quiet hours configuration
   - Real-time updates

## 🔧 Setup Instructions

### 1. Deploy Cloud Functions

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Build the functions
npm run build

# Deploy to Firebase
firebase deploy --only functions
```

### 2. Enable FCM in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Project Settings** > **Cloud Messaging**
4. Enable Cloud Messaging API (Legacy) if not already enabled
5. Copy the Server Key for backend use

### 3. Configure iOS Push Notifications

1. Enable Push Notifications capability in Xcode
2. Upload APNs certificate to Firebase Console
3. Configure notification service extension

### 4. Configure Android Push Notifications

1. Add google-services.json to your Android app
2. FCM is automatically configured with Firebase SDK

## 📲 Testing Push Notifications

### Development Testing (Expo Go)

Push notifications work with limitations in Expo Go:
- Local notifications work fully
- Remote FCM notifications require development build

```javascript
// Test local notification
await pushNotificationService.sendTestNotification(userId, userName);
```

### Development Build Testing

```bash
# Create development build
eas build --profile development --platform ios

# Or for Android
eas build --profile development --platform android

# Install and test FCM
```

### Testing Cloud Functions

```bash
# Test locally with emulator
npm run serve

# Test deployed function
curl https://your-region-your-project.cloudfunctions.net/testHello

# Check function logs
firebase functions:log
```

## 🔔 Notification Types

### 1. Fall Detection Alerts

**Priority**: CRITICAL
**Recipients**: All family members
**Trigger**: Fall detection sensor or manual test

```javascript
await pushNotificationService.sendFallAlert(
  userId,
  alertId,
  userName,
  familyId,
  location
);
```

### 2. Medication Reminders

**Priority**: HIGH
**Recipients**: Individual user
**Trigger**: Scheduled (hourly check) or manual

```javascript
await pushNotificationService.sendMedicationReminder(
  userId,
  medicationId,
  medicationName,
  dosage
);
```

### 3. Symptom Alerts

**Priority**: HIGH (severity 4-5 only)
**Recipients**: Family members
**Trigger**: When user logs severe symptoms

```javascript
await pushNotificationService.sendSymptomAlert(
  userId,
  userName,
  symptomType,
  severity,
  familyId
);
```

## ⚙️ User Preferences

Users can control notifications through:

### Global Settings
- **Master toggle** - Enable/disable all notifications
- **Sound** - Play sound with notifications
- **Vibration** - Vibrate device

### Notification Types
- **Fall Alerts** - Emergency fall notifications
- **Medication Reminders** - Scheduled medication alerts
- **Symptom Alerts** - Severe symptom notifications
- **Family Updates** - Family member activities

### Quiet Hours
- Configure time periods for reduced notifications
- Emergency alerts bypass quiet hours

## 🛠️ Implementation Details

### Cloud Function Features

1. **Smart Token Management**
   - Multi-device support
   - Automatic cleanup of invalid tokens
   - Device tracking

2. **Preference Checking**
   - Respects user notification settings
   - Type-specific preferences
   - Quiet hours enforcement

3. **Scheduled Tasks**
   - Hourly medication reminder checks
   - Automatic retry on failure
   - Timezone awareness

### Fallback Strategy

```
1. Try FCM via Cloud Function
2. If fails, try direct FCM
3. If fails, use local notifications
4. Log all attempts for debugging
```

## 📊 Monitoring

### Check Notification Delivery

```javascript
// View notification logs in Firebase Console
firebase functions:log --only sendPushNotification

// Check specific user's notification history
const logs = await db.collection('notificationLogs')
  .where('userId', '==', userId)
  .orderBy('sentAt', 'desc')
  .limit(10)
  .get();
```

### Debug Issues

1. **Notifications not received**
   - Check FCM token is saved
   - Verify user preferences
   - Check Cloud Function logs
   - Test with debug notifications screen

2. **Scheduled reminders not working**
   - Verify Cloud Scheduler is enabled
   - Check medication reminder times
   - Review function logs for errors

## 🔐 Security Considerations

1. **Authentication Required**
   - All Cloud Functions require authentication
   - Token validation on every request

2. **Data Privacy**
   - Notifications don't contain sensitive medical data
   - User IDs are encrypted in transit

3. **Rate Limiting**
   - Prevent notification spam
   - Throttle per-user notifications

## 🚦 Status Codes

| Code | Meaning |
|------|---------|
| 200 | Notification sent successfully |
| 401 | Authentication required |
| 403 | Permission denied |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## 📝 Troubleshooting

### Common Issues

1. **"FCM not available in Expo Go"**
   - This is expected behavior
   - Create a development build for testing FCM

2. **"Missing or insufficient permissions"**
   - Update Firestore security rules
   - Ensure user document exists

3. **"No FCM token found"**
   - User needs to grant notification permissions
   - Token needs to be saved after app launch

4. **Scheduled reminders not firing**
   - Check Cloud Scheduler is enabled
   - Verify medication reminder times are set
   - Ensure medications are marked as active

## 🎯 Best Practices

1. **Always provide fallbacks**
   - Don't rely solely on FCM
   - Implement local notification backup

2. **Respect user preferences**
   - Check settings before sending
   - Honor quiet hours
   - Allow granular control

3. **Optimize for battery**
   - Batch notifications when possible
   - Use appropriate priority levels
   - Avoid excessive polling

4. **Test thoroughly**
   - Test all notification types
   - Verify family member delivery
   - Check preference enforcement

## 📚 Additional Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Expo Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
- [Cloud Functions Best Practices](https://firebase.google.com/docs/functions/tips)

## 🤝 Support

For issues or questions:
1. Check Cloud Function logs
2. Use debug notifications screen
3. Review this documentation
4. Contact development team

---

**Last Updated**: December 2024
**Version**: 2.0.0