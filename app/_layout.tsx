import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { FallDetectionProvider } from "@/contexts/FallDetectionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
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

  useEffect(() => {
    // Request notification permissions on app start
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        console.log("Notification permissions not granted");
      } else {
        console.log("Notification permissions granted");
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
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen
              name="debug-notifications"
              options={{ title: "Debug Notifications" }}
            />
            <Stack.Screen name="+not-found" />
          </Stack>
        </FallDetectionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
