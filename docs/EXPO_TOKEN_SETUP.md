# Setting Up EXPO_TOKEN for GitHub Actions

The `eas token:create` command doesn't exist. Here's how to get an Expo access token for GitHub Actions:

## Quick Steps

1. **Go to Expo Dashboard:**
   - Visit: https://expo.dev/accounts/[your-account]/settings/access-tokens
   - Replace `[your-account]` with your Expo username or organization name

2. **Create a New Token:**
   - Click **Create Token** button
   - Give it a descriptive name (e.g., "GitHub Actions - Development")
   - Click **Create**

3. **Copy the Token:**
   - ⚠️ **Important:** Copy the token immediately - you won't be able to see it again!
   - The token will look like: `exp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

4. **Add to GitHub Secrets:**
   - Go to your repository: **Settings** → **Environments** → **Development** → **Secrets**
   - Click **Add secret**
   - Name: `EXPO_TOKEN`
   - Value: [paste the token you copied]
   - Click **Add secret**

## Alternative: Find Your Account URL

If you're not sure of your account URL:

1. Run: `eas whoami` to see your username
2. Or visit: https://expo.dev/accounts/ and find your account
3. Then go to Settings → Access Tokens

## Verify Token Works

After adding the token, test it by:

1. Pushing to `develop` branch (triggers the workflow)
2. Or manually trigger the workflow: **Actions** → **Development Deployment** → **Run workflow**

## Troubleshooting

### "Authentication failed" error
- Verify the token was copied correctly (no extra spaces)
- Check the token hasn't expired (tokens don't expire, but can be revoked)
- Ensure token is added to the correct environment (Development)

### "Token not found" error
- Verify secret name is exactly `EXPO_TOKEN` (case-sensitive)
- Check you're using the correct environment in the workflow (`environment: development`)

## Security Notes

- ✅ Tokens are scoped to your account/organization
- ✅ You can revoke tokens anytime from the dashboard
- ✅ Use different tokens for different environments (dev/staging/prod)
- ✅ Never commit tokens to your repository

## Related Documentation

- See `.github/workflows/README.md` for workflow setup
- See `docs/SECRETS_SETUP.md` for complete secrets guide
