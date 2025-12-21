import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, Alert, Platform } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { appleHealthService } from "@/lib/services/appleHealthService";
import { saveProviderConnection, getProviderConnection } from "@/lib/health/healthSync";
import type { ProviderConnection } from "@/lib/health/healthTypes";
import { getAvailableMetricsForProvider } from "@/lib/health/healthMetricsCatalog";

export default function AppleHealthPermissionsScreen() {
  const [authorizing, setAuthorizing] = useState(false);

  useEffect(() => {
    // Automatically trigger iOS permission screen when this screen loads
    requestIOSPermissions();
  }, []);

  const requestIOSPermissions = async () => {
    if (Platform.OS !== "ios") {
      Alert.alert("Not Available", "Apple Health is only available on iOS devices.");
      router.back();
      return;
    }

    setAuthorizing(true);
    try {
      // Check availability first
      const availability = await appleHealthService.isAvailable();
      if (!availability.available) {
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

      // Request authorization for ALL HealthKit types
      // This will immediately show the iOS permission screen with all available metrics
      // The iOS screen itself allows users to select all or individual metrics
      const result = await appleHealthService.requestAuthorization(["all"]);

      // Get all metrics from catalog for saving connection info
      const allMetrics = getAvailableMetricsForProvider("apple_health");
      const allMetricKeys = allMetrics.map((m) => m.key);

      // Save connection
      const connection: ProviderConnection = {
        provider: "apple_health",
        connected: result.granted.length > 0,
        connectedAt: new Date().toISOString(),
        selectedMetrics: allMetricKeys, // Save catalog metrics for reference
        grantedMetrics: result.granted,
        deniedMetrics: result.denied,
      };

      await saveProviderConnection(connection);

      if (result.granted.length > 0) {
        Alert.alert(
          "Success",
          `Health data integration enabled successfully. ${result.granted.length} metric${result.granted.length !== 1 ? "s" : ""} enabled.`,
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
      Alert.alert(
        "Permission Error",
        error.message || "Failed to request HealthKit permissions. Please try again.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={{ flex: 1, padding: 20, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={{ fontSize: 18, fontWeight: "600", marginTop: 20, textAlign: "center" }}>
          Opening iOS Permission Screen...
        </Text>
        <Text style={{ fontSize: 14, opacity: 0.7, marginTop: 8, textAlign: "center" }}>
          The iOS permission screen will appear where you can select all or individual health metrics.
        </Text>
      </View>
    </SafeAreaView>
  );
}
