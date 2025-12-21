/**
 * Motion Permissions Screen
 * Request motion and fitness permissions for fall detection
 */

import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  CheckCircle,
  Settings,
  Info,
} from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { motionPermissionService } from "@/lib/services/motionPermissionService";
import Constants from "expo-constants";

export default function MotionPermissionsScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<{
    available: boolean;
    granted: boolean;
    reason?: string;
  } | null>(null);

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    setChecking(true);
    try {
      const status = await motionPermissionService.checkMotionAvailability();
      setPermissionStatus(status);
    } catch (error) {
      setPermissionStatus({
        available: false,
        granted: false,
        reason: "Failed to check permission status",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleRequestPermission = async () => {
    setLoading(true);
    try {
      const granted = await motionPermissionService.requestMotionPermission();
      
      if (granted) {
        await motionPermissionService.saveMotionPermissionStatus(true);
        Alert.alert(
          "Permission Requested",
          Platform.OS === "ios"
            ? "Please allow motion access in the dialog that appears. If no dialog appears, you may need to enable it in Settings → Privacy & Security → Motion & Fitness."
            : "Motion permission has been requested. Please grant the permission when prompted.",
          [
            {
              text: "OK",
              onPress: () => {
                checkPermissionStatus();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Permission Not Available",
          "Motion sensors are not available on this device. Fall detection may not work properly.",
          [{ text: "OK" }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "Failed to request motion permission. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettings = async () => {
    await motionPermissionService.openMotionSettings();
  };

  if (checking) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.primary} size="large" />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Checking permission status...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isRTL = false; // Add RTL support if needed

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={theme.text} />
          </TouchableOpacity>
          <Activity size={48} color={theme.primary} />
          <Text style={[styles.title, { color: theme.text }]}>
            Motion & Fitness Access
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enable motion sensors for fall detection
          </Text>
        </View>

        {/* Status Card */}
        {permissionStatus && (
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor:
                  permissionStatus.granted
                    ? "#10B981"
                    : permissionStatus.available
                      ? "#F59E0B"
                      : "#EF4444",
              },
            ]}
          >
            <View style={styles.statusHeader}>
              {permissionStatus.granted ? (
                <CheckCircle color="#10B981" size={32} />
              ) : permissionStatus.available ? (
                <AlertTriangle color="#F59E0B" size={32} />
              ) : (
                <AlertTriangle color="#EF4444" size={32} />
              )}
              <View style={styles.statusInfo}>
                <Text style={[styles.statusTitle, { color: theme.text }]}>
                  {permissionStatus.granted
                    ? "Permission Granted"
                    : permissionStatus.available
                      ? "Permission Required"
                      : "Not Available"}
                </Text>
                <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                  {permissionStatus.granted
                    ? "Motion sensors are enabled. Fall detection is ready."
                    : permissionStatus.reason ||
                      "Motion sensors are required for fall detection."}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Information Cards */}
        <View style={styles.infoSection}>
          {/* Why We Need This */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.infoHeader}>
              <Activity color={theme.primary} size={24} />
              <Text style={[styles.infoTitle, { color: theme.text }]}>
                Why We Need This
              </Text>
            </View>
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              Maak Health uses your device&apos;s motion sensors (accelerometer and gyroscope) to detect
              sudden movements that may indicate a fall. This allows us to automatically alert your
              emergency contacts if a fall is detected.
            </Text>
          </View>

          {/* How It Works */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.infoHeader}>
              <Info color={theme.primary} size={24} />
              <Text style={[styles.infoTitle, { color: theme.text }]}>
                How It Works
              </Text>
            </View>
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              The app continuously monitors motion patterns. When unusual acceleration patterns are
              detected that match a fall, an alert is automatically sent to your family members with
              your location.
            </Text>
          </View>

          {/* Privacy */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.infoHeader}>
              <CheckCircle color={theme.primary} size={24} />
              <Text style={[styles.infoTitle, { color: theme.text }]}>
                Your Privacy
              </Text>
            </View>
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              Motion data is processed locally on your device and is never stored or transmitted.
              Only fall detection alerts are sent to your emergency contacts.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          {!permissionStatus?.granted && permissionStatus?.available && (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: theme.primary,
                },
              ]}
              onPress={handleRequestPermission}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Activity color="#FFFFFF" size={20} />
                  <Text style={styles.primaryButtonText}>
                    Enable Motion Access
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {permissionStatus?.granted && (
            <View
              style={[
                styles.successCard,
                {
                  backgroundColor: "#10B98120",
                  borderColor: "#10B981",
                },
              ]}
            >
              <CheckCircle color="#10B981" size={24} />
              <Text style={[styles.successText, { color: "#10B981" }]}>
                Motion access is enabled. Fall detection is ready to use.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
            onPress={handleOpenSettings}
          >
            <Settings color={theme.text} size={20} />
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>
              Open Settings
            </Text>
          </TouchableOpacity>
        </View>

        {/* Warning */}
        <View
          style={[
            styles.warningCard,
            {
              backgroundColor: "#FFFBEB",
              borderColor: "#FEF3C7",
            },
          ]}
        >
          <AlertTriangle color="#F59E0B" size={20} />
          <Text style={styles.warningText}>
            {Platform.OS === "ios"
              ? "If permission was denied, go to Settings → Privacy & Security → Motion & Fitness → Maak Health and enable motion access."
              : "If permission was denied, go to Settings → Apps → Maak Health → Permissions and enable Activity Recognition."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    padding: 24,
    alignItems: "center",
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: 24,
    top: 24,
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  statusCard: {
    margin: 24,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusInfo: {
    marginLeft: 16,
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginLeft: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  successText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  warningText: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
    flex: 1,
  },
});

