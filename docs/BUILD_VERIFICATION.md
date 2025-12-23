# Build Verification Checklist - HealthKit Native Modules

## ✅ Pre-Build Verification

### 1. HealthKit Configuration ✅
- [x] **Entitlements**: `com.apple.developer.healthkit: true` in `app.json`
- [x] **HealthKit Access**: `com.apple.developer.healthkit.access: []` (empty = all types)
- [x] **Info.plist Permissions**: 
  - [x] `NSHealthShareUsageDescription` - Set
  - [x] `NSHealthUpdateUsageDescription` - Set

### 2. Native Module Plugin ✅
- [x] **react-native-health plugin**: Configured in `app.json` plugins array
- [x] **Plugin version**: `^1.19.0` in `package.json`
- [x] **Plugin permissions**: Both share and update permissions configured

### 3. Build Configuration ✅
- [x] **Build Number**: Incremented to `26` (was 25)
- [x] **EAS Build Profile**: `development` configured
- [x] **Platform**: iOS (not simulator)
- [x] **SDK Version**: 54.0.0

### 4. Code Implementation ✅
- [x] **Service**: `lib/services/appleHealthService.ts` - Implemented
- [x] **HealthKit Types**: `lib/health/allHealthKitTypes.ts` - Complete list
- [x] **Metrics Catalog**: `lib/health/healthMetricsCatalog.ts` - Configured
- [x] **Permission Flow**: `app/profile/health/apple-permissions.tsx` - Working

---

## 🔨 Build Command

```bash
eas build -p ios --profile development --clear-cache
```

**Note**: Use `--clear-cache` to ensure native modules are properly compiled.

---

## ✅ Post-Build Verification

After installing the new build, verify:

### 1. Native Modules Check
Run the HealthKit Debug screen (`/healthkit-debug`) and verify:
- [ ] **Total modules**: Should show 30-50+ (not 0)
- [ ] **Health-related modules**: Should find `RNFitness` or similar
- [ ] **react-native-health**: Should load successfully with methods available

### 2. HealthKit Availability
- [ ] `isAvailable()` returns `{ available: true }`
- [ ] No bridge errors in console
- [ ] Module loads without timeouts

### 3. Permission Request
- [ ] Can navigate to Apple Health permissions screen
- [ ] Can select metrics
- [ ] iOS permission dialog appears when authorizing
- [ ] No `RCTModuleMethod invokeWithBridge` errors

### 4. Settings Verification
After granting permissions:
- [ ] App appears in **Settings → Privacy & Security → Health**
- [ ] App appears in **Health app → Data Access & Devices**
- [ ] Shows "Maak Health" with data types listed

---

## 📋 HealthKit Data Types Requested

See `HEALTHKIT_PERMISSIONS.md` for complete list.

**Summary**:
- **Total Types**: 68 HealthKit data types (cleaned and optimized)
- **User-Selectable**: ~24 metrics
- **Default**: All types (when "Select All" chosen)

**Categories**:
- Heart & Cardiovascular (7 types)
- Respiratory (2 types)
- Body Measurements (6 types)
- Temperature (2 types)
- Activity & Fitness (11 types)
- Workouts (1 type)
- Sleep & Mindfulness (3 types)
- Nutrition (11 types - Basic Macros Only)
- Glucose (2 types)
- Reproductive Health (3 types - Basic Only)
- Hearing (2 types)
- Mobility (4 types)
- Other Metrics (7 types)
- UV Exposure (1 type)
- Characteristic Types (6 types)

---

## 🐛 Troubleshooting

### If "Total modules: 0" after build:
1. ✅ Verify you installed the **newest build** (build 26)
2. ✅ Delete old app completely before installing new build
3. ✅ Restart Metro bundler: `bun run dev:clear`
4. ✅ Check build logs for native module compilation errors

### If RCTModuleMethod errors persist:
1. ✅ Ensure build includes `--clear-cache` flag
2. ✅ Verify `react-native-health` plugin is in `app.json`
3. ✅ Check that HealthKit entitlement is enabled in Apple Developer Portal
4. ✅ Verify you're running on a **real device** (not simulator)

### If permissions don't appear in Settings:
1. ✅ Must complete authorization flow in app first
2. ✅ iOS only shows apps that have requested permissions
3. ✅ Check that `initHealthKit()` was called successfully
4. ✅ Verify no errors in console during permission request

---

## 📱 Installation Steps

1. **Build**: `eas build -p ios --profile development --clear-cache`
2. **Download**: Get IPA from EAS dashboard or use `eas build:download`
3. **Delete Old App**: Remove Maak Health from iPhone completely
4. **Install New Build**: Use Xcode, Apple Configurator, or TestFlight
5. **Start Dev Server**: `bun run dev:clear`
6. **Test**: Navigate to Health Integrations → Apple Health → Select metrics → Authorize

---

## ✅ Success Criteria

The build is successful when:
- ✅ Native modules load (30-50+ modules found)
- ✅ HealthKit `isAvailable()` returns true
- ✅ Permission request shows iOS dialog
- ✅ App appears in iOS Health Settings
- ✅ No bridge errors or timeouts

---

**Last Updated**: Build 26
**Date**: December 23, 2025

