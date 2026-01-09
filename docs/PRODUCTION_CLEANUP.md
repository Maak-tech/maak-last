# Production Environment Cleanup Checklist

This document lists items that should be removed, fixed, or reviewed before deploying to production.

## 🔴 Critical Security Issues

### 0. RevenueCat Test API Key in Production ⚠️ CRITICAL
**Location:** `lib/services/revenueCatService.ts:13`
**Issue:** Hardcoded test API key will cause App Store rejection
**Status:** ✅ **FIXED** - Now uses environment variables
**Changes Made:**
- Updated to load API key from environment variables (`REVENUECAT_API_KEY`)
- Added fallback to test key only in development (`__DEV__`)
- Production builds will throw error if API key is not set
- Added to `app.config.js` extra section for environment variable access

**Action Required Before Production:**
1. Get production API key from RevenueCat dashboard
2. Set `REVENUECAT_API_KEY` in EAS secrets for production builds:
   ```bash
   eas secret:create --scope project --name REVENUECAT_API_KEY --value "your-production-api-key"
   ```
3. For local development, add to `.env` file:
   ```env
   REVENUECAT_API_KEY=your-production-api-key
   ```

### 1. Firebase Functions - Authentication Bypass ✅ FIXED
**Location:** `functions/src/index.ts:199`
**Issue:** Authentication was bypassed with a test user fallback
**Status:** ✅ **FIXED** - Authentication now properly required
**Changes Made:**
- Removed `"testing-user"` fallback
- Added proper authentication check that throws error if missing
- Updated `saveFCMToken` function to require authentication

### 2. Hardcoded Firebase Configuration
**Location:** `lib/firebase.ts:18-47`
**Issue:** Firebase API keys are hardcoded in the source code
**Note:** These are public client-side keys (acceptable), but should ideally use environment variables exclusively
**Action Required:** 
- Ensure all Firebase configs come from environment variables
- Remove hardcoded values as fallbacks (or document why they're needed)

## ⚠️ High Priority Issues

### 3. Console Logs in Production ✅ FIXED
**Location:** Multiple files
**Issue:** Console statements were not removed in production builds
**Status:** ✅ **FIXED** - Console removal enabled for production
**Changes Made:**
- Installed `babel-plugin-transform-remove-console`
- Enabled console removal in `babel.config.js` for production builds
- Configured to keep `console.error` and `console.warn` for error tracking
- All `console.log`, `console.debug`, and `console.info` will be removed in production builds

**Note:** Files using `__DEV__` checks (like `lib/utils/debugger.ts` and `lib/utils/logger.ts`) are already properly configured

### 4. Simulated/Mock Data Fallbacks ✅ FIXED
**Location:** `lib/services/healthDataService.ts`
**Issue:** `getSimulatedVitals()` was used as fallback when health data is unavailable
**Status:** ✅ **FIXED** - Simulated data only returned in development
**Changes Made:**
- Updated all `getSimulatedVitals()` calls to check `__DEV__` flag
- In production, functions now return `null` instead of simulated data
- Applied to: `getIOSVitals()`, `getAndroidVitals()`, `getFitbitVitals()`
- Simulated data is still available for development/testing purposes

### 5. Test/Development Scripts
**Location:** `scripts/` directory
**Files:**
- `scripts/create-user-collections.ts` - Creates sample data
- `scripts/test-family-invitation.js` - Test script
- `scripts/firebase-init-collections.ts` - Initialization script
- `scripts/fix-medications.js` - Data fix script

**Action Required:**
- Ensure these scripts are not included in production builds
- Verify `.gitignore` excludes them from deployment
- Document that these are development-only tools

## 📝 Medium Priority Issues

### 6. TODO Comments ✅ ADDRESSED
**Location:** Multiple files
**Status:** ✅ **ADDRESSED** - All critical TODOs resolved
**Changes Made:**
- `functions/src/index.ts` - Authentication TODO resolved (authentication now required)
- `lib/utils/logger.ts` - Updated TODO to documentation comment about error tracking integration

### 7. Debug/Development Features
**Location:** Various files
**Features:**
- `lib/utils/debugger.ts` - Comprehensive debugging utilities (uses `__DEV__` checks - good)
- `lib/utils/fallDetectionDiagnostics.ts` - Diagnostic utilities
- Test fall detection function in `contexts/FallDetectionContext.tsx`

**Action Required:**
- Verify all debug features are properly gated with `__DEV__` checks
- Ensure test/debug functions are not accessible in production builds

### 8. Demo/Test Data in Scripts ✅ FIXED
**Location:** `scripts/fix-medications.js`
**Issue:** Script contained demo Firebase config with placeholder values
**Status:** ✅ **FIXED** - Scripts now require environment variables
**Changes Made:**
- Removed all demo/placeholder fallback values
- Added validation to check for required environment variables
- Script now exits with error if environment variables are missing
- Prevents accidental use of wrong Firebase project

## ✅ Already Properly Handled

### Good Practices Found:
1. **Logger Utility** (`lib/utils/logger.ts`) - Properly uses `__DEV__` checks
2. **Debugger Utility** (`lib/utils/debugger.ts`) - Properly uses `__DEV__` checks
3. **Network Debugger** (`lib/utils/debugger.ts:350-380`) - Only runs in `__DEV__`
4. **Environment Variables** - Most configs use environment variables with fallbacks

## ✅ Completed Actions

### Critical Fixes (Completed):
1. ✅ **Fixed** authentication bypass in Firebase Functions
2. ✅ **Enabled** console removal in Babel config for production
3. ✅ **Fixed** simulated data fallbacks (now return null in production)
4. ✅ **Addressed** critical TODO comments
5. ✅ **Removed** demo/test data fallbacks from scripts

### Remaining Recommendations:

### Before Next Release:
1. ⚠️ Consider removing hardcoded Firebase configs (use env vars only) - Currently acceptable as public client keys
2. ✅ Console statements audited and properly configured
3. ✅ Test scripts documented as development-only
4. 💡 Consider implementing error tracking service (Sentry, etc.) - Optional enhancement

### Ongoing:
1. 💡 Set up automated linting rules to catch console statements
2. 💡 Add pre-commit hooks to prevent committing debug code
3. 💡 Regular security audits

## 📋 Quick Fix Commands

### Enable Console Removal in Production:
Edit `babel.config.js`:
```javascript
env: {
  production: {
    plugins: [
      ['transform-remove-console', { exclude: ['error', 'warn'] }],
    ],
  },
},
```

### Install Console Removal Plugin:
```bash
npm install --save-dev babel-plugin-transform-remove-console
```

## 🔍 Verification Steps

After making changes:
1. Build production bundle: `eas build --profile production`
2. Test the build on a real device
3. Verify no console.log statements appear (except errors/warnings)
4. Verify authentication works properly
5. Verify no test data is created in production

