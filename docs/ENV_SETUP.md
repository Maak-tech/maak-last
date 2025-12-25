# Environment Variables Setup

## Overview

API keys and sensitive configuration are now stored in environment variables instead of `app.json` for security. This prevents exposing secrets in version control.

## Setup Instructions

1. **Create a `.env` file** in the project root (same directory as `package.json`)

2. **Copy the template** from `.env.example` (if it exists) or create one with these variables:

```env
# OpenAI API Configuration
# Get your API key from https://platform.openai.com/api-keys
# This key is used for both regular and premium users
OPENAI_API_KEY=your_openai_api_key_here

# Fitbit API Configuration
# Get your credentials from https://dev.fitbit.com/apps
FITBIT_CLIENT_ID=your_fitbit_client_id_here
FITBIT_CLIENT_SECRET=your_fitbit_client_secret_here
```

3. **Replace the placeholder values** with your actual API keys

4. **Verify `.env` is in `.gitignore`** (it should already be there)

## Important Notes

- ⚠️ **Never commit `.env` to version control** - it's already in `.gitignore`
- ✅ The `.env` file is automatically loaded by `app.config.js`
- ✅ API keys are accessible via `Constants.expoConfig?.extra` in your app code
- ✅ If an API key is missing, the app will show a warning but continue to function (where applicable)

## For Production Builds

For EAS builds, you'll need to set environment variables in your EAS build configuration or use EAS Secrets:

```bash
eas secret:create --scope project --name OPENAI_API_KEY --value your_key_here
```

Then update your `eas.json` to reference these secrets in the build profiles.

## Troubleshooting

If you see warnings about missing API keys:
1. Check that your `.env` file exists in the project root
2. Verify the variable names match exactly (case-sensitive)
3. Restart your Expo dev server after creating/updating `.env`
4. For production builds, ensure EAS secrets are configured

