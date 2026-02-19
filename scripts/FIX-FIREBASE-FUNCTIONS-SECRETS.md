# Fix Firebase Functions Secrets for Zeina

## The Problem

Zeina runs in **TWO places**:
1. **Client-side** (React Native app) → Uses EAS secrets ✅
2. **Server-side** (Firebase Functions) → Uses Firebase Functions secrets ❌ **THIS IS MISSING!**

Firebase Functions run on Google Cloud, not Expo, so they **don't have access to EAS secrets**. They need Firebase Functions secrets set separately.

## The Solution

You need to set the API key as a **Firebase Functions Secret**:

### Step 1: Set Firebase Functions Secret

```powershell
# Read the key from your .env file
$key = (Get-Content .env | Select-String "OPENAI_API_KEY=" | ForEach-Object { $_.Line.Split('=')[1] }).Trim()

# Set Firebase Functions secret
echo $key | firebase functions:secrets:set OPENAI_API_KEY
```

Or manually:

```powershell
# Set the secret (will prompt for the value)
firebase functions:secrets:set OPENAI_API_KEY
# Then paste your API key when prompted
```

### Step 2: Set ZEINA_API_KEY (Optional)

If you have a separate Zeina key:

```powershell
$zeinaKey = (Get-Content .env | Select-String "ZEINA_API_KEY=" | ForEach-Object { $_.Line.Split('=')[1] }).Trim()
echo $zeinaKey | firebase functions:secrets:set ZEINA_API_KEY
```

Or use the same key:

```powershell
echo $key | firebase functions:secrets:set ZEINA_API_KEY
```

### Step 3: Verify Secrets Are Set

```powershell
firebase functions:secrets:access OPENAI_API_KEY
```

This should output your API key (masked).

### Step 4: Update Functions That Use Zeina

Functions that call Zeina need to include the secret in their configuration. Check if your functions are using the secret correctly:

**Current code in `functions/src/services/zeina/analyze.ts`:**
```typescript
const key = apiKey || process.env.OPENAI_API_KEY;
```

This will work once the Firebase Functions secret is set, because Firebase Functions automatically makes secrets available as `process.env.SECRET_NAME`.

### Step 5: Redeploy Firebase Functions

After setting secrets, you MUST redeploy:

```powershell
firebase deploy --only functions
```

## Quick Fix Script

I'll create a PowerShell script to automate this. But for now, run these commands:

```powershell
# 1. Get your API key from .env
$openaiKey = (Get-Content .env | Select-String "^OPENAI_API_KEY=" | ForEach-Object { 
    $value = $_.Line.Split('=', 2)[1]
    if ($value -match '^"(.*)"$') { $matches[1] } else { $value }
}).Trim()

# 2. Set Firebase Functions secret
echo $openaiKey | firebase functions:secrets:set OPENAI_API_KEY

# 3. Set ZEINA_API_KEY (use same key if not separate)
echo $openaiKey | firebase functions:secrets:set ZEINA_API_KEY

# 4. Redeploy functions
firebase deploy --only functions
```

## Verify It's Working

After deploying, check the Firebase Functions logs:

```powershell
firebase functions:log --only functions --limit 50
```

Look for Zeina-related logs. If you see "Invalid or expired OpenAI API key", the secret isn't set correctly.

## Alternative: Use the Setup Script

Your project has a setup script at `functions/src/services/zeina/scripts/setup.sh`. For Windows, you can adapt it or use WSL:

```bash
# In WSL or Git Bash
cd functions/src/services/zeina/scripts
bash setup.sh production
```

## Important Notes

1. **Firebase Functions secrets are different from EAS secrets** - you need both!
2. **Secrets are environment-specific** - make sure you're setting them for the right Firebase project
3. **After setting secrets, you MUST redeploy functions** - secrets are baked in at deploy time
4. **Secrets are automatically available as `process.env.SECRET_NAME`** in Firebase Functions

## Troubleshooting

### Issue: "Secret not found" error

**Solution:**
- Make sure you set the secret: `firebase functions:secrets:set OPENAI_API_KEY`
- Verify it exists: `firebase functions:secrets:access OPENAI_API_KEY`
- Redeploy functions after setting: `firebase deploy --only functions`

### Issue: Still getting 401 errors

**Solution:**
- Check the secret value doesn't have quotes: `firebase functions:secrets:access OPENAI_API_KEY`
- Verify the key is valid (test with curl)
- Check Firebase Functions logs for the actual error

### Issue: Secret set but function still fails

**Solution:**
- Make sure you redeployed after setting the secret
- Check that your function code uses `process.env.OPENAI_API_KEY` (which it does)
- Verify you're using the correct Firebase project: `firebase use`

## Summary

**You need TWO separate secrets:**
1. ✅ **EAS secret** (`OPENAI_API_KEY`) → For React Native app (client-side)
2. ❌ **Firebase Functions secret** (`OPENAI_API_KEY`) → For Firebase Functions (server-side) ← **THIS IS MISSING!**

Set the Firebase Functions secret and redeploy!
