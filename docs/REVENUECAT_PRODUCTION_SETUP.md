# RevenueCat Production Setup Guide

This guide will help you set up RevenueCat for production builds.

## Prerequisites

- RevenueCat App ID: `app7fb7d2f755`
- Access to [RevenueCat Dashboard](https://app.revenuecat.com/)
- EAS CLI installed and authenticated

## Step 1: Get Your Production API Key

1. Log in to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your app (App ID: `app7fb7d2f755`)
3. Navigate to **Project Settings** → **API Keys**
4. Find the **Public API Key** section
5. Copy the production API key:
   - **iOS**: Starts with `appl_` (e.g., `appl_xxxxxxxxxxxxx`)
   - **Android**: Starts with `goog_` (e.g., `goog_xxxxxxxxxxxxx`)
   - **Note**: For React Native, you can use either key - they work cross-platform

## Step 2: Set API Key in EAS Secrets

Run the following command in your terminal (replace `YOUR_PRODUCTION_API_KEY` with the actual key):

```bash
eas secret:create --scope project --name REVENUECAT_API_KEY --value "YOUR_PRODUCTION_API_KEY" --type string --visibility secret --environment production
```

**Important Notes:**
- Use `--environment production` to ensure this key is only used in production builds
- The key will automatically be available in your production builds via `process.env.REVENUECAT_API_KEY`
- Development builds will continue to use the test key if this is not set

## Step 3: Verify the Secret

Verify that the secret was created successfully:

```bash
eas env:list
```

You should see `REVENUECAT_API_KEY` listed with environment `production`.

## Step 4: Test Production Build

After setting up the production API key, create a production build:

```bash
eas build --platform ios --profile production
# or
eas build --platform android --profile production
```

The app will automatically use the production API key during the build process.

## Verification

To verify RevenueCat is working correctly in production:

1. **Check Initialization**: The app should initialize RevenueCat without errors
2. **Test Purchases**: Use sandbox/test accounts to verify purchase flows work
3. **Check Entitlements**: Verify that subscription entitlements are correctly recognized
4. **Monitor Dashboard**: Check the RevenueCat dashboard for any errors or warnings

## Troubleshooting

### API Key Not Found Error

If you see an error about the API key not being found:

1. Verify the secret exists: `eas env:list`
2. Check that you used `--environment production`
3. Ensure you're building with the `production` profile: `eas build --profile production`

### Test Key in Production Warning

If you see a warning about using a test key in production:

- This means the production API key wasn't found
- Verify the EAS secret is set correctly
- Ensure you're building with the `production` profile

### API Key Format

- Production keys start with `appl_` (iOS) or `goog_` (Android)
- Test keys start with `test_`
- The SDK will reject test keys in production builds

## Missing Metadata?

If RevenueCat shows "missing metadata" warnings, see the [RevenueCat Metadata Setup Guide](./REVENUECAT_METADATA_SETUP.md) for detailed instructions on configuring:
- App details in RevenueCat dashboard
- Products and entitlements
- App Store Connect metadata (iOS)
- Google Play Console metadata (Android)

## Additional Resources

- [RevenueCat Dashboard](https://app.revenuecat.com/)
- [RevenueCat React Native Documentation](https://www.revenuecat.com/docs/react-native)
- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/)
- [RevenueCat Metadata Setup Guide](./REVENUECAT_METADATA_SETUP.md)

## Current Configuration

- **App ID**: `app7fb7d2f755`
- **Project ID**: `proj76462039`
- **API Key Location**: EAS Secrets (`REVENUECAT_API_KEY`)
- **Environment**: Production builds only
