/**
 * Fitbit Permissions Screen
 * Metric selection before requesting Fitbit OAuth
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
import { fitbitService } from "@/lib/services/fitbitService";
import { saveProviderConnection } from "@/lib/health/healthSync";
import type { ProviderConnection } from "@/lib/health/healthTypes";

export default function FitbitPermissionsScreen() {
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

  const [loading, setLoading] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set()
  );
  const [availableMetrics, setAvailableMetrics] = useState<HealthMetric[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [fitbitAvailable, setFitbitAvailable] = useState<boolean | null>(
    null
  );
  const [availabilityReason, setAvailabilityReason] = useState<
    string | undefined
  >();

  useEffect(() => {
    loadAvailableMetrics();
    checkFitbitAvailability();
  }, []);

  const checkFitbitAvailability = async () => {
    try {
      const availability = await fitbitService.isAvailable();
      setFitbitAvailable(availability.available);
      setAvailabilityReason(availability.reason);
    } catch (error) {
      setFitbitAvailable(false);
      setAvailabilityReason(
        "Failed to check Fitbit availability. Please try again."
      );
    }
  };

  const loadAvailableMetrics = () => {
    const metrics = getAvailableMetricsForProvider("fitbit");
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
        isRTL ? "لم يتم اختيار مقاييس" : "No Metrics Selected",
        isRTL
          ? "يرجى اختيار مقياس واحد على الأقل للمتابعة"
          : "Please select at least one metric to continue."
      );
      return;
    }

    setLoading(true);

    try {
      // Check availability before proceeding
      const availability = await fitbitService.isAvailable();

      if (!availability.available) {
        setLoading(false);
        Alert.alert(
          isRTL ? "Fitbit غير متاح" : "Fitbit Not Available",
          availability.reason ||
            (isRTL
              ? "Fitbit غير متاح. يرجى التأكد من تكوين بيانات اعتماد Fitbit في إعدادات التطبيق."
              : "Fitbit is not available. Please ensure Fitbit credentials are configured in app settings.")
        );
        return;
      }

      // Start OAuth flow
      await fitbitService.startAuth(Array.from(selectedMetrics));

      // If we get here, the OAuth flow completed successfully
      // The connection is saved in fitbitService.handleRedirect()
      // Navigate to connected screen
      router.replace("/profile/health/fitbit-connected" as any);
    } catch (error: any) {
      console.error("[Fitbit Permissions] Auth error:", error);
      
      let errorMessage = isRTL
        ? "فشل طلب إذن Fitbit. يرجى المحاولة مرة أخرى."
        : "Failed to request Fitbit permissions. Please try again.";

      if (error?.message) {
        errorMessage = error.message;
      }

      Alert.alert(
        isRTL ? "خطأ في الإذن" : "Permission Error",
        errorMessage
      );
    } finally {
      setLoading(false);
    }
  };

  // Show error if Fitbit is not available
  if (fitbitAvailable === false) {
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
              color="#1E293B"
              size={24}
              style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
            />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
            {isRTL ? "أذونات Fitbit" : "Fitbit Permissions"}
          </Text>

          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <Text
            style={[styles.errorText, { color: theme.colors.text.primary }]}
          >
            {availabilityReason || (isRTL ? "Fitbit غير متاح" : "Fitbit is not available")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const groups = getAllGroups();
  const allSelected = selectedMetrics.size === availableMetrics.length;

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
            color="#1E293B"
            size={24}
            style={[isRTL && { transform: [{ rotate: "180deg" }] }]}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {isRTL ? "أذونات Fitbit" : "Fitbit Permissions"}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Intro Section */}
        <View style={styles.introSection}>
          <Heart color={theme.colors.primary.main} size={48} />
          <Text
            style={[
              styles.title,
              { color: theme.colors.text.primary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL ? "اختر المقاييس" : "Select Metrics"}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: theme.colors.text.secondary },
              isRTL && styles.rtlText,
            ]}
          >
            {isRTL
              ? "اختر مقاييس الصحة التي تريد مزامنتها من Fitbit"
              : "Choose which health metrics to sync from Fitbit"}
          </Text>
        </View>

        {/* Select All Toggle */}
        <View style={styles.selectAllSection}>
          <TouchableOpacity
            onPress={allSelected ? clearAllMetrics : selectAllMetrics}
            style={[
              styles.selectAllButton,
              {
                backgroundColor: allSelected
                  ? theme.colors.primary.main + "20"
                  : isDark
                    ? "#1E293B"
                    : "#F8FAFC",
              },
            ]}
          >
            <Text
              style={[
                styles.selectAllText,
                {
                  color: allSelected
                    ? theme.colors.primary.main
                    : theme.colors.text.primary,
                  fontWeight: allSelected ? "600" : "500",
                },
              ]}
            >
              {allSelected
                ? isRTL
                  ? "✓ تم اختيار الكل"
                  : "✓ All Selected"
                : isRTL
                  ? "اختر الكل"
                  : "Select All"}
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
                  onPress={() => toggleGroup(group)}
                  style={styles.groupHeader}
                >
                  <View style={styles.groupHeaderLeft}>
                    <Switch
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
                      thumbColor="#FFFFFF"
                      trackColor={{
                        false: isDark ? "#334155" : "#E2E8F0",
                        true: theme.colors.primary.main,
                      }}
                      value={groupSelected}
                    />
                    <Text
                      style={[
                        styles.groupTitle,
                        { color: theme.colors.text.primary },
                      ]}
                    >
                      {getGroupDisplayName(group)}
                    </Text>
                    <Text
                      style={[
                        styles.groupCount,
                        { color: theme.colors.text.secondary },
                      ]}
                    >
                      ({groupMetrics.length})
                    </Text>
                  </View>
                  <ChevronRight
                    color={theme.colors.text.secondary}
                    size={20}
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
                          onPress={() => toggleMetric(metric.key)}
                          style={[
                            styles.metricItem,
                            isSelected && {
                              backgroundColor: theme.colors.primary.main + "10",
                            },
                          ]}
                        >
                          <View style={styles.metricLeft}>
                            {isSelected ? (
                              <View
                                style={[
                                  styles.checkbox,
                                  {
                                    backgroundColor: theme.colors.primary.main,
                                  },
                                ]}
                              >
                                <Check color="#FFFFFF" size={14} />
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
                                style={[
                                  styles.metricName,
                                  { color: theme.colors.text.primary },
                                ]}
                              >
                                {metric.displayName}
                              </Text>
                              {metric.unit && (
                                <Text
                                  style={[
                                    styles.metricUnit,
                                    { color: theme.colors.text.secondary },
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
            <Info color={theme.colors.text.secondary} size={16} />
            <Text
              style={[styles.infoText, { color: theme.colors.text.secondary }]}
            >
              {isRTL
                ? "سيتم توجيهك إلى موقع Fitbit للمصادقة. يمكنك تغيير هذه الأذونات لاحقًا في إعدادات التطبيق."
                : "You will be redirected to Fitbit's website for authentication. You can change these permissions later in app settings."}
            </Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            disabled={loading || selectedMetrics.size === 0}
            onPress={handleContinue}
            style={[
              styles.primaryButton,
              {
                backgroundColor:
                  selectedMetrics.size > 0
                    ? theme.colors.primary.main
                    : theme.colors.text.secondary,
              },
              selectedMetrics.size === 0 && styles.disabledButton,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {isRTL
                    ? `الموافقة على ${selectedMetrics.size} مقياس${
                        selectedMetrics.size !== 1 ? "ات" : ""
                      }`
                    : `Authorize ${selectedMetrics.size} Metric${
                        selectedMetrics.size !== 1 ? "s" : ""
                      }`}
                </Text>
                <ChevronRight color="#FFFFFF" size={20} />
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
  rtlText: {
    fontFamily: "Geist-Regular",
  },
  introSection: {
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "Geist-Bold",
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

