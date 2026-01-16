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
Added more comprehensive React Native header search paths:
- Added `React_Core.framework/Headers` path (alternative naming)
- Added Private headers path
- Added direct node_modules paths as fallback
- Added SRCROOT-relative paths

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
1. Comment out C++ headers from the ReactNativeHealthkit umbrella header (these cause build failures):
   - `Bridge.h` (C++ bridge header)
   - `AggregationStyle.hpp` (C++ header)
   - `AuthDataTypes.hpp` (C++ header)
   - `QueryDataTypes.hpp` (C++ header)
   
   **Note**: `ExceptionCatcher.h` is kept in the umbrella header because it's needed by Swift files (`Helpers.swift` uses `HKUnitFromStringCatchingExceptions`).
2. Add comprehensive header search paths for ReactNativeHealthkit (including recursive paths with `/**`)
3. Add React Native header search paths for all pod targets (for static frameworks)
4. Enable `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES` for all targets
5. Set `USER_HEADER_SEARCH_PATHS` specifically for ReactNativeHealthkit
6. Enable `USE_HEADERMAP` and `ALWAYS_SEARCH_USER_PATHS` for ReactNativeHealthkit

The key fix is that the umbrella header was trying to import internal C++ implementation headers that:
- Should not be in a public umbrella header
- Cause build failures when using static frameworks
- Are only needed internally by the module's implementation files

By commenting out these imports in the umbrella header and ensuring proper header search paths, the module can build successfully.

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
