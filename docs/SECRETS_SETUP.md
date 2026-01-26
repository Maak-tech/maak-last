# Secrets Management Guide

This project uses secrets in two places:
1. **GitHub Secrets** - For CI/CD workflows (GitHub Actions)
2. **EAS Secrets** - For Expo Application Services builds

## Overview

### GitHub Secrets
- Used by GitHub Actions workflows for CI/CD
- Accessible via `${{ secrets.SECRET_NAME }}` in workflows
- Set in: Repository Settings → Secrets and variables → Actions
- **Environments**: You can create environment-specific secrets (e.g., `development`, `staging`, `production`)
  - Access via `${{ secrets.SECRET_NAME }}` when using `environment: development`
  - Set in: Repository Settings → Environments → [Environment Name] → Secrets

### EAS Secrets
- Used during EAS builds (iOS/Android app builds)
- Automatically injected as environment variables during build
- Set via: `eas secret:create` command or EAS dashboard
- Accessible in `app.config.js` via `process.env.SECRET_NAME`

## Required Secrets

### Firebase Configuration (Both GitHub & EAS)

These should be set in **both** GitHub Secrets and EAS Secrets:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID  # Optional
```

### Google Services Files (EAS Only)

These are base64-encoded files, typically only needed for EAS builds:

```bash
GOOGLE_SERVICES_JSON          # Base64 encoded google-services.json
GOOGLE_SERVICE_INFO_PLIST     # Base64 encoded GoogleService-Info.plist
```

### API Keys (Both GitHub & EAS)

```bash
OPENAI_API_KEY                 # OpenAI API key
ZEINA_API_KEY                 # Zeina service API key (or same as OPENAI_API_KEY)
FITBIT_CLIENT_ID
FITBIT_CLIENT_SECRET
OURA_CLIENT_ID
OURA_CLIENT_SECRET
WITHINGS_CLIENT_ID
WITHINGS_CLIENT_SECRET
GARMIN_CLIENT_ID
GARMIN_CLIENT_SECRET
SAMSUNG_HEALTH_CLIENT_ID
SAMSUNG_HEALTH_CLIENT_SECRET
DEXCOM_CLIENT_ID
DEXCOM_CLIENT_SECRET
DEXCOM_REDIRECT_URI
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
REVENUECAT_API_KEY            # RevenueCat API key
REVENUECAT_PROJECT_ID
```

### GitHub Actions Specific (GitHub Only)

For GitHub Actions workflows that use EAS builds:

```bash
EXPO_TOKEN                    # Expo access token for CI/CD
                              # Create at: https://expo.dev/accounts/[your-account]/settings/access-tokens
```

### Firebase Functions (GitHub Only)

For Firebase Functions deployment via GitHub Actions:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY   # JSON service account key (base64 encoded)
FIREBASE_TOKEN                 # Firebase CLI token (optional, for CI)
```

## Setting Up Secrets

### GitHub Secrets

#### Repository-Level Secrets (Available to all workflows)

1. Go to your repository on GitHub
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its name and value
5. Click **Add secret**

#### Environment-Specific Secrets (Recommended for multi-environment setup)

1. Go to your repository on GitHub
2. Navigate to: **Settings** → **Environments**
3. Click **New environment** (or select existing environment like "Development")
4. Add environment-specific secrets:
   - Click **Add secret** under the environment
   - Enter secret name and value
   - These secrets are only available when the workflow uses `environment: development`

**Benefits of Environment-Specific Secrets:**
- ✅ Isolate secrets per environment (dev/staging/prod)
- ✅ Add protection rules (required reviewers, deployment branches)
- ✅ Better security and organization
- ✅ Can use different values for same secret name in different environments

**Note:** For base64-encoded files (like `GOOGLE_SERVICES_JSON`), encode them first:
```bash
# On macOS/Linux
base64 -i google-services.json

# On Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json"))
```

### EAS Secrets

Use the EAS CLI to set secrets:

```bash
# Set a secret for all environments
eas secret:create --scope project --name SECRET_NAME --value "secret-value" --type string

# Set a secret for specific environment
eas secret:create --scope project --name SECRET_NAME --value "secret-value" --type string --environment production

# Set a file secret (base64 encoded)
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --value "$(cat google-services.json | base64)" --type string
```

**Or use the PowerShell script:**
```powershell
.\scripts\setup-eas-firebase-secrets.ps1
```

## Verifying Secrets

### Verify GitHub Secrets

#### Repository-Level Secrets

1. Go to: **Settings** → **Secrets and variables** → **Actions**
2. Check that all required secrets are listed
3. Secrets cannot be viewed after creation (for security)

#### Environment-Specific Secrets

1. Go to: **Settings** → **Environments**
2. Click on your environment (e.g., "Development")
3. Check the **Secrets** section
4. Verify all required secrets are listed for that environment
5. Secrets cannot be viewed after creation (for security)

### Verify EAS Secrets

```bash
# List all EAS secrets
eas secret:list

# Check specific secret (will show if exists, not the value)
eas secret:list --name SECRET_NAME
```

### Validate Environment Setup

Run the validation script:
```bash
npm run validate:env
```

This will check:
- Local `.env` file (for development)
- EAS secrets (during builds)
- GitHub secrets (during CI/CD)

## Usage in Code

### In GitHub Actions Workflows

#### Using Repository-Level Secrets

```yaml
env:
  FIREBASE_API_KEY: ${{ secrets.EXPO_PUBLIC_FIREBASE_API_KEY }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

#### Using Environment-Specific Secrets (Development Environment)

```yaml
name: Deploy to Development

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: development  # This makes environment secrets available
    steps:
      - uses: actions/checkout@v4
      - name: Use Development Secrets
        env:
          FIREBASE_API_KEY: ${{ secrets.EXPO_PUBLIC_FIREBASE_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          echo "Deploying to development environment"
          # Your deployment commands here
```

**Note:** When using `environment: development`, GitHub Actions will:
- Use secrets from the "Development" environment first
- Fall back to repository-level secrets if not found in the environment

### In EAS Builds (app.config.js)

```javascript
export default {
  expo: {
    extra: {
      openaiApiKey: process.env.OPENAI_API_KEY || "",
      fitbitClientId: process.env.FITBIT_CLIENT_ID || "",
      // ... etc
    }
  }
}
```

### In Firebase Functions

Firebase Functions can access secrets via:
- Environment variables set in Firebase Console
- Or via `firebase functions:config:set`

```bash
firebase functions:config:set openai.api_key="your-key"
```

## Security Best Practices

1. ✅ **Never commit secrets** - `.env` is in `.gitignore`
2. ✅ **Use different secrets for different environments** (dev/staging/prod)
3. ✅ **Rotate secrets regularly**
4. ✅ **Use least privilege** - Only grant access to what's needed
5. ✅ **Review secret access logs** periodically
6. ✅ **Use EAS secrets for app builds**, GitHub secrets for CI/CD

## Troubleshooting

### Secret Not Found in EAS Build

```bash
# Check if secret exists
eas secret:list

# Recreate if missing
eas secret:create --scope project --name SECRET_NAME --value "value"
```

### Secret Not Found in GitHub Actions

1. Verify secret name matches exactly (case-sensitive)
2. Check repository settings → Secrets
3. Ensure workflow has permission to access secrets

### Environment Variable Not Available

- **Local development**: Check `.env` file exists and is loaded
- **EAS builds**: Verify secret is set with `eas secret:list`
- **GitHub Actions**: Check workflow YAML syntax for `${{ secrets.NAME }}`

## Quick Reference

| Secret Type | Where Set | Used By | Access Method |
|------------|-----------|---------|---------------|
| Firebase Config | GitHub + EAS | App builds, CI/CD | `process.env` / `${{ secrets }}` |
| API Keys | GitHub + EAS | App builds, CI/CD | `process.env` / `${{ secrets }}` |
| Google Services Files | EAS | App builds | `process.env` (base64 decoded) |
| Firebase Service Account | GitHub | CI/CD only | `${{ secrets }}` |

## GitHub Environments Setup

You've created a **Development** environment in GitHub. Here's how to use it:

### Setting Up Development Environment Secrets

1. Go to: **Settings** → **Environments** → **Development**
2. Add environment-specific secrets:
   - Development Firebase config (can use different project for dev)
   - Development API keys
   - Any other dev-specific secrets

### Using Development Environment in Workflows

See `.github/workflows/development.yml` (sample workflow included) for an example.

### Environment Protection Rules (Optional)

You can configure:
- **Required reviewers**: Require approval before deploying
- **Deployment branches**: Only allow deployments from specific branches
- **Wait timer**: Add a delay before deployment

## Next Steps

1. ✅ Verify all secrets are set in both GitHub and EAS
2. ✅ Add secrets to your Development environment in GitHub
3. ✅ Run `npm run verify:secrets` to check setup
4. ✅ Run `npm run validate:env` to check setup
5. ✅ Test EAS build: `eas build --profile production --platform ios`
6. ✅ Test GitHub Actions workflow with Development environment
