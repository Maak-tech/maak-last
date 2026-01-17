/**
 * Apple Health Connected Screen
 * Shows connection status, granted metrics, and sync controls
 */

import { format } from "date-fns";
import { useNavigation, useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  RefreshCw,
  Settings,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getAvailableMetricsForProvider,
  getMetricByKey,
} from "@/lib/health/healthMetricsCatalog";
import {
  disconnectProvider,
  getLastSyncTimestamp,
  getProviderConnection,
  syncHealthData,
} from "@/lib/health/healthSync";
import type { ProviderConnection, SyncResult } from "@/lib/health/healthTypes";

export default function AppleHealthConnectedScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();

  const isRTL = i18n.language === "ar";

  // Hide the default header to prevent duplicate headers
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connection, setConnection] = useState<ProviderConnection | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    loadConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadConnection = async () => {
    try {
      setLoading(true);
      const conn = await getProviderConnection("apple_health");
      setConnection(conn);
      if (conn) {
        const syncTime = await getLastSyncTimestamp("apple_health");
        setLastSync(syncTime);
      }
    } catch {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await syncHealthData("apple_health");
      setSyncResult(result);
      await loadConnection(); // Reload to get updated sync timestamp

      if (result.success) {
        Alert.alert(
          "Sync Complete",
          `Synced ${result.metricsCount} metrics with ${result.samplesCount} data points.`
        );
      } else {
        Alert.alert("Sync Failed", result.error || "Unknown error occurred");
      }
    } catch (error: any) {
      Alert.alert("Sync Error", error.message || "Failed to sync health data");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Apple Health",
      "Are you sure you want to disconnect? You can reconnect anytime.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              await disconnectProvider("apple_health");
              router.replace("/profile/health-integrations" as any);
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to disconnect");
            }
          },
        },
      ]
    );
  };

  const handleOpenSettings = () => {
    // Open iOS Settings → Privacy & Security → Health
    Linking.openURL("app-settings:");
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.colors.background.primary },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!(connection && connection.connected)) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.colors.background.primary },
        ]}
      >
        <View style={styles.errorContainer}>
          <AlertCircle color={theme.colors.accent.error} size={48} />
          <Text
            style={[styles.errorText, { color: theme.colors.text.primary }]}
          >
            Not Connected
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/profile/health/apple-intro" as any)}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.colors.primary.main },
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {t("connectAppleHealth", "Connect Apple Health")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Expand "all" to actual metric keys if present (for backward compatibility)
  const rawGrantedMetrics =
    connection.grantedMetrics || connection.selectedMetrics || [];
  const grantedMetrics = rawGrantedMetrics.includes("all")
    ? getAvailableMetricsForProvider("apple_health").map((m) => m.key)
    : rawGrantedMetrics;

  // Expand "all" in denied metrics as well
  const rawDeniedMetrics = connection.deniedMetrics || [];
  const deniedMetrics = rawDeniedMetrics.includes("all")
    ? getAvailableMetricsForProvider("apple_health").map((m) => m.key)
    : rawDeniedMetrics;

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.primary },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/profile")}
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
        >
          <ArrowLeft
            color="#1E293B"
            size={24}
            style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, isRTL && { textAlign: "left" }]}>
          {isRTL ? "Apple Health متصل" : "Apple Health Connected"}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Status Section */}
        <View style={styles.statusSection}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.colors.accent.success + "20" },
            ]}
          >
            <Check color={theme.colors.accent.success} size={32} />
          </View>
          <Text
            style={[
              styles.title,
              { color: theme.colors.text.primary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {isRTL ? "Apple Health متصل" : "Apple Health Connected"}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: theme.colors.text.secondary },
              isRTL && { textAlign: "left" },
            ]}
          >
            {isRTL
              ? `متصل في ${format(new Date(connection.connectedAt!), "d MMM yyyy")}`
              : `Connected on ${format(new Date(connection.connectedAt!), "MMM d, yyyy")}`}
          </Text>
        </View>

        {/* Sync Section */}
        <View style={styles.section}>
          <View
            style={[
              styles.syncCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.syncHeader}>
              <View>
                <Text
                  style={[
                    styles.syncTitle,
                    { color: theme.colors.text.primary },
                  ]}
                >
                  Last Sync
                </Text>
                <Text
                  style={[
                    styles.syncTime,
                    { color: theme.colors.text.secondary },
                  ]}
                >
                  {lastSync
                    ? format(new Date(lastSync), "MMM d, yyyy 'at' h:mm a")
                    : "Never"}
                </Text>
              </View>
              <TouchableOpacity
                disabled={syncing}
                onPress={handleSyncNow}
                style={[
                  styles.syncButton,
                  { backgroundColor: theme.colors.primary.main },
                  syncing && styles.syncButtonDisabled,
                ]}
              >
                {syncing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <RefreshCw color="#FFFFFF" size={18} />
                    <Text style={styles.syncButtonText}>
                      {t("syncNow", "Sync Now")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {syncResult && (
              <View style={styles.syncResult}>
                <Text
                  style={[
                    styles.syncResultText,
                    {
                      color: syncResult.success
                        ? theme.colors.accent.success
                        : theme.colors.accent.error,
                    },
                  ]}
                >
                  {syncResult.success
                    ? `✓ Synced ${syncResult.metricsCount} metrics, ${syncResult.samplesCount} data points`
                    : `✗ Sync failed: ${syncResult.error}`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Granted Metrics */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.text.primary }]}
          >
            Granted Metrics ({grantedMetrics.length})
          </Text>
          <View
            style={[
              styles.metricsCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            {grantedMetrics.map((key) => {
              const metric = getMetricByKey(key);
              return (
                <View key={key} style={styles.metricRow}>
                  <Check color={theme.colors.accent.success} size={16} />
                  <Text
                    style={[
                      styles.metricText,
                      { color: theme.colors.text.primary },
                    ]}
                  >
                    {metric?.displayName || key}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Denied Metrics (if any) */}
        {deniedMetrics.length > 0 && (
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.text.primary },
              ]}
            >
              Denied Metrics ({deniedMetrics.length})
            </Text>
            <View
              style={[
                styles.metricsCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                },
              ]}
            >
              {deniedMetrics.map((key) => {
                const metric = getMetricByKey(key);
                return (
                  <View key={key} style={styles.metricRow}>
                    <X color={theme.colors.accent.error} size={16} />
                    <Text
                      style={[
                        styles.metricText,
                        { color: theme.colors.text.secondary },
                      ]}
                    >
                      {metric?.displayName || key}
                    </Text>
                  </View>
                );
              })}
              <Text
                style={[
                  styles.deniedHint,
                  { color: theme.colors.text.secondary },
                ]}
              >
                You can enable these in iOS Settings → Privacy & Security →
                Health
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={handleOpenSettings}
            style={[
              styles.actionButton,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <Settings color={theme.colors.primary.main} size={20} />
            <Text
              style={[
                styles.actionButtonText,
                { color: theme.colors.primary.main },
              ]}
            >
              Manage Permissions in Settings
            </Text>
            <ChevronRight color={theme.colors.text.secondary} size={20} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDisconnect}
            style={[
              styles.actionButton,
              styles.dangerButton,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: theme.colors.accent.error + "40",
              },
            ]}
          >
            <X color={theme.colors.accent.error} size={20} />
            <Text
              style={[
                styles.actionButtonText,
                { color: theme.colors.accent.error },
              ]}
            >
              Disconnect Apple Health
            </Text>
          </TouchableOpacity>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonRTL: {
    transform: [{ scaleX: -1 }],
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Geist-SemiBold",
    color: "#1E293B",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  statusSection: {
    padding: 24,
    alignItems: "center",
  },
  rtlText: {
    textAlign: "right",
    fontFamily: "Geist-Regular",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
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
    color: "#64748B",
  },
  section: {
    padding: 24,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  syncCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  syncTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  syncTime: {
    fontSize: 13,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginStart: 6,
  },
  syncResult: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  syncResultText: {
    fontSize: 13,
    fontWeight: "500",
  },
  metricsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  metricText: {
    fontSize: 15,
    marginStart: 10,
  },
  deniedHint: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: "italic",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  dangerButton: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "500",
    marginStart: 12,
    flex: 1,
  },
  primaryButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
});
