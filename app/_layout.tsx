/* biome-ignore-all lint/performance/noNamespaceImport: Expo SDK modules in this file intentionally use namespace imports. */
// TextImpl patch removed due to Bun compatibility issues
// Reanimated setup handles TextImpl patching through TypeScript

// Polyfill to prevent PushNotificationIOS errors
import "@/lib/polyfills/pushNotificationIOS";

// CRITICAL: Initialize error handlers AFTER TextImpl patch
// This ensures we wrap the TextImpl handler and catch all errors
import "@/lib/utils/errorHandler";
import { initializeErrorHandlers } from "@/lib/utils/errorHandler";

// Initialize error handlers immediately (wraps TextImpl handler)
try {
  initializeErrorHandlers();
} catch {
  // Silently handle environments where global error handlers aren't available
}

// Initialize reanimated compatibility early to prevent createAnimatedComponent errors
import "@/lib/utils/reanimatedSetup";

import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

// Initialize React Native Firebase early (must be imported before any Firebase operations)
// This ensures the default Firebase app is initialized from native config files
// React Native Firebase auto-initializes from GoogleService-Info.plist (iOS) and google-services.json (Android)
if (Platform.OS !== "web") {
  try {
    // Import React Native Firebase app module - this initializes Firebase from native config
    require("@react-native-firebase/app");
  } catch (_error) {
    // React Native Firebase not available (e.g., in Expo Go or web)
    // This is expected and will be handled gracefully in AuthContext
  }
}

import { I18nextProvider } from "react-i18next";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { FallDetectionProvider } from "@/contexts/FallDetectionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { isFirebaseReady } from "@/lib/firebase";
import i18n from "@/lib/i18n";
import { observabilityEmitter } from "@/lib/observability";
import { revenueCatService } from "@/lib/services/revenueCatService";
import { logger } from "@/lib/utils/logger";

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync().catch(() => {
  // Avoid crashing on platforms where this isn't supported
});

// Configure how notifications should be displayed when app is in foreground
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, // Show notification banner at top
      shouldShowList: true, // Show in notification list
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch {
  // Silently handle environments where notifications aren't available
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Geist-Regular": require("@/assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("@/assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("@/assets/fonts/Geist-SemiBold.ttf"),
    "Geist-Bold": require("@/assets/fonts/Geist-Bold.ttf"),
  });
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active"
  );
  const [hasBeenActive, setHasBeenActive] = useState(
    AppState.currentState === "active"
  );
  const backgroundLaunchLoggedRef = useRef(false);

  useEffect(() => {
    if ((fontsLoaded || fontError) && hasBeenActive) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, hasBeenActive]);

  // Initialize RevenueCat SDK
  useEffect(() => {
    if (!isAppActive) {
      return;
    }

    const initializeRevenueCat = async () => {
      try {
        await revenueCatService.initialize();
      } catch (error) {
        logger.error("Failed to initialize RevenueCat", error, "RootLayout");
        // Don't block app startup if RevenueCat fails to initialize
      }
    };

    initializeRevenueCat();
  }, [isAppActive]);

  // HealthKit module check removed for production

  useEffect(() => {
    if (!isAppActive) {
      return;
    }

    // Request notification permissions on app start
    const requestPermissions = async () => {
      try {
        // Skip on web - notifications work differently
        if (Platform.OS === "web") {
          return;
        }

        // Check current status first
        const currentPermission = await Notifications.getPermissionsAsync();

        // Only request if not already determined
        if (currentPermission.status === "undetermined") {
          await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          });
        }
      } catch (_error) {
        // Silently handle error
      }
    };

    requestPermissions();
  }, [isAppActive]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const active = nextState === "active";
      setIsAppActive(active);
      if (active) {
        setHasBeenActive(true);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (hasBeenActive || isAppActive) {
      return;
    }
    if (backgroundLaunchLoggedRef.current) {
      return;
    }
    backgroundLaunchLoggedRef.current = true;
    if (!isFirebaseReady()) {
      logger.info(
        "Skipping background launch observability: Firebase not ready",
        { appState: AppState.currentState },
        "RootLayout"
      );
      return;
    }
    observabilityEmitter.emitPlatformEvent(
      "app_background_launch",
      "App launched in background; UI mount skipped",
      {
        source: "root_layout",
        severity: "warn",
        status: "cancelled",
        metadata: {
          appState: AppState.currentState,
        },
      }
    );
  }, [hasBeenActive, isAppActive]);

  if (!(fontsLoaded || fontError)) {
    return null;
  }
  // If the app launches in background, skip mounting UI until it becomes active.
  if (!hasBeenActive) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider>
            <AuthProvider>
              <FallDetectionProvider>
                <StatusBar style="auto" />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="profile"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="family"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="onboarding"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="(auth)"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen name="+not-found" />
                </Stack>
              </FallDetectionProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
