# Firebase Service Account Information

## Default App Engine Service Account

Firebase automatically creates a default App Engine service account for your project:

**Service Account Email:**
```
firebase-adminsdk-fbsvc@maak-app-12cb8.iam.gserviceaccount.com
```

**Project Details:**
- **Project Name**: Maak App
- **Project ID**: maak-app-12cb8
- **Project Number**: 426849383346
- **Parent Org/Folder**: maaktech.net

## Usage

### In Cloud Functions (Production)

When your Cloud Functions are deployed, they automatically use this service account with default credentials. No additional configuration is needed - Firebase handles this automatically.

### For Local Development & Scripts

For local development and running scripts, you need to download a service account key file:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **Maak App** (maak-app-12cb8)
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the downloaded JSON file as `serviceAccountKey.json` in the project root

The downloaded key file will contain credentials for a service account (which may be different from the default App Engine account shown above, but has the same permissions).

## IAM Permissions

The default App Engine service account (`firebase-adminsdk-fbsvc@maak-app-12cb8.iam.gserviceaccount.com`) has the following roles by default:

- **Firebase Admin SDK Administrator Service Agent** - Full access to Firebase services
- **Cloud Functions Service Agent** - Can invoke and manage Cloud Functions
- **Firestore Service Agent** - Can read/write Firestore data
- **Cloud Messaging Service Agent** - Can send push notifications

## Security Notes

⚠️ **Important:**
- Never commit the `serviceAccountKey.json` file to version control (already in `.gitignore`)
- The service account email above is public information and safe to document
- The private key file contains sensitive credentials and must be kept secure
- Rotate service account keys periodically for security

## Verification

To verify the service account is working:

```bash
# Test Firebase Admin SDK initialization
npm run firebase:check

# Initialize collections (requires service account key)
npm run firebase:init
```

## Code Examples

### Standard Pattern (from Firebase Console)

The standard Firebase Admin SDK initialization pattern:

```javascript
var admin = require("firebase-admin");
var serviceAccount = require("path/to/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
```

### Implementation in This Project

This pattern is implemented in:
- `functions/src/index.ts` - Cloud Functions initialization (with environment detection)
- `lib/firebase-admin.ts` - Reusable helper utility
- `examples/firebase-admin-example.js` - Complete example file

## Related Files

- `functions/src/index.ts` - Cloud Functions initialization
- `lib/firebase-admin.ts` - Reusable Firebase Admin helper
- `examples/firebase-admin-example.js` - Standard pattern example
- `scripts/firebase-init-collections.ts` - Collection initialization script
- `.gitignore` - Prevents committing service account keys
- `docs/FIREBASE_SETUP.md` - Complete Firebase setup guide

