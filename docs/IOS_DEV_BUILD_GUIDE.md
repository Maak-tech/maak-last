# iOS Development Build Guide - Physical Device

This guide walks you through building a development iOS build and running it on your physical iPhone (not simulator).

## Prerequisites

1. **Apple Developer Account** ($99/year) - Required for installing on physical devices
2. **EAS CLI** installed globally
3. **Expo account** logged in
4. **iPhone** connected to the same network as your development machine

## Step-by-Step Process

### Step 1: Verify EAS Setup

```bash
# Check if EAS CLI is installed
eas --version

# If not installed, install it (using npm for global install)
npm install -g @expo/eas-cli@latest
# Or with bunx (no install needed)
# bunx eas-cli --version

# Login to EAS (if not already logged in)
eas login

# Verify you're logged in
eas whoami

# Check project info
eas project:info
```

### Step 2: Configure iOS Credentials (First Time Only)

If you haven't set up iOS credentials yet:

```bash
eas credentials -p ios
```

**Select these options:**
1. **Select profile**: `development`
2. **What do you want to do?**: `Manage everything needed to build your project`
3. **Distribution Certificate**: `Let EAS handle this` (recommended)
4. **Provisioning Profile**: `Let EAS handle this` (recommended)

This will:
- Create/update development certificate
- Create/update provisioning profile for your device
- Store credentials securely in EAS

**Important**: Make sure your iPhone's UDID is registered in your Apple Developer account. EAS will handle this automatically if you have the right permissions.

### Step 3: Build the Development iOS App

```bash
# Build development iOS app
bun run build:ios:dev

# Or directly:
eas build -p ios --profile development
```

**What happens:**
- EAS builds your app in the cloud (takes 8-15 minutes)
- Build includes `expo-dev-client` for development mode
- Build is configured for physical device (not simulator)
- Build will be distributed internally

**Monitor the build:**
- The command will show a build URL
- You can also check status: `bun run build:list` or `eas build:list`
- View logs: `eas build:logs [BUILD_ID]`

### Step 4: Install the Build on Your iPhone

After the build completes, you have two options:

#### Option A: Install via TestFlight (Recommended)

1. **Check build status:**
   ```bash
   eas build:list
   ```

2. **Download the build:**
   - The build output will include a download link
   - Or download from: https://expo.dev/accounts/[your-account]/projects/[project-slug]/builds

3. **Upload to TestFlight:**
   ```bash
   # Submit to TestFlight
   eas submit -p ios --profile development
   ```
   
   Or manually:
   - Download the `.ipa` file
   - Go to App Store Connect → TestFlight
   - Upload the build
   - Add yourself as an internal tester
   - Install TestFlight app on your iPhone
   - Install the app from TestFlight

#### Option B: Install Directly (Ad Hoc Distribution)

1. **Download the `.ipa` file** from the build output
2. **Install via Apple Configurator 2** (Mac only):
   - Connect iPhone to Mac
   - Open Apple Configurator 2
   - Drag the `.ipa` file onto your device
   
   Or use **3uTools** or **iMazing** (Windows/Mac)

### Step 5: Start the Development Server

Once the app is installed on your iPhone:

```bash
# Start Expo dev server with dev client mode
bun run dev

# Or if you need to clear cache:
bun run dev:clear
```

**Important**: The dev server must be running for the app to load your code changes.

### Step 6: Connect Your iPhone to the Dev Server

1. **Make sure your iPhone and computer are on the same Wi-Fi network**

2. **Open the app on your iPhone** (the development build you just installed)

3. **The app will show a connection screen** with options:
   - **Enter URL manually**: Enter your computer's local IP address
   - **Scan QR code**: Use the QR code from the terminal
   - **Recent connections**: If you've connected before

4. **To find your computer's IP:**
   - **Windows**: Run `ipconfig` in PowerShell, look for IPv4 Address
   - **Mac/Linux**: Run `ifconfig` or `ip addr`, look for inet address

5. **Enter the connection URL** in format:
   ```
   exp://192.168.1.XXX:8081
   ```
   (Replace XXX with your actual IP address)

6. **The app will connect** and load your code!

## Troubleshooting

### Build Issues

**Build fails with certificate errors:**
```bash
# Clear and reconfigure credentials
eas credentials -p ios --clear-all
eas credentials -p ios
```

**Build succeeds but app won't install:**
- Verify your iPhone's UDID is registered
- Check that the provisioning profile includes your device
- Try rebuilding: `bun run build:ios:dev -- --clear-cache`

### Connection Issues

**App can't connect to dev server:**
1. **Check network**: Ensure iPhone and computer are on same Wi-Fi
2. **Check firewall**: Windows Firewall may block port 8081
   - Allow Node.js through firewall
   - Or temporarily disable firewall for testing
3. **Check IP address**: Use `ipconfig` to verify your current IP
4. **Try tunnel mode**: 
   ```bash
   bun run dev -- --tunnel
   ```
   (Slower but works across networks)

**App connects but shows blank screen:**
- Check Metro bundler logs in terminal
- Look for JavaScript errors
- Try clearing cache: `npm run dev:clear`

**"Unable to resolve module" errors:**
```bash
# Clear all caches and reinstall
rm -rf node_modules
bun install
bun run dev:clear
```

### App Crashes on Launch

1. **Check device logs:**
   - Connect iPhone to Mac
   - Open Console.app
   - Filter by your app name
   - Look for crash logs

2. **Common causes:**
   - Missing Firebase configuration files
   - Native module compatibility issues
   - Missing permissions in Info.plist

3. **Debug steps:**
   ```bash
   # Verify app configuration
   npx expo config --type introspect
   
   # Check for issues
   npx expo-doctor
   ```

## Quick Reference Commands

```bash
# Build development iOS app
bun run build:ios:dev

# List all builds
bun run build:list

# Start dev server
bun run dev

# Start dev server (clear cache)
bun run dev:clear

# Check EAS login
eas whoami

# View build logs
eas build:logs [BUILD_ID]

# Submit to TestFlight
eas submit -p ios --profile development
```

## Development Workflow

Once everything is set up:

1. **Make code changes** in your project
2. **Save files** - Metro bundler will reload automatically
3. **Shake your iPhone** or use dev menu to reload
4. **See changes instantly** without rebuilding!

**Note**: If you add new native dependencies, you'll need to rebuild:
```bash
bun run build:ios:dev
```

## Next Steps

- After testing, build a preview build: `bun run build:ios:preview`
- For production: `bun run build:ios:production`
- See `EAS_BUILD_GUIDE.md` for more details

