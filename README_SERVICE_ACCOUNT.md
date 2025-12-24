# 🔑 Service Account Key Setup

## ⚠️ Important: You Need the Actual JSON File

Your `serviceAccountKey.json` file should be a **JSON file** downloaded from Firebase Console, NOT code.

## Quick Setup Steps

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select Project**: Maak App (maak-app-12cb8)
3. **Project Settings** → **Service Accounts** tab
4. **Click**: "Generate New Private Key"
5. **Download**: The JSON file will download automatically
6. **Rename**: Rename it to `serviceAccountKey.json`
7. **Place**: Put it in your project root (same folder as `package.json`)

## What the File Should Look Like

The file should be valid JSON with this structure:

```json
{
  "type": "service_account",
  "project_id": "maak-app-12cb8",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@maak-app-12cb8.iam.gserviceaccount.com",
  ...
}
```

See `serviceAccountKey.example.json` for the complete template.

## Key vs Token

- **Service Account Key** (JSON file) = What you download from Firebase Console
- **Service Account Token** = Generated automatically by Firebase Admin SDK (you don't need to manage this)

## Verify It Works

After placing the file, test it:

```bash
npm run firebase:init
```

You should see: "✅ Firebase Admin initialized with service account"

## Security

⚠️ **Never commit `serviceAccountKey.json` to version control!**
- It's already in `.gitignore`
- Contains sensitive credentials
- If compromised, delete and regenerate

## More Information

- See `docs/SERVICE_ACCOUNT_KEY_FORMAT.md` for detailed format information
- See `docs/FIREBASE_SERVICE_ACCOUNT.md` for service account details

