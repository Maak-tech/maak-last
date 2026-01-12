/**
 * Samsung Health Permissions Screen
 * Metric selection before requesting Samsung Health OAuth
 * @module profile/health/samsung-health-permissions
 */

import { useNavigation, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Heart,
  Info,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getAllGroups,
  getAvailableMetricsForProvider,
  getGroupDisplayName,
  type HealthMetric,
} from "@/lib/health/healthMetricsCatalog";
import { samsungHealthService } from "@/lib/services/samsungHealthService";
import { saveProviderConnection } from "@/lib/health/healthSync";
import type { ProviderConnection } from "@/lib/health/healthTypes";

export default function SamsungHealthPermissionsScreen() {
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
  const [connecting, setConnecting] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set());
  const [availableMetrics, setAvailableMetrics] = useState<HealthMetric[]>([]);
  const [groups, setGroups] = useState<string[]>([]);

  // Load available metrics for Samsung Health
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoading(true);

        // Check if Samsung Health is available
        const availability = await samsungHealthService.isAvailable();
        if (!availability.available) {
          Alert.alert(
            isRTL ? "غير متوفر" : "Not Available",
            availability.reason,
            [
              {
                text: isRTL ? "موافق" : "OK",
                onPress: () => router.back(),
              },
            ]
          );
          return;
        }

        // Get available metrics for Samsung Health
        const metrics = getAvailableMetricsForProvider("samsung_health");
        setAvailableMetrics(metrics);

        // Get all metric groups
        const allGroups = getAllGroups();
        setGroups(allGroups);

        // Pre-select some common metrics
        const preSelected = new Set<string>();
        metrics
          .filter((metric) => metric.samsungHealth?.available)
          .slice(0, 5) // Pre-select first 5 available metrics
          .forEach((metric) => preSelected.add(metric.key));

        setSelectedMetrics(preSelected);
      } catch (error) {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL
            ? "فشل في تحميل البيانات المتاحة"
            : "Failed to load available metrics"
        );
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, [isRTL, router]);

  const toggleMetric = (metricKey: string) => {
    const newSelected = new Set(selectedMetrics);
    if (newSelected.has(metricKey)) {
      newSelected.delete(metricKey);
    } else {
      newSelected.add(metricKey);
    }
    setSelectedMetrics(newSelected);
  };

  const toggleGroup = (groupKey: string) => {
    const groupMetrics = availableMetrics.filter((m) => m.group === groupKey);
    const allSelected = groupMetrics.every((m) => selectedMetrics.has(m.key));
    const noneSelected = groupMetrics.every((m) => !selectedMetrics.has(m.key));

    const newSelected = new Set(selectedMetrics);

    if (allSelected) {
      // Deselect all in group
      groupMetrics.forEach((m) => newSelected.delete(m.key));
    } else {
      // Select all in group
      groupMetrics.forEach((m) => newSelected.add(m.key));
    }

    setSelectedMetrics(newSelected);
  };

  const getMetricsInGroup = (groupKey: string) => {
    return availableMetrics.filter((m) => m.group === groupKey);
  };

  const isGroupFullySelected = (groupKey: string) => {
    const groupMetrics = getMetricsInGroup(groupKey);
    return (
      groupMetrics.length > 0 &&
      groupMetrics.every((m) => selectedMetrics.has(m.key))
    );
  };

  const isGroupPartiallySelected = (groupKey: string) => {
    const groupMetrics = getMetricsInGroup(groupKey);
    const selectedCount = groupMetrics.filter((m) => selectedMetrics.has(m.key)).length;
    return selectedCount > 0 && selectedCount < groupMetrics.length;
  };

  const handleConnect = async () => {
    if (selectedMetrics.size === 0) {
      Alert.alert(
        isRTL ? "تحديد مطلوب" : "Selection Required",
        isRTL
          ? "يرجى اختيار نوع واحد على الأقل من البيانات"
          : "Please select at least one type of data"
      );
      return;
    }

    try {
      setConnecting(true);

      // Start OAuth flow
      await samsungHealthService.startAuth(Array.from(selectedMetrics));

      // If we get here, OAuth was successful
      Alert.alert(
        isRTL ? "تم الربط بنجاح" : "Successfully Connected",
        isRTL
          ? "تم ربط سامسونج هيلث بنجاح. سيبدأ مزامنة البيانات قريباً."
          : "Samsung Health connected successfully. Data sync will begin shortly.",
        [
          {
            text: isRTL ? "موافق" : "OK",
            onPress: () => router.replace("/profile/health"),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        isRTL ? "فشل الربط" : "Connection Failed",
        error.message || (isRTL ? "فشل في ربط سامسونج هيلث" : "Failed to connect Samsung Health")
      );
    } finally {
      setConnecting(false);
    }
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
          <Text
            style={[
              styles.loadingText,
              { color: theme.colors.text.secondary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "جاري التحميل..." : "Loading..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
          onPress={() => router.back()}
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
        >
          <ArrowLeft
            color={theme.colors.text.primary}
            size={24}
            style={isRTL && styles.iconRTL}
          />
        </TouchableOpacity>
        <Text
          style={[
            styles.title,
            { color: theme.colors.text.primary },
            isRTL && styles.rtlText,
          ]}
        >
          {isRTL ? "أذونات سامسونج هيلث" : "Samsung Health Permissions"}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Info Section */}
        <View style={styles.infoSection}>
          <View
            style={[
              styles.infoIcon,
              {
                backgroundColor: isDark
                  ? "rgba(34, 197, 94, 0.2)"
                  : "rgba(34, 197, 94, 0.1)",
              },
            ]}
          >
            <Info color="#22C55E" size={24} />
          </View>
          <Text
            style={[
              styles.infoTitle,
              { color: theme.colors.text.primary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "اختر البيانات المراد مشاركتها" : "Choose Data to Share"}
          </Text>
          <Text
            style={[
              styles.infoDescription,
              { color: theme.colors.text.secondary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL
              ? "حدد أنواع البيانات الصحية التي تريد مشاركتها مع التطبيق"
              : "Select the types of health data you want to share with the app"}
          </Text>
        </View>

        {/* Metrics Selection */}
        <View style={styles.metricsSection}>
          {groups.map((groupKey) => {
            const groupMetrics = getMetricsInGroup(groupKey);
            if (groupMetrics.length === 0) return null;

            const groupFullySelected = isGroupFullySelected(groupKey);
            const groupPartiallySelected = isGroupPartiallySelected(groupKey);

            return (
              <View key={groupKey} style={styles.groupContainer}>
                <TouchableOpacity
                  onPress={() => toggleGroup(groupKey)}
                  style={styles.groupHeader}
                >
                  <View style={styles.groupHeaderLeft}>
                    <View
                      style={[
                        styles.checkbox,
                        groupFullySelected && styles.checkboxChecked,
                        groupPartiallySelected && styles.checkboxPartial,
                      ]}
                    >
                      {groupFullySelected && (
                        <Check color="#FFFFFF" size={16} />
                      )}
                      {groupPartiallySelected && !groupFullySelected && (
                        <View style={styles.partialIndicator} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.groupTitle,
                        { color: theme.colors.text.primary },
                        isRTL && styles.rtlText,
                      ]}
                    >
                      {getGroupDisplayName(groupKey, isRTL ? "ar" : "en")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.groupCount,
                      { color: theme.colors.text.tertiary },
                    ]}
                  >
                    {groupMetrics.filter((m) => selectedMetrics.has(m.key)).length}/
                    {groupMetrics.length}
                  </Text>
                </TouchableOpacity>

                {groupMetrics.map((metric) => (
                  <View key={metric.key} style={styles.metricItem}>
                    <TouchableOpacity
                      onPress={() => toggleMetric(metric.key)}
                      style={styles.metricTouchable}
                    >
                      <View
                        style={[
                          styles.metricCheckbox,
                          selectedMetrics.has(metric.key) && styles.metricCheckboxChecked,
                        ]}
                      >
                        {selectedMetrics.has(metric.key) && (
                          <Check color="#FFFFFF" size={14} />
                        )}
                      </View>
                      <View style={styles.metricContent}>
                        <Text
                          style={[
                            styles.metricName,
                            { color: theme.colors.text.primary },
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {metric.displayName}
                        </Text>
                        {metric.description && (
                          <Text
                            style={[
                              styles.metricDescription,
                              { color: theme.colors.text.secondary },
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {metric.description}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        {/* Connect Button */}
        <View style={styles.connectSection}>
          <TouchableOpacity
            onPress={handleConnect}
            disabled={connecting}
            style={[
              styles.connectButton,
              { backgroundColor: "#22C55E" },
              connecting && styles.connectButtonDisabled,
            ]}
          >
            {connecting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.connectButtonText}>
                  {isRTL ? "ربط سامسونج هيلث" : "Connect Samsung Health"}
                </Text>
                <ChevronRight
                  color="#FFFFFF"
                  size={20}
                  style={isRTL && styles.iconRTL}
                />
              </>
            )}
          </TouchableOpacity>

          <Text
            style={[
              styles.selectionSummary,
              { color: theme.colors.text.tertiary },
              isRTL && styles.rtlText,
            ]}
          >
            {selectedMetrics.size} {isRTL ? "عنصر محدد" : "item(s) selected"}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonRTL: {
    transform: [{ scaleX: -1 }],
  },
  title: {
    fontSize: 20,
    fontFamily: "Geist-Bold",
    flex: 1,
    textAlign: "center",
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Geist-Regular",
    marginTop: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  infoSection: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: "rgba(34, 197, 94, 0.05)",
    borderRadius: 12,
    marginBottom: 24,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontFamily: "Geist-Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  metricsSection: {
    marginBottom: 24,
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 8,
    marginBottom: 8,
  },
  groupHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  checkboxPartial: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  partialIndicator: {
    width: 8,
    height: 2,
    backgroundColor: "#FFFFFF",
  },
  groupTitle: {
    fontSize: 16,
    fontFamily: "Geist-SemiBold",
    flex: 1,
  },
  groupCount: {
    fontSize: 14,
    fontFamily: "Geist-Regular",
  },
  metricItem: {
    marginLeft: 36,
    marginBottom: 4,
  },
  metricTouchable: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  metricCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  metricCheckboxChecked: {
    backgroundColor: "#22C55E",
    borderColor: "#22C55E",
  },
  metricContent: {
    flex: 1,
  },
  metricName: {
    fontSize: 14,
    fontFamily: "Geist-Medium",
    marginBottom: 2,
  },
  metricDescription: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    lineHeight: 16,
  },
  connectSection: {
    alignItems: "center",
    paddingTop: 20,
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: "100%",
    marginBottom: 12,
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    fontSize: 16,
    fontFamily: "Geist-Bold",
    color: "#FFFFFF",
    marginRight: 8,
  },
  selectionSummary: {
    fontSize: 12,
    fontFamily: "Geist-Regular",
    textAlign: "center",
  },
  rtlText: {
    textAlign: "right",
  },
  iconRTL: {
    transform: [{ scaleX: -1 }],
  },
});