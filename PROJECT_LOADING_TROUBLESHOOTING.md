# Project Loading Troubleshooting Guide

If you're experiencing issues loading the Maak Health project, follow these steps:

## Quick Fixes

### 1. Install Dependencies
```bash
# Using npm
npm install

# Using bun (recommended, as project uses bun.lock)
bun install

# Using yarn
yarn install
```

### 2. Clear Cache and Reinstall
```bash
# Clear Metro bundler cache
npm run dev:clear
# or
expo start --dev-client --clear

# If that doesn't work, try:
rm -rf node_modules
rm -rf .expo
npm install
# or
bun install
```

### 3. Check Node.js Version
This project requires Node.js 18+:
```bash
node --version
# Should be v18.x.x or higher
```

### 4. Environment Variables (Optional)
While not strictly required for basic loading, create a `.env` file for full functionality:

```env
# OpenAI API Configuration (optional - for AI assistant)
OPENAI_API_KEY=your_openai_api_key_here

# Fitbit API Configuration (optional - for Fitbit integration)
FITBIT_CLIENT_ID=your_fitbit_client_id_here
FITBIT_CLIENT_SECRET=your_fitbit_client_secret_here
```

Note: The app will work without these, but some features (AI assistant, Fitbit) won't function.

## Common Issues

### Issue: "Cannot find module" errors
**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules
bun install
# or npm install
```

### Issue: TypeScript errors
**Solution:**
```bash
# Check TypeScript version
npx tsc --version

# Clear TypeScript cache
rm -rf .expo
rm -rf node_modules/.cache
```

### Issue: Metro bundler errors
**Solution:**
```bash
# Clear Metro cache
expo start --dev-client --clear

# Or manually:
rm -rf .expo
rm -rf node_modules/.cache
```

### Issue: Native module errors (iOS/Android)
**Solution:**
```bash
# For iOS
cd ios
pod install
cd ..

# For Android - rebuild native modules
npx expo prebuild --clean
```

### Issue: Expo CLI not found
**Solution:**
```bash
# Install Expo CLI globally
npm install -g expo-cli

# Or use npx
npx expo start --dev-client
```

## IDE-Specific Issues

### VS Code / Cursor
1. **Reload Window**: `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) → "Reload Window"
2. **Install Extensions**:
   - ESLint
   - Prettier
   - TypeScript and JavaScript Language Features
3. **Restart TypeScript Server**: `Ctrl+Shift+P` → "TypeScript: Restart TS Server"

### WebStorm / IntelliJ
1. **Invalidate Caches**: File → Invalidate Caches → Invalidate and Restart
2. **Reimport Project**: File → Reload Project from Disk

## Verify Project Setup

Run these commands to verify everything is set up correctly:

```bash
# Check if dependencies are installed
ls node_modules | head -5

# Check if Expo is working
npx expo --version

# Check TypeScript compilation
npx tsc --noEmit

# Check for linting errors
npx biome check .
```

## Start the Development Server

Once dependencies are installed:

```bash
# Start Expo dev server
npm run dev
# or
bun run dev
# or
expo start --dev-client
```

## Still Having Issues?

1. **Check Error Messages**: Look at the terminal/console output for specific error messages
2. **Check Logs**: Look for error logs in `.expo` folder or Metro bundler output
3. **Verify File Structure**: Ensure all files from the repository are present
4. **Check Git Status**: Ensure you're on the correct branch and have latest changes

## Platform-Specific Setup

### iOS Development
- Requires Xcode installed
- Requires CocoaPods: `sudo gem install cocoapods`
- Run: `cd ios && pod install && cd ..`

### Android Development
- Requires Android Studio installed
- Requires Android SDK configured
- Run: `npx expo prebuild --platform android`

## Need More Help?

If you're still experiencing issues, please provide:
1. The exact error message you're seeing
2. Your Node.js version (`node --version`)
3. Your operating system
4. Whether you're trying to run on iOS, Android, or Web
5. The output of `npx expo --version`

