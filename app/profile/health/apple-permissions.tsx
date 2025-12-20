/**
 * Apple Health Permissions Screen
 * Metric selection before requesting HealthKit permissions
 */

import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Check,
  ArrowLeft,
  Heart,
  ChevronRight,
  Info,
} from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { Platform } from "react-native";
import {
  getAvailableMetricsForProvider,
  getAllGroups,
  getGroupDisplayName,
  getMetricsByGroup,
  type HealthMetric,
} from "@/lib/health/healthMetricsCatalog";
import { appleHealthService } from "@/lib/services/appleHealthService";
import {
  saveProviderConnection,
  type ProviderConnection,
} from "@/lib/health/healthSync";

export default function AppleHealthPermissionsScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set());
  const [availableMetrics, setAvailableMetrics] = useState<HealthMetric[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAvailableMetrics();
  }, []);

  const loadAvailableMetrics = () => {
    const metrics = getAvailableMetricsForProvider("apple_health");
    setAvailableMetrics(metrics);
    // Expand first group by default
    if (metrics.length > 0) {
      setExpandedGroups(new Set([metrics[0].group]));
    }
  };

  const toggleMetric = (metricKey: string) => {
    const newSelected = new Set(selectedMetrics);
    if (newSelected.has(metricKey)) {
      newSelected.delete(metricKey);
    } else {
      newSelected.add(metricKey);
    }
    setSelectedMetrics(newSelected);
  };

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const selectAllMetrics = () => {
    const allKeys = new Set(availableMetrics.map((m) => m.key));
    setSelectedMetrics(allKeys);
  };

  const clearAllMetrics = () => {
    setSelectedMetrics(new Set());
  };

  const handleContinue = async () => {
    if (selectedMetrics.size === 0) {
      Alert.alert(
        "No Metrics Selected",
        "Please select at least one metric to continue."
      );
      return;
    }

    setLoading(true);
    try {
      // Request HealthKit permissions
      const { granted, denied } = await appleHealthService.requestAuthorization(
        Array.from(selectedMetrics)
      );

      // Save connection
      const connection: ProviderConnection = {
        provider: "apple_health",
        connected: granted.length > 0,
        connectedAt: new Date().toISOString(),
        selectedMetrics: Array.from(selectedMetrics),
        grantedMetrics: granted,
        deniedMetrics: denied,
      };

      await saveProviderConnection(connection);

      // Navigate to connected screen
      router.replace("/profile/health/apple-connected" as any);
    } catch (error: any) {
      console.error("Error requesting HealthKit permissions:", error);
      Alert.alert(
        "Permission Error",
        error.message ||
          "Failed to request HealthKit permissions. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (Platform.OS !== "ios") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.text }]}>
            Apple Health is only available on iOS devices.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const groups = getAllGroups();
  const allSelected = selectedMetrics.size === availableMetrics.length;

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
          <Heart size={48} color={theme.primary} />
          <Text style={[styles.title, { color: theme.text }]}>
            Select Metrics
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose which health metrics to sync from Apple Health
          </Text>
        </View>

        {/* Select All Toggle */}
        <View style={styles.selectAllSection}>
          <TouchableOpacity
            style={[
              styles.selectAllButton,
              {
                backgroundColor: allSelected
                  ? theme.primary + "20"
                  : isDark
                    ? "#1E293B"
                    : "#F8FAFC",
              },
            ]}
            onPress={allSelected ? clearAllMetrics : selectAllMetrics}
          >
            <Text
              style={[
                styles.selectAllText,
                {
                  color: allSelected ? theme.primary : theme.text,
                  fontWeight: allSelected ? "600" : "500",
                },
              ]}
            >
              {allSelected ? "✓ All Selected" : "Select All"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Metric Groups */}
        <View style={styles.metricsSection}>
          {groups.map((group) => {
            const groupMetrics = availableMetrics.filter(
              (m) => m.group === group
            );
            if (groupMetrics.length === 0) return null;

            const isExpanded = expandedGroups.has(group);
            const groupSelected = groupMetrics.every((m) =>
              selectedMetrics.has(m.key)
            );
            const someSelected = groupMetrics.some((m) =>
              selectedMetrics.has(m.key)
            );

            return (
              <View
                key={group}
                style={[
                  styles.groupCard,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                {/* Group Header */}
                <TouchableOpacity
                  style={styles.groupHeader}
                  onPress={() => toggleGroup(group)}
                >
                  <View style={styles.groupHeaderLeft}>
                    <Switch
                      value={groupSelected}
                      onValueChange={(value) => {
                        const newSelected = new Set(selectedMetrics);
                        groupMetrics.forEach((m) => {
                          if (value) {
                            newSelected.add(m.key);
                          } else {
                            newSelected.delete(m.key);
                          }
                        });
                        setSelectedMetrics(newSelected);
                      }}
                      trackColor={{
                        false: isDark ? "#334155" : "#E2E8F0",
                        true: theme.primary,
                      }}
                      thumbColor="#FFFFFF"
                    />
                    <Text style={[styles.groupTitle, { color: theme.text }]}>
                      {getGroupDisplayName(group)}
                    </Text>
                    <Text
                      style={[
                        styles.groupCount,
                        { color: theme.textSecondary },
                      ]}
                    >
                      ({groupMetrics.length})
                    </Text>
                  </View>
                  <ChevronRight
                    size={20}
                    color={theme.textSecondary}
                    style={{
                      transform: [{ rotate: isExpanded ? "90deg" : "0deg" }],
                    }}
                  />
                </TouchableOpacity>

                {/* Group Metrics */}
                {isExpanded && (
                  <View style={styles.metricsList}>
                    {groupMetrics.map((metric) => {
                      const isSelected = selectedMetrics.has(metric.key);
                      return (
                        <TouchableOpacity
                          key={metric.key}
                          style={[
                            styles.metricItem,
                            isSelected && {
                              backgroundColor: theme.primary + "10",
                            },
                          ]}
                          onPress={() => toggleMetric(metric.key)}
                        >
                          <View style={styles.metricLeft}>
                            {isSelected ? (
                              <View
                                style={[
                                  styles.checkbox,
                                  { backgroundColor: theme.primary },
                                ]}
                              >
                                <Check size={14} color="#FFFFFF" />
                              </View>
                            ) : (
                              <View
                                style={[
                                  styles.checkbox,
                                  {
                                    borderColor: isDark ? "#475569" : "#CBD5E1",
                                  },
                                ]}
                              />
                            )}
                            <View style={styles.metricInfo}>
                              <Text
                                style={[styles.metricName, { color: theme.text }]}
                              >
                                {metric.displayName}
                              </Text>
                              {metric.unit && (
                                <Text
                                  style={[
                                    styles.metricUnit,
                                    { color: theme.textSecondary },
                                  ]}
                                >
                                  {metric.unit}
                                </Text>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Info size={16} color={theme.textSecondary} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              You can change these permissions later in iOS Settings → Privacy &
              Security → Health
            </Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor:
                  selectedMetrics.size > 0 ? theme.primary : theme.textSecondary,
              },
              selectedMetrics.size === 0 && styles.disabledButton,
            ]}
            onPress={handleContinue}
            disabled={loading || selectedMetrics.size === 0}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  Authorize {selectedMetrics.size} Metric
                  {selectedMetrics.size !== 1 ? "s" : ""}
                </Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </>
            )}
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 16,
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
  selectAllSection: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  selectAllButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  selectAllText: {
    fontSize: 15,
  },
  metricsSection: {
    padding: 24,
    paddingTop: 0,
  },
  groupCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  groupHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  groupTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginLeft: 12,
  },
  groupCount: {
    fontSize: 14,
    marginLeft: 8,
  },
  metricsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  metricLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  metricInfo: {
    flex: 1,
  },
  metricName: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  metricUnit: {
    fontSize: 13,
  },
  infoSection: {
    padding: 24,
    paddingTop: 0,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 8,
    flex: 1,
  },
  ctaSection: {
    padding: 24,
    paddingTop: 8,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    marginRight: 8,
  },
});

