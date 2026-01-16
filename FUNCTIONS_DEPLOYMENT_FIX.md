# Firebase Functions Deployment Fix

## Issues Fixed

### 1. Peer Dependency Conflicts
- **Problem**: `lucide-react-native@0.400.0` requires React ^16.5.1 || ^17.0.0 || ^18.0.0, but React 19.1.0 is installed
- **Solution**: Added `overrides` in `package.json` to force `lucide-react-native` to accept React 19.1.0

### 2. Functions Package Dependencies
- **Problem**: `functions/package.json` included React, React Native, and Expo dependencies that shouldn't be in Firebase Functions
- **Solution**: Removed all React/React Native/Expo dependencies from `functions/package.json`
- **Kept**: Only Firebase-specific dependencies (`firebase-admin`, `firebase-functions`)

### 3. Start Script for Cloud Run
- **Problem**: Start script was set to `npm run shell` which executes a bash script instead of starting a web server
- **Solution**: Changed to `node lib/index.js` which properly starts the function server

### 4. Predeploy Script
- **Problem**: Used `bun run build` but Firebase Functions uses npm
- **Solution**: Changed to `npm run build`

### 5. Root Dependencies Being Deployed
- **Problem**: Root `node_modules` with React Native dependencies were being included in Functions deployment
- **Solution**: Created `functions/.gcloudignore` to exclude root dependencies and app files

## Files Modified

1. **package.json**
   - Added `overrides` for `lucide-react-native` to work with React 19

2. **functions/package.json**
   - Removed: `expo`, `expo-dev-client`, `expo-file-system`, `expo-image-picker`, `expo-print`, `expo-sharing`, `react`, `react-native`
   - Removed: `android` and `ios` scripts
   - Updated: `start` script to use `node lib/index.js`

3. **firebase.json**
   - Changed predeploy from `bun run build` to `npm run build`

4. **functions/.gcloudignore** (NEW)
   - Excludes root `node_modules`, app files, and React Native dependencies from deployment

## Testing

After these changes, Firebase Functions deployment should:
1. ✅ Only install Node.js dependencies (no React Native)
2. ✅ Build successfully without peer dependency conflicts
3. ✅ Start properly as a web server for Cloud Run
4. ✅ Not include unnecessary root dependencies

## Deployment Command

```bash
firebase deploy --only functions
```

## Notes

- The root `package.json` still has React 19 and all React Native dependencies (this is correct for the mobile app)
- The `functions/package.json` now only has Firebase dependencies (this is correct for Cloud Functions)
- The `.gcloudignore` ensures root dependencies don't get deployed with Functions
