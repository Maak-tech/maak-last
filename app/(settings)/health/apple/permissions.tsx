import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAvailableMetricsForProvider } from "@/lib/health/healthMetricsCatalog";
// Lazy import to prevent early native module loading
import { saveProviderConnection } from "@/lib/health/healthSync";
import type { ProviderConnection } from "@/lib/health/healthTypes";

export default function AppleHealthPermissionsScreen() {
  const [authorizing, setAuthorizing] = useState(false);

  useEffect(() => {
    // Automatically trigger iOS permission screen when this screen loads
    requestIOSPermissions();
  }, []);

  const requestIOSPermissions = async () => {
    if (Platform.OS !== "ios") {
      Alert.alert(
        "Not Available",
        "Apple Health is only available on iOS devices."
      );
      router.back();
      return;
    }

    setAuthorizing(true);
    try {
      // Lazy import to prevent early native module loading
      const { appleHealthService } = await import(
        "@/lib/services/appleHealthService"
      );

      // Check availability first - wrapped in try-catch to prevent crashes
      let availability;
      try {
        availability = await appleHealthService.checkAvailability();
      } catch (availError: any) {
        setAuthorizing(false);
        Alert.alert(
          "HealthKit Error",
          "Failed to check HealthKit availability. Please rebuild the app if you see native module errors.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
        return;
      }

      if (!availability.available) {
        setAuthorizing(false);
        Alert.alert(
          "HealthKit Not Available",
          availability.reason ||
            "HealthKit is not available. Please ensure you're running a development build or standalone app, not Expo Go.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
        return;
      }

      // CRITICAL: Wait for bridge to stabilize after isAvailable() before requesting authorization
      // This prevents RCTModuleMethod invokeWithBridge errors
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay

      // Request authorization for ALL HealthKit types
      // This will immediately show the iOS permission screen with all available metrics
      // The iOS screen itself allows users to select all or individual metrics
      const granted = await appleHealthService.authorize();

      // Get all metrics from catalog for saving connection info
      const allMetrics = getAvailableMetricsForProvider("apple_health");
      const allMetricKeys = allMetrics.map((m) => m.key);

      // Save connection
      const connection: ProviderConnection = {
        provider: "apple_health",
        connected: granted,
        connectedAt: new Date().toISOString(),
        selectedMetrics: allMetricKeys,
      };

      await saveProviderConnection(connection);

      if (granted) {
        Alert.alert(
          "Success",
          "Health data integration enabled successfully.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert(
          "Permission Denied",
          "Please allow access to health data in iOS Settings → Privacy & Security → Health",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error: any) {
      let errorMessage =
        "Failed to request HealthKit permissions. Please try again.";

      // Check for specific native module errors
      if (
        error?.message?.includes("RCTModuleMethod") ||
        error?.message?.includes("folly")
      ) {
        errorMessage =
          "HealthKit native module error. Please rebuild the app with: bun run build:ios:dev";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      Alert.alert("Permission Error", errorMessage, [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View
        style={{
          flex: 1,
          padding: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color="#000000" size="large" />
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            marginTop: 20,
            textAlign: "center",
          }}
        >
          Opening iOS Permission Screen...
        </Text>
        <Text
          style={{
            fontSize: 14,
            opacity: 0.7,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          The iOS permission screen will appear where you can select all or
          individual health metrics.
        </Text>
      </View>
    </SafeAreaView>
  );
}
