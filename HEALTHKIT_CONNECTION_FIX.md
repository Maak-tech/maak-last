# Fix "Not Connected to Health App" Error

## Problem
After rebuilding, the app shows "Not Connected" even though you tried to authorize HealthKit.

## Root Cause
The connection status is stored in AsyncStorage. If authorization failed (due to native module issues), the connection was never saved, so the app shows "Not Connected".

## Solution Steps

### Step 1: Verify Native Modules Are Working
1. Open the app
2. Go to Profile → Health Integrations
3. Tap the "🔧 HealthKit Debug" button (if available)
4. Run diagnostics
5. **Check**: Should show "Total modules: 30-50+" (not 0)

### Step 2: If Native Modules Are Still 0
The build didn't include native modules properly. You need to:
1. Check EAS build logs for errors
2. Rebuild with `--clear-cache`
3. Make sure the build completed successfully

### Step 3: If Native Modules Are Working
Try authorizing again:

1. **Go to**: Profile → Health Integrations → Apple Health
2. **Follow the flow**:
   - Tap "Connect Apple Health"
   - Select metrics you want
   - Tap "Authorize X metrics"
   - Wait for authorization to complete
   - Should save connection automatically

### Step 4: Check Connection Status
After authorizing, check if connection was saved:

1. Go to: Profile → Health Integrations
2. Apple Health should show: "Connected • X metrics"
3. If still "Not Connected", the authorization failed

### Step 5: Manual Connection Check
If authorization keeps failing:

1. **Check iOS Settings**:
   - Settings → Privacy & Security → Health
   - Find "Maak Health"
   - Check if permissions are granted

2. **Try disconnecting and reconnecting**:
   - If you see "Disconnect" option, use it
   - Then reconnect fresh

## Common Issues

### Issue 1: Authorization Dialog Doesn't Appear
- **Cause**: Native modules not working
- **Fix**: Rebuild app with native modules

### Issue 2: Authorization Completes But Shows "Not Connected"
- **Cause**: Connection not saved to AsyncStorage
- **Fix**: Check if `saveProviderConnection()` was called after authorization

### Issue 3: "invokeinner" Error During Authorization
- **Cause**: Native bridge not ready
- **Fix**: Wait longer before authorizing, or rebuild

## Debug Commands

Check connection status in code:
```typescript
import { getProviderConnection } from "@/lib/health/healthSync";

const connection = await getProviderConnection("apple_health");
console.log("Connection:", connection);
// Should show: { provider: "apple_health", connected: true, ... }
```

## Expected Flow

1. ✅ Native modules load (debug shows 30+ modules)
2. ✅ Tap "Connect Apple Health"
3. ✅ Select metrics
4. ✅ Tap "Authorize"
5. ✅ iOS permission dialog appears
6. ✅ User grants permissions
7. ✅ Connection saved to AsyncStorage
8. ✅ Screen shows "Connected • X metrics"

## Next Steps

1. **First**: Run the debug screen to verify native modules
2. **If modules work**: Try authorizing again
3. **If modules don't work**: Check build logs and rebuild
4. **If authorization fails**: Check iOS Settings for permissions

