# Runtime Module Registration Issue

## Problem Identified
Build logs show:
- ✅ Pod installed: `Installing RNAppleHealthKit (1.7.0)`
- ✅ Module found: `react-native-health` detected
- ❌ Auto-linking skipped: Not in final linked modules list
- ❌ Runtime: `NativeModules` shows 0 modules

## Root Cause
The pod is installed and compiled, but React Native's auto-linking didn't include it in the linked modules. This means:
1. Native code is compiled ✅
2. Pod is installed ✅
3. But React Native bridge doesn't know about it ❌
4. So it doesn't register in `NativeModules` ❌

## The Module Name Issue
- Native module registers as: `RCTAppleHealthKit` (from `RCT_EXPORT_MODULE()`)
- JavaScript expects: `AppleHealthKit` (from `NativeModules`)
- React Native should auto-strip `RCT` prefix, but it's not happening

## Solution Applied

### 1. Updated Module Name Checks
Updated `appleHealthService.ts` to check for multiple possible names:
- `RCTAppleHealthKit`
- `AppleHealthKit`
- `RNFitness`
- `RNAppleHealthKit`

### 2. Updated Debug Screen
Added checks for all possible module names in the debug screen.

### 3. Plugin Fix
Updated `withHealthKitFix.js` to always add explicit pod reference, even if `use_native_modules!` is present.

## Next Steps

### Immediate Action
The build is compiling correctly, but modules aren't registering at runtime. This suggests:

1. **Bridge initialization issue** - Modules might not be registering before we check
2. **Module name mismatch** - The module might be registered under a different name
3. **Auto-linking failure** - React Native isn't linking the module properly

### Test After Rebuild
After rebuilding with the updated code:
1. Run debug screen
2. Check if modules are now registered
3. Try authorizing HealthKit again

## Expected Behavior
After fix:
- Debug screen should show modules registered (even if not 30+, at least some)
- `AppleHealthKit` should be accessible from `NativeModules`
- Authorization should work without "invokeinner" errors

