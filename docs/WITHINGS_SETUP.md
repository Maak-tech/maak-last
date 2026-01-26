# Withings Integration Setup

This document outlines the URLs that need to be registered with Withings for OAuth2 and data notification services.

## Registered URLs for Withings

### OAuth2 Redirect URL

**Register this URL in your Withings developer account for OAuth2 authentication:**

```
https://maak-5caad.web.app/withings-callback
```

**Important:** This is the primary callback URL that Withings will redirect to after OAuth authorization. The web page will then redirect to the app via deep link (`maak://withings-callback`).

### Data Notification Service URL (Callback URI)

**IMPORTANT:** Register this URL in the "Callback URI" field of your Withings application in the Developer Dashboard. This is required before subscribing to notifications via API.

```
https://us-central1-maak-5caad.cloudfunctions.net/withingsWebhook
```

**Note:** The notification subscription happens automatically after OAuth completes. The callback URL must be registered in the dashboard first for the subscription to succeed.

## Setup Steps

1. **Log in to Withings Developer Portal:**
   - Go to https://developer.withings.com/
   - Navigate to your application settings

2. **Register OAuth2 Redirect URL:**
   - Add the web callback URL: `https://maak-5caad.web.app/withings-callback`
   - This is the URL that Withings will redirect to after OAuth authorization
   - The web page will then redirect to the app via deep link (`maak://withings-callback`)

3. **Register Notification Callback URI:**
   - Add the webhook URL (`https://us-central1-maak-5caad.cloudfunctions.net/withingsWebhook`) to the **"Callback URI"** field
   - This must be done before users connect their accounts
   - The app will automatically subscribe to notifications after OAuth completes

4. **API Endpoint:**
   - All API calls use: `https://wbsapi.withings.net`
   - OAuth token endpoint: `https://wbsapi.withings.net/v2/oauth2`
   - Notification subscription endpoint: `https://wbsapi.withings.net/notify`

## How It Works

### OAuth Flow
1. User initiates Withings connection from the app
2. User is redirected to Withings authorization page
3. After authorization, Withings redirects to the registered callback URL
4. The callback page extracts the authorization code and redirects to the app via deep link
5. The app exchanges the code for access/refresh tokens

### Webhook Flow
1. User connects their Withings account (OAuth completes)
2. Withings user ID is saved to the user's Firestore document
3. App automatically subscribes to notifications via `/notify` endpoint for categories:
   - 1: Weight
   - 2: Temperature
   - 4: Blood pressure/Heart rate
   - 16: Activity
   - 44: Sleep
4. When new data is available, Withings sends a POST request to the webhook URL
5. The webhook handler:
   - Verifies the request
   - Finds the user by Withings user ID
   - Stores the notification in Firestore
   - Returns 200 OK response (required within 4 seconds)
6. Background jobs process the notifications and sync data

## Firebase Configuration

### 1. Authorized Domains

**CRITICAL:** Add `maak-5caad.web.app` to Firebase Authentication authorized domains:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `maak-5caad`
3. Navigate to **Authentication** → **Settings** → **Authorized Domains**
4. Click **Add Domain**
5. Add: `maak-5caad.web.app`
6. Save

This ensures Firebase can securely handle requests from your hosting domain.

### 2. Firebase Config Update

The `authDomain` in `lib/firebase.ts` has been updated to use `maak-5caad.web.app` instead of `maak-5caad.firebaseapp.com` for better OAuth compatibility.

### 3. Files Configured

The following files have been configured:

- `public/withings-callback.html` - OAuth callback page
- `functions/src/index.ts` - Webhook handler (`withingsWebhook`)
- `firebase.json` - Hosting rewrite rule for callback page
- `lib/services/withingsService.ts` - Updated to save Withings user ID to Firestore
- `lib/firebase.ts` - Updated authDomain to use `.web.app` domain

## Testing

After registering the URLs:

1. Test OAuth flow by connecting a Withings account from the app
2. Verify the webhook is accessible:
   ```bash
   curl https://us-central1-maak-5caad.cloudfunctions.net/withingsWebhook
   ```
3. Check Firestore for webhook events in the `withingsWebhooks` collection

## Notes

- The webhook endpoint returns 200 OK even if user is not found to prevent Withings from retrying
- Webhook events are stored in Firestore for async processing
- The Withings user ID is stored in the user document for webhook matching
