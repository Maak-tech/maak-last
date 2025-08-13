# 🚀 FCM Setup Checklist

## ✅ Firebase Console Setup

### 1. Enable Cloud Messaging API
- [ ] Go to [Firebase Console](https://console.firebase.google.com)
- [ ] Select project: **maak-5caad**
- [ ] Navigate to **Project Settings** → **Cloud Messaging**
- [ ] Enable **Cloud Messaging API (Legacy)**
- [ ] Copy and save the **Server Key**

**Your Server Key**: `AAAA...` (starts with AAAA)
**Sender ID**: `827176918437`

### 2. Save Server Key
Replace `YOUR_SERVER_KEY_HERE` in `/functions/.env`:
```env
FCM_SERVER_KEY=YOUR_ACTUAL_SERVER_KEY
PROJECT_ID=maak-5caad
```

---

## 🍎 iOS Configuration

### Step 1: Apple Developer Portal
- [ ] Sign in to [Apple Developer](https://developer.apple.com)
- [ ] Go to **Certificates, IDs & Profiles**

### Step 2: Create APNs Key
- [ ] Click **Keys** → **+**
- [ ] Name: "Maak Push Notifications"
- [ ] Check **Apple Push Notifications service (APNs)**
- [ ] Download the **.p8 file** (save it securely!)
- [ ] Note the **Key ID**: ___________

### Step 3: Upload to Firebase
- [ ] Go to Firebase Console → Project Settings → Cloud Messaging
- [ ] Find iOS app configuration
- [ ] Upload APNs Authentication Key (.p8 file)
- [ ] Enter Key ID: ___________
- [ ] Enter Team ID: ___________ (from Apple Developer account)

### Step 4: Xcode Configuration (for development builds)
When you create a development build with EAS:
```bash
# The app.json already has the push notifications plugin configured
eas build --profile development --platform ios
```

The Expo config will automatically:
- Enable Push Notifications capability
- Add Background Modes
- Configure entitlements

---

## 🤖 Android Configuration

### Step 1: Download google-services.json
- [ ] Go to Firebase Console → Project Settings
- [ ] Find your Android app
- [ ] Download **google-services.json**

### Step 2: Add to Project
When building with EAS, place the file in:
```bash
# For Expo/React Native
cp google-services.json ./
```

### Step 3: Verify app.json
Your `app.json` should have (already configured):
```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json",
      "permissions": [
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "com.google.android.c2dm.permission.RECEIVE"
      ]
    },
    "plugins": [
      "expo-notifications"
    ]
  }
}
```

---

## 🧪 Testing Push Notifications

### 1. Development Build Required
FCM doesn't work in Expo Go. Create a development build:

```bash
# iOS
eas build --profile development --platform ios

# Android  
eas build --profile development --platform android
```

### 2. Test Notifications

#### Using the App:
1. Open the app on your device
2. Go to **Profile** → **Debug Notifications**
3. Tap **Test Notifications**

#### Using Firebase Console:
1. Go to Firebase Console → **Engage** → **Messaging**
2. Click **Create your first campaign**
3. Choose **Firebase Notification messages**
4. Enter notification details
5. Target your app
6. Send test message

#### Using Cloud Functions:
```bash
# After deploying functions
curl -X POST https://us-central1-maak-5caad.cloudfunctions.net/sendPushNotification \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "userIds": ["USER_ID"],
      "notification": {
        "title": "Test",
        "body": "Hello from Cloud Functions!"
      }
    }
  }'
```

---

## 📝 Verification Steps

### Firebase Console:
- [ ] Cloud Messaging API enabled
- [ ] Server key copied
- [ ] iOS app configured with APNs
- [ ] Android app has google-services.json

### Cloud Functions:
- [ ] Functions deployed successfully
- [ ] Test endpoint working
- [ ] Scheduled functions running

### App Testing:
- [ ] Development build created
- [ ] Push permissions granted
- [ ] Test notification received
- [ ] Fall detection alerts working
- [ ] Medication reminders working

---

## 🔧 Troubleshooting

### iOS Issues:
- **No notifications**: Check APNs key upload
- **Invalid token**: Regenerate APNs key
- **Not receiving**: Check device settings → Notifications → Your App

### Android Issues:
- **No token**: Check google-services.json
- **Not receiving**: Check device battery optimization settings
- **Delayed**: Disable battery saver

### General Issues:
- **"FCM not available"**: Not in development build
- **No sound**: Check notification settings
- **Not in background**: Check background modes

---

## 📞 Support Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Apple Push Notification Service](https://developer.apple.com/documentation/usernotifications)
- [Android Notifications](https://developer.android.com/develop/ui/views/notifications)

---

## ✨ Next Steps

1. **Complete all checkboxes above**
2. **Deploy Cloud Functions**: `firebase deploy --only functions`
3. **Create development build**: `eas build --profile development`
4. **Test all notification types**
5. **Monitor in Firebase Console**

**Last Updated**: December 2024
**Status**: Ready for configuration