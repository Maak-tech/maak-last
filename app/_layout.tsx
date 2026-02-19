/* biome-ignore-all lint/performance/noNamespaceImport: Expo SDK modules in this file intentionally use namespace imports. */
// Polyfill to prevent PushNotificationIOS errors
import "@/lib/polyfills/pushNotificationIOS";

// Initialize reanimated compatibility early to prevent createAnimatedComponent errors
import "@/lib/utils/reanimatedSetup";
// Remap Inter fonts to Arabic-safe fonts when app language is Arabic.
import "@/lib/patchInterForArabic";
// Ensure Firebase JS SDK initializes before consumers import services.
import "@/lib/firebase";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  NotoSansArabic_400Regular,
  NotoSansArabic_600SemiBold,
  NotoSansArabic_700Bold,
} from "@expo-google-fonts/noto-sans-arabic";
import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { AppState, LogBox, Platform, Text as RNText } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import MedicationAlarmModal from "@/components/MedicationAlarmModal";
import { NotificationListenerSetup } from "@/components/NotificationListenerSetup";
import { AuthProvider } from "@/contexts/AuthContext";
import { FallDetectionProvider } from "@/contexts/FallDetectionContext";
import { MedicationAlarmProvider } from "@/contexts/MedicationAlarmContext";
import { RealtimeHealthProvider } from "@/contexts/RealtimeHealthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { isFirebaseReady } from "@/lib/firebase";
import i18n from "@/lib/i18n";
import { routingInstrumentation } from "@/lib/sentry";
import { revenueCatService } from "@/lib/services/revenueCatService";
import { initializeErrorHandlers } from "@/lib/utils/errorHandler";
import { logger } from "@/lib/utils/logger";

const ENABLE_NOTIFICATIONS_BOOTSTRAP =
  process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_BOOTSTRAP === "true";
const IS_DEV_BUILD = process.env.NODE_ENV !== "production";

// Install global JS error hooks as early as possible.
initializeErrorHandlers();

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync().catch(() => {
  // Avoid crashing on platforms where this isn't supported
});

const RN_CORE_DEPRECATION_WARNINGS = [
  "ProgressBarAndroid has been extracted from react-native core",
  "SafeAreaView has been deprecated and will be removed in a future release",
  "Clipboard has been extracted from react-native core",
  "PushNotificationIOS has been extracted from react-native core",
];

LogBox.ignoreLogs(RN_CORE_DEPRECATION_WARNINGS);

const globalWithWarnFilter = globalThis as typeof globalThis & {
  __maakWarnFilterInstalled?: boolean;
};

if (!globalWithWarnFilter.__maakWarnFilterInstalled) {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const shouldSuppress = args.some(
      (arg) =>
        typeof arg === "string" &&
        RN_CORE_DEPRECATION_WARNINGS.some((warning) => arg.includes(warning))
    );

    if (shouldSuppress) {
      return;
    }

    originalWarn(...args);
  };
  globalWithWarnFilter.__maakWarnFilterInstalled = true;
}

function RootLayout() {
  const navigationRef = useNavigationContainerRef();
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active"
  );
  const [hasBeenActive, setHasBeenActive] = useState(
    AppState.currentState === "active"
  );
  const [fontsLoaded, fontError] = useFonts({
    "Inter-Regular": Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold,
    "NotoSansArabic-Regular": NotoSansArabic_400Regular,
    "NotoSansArabic-SemiBold": NotoSansArabic_600SemiBold,
    "NotoSansArabic-Bold": NotoSansArabic_700Bold,
  });
  const backgroundLaunchLoggedRef = useRef(false);
  const notificationHandlerConfiguredRef = useRef(false);

  useEffect(() => {
    routingInstrumentation.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  useEffect(() => {
    if (hasBeenActive && (fontsLoaded || fontError)) {
      SplashScreen.hideAsync();
    }
  }, [hasBeenActive, fontsLoaded, fontError]);

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
    if (!(isAppActive && ENABLE_NOTIFICATIONS_BOOTSTRAP)) {
      return;
    }

    if (notificationHandlerConfiguredRef.current) {
      return;
    }

    notificationHandlerConfiguredRef.current = true;

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch {
      // Keep startup resilient when notification modules are not fully ready.
    }
  }, [isAppActive]);

  useEffect(() => {
    if (!(isAppActive && ENABLE_NOTIFICATIONS_BOOTSTRAP)) {
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
    if (hasBeenActive || isAppActive || backgroundLaunchLoggedRef.current) {
      return;
    }
    backgroundLaunchLoggedRef.current = true;
    if (!isFirebaseReady()) {
      logger.info(
        "Skipping background launch observability: Firebase not ready",
        { appState: AppState.currentState },
        "RootLayout"
      );
    }
  }, [hasBeenActive, isAppActive]);

  // Keep Text defaults neutral. Arabic font handling is patched globally at runtime.
  useEffect(() => {
    if (!(fontsLoaded || fontError)) {
      if (IS_DEV_BUILD) {
        logger.debug(
          "Fonts not loaded yet",
          { fontsLoaded, fontError },
          "RootLayout"
        );
      }
      return;
    }

    if (IS_DEV_BUILD) {
      logger.debug(
        "Setting up Arabic font defaults",
        { language: i18n.language, fontsLoaded },
        "RootLayout"
      );
    }

    type RNTextWithDefaults = typeof RNText & {
      defaultProps?: { style?: unknown };
    };
    const rnText = RNText as unknown as RNTextWithDefaults;
    rnText.defaultProps = rnText.defaultProps ?? {};
    rnText.defaultProps.style = undefined;
    if (IS_DEV_BUILD) {
      logger.debug(
        "Text defaults reset; runtime Arabic patch active",
        undefined,
        "RootLayout"
      );
    }
    if (i18n.language === "ar" && IS_DEV_BUILD) {
      logger.debug(
        "Arabic debug",
        { literal: "مرحباً بالعالم", home: i18n.t("home") },
        "RootLayout"
      );
    }
  }, [fontsLoaded, fontError]);

  // If the app launches in background, skip mounting UI until it becomes active.
  if (!(hasBeenActive && (fontsLoaded || fontError))) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider>
            <AuthProvider>
              <NotificationListenerSetup />
              <MedicationAlarmProvider>
                <RealtimeHealthProvider>
                  <FallDetectionProvider>
                    <MedicationAlarmModal />
                    <StatusBar style="auto" />
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen
                        name="index"
                        options={{ headerShown: false }}
                      />
                      <Stack.Screen
                        name="(tabs)"
                        options={{ headerShown: false }}
                      />
                      <Stack.Screen
                        name="profile"
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
                      <Stack.Screen
                        name="family"
                        options={{ headerShown: false }}
                      />
                      <Stack.Screen name="+not-found" />
                    </Stack>
                  </FallDetectionProvider>
                </RealtimeHealthProvider>
              </MedicationAlarmProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout, {
  touchEventBoundaryProps: { labelName: "sentry-label" },
});
