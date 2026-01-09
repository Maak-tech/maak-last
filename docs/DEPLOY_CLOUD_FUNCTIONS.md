# Deploying Cloud Functions

This guide explains how to deploy the Firebase Cloud Functions for vital and symptom benchmark alerts.

## Prerequisites

1. **Firebase CLI installed**
   ```bash
   npm install -g firebase-tools
   ```

2. **Logged into Firebase**
   ```bash
   firebase login
   ```

3. **Firebase project initialized**
   ```bash
   firebase use <your-project-id>
   ```
   Or if not initialized:
   ```bash
   firebase init
   ```

## Pre-Deployment Checklist

### 1. Verify Functions Code
- ✅ Functions are in `functions/src/index.ts`
- ✅ TypeScript compiles successfully
- ✅ All dependencies are in `functions/package.json`

### 2. Check Firebase Configuration
- ✅ `firebase.json` is configured correctly
- ✅ Runtime matches your Node.js version (nodejs22)

### 3. Build Functions Locally (Optional)
Test that functions compile:
```bash
cd functions
bun install
bun run build
```

This should create the `lib/` directory with compiled JavaScript.

## Deployment Steps

### Option 1: Deploy All Functions
```bash
firebase deploy --only functions
```

### Option 2: Deploy Specific Functions
Deploy only the new benchmark checking functions:
```bash
firebase deploy --only functions:checkVitalBenchmarks,functions:checkSymptomBenchmarks
```

### Option 3: Deploy from Functions Directory
```bash
cd functions
bun run deploy
```

## What Gets Deployed

The following Cloud Functions will be deployed:

1. **checkVitalBenchmarks** - Firestore trigger that monitors new vitals
   - Trigger: `vitals/{vitalId}` document creation
   - Checks vitals against benchmarks
   - Sends alerts to account admins

2. **checkSymptomBenchmarks** - Firestore trigger that monitors new symptoms
   - Trigger: `symptoms/{symptomId}` document creation
   - Checks symptom severity
   - Sends alerts to account admins for severity ≥ 4

## Deployment Output

You should see output like:
```
✔  functions[checkVitalBenchmarks(us-central1)] Successful create operation.
✔  functions[checkSymptomBenchmarks(us-central1)] Successful create operation.
```

## Verify Deployment

### 1. Check Functions in Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Functions** section
4. You should see `checkVitalBenchmarks` and `checkSymptomBenchmarks`

### 2. Test the Functions
Create a test vital or symptom in Firestore and verify:
- Function triggers automatically
- Admin receives push notification
- Alert is logged in `notificationLogs` collection

### 3. View Function Logs
```bash
firebase functions:log
```

Or view specific function logs:
```bash
firebase functions:log --only checkVitalBenchmarks
```

## Troubleshooting

### Error: "Functions did not deploy"
- Check that TypeScript compiles: `cd functions && bun run build`
- Verify Firebase CLI is logged in: `firebase login`
- Check project is selected: `firebase use`

### Error: "Runtime nodejs18 not found"
- Update `firebase.json` to use `nodejs22` (already done)
- Or install the required runtime

### Error: "Permission denied"
- Ensure you have Firebase Admin permissions
- Check billing is enabled (required for Cloud Functions)

### Functions not triggering
- Verify Firestore triggers are enabled
- Check function logs for errors
- Ensure user has `familyId` set
- Verify admins exist in the family

## Updating Functions

To update functions after making changes:

1. Make your code changes
2. Build TypeScript:
   ```bash
   cd functions
   bun run build
   ```
3. Deploy:
   ```bash
   firebase deploy --only functions
   ```

## Rollback

If you need to rollback:

1. List function versions:
   ```bash
   firebase functions:list
   ```
2. Delete problematic function:
   ```bash
   firebase functions:delete checkVitalBenchmarks
   ```
3. Redeploy previous version if needed

## Cost Considerations

- **Firestore triggers**: Free tier includes 50K invocations/day
- **Cloud Functions**: Free tier includes 2M invocations/month
- **Push notifications**: Uses FCM (free tier available)

Monitor usage in Firebase Console → Usage and Billing

## Next Steps After Deployment

1. ✅ Test with a real vital sign entry
2. ✅ Verify admin receives notification
3. ✅ Check notification logs
4. ✅ Monitor function execution time and errors
5. ✅ Adjust benchmarks if needed (in `functions/src/index.ts`)

## Environment Variables (if needed)

If you need to add environment variables:
```bash
firebase functions:config:set vital.alert.enabled=true
```

Then access in code:
```typescript
const config = functions.config();
const alertEnabled = config.vital?.alert?.enabled;
```

