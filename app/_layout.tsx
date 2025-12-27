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
import { NativeModules, Platform } from "react-native";
import { AuthProvider } from "@/contexts/AuthContext";
import { FallDetectionProvider } from "@/contexts/FallDetectionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { revenueCatService } from "@/lib/services/revenueCatService";
import { logger } from "@/lib/utils/logger";
import "@/lib/i18n";

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
    <ThemeProvider>
      <AuthProvider>
        <FallDetectionProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="family" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </FallDetectionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
