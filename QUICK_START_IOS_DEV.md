# Quick Start: iOS Development Build on Physical iPhone

## ✅ Current Status

- ✅ EAS CLI installed (v16.28.0)
- ✅ Logged in as: `nour_maak`
- ✅ Dev server starting...
- ⏳ iOS build needs to be started (requires interactive Apple login)

## 🚀 Next Steps

### Step 1: Build the iOS Development App

The build command requires interactive Apple account login. Run this in your terminal:

```bash
bun run build:ios:dev
```

**When prompted:**
- Choose to log in to your Apple account (recommended)
- Enter your Apple ID credentials
- EAS will handle certificate and provisioning profile creation automatically

**Build will take:** 8-15 minutes

**Monitor progress:**
- Check build status: `bun run build:list`
- View build logs: `eas build:logs [BUILD_ID]`

### Step 2: Dev Server is Running

The Expo dev server should now be running. Look for output like:

```
Metro waiting on exp://192.168.1.5:8081
```

**Your connection URL:** `exp://192.168.1.5:8081`

### Step 3: Install Build on iPhone

After the build completes:

1. **Download the build:**
   ```bash
   bun run build:list
   ```
   - Click the download link for the completed build
   - Or download from: https://expo.dev/accounts/nour_maak/projects/maak-health/builds

2. **Install on iPhone:**

   **Option A: TestFlight (Recommended)**
   ```bash
   eas submit -p ios --profile development
   ```
   Then install TestFlight app on iPhone and install from there.

   **Option B: Direct Install**
   - Download the `.ipa` file
   - Use Apple Configurator 2 (Mac) or 3uTools/iMazing (Windows)
   - Drag `.ipa` onto your connected iPhone

### Step 4: Connect iPhone to Dev Server

1. **Ensure iPhone and computer are on the same Wi-Fi network**

2. **Open the development app** on your iPhone (the one you just installed)

3. **Enter connection URL:**
   ```
   exp://192.168.1.5:8081
   ```
   (Or scan the QR code from the terminal)

4. **The app will connect and load your code!**

## 🔧 Troubleshooting

### If Dev Server Isn't Running

```bash
# Start dev server
bun run dev

# Or with cache clear
bun run dev:clear
```

### If Build Fails

```bash
# Clear credentials and reconfigure
eas credentials -p ios --clear-all
eas credentials -p ios

# Then rebuild
bun run build:ios:dev
```

### If iPhone Can't Connect

1. **Check firewall:** Windows Firewall may block port 8081
   - Allow Node.js through firewall
   - Or temporarily disable for testing

2. **Verify IP:** Your IP is `192.168.1.5`
   - Run `ipconfig` to verify if it changed
   - Update connection URL if IP changed

3. **Try tunnel mode:**
   ```bash
   bun run dev -- --tunnel
   ```
   (Slower but works across networks)

## 📚 Full Documentation

For detailed instructions, see: `docs/IOS_DEV_BUILD_GUIDE.md`

## 🎯 Quick Commands Reference

```bash
# Build iOS development app
bun run build:ios:dev

# List builds
bun run build:list

# Start dev server
bun run dev

# Start dev server (clear cache)
bun run dev:clear

# Submit to TestFlight
eas submit -p ios --profile development
```

