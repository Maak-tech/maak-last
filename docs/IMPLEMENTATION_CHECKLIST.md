# Real PPG Implementation Checklist

This checklist guides you through completing the real PPG implementation.

## ✅ Completed

- [x] Install react-native-vision-camera and dependencies
- [x] Update app.config.js with camera permissions
- [x] Create PPGVitalMonitorVisionCamera component
- [x] Create PPG frame processor utilities
- [x] Create pixel extractor module
- [x] Add setup documentation

## 🔧 To Complete

### 1. Implement Actual Pixel Extraction

**File**: `lib/utils/PPGPixelExtractor.ts`

**Current Status**: Placeholder returning 128

**Action Required**:
```typescript
// Replace the placeholder in extractRedChannelAverage():
export function extractRedChannelAverage(frame: Frame): number {
  'worklet';
  
  // TODO: Implement one of these methods:
  
  // Option A: Using toArrayBuffer() (if available)
  const buffer = frame.toArrayBuffer();
  const data = new Uint8Array(buffer);
  return extractRedFromYUVBuffer(data, frame.width, frame.height, ...);
  
  // Option B: Create native frame processor plugin (recommended for production)
  // See: https://react-native-vision-camera.com/docs/guides/frame-processors-plugins-overview
}
```

**Resources**:
- react-native-vision-camera docs: https://react-native-vision-camera.com/
- Frame processor guide: https://react-native-vision-camera.com/docs/guides/frame-processors
- Example plugins: https://github.com/mrousavy/react-native-vision-camera/tree/main/package/example

### 2. Update Component to Use Pixel Extractor

**File**: `components/PPGVitalMonitorVisionCamera.tsx`

**Current Status**: Using placeholder brightness value

**Action Required**:
```typescript
// Replace the frameProcessor implementation:
import { extractRedChannelAverage } from '@/lib/utils/PPGPixelExtractor';

const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  
  if (!isCapturingRef.current) return;
  
  const now = Date.now();
  if (now - lastFrameTimeRef.current < FRAME_INTERVAL_MS) return;
  
  lastFrameTimeRef.current = now;
  
  // Use real pixel extraction
  const redAverage = extractRedChannelAverage(frame);
  
  runOnJS(processPPGFrameData)(redAverage, frameCountRef.current);
  frameCountRef.current++;
}, [isCapturingRef]);
```

### 3. Build Native Development Build

**Required**: react-native-vision-camera needs native code

**Commands**:
```bash
# iOS
eas build -p ios --profile development

# Android
eas build -p android --profile development

# Or local builds (if configured)
npm run ios
npm run android
```

**Note**: This will NOT work in Expo Go. You must use a development build.

### 4. Test and Validate

**Test Cases**:

1. **Basic Functionality**
   - [ ] Camera opens and shows preview
   - [ ] Frame processor runs without errors
   - [ ] Captures 840 frames in 60 seconds
   - [ ] Displays heart rate result

2. **Signal Quality**
   - [ ] Detects when finger is not on camera
   - [ ] Rejects measurements with poor signal
   - [ ] Shows signal quality indicator
   - [ ] Handles lighting variations

3. **Accuracy**
   - [ ] Compare with pulse oximeter (±3 BPM)
   - [ ] Compare with Apple Watch / Fitbit
   - [ ] Test with different users
   - [ ] Test in different lighting conditions

4. **Edge Cases**
   - [ ] No finger on camera
   - [ ] Finger removed during measurement
   - [ ] Camera blocked by case
   - [ ] Very dark or bright environments
   - [ ] User moves during measurement

### 5. Replace Old Component

**Files to Update**:

Find all usages of the old simulated component:

```bash
# Search for imports
grep -r "from \"@/components/PPGVitalMonitor\"" .

# Common files that might use it:
# - app/(tabs)/health.tsx
# - app/(tabs)/profile.tsx
# - components/AdaptiveBiometricAuth.js
```

**Replace**:
```typescript
// Old
import PPGVitalMonitor from "@/components/PPGVitalMonitor";

// New
import PPGVitalMonitor from "@/components/PPGVitalMonitorVisionCamera";
```

### 6. Optimize Performance

**Optimizations to Consider**:

1. **Frame Processing**
   - [ ] Reduce sample area if performance is poor
   - [ ] Adjust sample step size (currently 4)
   - [ ] Consider native plugin for pixel extraction

2. **Memory Management**
   - [ ] Clear frame buffers after processing
   - [ ] Limit signal array size
   - [ ] Release camera resources on unmount

3. **Battery Usage**
   - [ ] Profile battery consumption
   - [ ] Consider reducing measurement duration
   - [ ] Add power-saving mode

### 7. Add User Feedback

**UI Improvements**:

1. **Real-time Feedback**
   - [ ] Show live signal waveform
   - [ ] Display signal quality meter
   - [ ] Show frame capture progress
   - [ ] Indicate when finger is detected

2. **Error Messages**
   - [ ] Specific guidance for each error type
   - [ ] Visual indicators for finger placement
   - [ ] Retry suggestions

3. **Results Display**
   - [ ] Confidence score
   - [ ] Signal quality rating
   - [ ] Comparison with previous measurements
   - [ ] Export/share results

### 8. Production Readiness

**Before Production Release**:

1. **Testing**
   - [ ] Clinical validation (if required)
   - [ ] Accuracy testing with diverse users
   - [ ] Stress testing (1000+ measurements)
   - [ ] Cross-platform testing (iOS + Android)

2. **Documentation**
   - [ ] User guide for taking measurements
   - [ ] Troubleshooting guide
   - [ ] API documentation
   - [ ] Privacy policy update (camera usage)

3. **Compliance**
   - [ ] Medical device regulations (if applicable)
   - [ ] FDA/CE certification (if needed)
   - [ ] Privacy compliance (HIPAA, GDPR)
   - [ ] App store guidelines

4. **Monitoring**
   - [ ] Error tracking (Sentry, etc.)
   - [ ] Analytics for usage patterns
   - [ ] Success rate monitoring
   - [ ] Performance metrics

## 🚀 Quick Start

To get started immediately:

1. **Build Development Build**
   ```bash
   eas build -p ios --profile development
   ```

2. **Install on Device**
   ```bash
   # Download and install the build from EAS
   ```

3. **Test Basic Functionality**
   - Open app
   - Navigate to vital signs monitor
   - Place finger on front camera
   - Verify camera preview shows
   - Check console for frame processor logs

4. **Implement Pixel Extraction**
   - Follow step 1 above
   - Test with real measurements
   - Compare with known heart rate

## 📚 Resources

- **react-native-vision-camera**: https://react-native-vision-camera.com/
- **Frame Processors**: https://react-native-vision-camera.com/docs/guides/frame-processors
- **PPG Research**: Olugbenle et al. (arXiv:2412.07082v1)
- **Setup Guide**: `docs/PPG_SETUP.md`

## 🆘 Getting Help

If you encounter issues:

1. Check the setup guide: `docs/PPG_SETUP.md`
2. Review react-native-vision-camera docs
3. Check example projects on GitHub
4. Test with simulated component first to isolate issues

## 📝 Notes

- The simulated component (`PPGVitalMonitor.tsx`) can remain for testing/demo
- Real PPG requires device camera - won't work on web or simulators
- Frame processors must run on worklet thread (use 'worklet' directive)
- Pixel extraction is the most critical part - test thoroughly

