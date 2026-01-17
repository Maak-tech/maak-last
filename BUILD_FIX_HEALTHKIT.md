# Fix for React Native HealthKit Build Error

## Problem
The iOS build was failing with:
```
'Bridge.h' file not found
could not build Objective-C module 'ReactNativeHealthkit'
```

## Root Cause
When using `use_frameworks! :linkage => :static` in the Podfile (required for Firebase Swift pods), React Native headers are packaged differently. The `@kingstinct/react-native-healthkit` module couldn't find the `Bridge.h` header file because it was looking in the wrong locations.

## Solution Applied

### 1. Updated `plugins/withFollyFix.js`
Patch the HealthKit podspec during prebuild so CocoaPods stops exporting/importing internal headers:
- Patch `node_modules/@kingstinct/react-native-healthkit/ReactNativeHealthkit.podspec`
- Exclude `ios/Bridge.h` from `public_header_files` and mark it as `private_header_files`
- This prevents CocoaPods from generating an umbrella header that tries to `#import "Bridge.h"` (which was failing in EAS)

### 2. Updated `app.config.js`
Enhanced `expo-build-properties` configuration:
- Set explicit deployment target (`15.1`)
- Configured `useFrameworks: "static"` for Firebase compatibility
- Enabled `buildReactNativeFromSource: true`

## Files Modified
1. `plugins/withFollyFix.js` - Enhanced header search paths
2. `app.config.js` - Updated iOS build properties

## How It Works
The `withFollyFix` plugin runs during `expo prebuild` and modifies the generated Podfile to:
1. Patch the HealthKit podspec before CocoaPods runs so the generated umbrella header no longer imports `Bridge.h`
2. Apply the folly coroutine fix for `react-native-reanimated`

The key fix is that CocoaPods was generating `ReactNativeHealthkit-umbrella.h` with `#import "Bridge.h"`. By excluding `Bridge.h` from the pod’s public headers, CocoaPods stops including it in the umbrella header and the module can compile under EAS.

## Testing
After these changes:
1. Run `expo prebuild --clean` locally to verify the Podfile is generated correctly
2. Push to trigger a new EAS build
3. The build should complete successfully

## Alternative Solutions (if this doesn't work)
If the issue persists, consider:
1. Downgrading `@kingstinct/react-native-healthkit` to an older version
2. Using a fork of the library with proper header imports
3. Switching to `use_modular_headers!` instead of static frameworks (may conflict with Firebase)

## Related Issues
- React Native static frameworks and modular headers: https://github.com/facebook/react-native/issues/32039
- HealthKit module compatibility: https://github.com/Kingstinct/react-native-healthkit/issues

## Build Command
```bash
eas build --platform ios --profile production
```
