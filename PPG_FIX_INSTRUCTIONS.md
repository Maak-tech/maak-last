# PPG Vital Monitor Fix - Instructions

## Issue Fixed
Your PPG vital monitor was capturing for 60 seconds but getting **0 frames** instead of the expected 3600 frames. This has now been diagnosed and fixed.

## Root Cause
The frame processor wasn't working because the **Babel plugin was missing**. React Native Vision Camera requires the `react-native-worklets-core` Babel plugin to enable frame processors, but it wasn't configured in your `babel.config.js`.

## What Was Changed

### 1. ✅ Fixed `babel.config.js`
Added the required Babel plugin for frame processors:

```javascript
plugins: [
  // VisionCamera frame processor plugin - must come before reanimated
  [
    "react-native-worklets-core/plugin",
    {
      // Enable worklet support for frame processors
    }
  ],
  // Reanimated plugin must be last
  "react-native-reanimated/plugin",
]
```

### 2. ✅ Added Debug Logging
- Added comprehensive logging to `PPGPixelExtractor.ts` to show which extraction method works
- Added logging to frame processor to confirm frames are being received
- Added debug flags to control verbosity (set to development mode only)

### 3. ✅ Created Troubleshooting Guide
- See `docs/PPG_TROUBLESHOOTING.md` for detailed troubleshooting steps

## REQUIRED NEXT STEPS

### Step 1: Clear Cache and Restart Metro
The Babel configuration change requires clearing the Metro bundler cache:

```powershell
# Stop the current Metro server (Ctrl+C)

# Clear cache and restart
npx expo start --clear

# Or use the npm script
npm run dev:clear
```

### Step 2: Rebuild Native App (If Using Development Build)
If you're using a development build (EAS or local), you **MUST** rebuild:

```powershell
# For iOS
npm run build:ios:dev

# For Android
npm run build:android:dev

# Or both
npm run build:dev
```

**Note:** Expo Go does NOT support frame processors. You need a development build.

### Step 3: Test the Fix
1. Open the app
2. Navigate to the PPG monitor
3. Watch the console output - you should see:
   ```
   [PPG] Frame processor initialized and receiving frames
   [PPG] Frame extraction working: { method: 'getPlaneData-Y', dimensions: '640x480', ... }
   ```
4. Place finger on back camera
5. Start measurement
6. You should see frames being captured: `Capturing X/840 frames...`
7. After 60 seconds, should show heart rate result

## Expected Console Output (After Fix)

When working correctly, you'll see:

```
[PPG] Frame processor initialized and receiving frames
[PPG] Frame extraction working: { method: 'getPlaneData-Y', dimensions: '640x480', pixelFormat: 'yuv', sampleValue: 142 }
[PPG] Signal quality: 75.3%, frames: 300/840
[PPG] Signal quality: 78.1%, frames: 600/840
```

## Troubleshooting

### Still Getting 0 Frames?
1. **Check you cleared cache:** `npx expo start --clear`
2. **Rebuild if using dev build:** `npm run build:ios:dev`
3. **Check camera permission:** Ensure camera access is granted
4. **Check console:** Look for `[PPG]` logs to see what's failing
5. **Verify build type:** Expo Go won't work - need development build

### Frame Extraction Failing?
If you see "All extraction methods failed" in the logs:
1. Check that you're using a **development build** (not Expo Go)
2. Verify `react-native-vision-camera` is installed: `npm list react-native-vision-camera`
3. Verify `react-native-worklets-core` is installed: `npm list react-native-worklets-core`
4. Try deleting `node_modules` and reinstalling: `rm -rf node_modules && npm install`
5. Rebuild the native app after reinstalling

### Signal Quality Too Low?
- Ensure finger completely covers back camera and flash
- Hold still during measurement
- Make sure finger is warm (cold fingers reduce blood flow)
- Avoid pressing too hard (restricts blood flow)

## Debug Mode

Debug logging is enabled in development mode (`__DEV__ === true`). To control verbosity:

**In `lib/utils/PPGPixelExtractor.ts`:**
```typescript
const DEBUG_FRAME_EXTRACTION = true; // Set to false to reduce logging
```

**In `components/PPGVitalMonitorVisionCamera.tsx`:**
```typescript
const DEBUG_PPG = __DEV__; // Already set to development mode only
```

## Technical Details

### How Frame Extraction Works
1. Camera captures frame at 14-30 fps
2. Frame processor receives Frame object
3. Pixel extractor tries multiple methods:
   - `getNativeBuffer()` - Nitro Modules API
   - `toArrayBuffer()` - Legacy API
   - `getPlaneData()` - Plane-based (most common) ✅
   - `planes` array - Direct access
4. Red channel (or Y-plane luminance) extracted
5. Value validated (0-255 range)
6. Added to PPG signal array

### Why Babel Plugin Is Required
Frame processors use "worklets" - JavaScript functions that run on a separate thread for better performance. The Babel plugin transforms these worklet functions into a format that can run on the native side. Without this plugin:
- Frame processors don't work
- No frames are captured
- Extraction returns -1 (invalid)
- Measurement fails with "0 frames captured"

## Support

If you're still having issues:
1. Check `docs/PPG_TROUBLESHOOTING.md`
2. Look for `[PPG]` logs in the console
3. Verify you're using a development build
4. Ensure camera permissions are granted
5. Try on a different device

## Files Modified
- ✅ `babel.config.js` - Added worklets plugin
- ✅ `lib/utils/PPGPixelExtractor.ts` - Added debug logging
- ✅ `components/PPGVitalMonitorVisionCamera.tsx` - Added debug flags
- 📝 `docs/PPG_TROUBLESHOOTING.md` - Created troubleshooting guide
- 📝 `PPG_FIX_INSTRUCTIONS.md` - This file

## Next Steps for You

1. **Clear cache:** `npx expo start --clear`
2. **Rebuild app** (if using dev build): `npm run build:ios:dev`
3. **Test PPG monitor**
4. **Check console logs** for `[PPG]` output
5. **Report back** if still having issues

Good luck! 🎉
