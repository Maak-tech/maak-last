# Expo RevenueCat Directory Module

This Expo module ensures the RevenueCat cache directory exists on iOS before RevenueCat SDK initialization, preventing `NSCocoaErrorDomain Code=4` errors.

## Problem

RevenueCat SDK on iOS tries to cache data to a directory (`Documents/com.maak.health.revenuecat.etags/`) that may not exist yet, causing a non-critical error:

```
ERROR [RevenueCat] Failed to save codable to cache: Error Domain=NSCocoaErrorDomain Code=4 "The file doesn't exist."
```

## Solution

This module creates the directory before RevenueCat initializes, preventing the error from occurring.

## Usage

The module is automatically used by `revenueCatService` before RevenueCat initialization. No manual setup required.

If you need to use it directly:

```typescript
import { ensureRevenueCatDirectory } from "@/modules/expo-revenuecat-directory";

// Ensure directory exists (iOS only)
if (Platform.OS === "ios") {
  await ensureRevenueCatDirectory();
}
```

## Implementation

- **iOS**: Swift implementation creates the directory using `FileManager`
- **Android/Web**: No-op (returns false immediately, safe for all platforms)

## Android Compatibility

This module is **fully compatible with Android builds**:
- The module is iOS-only in native code (Swift)
- The TypeScript wrapper checks `Platform.OS` before calling native code
- Android builds will skip the directory creation (not needed on Android)
- No Android native code is included, so it won't cause build issues
- The module gracefully handles missing native module on non-iOS platforms

## Directory Path

The directory is created at:
```
Documents/com.maak.health.revenuecat.etags/
```

This matches the path RevenueCat SDK expects for its cache.

