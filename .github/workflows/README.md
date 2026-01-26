# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD automation.

## Available Workflows

### `development.yml`
Deploys to the Development environment when code is pushed to `develop` or `dev` branches.

**What it does:**
- ✅ Validates environment setup
- ✅ Deploys Firebase Functions (on push only)
- ✅ Creates EAS builds for development (on push only)

**Triggers:**
- Push to `develop` or `dev` branches
- Pull requests to `develop` or `dev` branches (validation only)
- Manual trigger via GitHub Actions UI

## Required Secrets

### Development Environment Secrets

Set these in: **Settings** → **Environments** → **Development** → **Secrets**

#### Required:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `OPENAI_API_KEY`

#### Optional (for Firebase Functions deployment):
- `FIREBASE_TOKEN` - Firebase CLI token (get via `firebase login:ci`)
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Base64-encoded service account JSON (alternative to token)

#### Required (for EAS builds):
- `EXPO_TOKEN` - Expo access token (get via `eas login` then `eas token:create`)

### Repository-Level Secrets

These can also be set at repository level (Settings → Secrets → Actions) and will be used as fallback if not found in the Development environment.

## Setting Up EXPO_TOKEN

To enable EAS builds in GitHub Actions, you need to create an Expo access token.

**📚 See the detailed guide:** [`docs/EXPO_TOKEN_SETUP.md`](../../docs/EXPO_TOKEN_SETUP.md)

**Quick steps:**
1. Go to: https://expo.dev/accounts/[your-account]/settings/access-tokens
2. Click **Create Token** and give it a name
3. Copy the token immediately (you won't see it again!)
4. Add to GitHub: **Settings** → **Environments** → **Development** → **Secrets**
   - Name: `EXPO_TOKEN`
   - Value: [paste token]

**Note:** The `expo/expo-github-action` handles authentication automatically when you provide the `EXPO_TOKEN` secret.

## Setting Up Firebase Token

For Firebase Functions deployment:

```bash
# Login to Firebase
firebase login

# Generate CI token
firebase login:ci

# Copy the token and add to GitHub Secrets:
# Settings → Environments → Development → Secrets → Add secret
# Name: FIREBASE_TOKEN
# Value: [paste token]
```

## Environment Protection Rules

You can configure protection rules for the Development environment:

1. Go to: **Settings** → **Environments** → **Development**
2. Configure:
   - **Required reviewers**: Require approval before deployment
   - **Deployment branches**: Only allow deployments from specific branches
   - **Wait timer**: Add delay before deployment

## Customizing Workflows

### Adding More Environments

Create new workflow files for other environments:
- `staging.yml` - For staging deployments
- `production.yml` - For production deployments

Each should use its corresponding environment:
```yaml
environment: staging  # or production
```

### Modifying Triggers

Edit the `on:` section in the workflow file to change when it runs:

```yaml
on:
  push:
    branches: [main]  # Change branch
  schedule:
    - cron: '0 0 * * *'  # Run daily at midnight
```

## Testing Workflows

1. **Test locally** (using act or similar):
   ```bash
   # Install act: https://github.com/nektos/act
   act -W .github/workflows/development.yml
   ```

2. **Test on GitHub**:
   - Push to `develop` branch to trigger automatically
   - Or use "Run workflow" button in GitHub Actions tab

## Troubleshooting

### Workflow fails with "Secret not found"
- Verify secret is set in the correct environment
- Check secret name matches exactly (case-sensitive)
- Ensure workflow uses `environment: development`

### EAS build fails
- Verify `EXPO_TOKEN` is set correctly
- Check EAS secrets are configured: `eas secret:list`
- Ensure EAS project is linked: `eas project:info`

### Firebase deployment fails
- Verify `FIREBASE_TOKEN` or `FIREBASE_SERVICE_ACCOUNT_KEY` is set
- Check Firebase project ID matches
- Ensure Firebase CLI is authenticated

## Next Steps

1. ✅ Add all required secrets to Development environment
2. ✅ Set up `EXPO_TOKEN` for EAS builds
3. ✅ Set up `FIREBASE_TOKEN` for Functions deployment
4. ✅ Test workflow by pushing to `develop` branch
5. ✅ Create additional environments (staging, production) as needed
