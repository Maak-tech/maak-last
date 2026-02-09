import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAvailableMetricsForProvider } from "@/lib/health/healthMetricsCatalog";
import { saveProviderConnection } from "@/lib/health/healthSync";
import type { ProviderConnection } from "@/lib/health/healthTypes";
import { healthConnectService } from "@/lib/services/healthConnectService";

export default function HealthConnectPermissionsScreen() {
  const [authorizing, setAuthorizing] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(true);

  const statusTitle = useMemo(() => {
    if (checkingAvailability) {
      return "Checking Health Connect availability...";
    }
    if (authorizing) {
      return "Opening Health Connect Permission Screen...";
    }
    return "Processing...";
  }, [authorizing, checkingAvailability]);

  const statusDescription = useMemo(() => {
    if (checkingAvailability) {
      return "Please wait while we check if Health Connect is installed.";
    }
    if (authorizing) {
      return "The Health Connect permission screen will appear where you can select health data permissions.";
    }
    return "";
  }, [authorizing, checkingAvailability]);

  const checkAvailabilityAndRequestPermissions = useCallback(async () => {
    if (Platform.OS !== "android") {
      Alert.alert(
        "Not Available",
        "Health Connect is only available on Android devices."
      );
      router.back();
      return;
    }

    setCheckingAvailability(true);
    try {
      // Check availability first
      const availability = await healthConnectService.checkAvailability();

      if (!availability.available) {
        setCheckingAvailability(false);
        const installUrl =
          availability.installUrl ||
          "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

        Alert.alert(
          "Health Connect Not Available",
          availability.reason ||
            "Health Connect is not installed on your device. Please install it from the Play Store.",
          [
            {
              text: "Install",
              onPress: () => {
                Linking.openURL(installUrl);
                router.back();
              },
            },
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => router.back(),
            },
          ]
        );
        return;
      }

      setCheckingAvailability(false);
      setAuthorizing(true);

      // Get all metrics from catalog for saving connection info
      const allMetrics = getAvailableMetricsForProvider("health_connect");
      const allMetricKeys = allMetrics.map((m) => m.key);

      // Request authorization for all metrics
      // Health Connect will show a permission screen where users can select permissions
      const granted = await healthConnectService.authorize(allMetricKeys);

      // Save connection
      const connection: ProviderConnection = {
        provider: "health_connect",
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
          "Please allow access to health data in Health Connect settings.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to request Health Connect permissions. Please try again.";

      Alert.alert("Permission Error", errorMessage, [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } finally {
      setCheckingAvailability(false);
      setAuthorizing(false);
    }
  }, []);

  useEffect(() => {
    // Check availability and request permissions when this screen loads
    checkAvailabilityAndRequestPermissions();
  }, [checkAvailabilityAndRequestPermissions]);

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
        {checkingAvailability || authorizing ? (
          <ActivityIndicator color="#000000" size="large" />
        ) : null}
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            marginTop: 20,
            textAlign: "center",
          }}
        >
          {statusTitle}
        </Text>
        <Text
          style={{
            fontSize: 14,
            opacity: 0.7,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {statusDescription}
        </Text>
      </View>
    </SafeAreaView>
  );
}
