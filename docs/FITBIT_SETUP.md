# Fitbit Integration Setup

This document outlines the URLs that need to be registered with Fitbit for OAuth2 services.

## Registered URLs for Fitbit

### OAuth2 Redirect URL

**Register this URL in your Fitbit developer account for OAuth2 authentication:**

```
https://maak-5caad.web.app/fitbit-callback
```

**Important:** This is the primary callback URL that Fitbit will redirect to after OAuth authorization. The web page will then redirect to the app via deep link (`maak://fitbit-callback`).

### Webhook Subscription URL (Optional)

**For real-time data updates, register this webhook URL:**

```
https://us-central1-maak-5caad.cloudfunctions.net/fitbitWebhook
```

**Alternative URL (also works):**
```
https://fitbitwebhook-rqd3fq3w3q-uc.a.run.app
```

**Note:** Fitbit webhooks are optional and require manual subscription via API. The webhook URL is automatically available after deployment. To subscribe to webhooks, you'll need to make API calls to Fitbit's subscription endpoint after OAuth completes.

**Important:** Use the standard Cloud Functions URL (`https://us-central1-maak-5caad.cloudfunctions.net/fitbitWebhook`) for consistency and easier management. Both URLs work identically.

## Setup Steps

1. **Log in to Fitbit Developer Portal:**
   - Go to https://dev.fitbit.com/
   - Navigate to your application settings

2. **Register OAuth2 Redirect URL:**
   - Add the web callback URL: `https://maak-5caad.web.app/fitbit-callback`
   - This is the URL that Fitbit will redirect to after OAuth authorization
   - The web page will then redirect to the app via deep link (`maak://fitbit-callback`)

3. **API Endpoint:**
   - Authorization endpoint: `https://www.fitbit.com/oauth2/authorize`
   - Token endpoint: `https://api.fitbit.com/oauth2/token`
   - API base: `https://api.fitbit.com/1`

## How It Works

### OAuth Flow
1. User initiates Fitbit connection from the app
2. App generates PKCE verifier and challenge
3. User is redirected to Fitbit authorization page
4. After authorization, Fitbit redirects to the registered callback URL
5. The callback page extracts the authorization code and redirects to the app via deep link
6. The app exchanges the code for access/refresh tokens using PKCE verifier

### PKCE (Proof Key for Code Exchange)
Fitbit uses PKCE for enhanced security:
- App generates a random verifier (43-128 characters)
- App creates a SHA256 hash (challenge) of the verifier
- Challenge is sent in authorization request
- Verifier is sent in token exchange request
- Fitbit validates that the verifier matches the challenge

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

### 2. Files Configured

The following files have been configured:

- `public/fitbit-callback.html` - OAuth callback page
- `firebase.json` - Hosting rewrite rule for callback page
- `lib/services/fitbitService.ts` - OAuth flow with PKCE support
- `lib/firebase.ts` - Updated authDomain to use `.web.app` domain

## Webhook Setup (Optional)

Fitbit webhooks allow real-time notifications when new data is available. The webhook function has been deployed and is available at:

```
https://fitbitwebhook-rqd3fq3w3q-uc.a.run.app
```

### Webhook Subscription

To subscribe to Fitbit webhooks, you need to make API calls to Fitbit's subscription endpoint after OAuth completes. The webhook will receive notifications for:
- Activities
- Body measurements
- Foods
- Sleep data

**Note:** Fitbit webhook subscriptions are optional. The app can still sync data manually without webhooks.

## Testing

After registering the URLs:

1. Test OAuth flow by connecting a Fitbit account from the app
2. Verify the callback URL is accessible:
   ```bash
   curl https://maak-5caad.web.app/fitbit-callback
   ```
3. Verify the webhook endpoint is accessible:
   ```bash
   curl https://fitbitwebhook-rqd3fq3w3q-uc.a.run.app
   ```
4. Check that PKCE flow works correctly (verifier/challenge validation)
5. Check Firestore for webhook events in the `fitbitWebhooks` collection (if webhooks are subscribed)

## Notes

- Fitbit requires PKCE (Proof Key for Code Exchange) for OAuth2
- The PKCE verifier is stored securely using SecureStore
- The callback URL must be registered exactly as shown (HTTPS, no trailing slash)
- Fitbit uses space-separated scopes (not comma-separated like some providers)
