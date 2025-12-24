# Firebase Account Migration Guide

This guide will help you migrate from your current Firebase project to a new Firebase account/project.

## Prerequisites

- Access to your new Firebase account
- Admin access to create a new Firebase project
- Your current `.env` file (for reference)

## Step-by-Step Migration Process

### Step 1: Create New Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Sign in with your **new account**
3. Click **"Create a project"** or **"Add project"**
4. Enter your project name (e.g., "Maak Health")
5. Enable Google Analytics (optional but recommended)
6. Create the project

### Step 2: Configure Authentication

1. In your new Firebase project, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password** sign-in provider
3. Save the changes

### Step 3: Create Firestore Database

1. Go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for initial setup)
4. Select your preferred location (match your old project if possible)
5. Create the database

### Step 4: Get Firebase Configuration

1. Go to **Project Settings** (gear icon) in your new Firebase project
2. In the **General** tab, scroll down to "Your apps"
3. Click the web icon `</>`
4. Register your app with name "Maak Health Web"
5. Copy the `firebaseConfig` object values

### Step 5: Update Environment Variables

Update your `.env` file with the new Firebase credentials:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-new-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-new-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-new-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-new-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-new-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-new-app-id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your-new-measurement-id
```

**Important**: Remove any quotes around the values in your `.env` file.

### Step 6: Update Firebase CLI Configuration

Update the `.firebaserc` file with your new project ID:

```json
{
  "projects": {
    "default": "your-new-project-id"
  }
}
```

### Step 7: Set Up Firestore Security Rules

1. Go to **Firestore Database** > **Rules** in your new Firebase project
2. Copy the rules from `firestore.rules` in your project
3. Paste them into the Firebase Console
4. Click **Publish**

### Step 8: Set Up Firestore Indexes (if needed)

1. Go to **Firestore Database** > **Indexes**
2. If you have `firestore.indexes.json`, import it or create indexes manually
3. Wait for indexes to build

### Step 9: Download Service Account Key (for scripts)

If you use Firebase Admin SDK scripts:

1. Go to **Project Settings** > **Service Accounts**
2. Click **Generate new private key**
3. Save it as `firebase-service-account.json` in your project root
4. **Important**: Add this file to `.gitignore` (it should already be there)

### Step 10: Test the Connection

1. Restart your development server:
   ```bash
   npm run dev
   # or
   bun run dev
   ```

2. Validate your environment variables:
   ```bash
   bunx tsx scripts/validate-env.ts
   ```

3. Test Firebase connection in your app:
   - Navigate to `/firebase-test` in your app
   - Run the Firebase tests

### Step 11: Migrate Data (Optional)

If you need to migrate data from your old Firebase project:

#### Option A: Manual Migration (Small datasets)
1. Export data from old Firestore database
2. Import into new Firestore database
3. Update user authentication (users will need to re-register)

#### Option B: Script-Based Migration (Large datasets)
1. Set up both Firebase projects temporarily
2. Create a migration script to copy data
3. Run the migration script
4. Verify data integrity

**Note**: User authentication cannot be migrated directly. Users will need to:
- Create new accounts in the new Firebase project, OR
- Use the same email/password if you manually create their accounts

### Step 12: Update App Configuration

Verify these files are using environment variables (they should be already):

- ✅ `lib/firebase.ts` - Uses `process.env.EXPO_PUBLIC_*` variables
- ✅ Scripts use environment variables with fallbacks

### Step 13: Clean Up Old Project (After Verification)

Once you've verified everything works:

1. **Wait at least 1-2 weeks** to ensure everything is working
2. Export any final data from old project
3. Delete the old Firebase project (if desired)

## Verification Checklist

- [ ] New Firebase project created
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] `.env` file updated with new credentials
- [ ] `.firebaserc` updated with new project ID
- [ ] Firestore security rules deployed
- [ ] Environment variables validated (`bunx tsx scripts/validate-env.ts`)
- [ ] App connects to new Firebase project
- [ ] Can create new user accounts
- [ ] Can read/write Firestore data
- [ ] Firebase test page (`/firebase-test`) passes all tests

## Common Issues

### "Invalid API Key" Error
- ✅ Check that `.env` file exists and has correct values
- ✅ Restart your development server after updating `.env`
- ✅ Ensure no quotes around values in `.env` file

### "Permission Denied" Errors
- ✅ Verify Firestore security rules are deployed
- ✅ Check that user is authenticated
- ✅ Ensure user document exists in `users` collection

### Scripts Not Working
- ✅ Verify `firebase-service-account.json` is for the new project
- ✅ Check that `EXPO_PUBLIC_FIREBASE_PROJECT_ID` matches new project

### Old Project Still Being Used
- ✅ Clear app cache/data
- ✅ Restart development server
- ✅ Verify `.env` file is being loaded correctly

## Files That Need Updating

1. **`.env`** - Update all `EXPO_PUBLIC_FIREBASE_*` variables
2. **`.firebaserc`** - Update project ID
3. **`firebase-service-account.json`** - Download new service account key (if using Admin SDK)

## Files That DON'T Need Changes

- ✅ `lib/firebase.ts` - Already uses environment variables
- ✅ `firestore.rules` - Rules are project-agnostic
- ✅ `firebase.json` - Configuration file, no project-specific data
- ✅ Scripts - Already use environment variables

## Need Help?

- Check `docs/FIREBASE_SETUP.md` for detailed Firebase setup
- Run `bunx tsx scripts/validate-env.ts` to validate configuration
- Use the Firebase test page in your app (`/firebase-test`)

## Important Notes

⚠️ **User Accounts**: Users will need to create new accounts in the new Firebase project. Authentication data cannot be migrated.

⚠️ **Data Migration**: If you have existing data, plan your migration strategy before switching.

⚠️ **Testing**: Test thoroughly in development before switching production environments.

