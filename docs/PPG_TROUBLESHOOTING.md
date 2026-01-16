# PPG Vital Monitor Troubleshooting

## Issue: "Insufficient frames captured: 0/3600"

### Problem Description
After 60 seconds of capturing, the PPG vital monitor shows an error: "insufficient frames captured: 0/3600 please try again". This means **no frames were extracted** during the entire measurement period.

### Root Cause
The frame processor wasn't properly configured in the Babel configuration. React Native Vision Camera requires the `react-native-worklets-core` Babel plugin to enable frame processors.

### Solution

#### 1. Fixed Babel Configuration
Updated `babel.config.js` to include the worklets plugin:

```javascript
plugins: [
  // VisionCamera frame processor plugin - must come before reanimated
  [
    "react-native-worklets-core/plugin",
    {
      // Enable worklet support for frame processors
    }
  ],
  // Reanimated plugin must be last in the plugins array
  "react-native-reanimated/plugin",
]
```

#### 2. Clear Build Cache and Rebuild
After updating the Babel configuration, you **MUST** clear the cache and rebuild:

```powershell
# Clear Metro bundler cache
npx expo start --clear

# Or for development build
npm run dev:clear

# If that doesn't work, delete node_modules and reinstall
rm -rf node_modules
npm install
```

For a **development build** (EAS or local), you need to rebuild the native app:

```powershell
# For iOS
npm run build:ios:dev

# For Android
npm run build:android:dev
```

#### 3. Added Debug Logging
Added comprehensive debug logging to help diagnose frame extraction issues:

- `PPGPixelExtractor.ts`: Logs which extraction method succeeds/fails
- `PPGVitalMonitorVisionCamera.tsx`: Logs frame processing status

Check the console output to see:
- `[PPG] Frame processor CALLED` - Frame processor is being invoked
- `[PPG] Frame dimensions valid: 640 x 480` - Frame has valid dimensions
- `[PPG] Extraction successful via getPlaneData-Y - value: 128` - Pixel data extracted successfully

### How Frame Extraction Works

The PPG pixel extractor tries multiple methods to access camera frame data (in order):

1. **getNativeBuffer()** - Nitro Modules API (v4+)
2. **toArrayBuffer()** - Legacy API (v3)
3. **getPlaneData()** - Plane-based access (v4 API) ✅ Most likely to work
4. **planes array** - Direct plane access

For most devices, **getPlaneData()** with Y-plane (luminance) extraction works best.

### Expected Behavior After Fix

Once fixed, you should see in the console:
```
[PPG] Frame processor CALLED - first frame
[PPG] Processing frame 0 at time 1737051234567
[PPG] Frame dimensions valid: 640 x 480
[PPG] Trying getPlaneData method...
[PPG] getPlaneData success, Y plane length: 307200
[PPG] Only Y plane available, using luminance
[PPG] Extraction successful via getPlaneData-Y - value: 142
[PPG] Valid frame data, processing...
```

And the measurement will complete successfully with captured frames:
```
Capturing 840/840 frames at 14 fps • 60s/60s
```

### Common Issues

#### Issue: "Frame processor not called"
**Cause**: Babel plugin not configured or cache not cleared  
**Fix**: Add worklets plugin to babel.config.js, clear cache, rebuild

#### Issue: "All extraction methods failed"
**Cause**: Camera format not supported or permissions issue  
**Fix**: Ensure camera permission granted, try different pixel format

#### Issue: "Signal quality too low"
**Cause**: Finger not properly covering camera or excessive movement  
**Fix**: Ensure finger completely covers back camera and flash, hold still

### Development vs Production

- **Expo Go**: ❌ Does NOT support frame processors (frame processing requires native modules)
- **Development Build**: ✅ Full support with proper babel config
- **Production Build**: ✅ Full support

### Required Dependencies

```json
{
  "react-native-vision-camera": "^4.7.3",
  "react-native-worklets-core": "^1.4.0",
  "react-native-reanimated": "3.16.7"
}
```

### Testing the Fix

1. Clear cache and rebuild
2. Open the PPG monitor
3. Place finger on back camera
4. Start measurement
5. Check console for `[PPG]` debug logs
6. Should see frames being captured: "Capturing X/840 frames..."
7. After 60 seconds, should show heart rate result

### Additional Notes

- The frame extraction returns `-1` when it fails, which is properly rejected
- This prevents using fake/simulated data (scientific accuracy requirement)
- Signal quality validation ensures only real PPG data is used
- Minimum 50% of target frames required for valid measurement

### Technical Details

#### Frame Processor Pipeline
1. Camera captures frame at 14-30 fps
2. Frame processor invoked with Frame object
3. Pixel extractor accesses frame buffer data
4. Red channel (or Y-plane luminance) extracted
5. Value validated (0-255 range)
6. Added to PPG signal array
7. Signal processed using BiometricUtils algorithms

#### Validation Steps
- Frame dimensions must be valid (> 0)
- Extracted value must be in 0-255 range
- Signal must show variation (not flat line)
- Minimum frame count required (50% of target)
- Signal quality score must exceed threshold

## Support

If issues persist after following these steps:

1. Check that you're using a development build (not Expo Go)
2. Verify camera permissions are granted
3. Check console logs for specific error messages
4. Ensure device has a working back camera with flash
5. Try on a different device to rule out hardware issues
