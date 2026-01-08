# Firebase Setup Scripts

This directory contains scripts to help you set up and validate your Firebase configuration automatically.

## Scripts Overview

### 1. `firebase-setup-check.ts` - Validation Script

**Purpose**: Checks your Firebase setup and identifies permission issues
**Command**: `npm run firebase:check`

### 2. `create-user-collections.ts` - Collection Creator

**Purpose**: Creates sample collections for your current user
**Command**: `npm run firebase:create-collections`

### 3. `firebase-init-collections.ts` - Full Initialization

**Purpose**: Complete Firebase setup with admin SDK (advanced)
**Command**: `npm run firebase:init`

## Quick Start (Recommended)

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Create Sample Collections

This will create collections for your current authenticated user:

```bash
npm run firebase:create-collections
```

### Step 3: Validate Setup

```bash
npm run firebase:check
```

## Detailed Usage

### Creating Collections for Your User

The easiest way to set up your collections is using the user-specific script:

```bash
npm run firebase:create-collections
```

**What it does:**

- Creates sample symptoms for your user ID
- Creates sample medications
- Creates sample medical history
- Creates sample vital signs
- Ensures your user document exists

**Prerequisites:**

- Your Firebase project must be configured
- Firestore security rules should be updated (see FIREBASE_SETUP.md)
- Your environment variables should be set

### Validating Your Setup

```bash
npm run firebase:check
```

**What it checks:**

- Firebase configuration
- Authentication status
- Firestore permissions
- Collection access rights

### Troubleshooting

#### Error: "Missing or insufficient permissions"

1. Update your Firestore security rules (see FIREBASE_SETUP.md)
2. Make sure you're signed into your app
3. Run `npm run firebase:check` to diagnose issues

#### Error: "Cannot use import statement outside a module"

✅ **Fixed!** The scripts now use CommonJS syntax and should work properly.

#### Error: "User ID not found"

The script uses your actual user ID: `Ezqaeqp23sXWHMIJJ4ELwyah8RC3`
You can also set a custom user ID:

```bash
USER_ID=your-user-id npm run firebase:create-collections
```

## Environment Variables

Make sure these are set in your `.env` file:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## Sample Data Created

When you run the collection creation script, it will create:

### Symptoms

- Sample headache entry
- Sample fatigue entry

### Medications

- Vitamin D (daily reminder)
- Paracetamol (as needed)

### Medical History

- Sample hypertension entry

### Vital Signs

- Heart rate reading
- Blood pressure reading

### User Document

- Ensures your user document exists with proper structure
- Sets up preferences and onboarding status

## Advanced Usage

### Using Firebase Admin SDK

For advanced users who want to use the Firebase Admin SDK:

1. Download your service account key from Firebase Console
2. Save it as `firebase-service-account.json` in the project root
3. Run: `npm run firebase:init`

### Custom User ID

To create collections for a specific user:

```bash
USER_ID=custom-user-id npm run firebase:create-collections
```

## Next Steps

After running the scripts:

1. **Update Security Rules**: Follow the guide in `FIREBASE_SETUP.md`
2. **Test Your App**: Try adding symptoms and medications
3. **Validate Setup**: Use the validation script: `npm run firebase:check`
4. **Check Console**: Look at Firebase Console to see your data

## Common Issues

### Permission Denied

- **Cause**: Firestore security rules not updated
- **Fix**: Update rules as shown in FIREBASE_SETUP.md

### Configuration Error

- **Cause**: Missing environment variables
- **Fix**: Check your `.env` file

### User Not Found

- **Cause**: User ID doesn't match your authenticated user
- **Fix**: Use the correct user ID from your app logs

## Support

If you encounter issues:

1. Check the console output for detailed error messages
2. Use the validation script: `npm run firebase:check`
3. Review the setup guide: `FIREBASE_SETUP.md`
4. Check Firebase Console to verify your data and permissions
