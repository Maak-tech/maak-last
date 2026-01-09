# Deployment Issues and Solutions

## Issue 1: Billing Account Required ✅ FIXED

**Error:**
```
Write access to project 'maak-5caad' was denied: please check billing account associated and retry
```

**Solution:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: `maak-5caad`
3. Navigate to **Billing** → **Account Management**
4. Link a billing account to the project
5. Cloud Functions requires billing to be enabled (even for free tier)

**Note:** Firebase has a free tier that includes:
- 2M function invocations/month
- 400K GB-seconds compute time/month
- 200K CPU-seconds/month

## Issue 2: Predeploy Script ✅ FIXED

**Problem:** Bun doesn't support `--cwd` flag in the same way as npm

**Solution:** Updated `firebase.json` to use `cd` command instead:
```json
"predeploy": [
  "cd \"$RESOURCE_DIR\" && bun run build"
]
```

## Next Steps

1. **Enable Billing** (Required)
   - Link billing account in Google Cloud Console
   - Free tier is sufficient for development/testing

2. **Deploy Functions**
   ```powershell
   firebase deploy --only functions
   ```

3. **Verify Deployment**
   ```powershell
   firebase functions:list
   ```
   Should show:
   - `checkVitalBenchmarks`
   - `checkSymptomBenchmarks`

## Alternative: Deploy Without Predeploy

If predeploy continues to have issues, you can:

1. Build manually:
   ```powershell
   cd functions
   bun run build
   cd ..
   ```

2. Deploy without predeploy:
   ```powershell
   firebase deploy --only functions --force
   ```

Or temporarily remove predeploy from `firebase.json`:
```json
"predeploy": []
```

