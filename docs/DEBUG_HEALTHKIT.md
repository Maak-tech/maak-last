# HealthKit RCTModuleMethod Error Debug Guide

## Problem
`-[RCTModuleMethod invokeWithBridge:module:arguments:]` error at app startup (line 550, column 0)

## Hypothesis
The Expo plugin for `react-native-health` registers the native module at build time. When the app starts, React Native tries to initialize all registered native modules before the bridge is ready, causing the error.

## Debugging Steps Added

### 1. Startup Module Check (`app/_layout.tsx`)
- Checks if HealthKit modules are registered at app startup
- Logs all native modules available at startup
- Identifies if HealthKit-related modules are auto-registered

### 2. Load Attempt Tracking (`lib/services/healthKitDebug.ts`)
- Tracks every attempt to load HealthKit
- Records stack traces to identify callers
- Logs timestamps for timing analysis

### 3. Enhanced Logging (`lib/services/appleHealthService.ts`)
- Logs bridge readiness checks
- Logs module loading attempts
- Logs require() calls and results
- Identifies bridge errors specifically

## What to Look For in Console

### At App Startup:
```
[App Startup Debug] Checking for HealthKit module registration...
[App Startup Debug] Native modules registered at startup: X modules
[App Startup Debug] ⚠️ HealthKit-related modules found at startup: [...]
```

### When HealthKit is Loaded:
```
[HealthKit Debug] Load attempt from: ...
[HealthKit Debug] Starting HealthKit load. Time since app start: Xms
[HealthKit Debug] Checking NativeModules for registered HealthKit module...
[HealthKit Debug] Available native modules: ...
[HealthKit Debug] Calling require('react-native-health')...
```

### If Error Occurs:
```
[HealthKit Debug] BRIDGE ERROR DETECTED! Module may be registered but bridge not ready.
```

## Testing Instructions

1. **Clear app and restart dev server:**
   ```bash
   bun run dev:clear
   ```

2. **Watch console logs from the very beginning:**
   - Look for `[App Startup Debug]` messages
   - Check if HealthKit modules are registered at startup
   - Note the exact timing of when HealthKit is loaded

3. **Check error timing:**
   - Does error happen immediately at startup?
   - Or does it happen when navigating to vitals screen?
   - What's the time difference between app start and error?

4. **Share logs:**
   - Copy all `[HealthKit Debug]` and `[App Startup Debug]` messages
   - Include the full error stack trace
   - Note the time since app start when error occurs

## Possible Solutions Based on Findings

### If module is registered at startup:
- May need to modify Expo plugin configuration
- Or delay module registration in native code
- Or use a different HealthKit library

### If error happens during require():
- Increase delays further
- Add more bridge readiness checks
- Wrap require() in additional error handling

### If error happens during method call:
- Add delays before method calls
- Add retry logic (already implemented)
- Check bridge state before each call

