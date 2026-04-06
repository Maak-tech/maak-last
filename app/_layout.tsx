// Initialize reanimated compatibility early to prevent createAnimatedComponent errors
import "@/lib/utils/reanimatedSetup";
// Remap Inter fonts to Arabic-safe fonts when app language is Arabic.
import "@/lib/patchInterForArabic";

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
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { AppState, LogBox, Platform, Text as RNText, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import MedicationAlarmModal from "@/components/MedicationAlarmModal";
import { NotificationListenerSetup } from "@/components/NotificationListenerSetup";
import WebNoticeBar from "@/app/components/WebNoticeBar";
import { AuthProvider } from "@/contexts/AuthContext";
import { FallDetectionProvider } from "@/contexts/FallDetectionContext";
import { MedicationAlarmProvider } from "@/contexts/MedicationAlarmContext";
import { RealtimeHealthProvider } from "@/contexts/RealtimeHealthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import i18n from "@/lib/i18n";
import { routingInstrumentation } from "@/lib/sentry";
import { offlineService } from "@/lib/services/offlineService";
import { revenueCatService } from "@/lib/services/revenueCatService";
import { requestATTPermission } from "@/lib/utils/attGate";
import { initializeErrorHandlers } from "@/lib/utils/errorHandler";
import { initDeepLinks } from "@/lib/utils/deepLinkHandler";
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
  __nuralixWarnFilterInstalled?: boolean;
};

if (!globalWithWarnFilter.__nuralixWarnFilterInstalled) {
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
  globalWithWarnFilter.__nuralixWarnFilterInstalled = true;
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
    // ATT must be requested before any tracking/analytics SDK (RevenueCat, FCM).
    // Notification permission is intentionally NOT requested here — it is
    // requested in onboarding after the user understands the value proposition,
    // per Apple's contextual permission guidelines.
    const initSDKs = async () => {
      await requestATTPermission();
      // RevenueCat and other analytics SDKs that require ATT clearance should
      // be initialized here, after the ATT gate has resolved.
    };

    initSDKs();
  }, []);

  useEffect(() => {
    // Initialize deep link listeners for maak:// and universal links
    const cleanupDeepLinks = initDeepLinks();
    return cleanupDeepLinks;
  }, []);

  useEffect(() => {
    // If app starts in background, listen for when it comes to foreground
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setIsAppActive(true);
        setHasBeenActive(true);
        // Resume offline sync polling when app returns to foreground
        offlineService.resumeIntervals();
      } else if (nextState === 'background') {
        setIsAppActive(false);
        // Pause polling intervals to save battery while backgrounded.
        // The queue is preserved in AsyncStorage; resumeIntervals() restarts
        // polling when the app comes back to the foreground.
        offlineService.pauseIntervals();
      } else {
        setIsAppActive(false);
      }
    });

    // If app is already active on mount, set immediately
    if (AppState.currentState === 'active') {
      setHasBeenActive(true);
    }

    return () => subscription.remove();
  }, []);

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

  // Block render only until fonts are ready.
  // hasBeenActive / isAppActive are used downstream for refresh logic (not for blocking render).
  if (!(fontsLoaded || fontError)) {
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
                    <WebNoticeBar />
                    <StatusBar
                      style="auto"
                      translucent={false}
                    />
                    <View style={{ flex: 1 }}>
                      <OfflineBanner />
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
                        <Stack.Screen
                          name="hospital"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="emergency"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen
                          name="join"
                          options={{ title: 'Join Family', headerShown: true }}
                        />
                        <Stack.Screen name="+not-found" />
                      </Stack>
                    </View>
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

export default Sentry.wrap(RootLayout);
