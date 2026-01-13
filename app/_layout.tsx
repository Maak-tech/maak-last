// TextImpl patch removed due to Bun compatibility issues
// Reanimated setup handles TextImpl patching through TypeScript

// Polyfill to prevent PushNotificationIOS errors
import "@/lib/polyfills/pushNotificationIOS";

// Initialize reanimated compatibility early to prevent createAnimatedComponent errors
import "@/lib/utils/reanimatedSetup";

import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { I18nManager, NativeModules, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/contexts/AuthContext";
import { FallDetectionProvider } from "@/contexts/FallDetectionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import OfflineIndicator from "@/app/components/OfflineIndicator";
import { revenueCatService } from "@/lib/services/revenueCatService";
import { logger } from "@/lib/utils/logger";
import i18n from "@/lib/i18n";

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

// Configure how notifications should be displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // Show notification banner at top
    shouldShowList: true, // Show in notification list
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Geist-Regular": require("@/assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("@/assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("@/assets/fonts/Geist-SemiBold.ttf"),
    "Geist-Bold": require("@/assets/fonts/Geist-Bold.ttf"),
  });

  // Set RTL direction based on current language
  useEffect(() => {
    const updateRTL = () => {
      const isRTL = i18n.language === "ar";
      if (Platform.OS === "android" || Platform.OS === "ios") {
        // Only update if RTL state has changed
        if (I18nManager.isRTL !== isRTL) {
          I18nManager.forceRTL(isRTL);
          I18nManager.allowRTL(isRTL);
          
          // On Android, RTL changes require a reload
          if (Platform.OS === "android" && NativeModules.UIManager?.setLayoutAnimationEnabledExperimental) {
            NativeModules.UIManager.setLayoutAnimationEnabledExperimental(true);
          }
        }
      }
    };

    // Update on mount
    updateRTL();

    // Listen for language changes
    const languageChangeHandler = () => {
      updateRTL();
    };

    i18n.on("languageChanged", languageChangeHandler);

    return () => {
      i18n.off("languageChanged", languageChangeHandler);
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Initialize RevenueCat SDK
  useEffect(() => {
    const initializeRevenueCat = async () => {
      try {
        await revenueCatService.initialize();
      } catch (error) {
        logger.error("Failed to initialize RevenueCat", error, "RootLayout");
        // Don't block app startup if RevenueCat fails to initialize
      }
    };

    initializeRevenueCat();
  }, []);

  // HealthKit module check removed for production

  useEffect(() => {
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
      } catch (error) {
        // Silently handle error
      }
    };

    requestPermissions();
  }, []);

  if (!(fontsLoaded || fontError)) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <FallDetectionProvider>
            <StatusBar style="auto" />
            <OfflineIndicator />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="profile" options={{ headerShown: false }} />
              <Stack.Screen name="family" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="voice-agent" options={{ headerShown: false, presentation: "modal" }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </FallDetectionProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
