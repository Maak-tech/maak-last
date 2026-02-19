# Fix Zeina Production API Key Issue

## Problem
Getting error: "Invalid or expired OpenAI API key. Verify OPENAI_API_KEY values in your EAS environment, then rebuild the app."

## Root Causes

1. **EAS secret not set** - The API key isn't configured in EAS
2. **App not rebuilt** - Secret was set but app wasn't rebuilt after setting it
3. **Secret formatting issues** - Key has quotes, spaces, or extra characters
4. **Wrong secret name** - Using incorrect environment variable name
5. **Actually expired key** - The API key itself is invalid/expired

## Solution Steps

### Step 1: Verify Your API Key is Valid

Test your API key locally first:

```bash
# Test the key from your .env file
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY_HERE"
```

If you get a 401 error, your key is invalid/expired. Get a new one from:
https://platform.openai.com/api-keys

### Step 2: Check Current EAS Secrets

```bash
# List all project secrets
eas secret:list --scope project
```

Look for:
- `OPENAI_API_KEY` ✅
- `EXPO_PUBLIC_OPENAI_API_KEY` (optional)
- `ZEINA_API_KEY` (optional, falls back to OPENAI_API_KEY)

### Step 3: Set/Update EAS Secret

**Option A: Using EAS CLI (Recommended)**

```bash
# Set OPENAI_API_KEY for production
eas secret:create \
  --scope project \
  --name OPENAI_API_KEY \
  --value "sk-your-actual-key-here" \
  --type string \
  --visibility secret \
  --environment production \
  --non-interactive
```

**Important:** 
- Remove quotes from the key value (don't include `"` around the key)
- Remove any spaces before/after the key
- The key should start with `sk-` or `sk-proj-`

**Option B: Update Existing Secret**

If the secret already exists:

```bash
eas secret:update \
  --scope project \
  --name OPENAI_API_KEY \
  --value "sk-your-actual-key-here" \
  --type string \
  --visibility secret \
  --environment production \
  --non-interactive
```

### Step 4: Verify Secret is Set

```bash
# Check the secret exists
eas secret:list --scope project | grep OPENAI_API_KEY
```

### Step 5: Rebuild Your App (CRITICAL!)

**You MUST rebuild after setting/updating secrets!**

```bash
# For iOS
eas build --platform ios --profile production

# For Android  
eas build --platform android --profile production
```

The secret is baked into `app.config.js` during build time, not runtime. Simply updating the secret won't fix existing builds.

### Step 6: Verify Configuration

After rebuilding, check that the key is being read correctly:

1. The `app.config.js` reads from `OPENAI_API_KEY` or `EXPO_PUBLIC_OPENAI_API_KEY`
2. It injects it into `extra.openaiApiKey` and `extra.zeinaApiKey`
3. The `openaiService.ts` reads from `Constants.expoConfig?.extra?.openaiApiKey`

## Troubleshooting

### Issue: Secret set but still getting error

**Solution:** 
- ✅ Did you rebuild after setting the secret? (Most common issue!)
- ✅ Check secret name is exactly `OPENAI_API_KEY` (case-sensitive)
- ✅ Verify secret is set for `production` environment
- ✅ Check secret value doesn't have quotes/spaces

### Issue: Key works locally but not in production

**Solution:**
- The key might be in `.env` but not in EAS secrets
- EAS builds don't use `.env` files - they use EAS secrets
- Set the secret in EAS and rebuild

### Issue: Getting 401 Unauthorized

**Solution:**
- Your API key might actually be expired/invalid
- Check OpenAI dashboard: https://platform.openai.com/api-keys
- Generate a new key and update EAS secret
- Rebuild the app

### Issue: Key has formatting problems

**Solution:**
- Remove any quotes (`"` or `'`) from the secret value
- Remove leading/trailing spaces
- Ensure key starts with `sk-` or `sk-proj-`
- Key should be one continuous string with no line breaks

## Quick Fix Script

Use the PowerShell script to set secrets automatically:

```powershell
.\scripts\setup-openai-secrets.ps1
```

This reads from your `.env` file and sets EAS secrets automatically.

## Verification Checklist

- [ ] API key is valid (tested with curl/API)
- [ ] EAS secret `OPENAI_API_KEY` exists
- [ ] Secret is set for `production` environment
- [ ] Secret value has no quotes or spaces
- [ ] App was rebuilt after setting secret
- [ ] New build is deployed to production

## Still Not Working?

1. Check EAS build logs for any errors during build
2. Verify the secret is accessible: `eas secret:list --scope project`
3. Try setting `EXPO_PUBLIC_OPENAI_API_KEY` instead (alternative name)
4. Check OpenAI API status: https://status.openai.com/
5. Verify your OpenAI account has billing enabled
6. Check if your API key has the right permissions/scopes

## Related Files

- `app.config.js` - Reads EAS secrets and injects into `extra`
- `lib/services/openaiService.ts` - Uses the API key from `Constants.expoConfig?.extra`
- `functions/src/services/zeina/analyze.ts` - Uses API key for Zeina analysis
