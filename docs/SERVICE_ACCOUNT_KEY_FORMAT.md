# Service Account Key File Format

## What You Need: Service Account Key (JSON File)

The `serviceAccountKey.json` file should be a **JSON file** downloaded from Firebase Console, NOT code.

## Correct Format

Your `serviceAccountKey.json` file should look like this (with your actual values):

```json
{
  "type": "service_account",
  "project_id": "maak-app-12cb8",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@maak-app-12cb8.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40maak-app-12cb8.iam.gserviceaccount.com"
}
```

## What You Currently Have (WRONG)

Your file currently contains JavaScript code:
```javascript
var admin = require("firebase-admin");
var serviceAccount = require("path/to/serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
```

This is **example code**, not the actual service account key file!

## How to Get the Correct File

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **Maak App** (maak-app-12cb8)
3. Click the gear icon ⚙️ → **Project Settings**
4. Go to the **Service Accounts** tab
5. Click **Generate New Private Key**
6. Click **Generate Key** in the confirmation dialog
7. A JSON file will download (e.g., `maak-app-12cb8-firebase-adminsdk-xxxxx.json`)
8. **Rename it to `serviceAccountKey.json`**
9. **Place it in your project root** (same folder as `package.json`)

## Key vs Token - Understanding the Difference

### Service Account Key (What You Need)
- **Format**: JSON file
- **Contains**: Private key, client email, project ID, etc.
- **Purpose**: Used to authenticate Firebase Admin SDK
- **Lifespan**: Permanent (until you regenerate it)
- **Location**: Downloaded file from Firebase Console
- **Usage**: `require("./serviceAccountKey.json")`

### Service Account Token (Generated Automatically)
- **Format**: Short string (JWT)
- **Contains**: Encoded authentication information
- **Purpose**: Used for API calls
- **Lifespan**: Expires after 1 hour
- **Location**: Generated automatically by Firebase Admin SDK
- **Usage**: Created internally when you use `admin.credential.cert()`

## Security Notes

⚠️ **CRITICAL**: 
- The service account key file contains **sensitive credentials**
- It's already in `.gitignore` - **never commit it to version control**
- Keep it secure and don't share it
- If compromised, delete it and generate a new one

## Verification

After placing the correct JSON file, test it:

```bash
# This should work without errors
npm run firebase:init
```

If you see "✅ Firebase Admin initialized with service account", you're good!

## Example Usage

Once you have the correct JSON file, your code will work:

```javascript
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Now you can use Firebase Admin SDK
const db = admin.firestore();
```

