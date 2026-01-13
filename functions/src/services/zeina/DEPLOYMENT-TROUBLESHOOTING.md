# Zeina Deployment Troubleshooting

## Current Status: ✅ Code Ready, ⚠️ Firebase Configuration Needed

The Zeina AI system has **0 TypeScript errors** and is ready for production. The deployment issue is related to Firebase/Google Cloud Platform configuration, not the code.

---

## Issue: Eventarc Service Identity Error

```
Error: Error generating the service identity for eventarc.googleapis.com.
```

### Root Cause
Firebase needs to create service accounts for Eventarc, but lacks the necessary permissions or the API isn't fully enabled.

### Solution Steps

#### Step 1: Enable Eventarc API
1. Visit: https://console.cloud.google.com/apis/library/eventarc.googleapis.com?project=maak-5caad
2. Click **"ENABLE"**
3. Wait 1-2 minutes for propagation

#### Step 2: Verify IAM Permissions
1. Visit: https://console.cloud.google.com/iam-admin/iam?project=maak-5caad
2. Find your account (the one you're deploying with)
3. Ensure you have one of these roles:
   - **Owner** (recommended for first deployment)
   - **Editor**
   - **Firebase Admin**
   - **Cloud Functions Admin**

#### Step 3: Check Required APIs
All these should be enabled (Firebase usually does this automatically):
- ✅ Cloud Functions API
- ✅ Cloud Build API
- ✅ Artifact Registry API
- ⚠️ **Eventarc API** ← Currently causing the issue
- ✅ Pub/Sub API
- ✅ Cloud Scheduler API
- ✅ Cloud Run API

Quick check: https://console.cloud.google.com/apis/dashboard?project=maak-5caad

#### Step 4: Verify Billing
1. Visit: https://console.cloud.google.com/billing?project=maak-5caad
2. Ensure a valid billing account is attached
3. Check that billing is **Active**

#### Step 5: Enable Service Account Creation
If you're still getting errors, you may need to enable the Service Usage API:
1. Visit: https://console.cloud.google.com/apis/library/serviceusage.googleapis.com?project=maak-5caad
2. Click **"ENABLE"**

---

## Alternative: Deploy to Different Project

If issues persist, you may want to deploy to the alternate project:

```powershell
firebase use maak-app-12cb8
firebase deploy --only functions
```

---

## Verify Deployment is Ready

Before attempting deployment, confirm:

### ✅ Code Status
```powershell
cd functions
npx tsc --noEmit
# Should return no errors
```

### ✅ Environment Variables
Check that `functions/.env` contains:
```
OPENAI_API_KEY=your-key-here
ZEINA_ENABLED=true
```

### ✅ Firebase Configuration
```powershell
firebase projects:list
# Should show maak-5caad as (current)
```

---

## Successful Deployment

Once the Eventarc API is enabled, run:

```powershell
firebase deploy --only functions
```

Expected output:
```
✔  functions: Finished running predeploy script.
✔  functions: all functions deployed successfully!
```

---

## Post-Deployment Verification

### 1. Check Functions are Deployed
Visit: https://console.firebase.google.com/project/maak-5caad/functions

You should see:
- `processVitalReading` (Firestore trigger)
- `sendPushNotification` (HTTPS callable)
- Other existing functions

### 2. Monitor Zeina Metrics
```powershell
firebase functions:log --only processVitalReading
```

Look for logs like:
```
zeina.calls: 1
zeina.successes: 1
zeina.duration.total: 850ms
```

### 3. Test with Real Alert
The Zeina system will automatically run when:
- A vital reading triggers an alert
- The alert severity is "warning" or "critical"

---

## Common Errors & Solutions

### Error: "403 Forbidden"
**Cause:** Billing not enabled or insufficient permissions  
**Fix:** Enable billing at https://console.cloud.google.com/billing

### Error: "Service account does not exist"
**Cause:** Firebase hasn't created default service accounts  
**Fix:** Visit https://console.cloud.google.com/iam-admin/serviceaccounts and wait for accounts to appear

### Error: "Quota exceeded"
**Cause:** Too many deployments in a short time  
**Fix:** Wait 10-15 minutes and try again

### Error: "Build failed"
**Cause:** TypeScript compilation error  
**Fix:** Run `cd functions && npx tsc --noEmit` to check for errors

---

## Emergency Rollback

If deployment causes issues:

```powershell
# List previous versions
firebase functions:list

# Roll back to previous version
firebase functions:delete processVitalReading --force
firebase deploy --only functions:processVitalReading
```

---

## Support Resources

- **Firebase Status:** https://status.firebase.google.com/
- **Google Cloud Status:** https://status.cloud.google.com/
- **Firebase Support:** https://firebase.google.com/support
- **Project Console:** https://console.firebase.google.com/project/maak-5caad

---

## Summary

**Current Blocker:** Eventarc API not fully enabled  
**Fix:** Enable at https://console.cloud.google.com/apis/library/eventarc.googleapis.com?project=maak-5caad  
**Code Status:** ✅ Ready for production (0 errors)  
**Next Step:** Enable API → Retry deployment  
