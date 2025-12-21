/**
 * Apple Health Connected Screen
 * Shows connection status, granted metrics, and sync controls
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Check,
  ArrowLeft,
  RefreshCw,
  Settings,
  AlertCircle,
  X,
  ChevronRight,
} from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getProviderConnection,
  disconnectProvider,
  syncHealthData,
  getLastSyncTimestamp,
} from "@/lib/health/healthSync";
import type { ProviderConnection, SyncResult } from "@/lib/health/healthTypes";
import { getMetricByKey } from "@/lib/health/healthMetricsCatalog";
import { format } from "date-fns";

export default function AppleHealthConnectedScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!connection || !connection.connected) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.text }]}>
            Not Connected
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => router.replace("/profile/health/apple-intro" as any)}
          >
            <Text style={styles.primaryButtonText}>Connect Apple Health</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const grantedMetrics = connection.grantedMetrics || connection.selectedMetrics;
  const deniedMetrics = connection.deniedMetrics || [];

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
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.success + "20" },
            ]}
          >
            <Check size={32} color={theme.success} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            Apple Health Connected
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Connected on {format(new Date(connection.connectedAt!), "MMM d, yyyy")}
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
                <Text style={[styles.syncTitle, { color: theme.text }]}>
                  Last Sync
                </Text>
                <Text style={[styles.syncTime, { color: theme.textSecondary }]}>
                  {lastSync
                    ? format(new Date(lastSync), "MMM d, yyyy 'at' h:mm a")
                    : "Never"}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.syncButton,
                  { backgroundColor: theme.primary },
                  syncing && styles.syncButtonDisabled,
                ]}
                onPress={handleSyncNow}
                disabled={syncing}
              >
                {syncing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <RefreshCw size={18} color="#FFFFFF" />
                    <Text style={styles.syncButtonText}>Sync Now</Text>
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
                      color: syncResult.success ? theme.success : theme.error,
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
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
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
                  <Check size={16} color={theme.success} />
                  <Text style={[styles.metricText, { color: theme.text }]}>
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
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
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
                    <X size={16} color={theme.error} />
                    <Text style={[styles.metricText, { color: theme.textSecondary }]}>
                      {metric?.displayName || key}
                    </Text>
                  </View>
                );
              })}
              <Text
                style={[styles.deniedHint, { color: theme.textSecondary }]}
              >
                You can enable these in iOS Settings → Privacy & Security → Health
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
            onPress={handleOpenSettings}
          >
            <Settings size={20} color={theme.primary} />
            <Text style={[styles.actionButtonText, { color: theme.primary }]}>
              Manage Permissions in Settings
            </Text>
            <ChevronRight size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.dangerButton,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: theme.error + "40",
              },
            ]}
            onPress={handleDisconnect}
          >
            <X size={20} color={theme.error} />
            <Text style={[styles.actionButtonText, { color: theme.error }]}>
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
    marginLeft: 6,
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
    marginLeft: 10,
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
    marginLeft: 12,
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

