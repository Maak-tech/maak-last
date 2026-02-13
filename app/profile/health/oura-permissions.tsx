/**
 * Oura Ring Permissions Screen
 * Metric selection before requesting Oura OAuth
 */

import { useNavigation, useRouter } from "expo-router";
import { ArrowLeft, Check, ChevronRight, Info } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
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
  type MetricGroup,
} from "@/lib/health/healthMetricsCatalog";
import { ouraService } from "@/lib/services/ouraService";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Permissions screen intentionally combines selection UX, async loading, and localized rendering.
export default function OuraPermissionsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { i18n } = useTranslation();
  const { theme, isDark } = useTheme();

  const isRTL = i18n.language === "ar";

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set()
  );
  const [availableMetrics, setAvailableMetrics] = useState<HealthMetric[]>([]);
  const [groups, setGroups] = useState<MetricGroup[]>([]);

  useEffect(() => {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Load flow combines availability checks, preselection logic, and localized alerts.
    const loadMetrics = async () => {
      try {
        setLoading(true);

        const availability = await ouraService.isAvailable();
        if (!availability.available) {
          Alert.alert(
            isRTL ? "غير متوفر" : "Not Available",
            availability.reason,
            [{ text: isRTL ? "موافق" : "OK", onPress: () => router.back() }]
          );
          return;
        }

        const metrics = getAvailableMetricsForProvider("oura");
        setAvailableMetrics(metrics);

        const allGroups = getAllGroups();
        setGroups(allGroups);

        const preSelected = new Set<string>();
        const available = metrics.filter((metric) => metric.oura?.available);
        for (const metric of available.slice(0, 5)) {
          preSelected.add(metric.key);
        }

        setSelectedMetrics(preSelected);
      } catch (_error) {
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

  const toggleGroup = (groupKey: MetricGroup) => {
    const groupMetrics = availableMetrics.filter((m) => m.group === groupKey);
    const allSelected = groupMetrics.every((m) => selectedMetrics.has(m.key));

    const newSelected = new Set(selectedMetrics);

    if (allSelected) {
      for (const m of groupMetrics) {
        newSelected.delete(m.key);
      }
    } else {
      for (const m of groupMetrics) {
        newSelected.add(m.key);
      }
    }

    setSelectedMetrics(newSelected);
  };

  const getMetricsInGroup = (groupKey: MetricGroup) =>
    availableMetrics.filter((m) => m.group === groupKey);

  const isGroupFullySelected = (groupKey: MetricGroup) => {
    const groupMetrics = getMetricsInGroup(groupKey);
    return (
      groupMetrics.length > 0 &&
      groupMetrics.every((m) => selectedMetrics.has(m.key))
    );
  };

  const isGroupPartiallySelected = (groupKey: MetricGroup) => {
    const groupMetrics = getMetricsInGroup(groupKey);
    const selectedCount = groupMetrics.filter((m) =>
      selectedMetrics.has(m.key)
    ).length;
    return selectedCount > 0 && selectedCount < groupMetrics.length;
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Connection flow includes validation, OAuth, and localized success/failure states.
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
      await ouraService.startAuth(Array.from(selectedMetrics));

      Alert.alert(
        isRTL ? "تم الربط بنجاح" : "Successfully Connected",
        isRTL
          ? "تم ربط خاتم أورا بنجاح. سيبدأ مزامنة البيانات قريباً."
          : "Oura Ring connected successfully. Data sync will begin shortly.",
        [
          {
            text: isRTL ? "موافق" : "OK",
            onPress: () => router.replace("/profile/health-integrations"),
          },
        ]
      );
    } catch (error: unknown) {
      Alert.alert(
        isRTL ? "فشل الربط" : "Connection Failed",
        getErrorMessage(error, "") ||
          (isRTL ? "فشل في ربط خاتم أورا" : "Failed to connect Oura Ring")
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
          {isRTL ? "أذونات خاتم أورا" : "Oura Ring Permissions"}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoSection}>
          <View
            style={[
              styles.infoIcon,
              {
                backgroundColor: isDark
                  ? "rgba(139, 92, 246, 0.2)"
                  : "rgba(139, 92, 246, 0.1)",
              },
            ]}
          >
            <Info color="#8B5CF6" size={24} />
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

        <View style={styles.metricsSection}>
          {groups.map((groupKey) => {
            const groupMetrics = getMetricsInGroup(groupKey);
            if (groupMetrics.length === 0) {
              return null;
            }

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
                      {groupFullySelected ? (
                        <Check color="#FFFFFF" size={16} />
                      ) : null}
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
                    {
                      groupMetrics.filter((m) => selectedMetrics.has(m.key))
                        .length
                    }
                    /{groupMetrics.length}
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
                          selectedMetrics.has(metric.key) &&
                            styles.metricCheckboxChecked,
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
                        {metric.description ? (
                          <Text
                            style={[
                              styles.metricDescription,
                              { color: theme.colors.text.secondary },
                              isRTL && styles.rtlText,
                            ]}
                          >
                            {metric.description}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        <View style={styles.connectSection}>
          <TouchableOpacity
            disabled={connecting}
            onPress={handleConnect}
            style={[
              styles.connectButton,
              { backgroundColor: "#8B5CF6" },
              connecting && styles.connectButtonDisabled,
            ]}
          >
            {connecting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.connectButtonText}>
                  {isRTL ? "ربط خاتم أورا" : "Connect Oura Ring"}
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
  container: { flex: 1 },
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
  backButtonRTL: { transform: [{ scaleX: -1 }] },
  title: {
    fontSize: 20,
    fontFamily: "Inter-Bold",
    flex: 1,
    textAlign: "center",
  },
  placeholder: { width: 40 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 16, fontFamily: "Inter-Regular", marginTop: 16 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  infoSection: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: "rgba(139, 92, 246, 0.05)",
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
    fontFamily: "Inter-Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  metricsSection: { marginBottom: 24 },
  groupContainer: { marginBottom: 16 },
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
  groupHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
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
  checkboxChecked: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  checkboxPartial: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
  partialIndicator: { width: 8, height: 2, backgroundColor: "#FFFFFF" },
  groupTitle: { fontSize: 16, fontFamily: "Inter-SemiBold", flex: 1 },
  groupCount: { fontSize: 14, fontFamily: "Inter-Regular" },
  metricItem: { marginLeft: 36, marginBottom: 4 },
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
  metricCheckboxChecked: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  metricContent: { flex: 1 },
  metricName: { fontSize: 14, fontFamily: "Inter-Medium", marginBottom: 2 },
  metricDescription: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    lineHeight: 16,
  },
  connectSection: { alignItems: "center", paddingTop: 20 },
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
  connectButtonDisabled: { opacity: 0.6 },
  connectButtonText: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
    marginRight: 8,
  },
  selectionSummary: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    textAlign: "center",
  },
  rtlText: { textAlign: "right" },
  iconRTL: { transform: [{ scaleX: -1 }] },
});
