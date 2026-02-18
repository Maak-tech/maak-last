/* biome-ignore-all lint/style/noNestedTernary: preserving existing conditional layout flow while iterating in batches. */
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  Droplet,
  Plus,
  TestTube,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  type StyleProp,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Button, Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { labResultService } from "@/lib/services/labResultService";
import type { LabResult } from "@/types";
import { safeFormatDate } from "@/utils/dateFormat";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: screen bundles data loading, filtering, list and modal rendering.
export default function LabResultsScreen() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const isRTL = i18n.language === "ar";

  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);

  const getResultStatus = (result: LabResult) => {
    const hasFlagged = result.results?.some((entry) => entry.flagged);
    const hasAbnormal = result.results?.some(
      (entry) =>
        entry.status &&
        entry.status !== "normal" &&
        entry.status !== "low" &&
        entry.status !== "high"
    );
    const hasHighLow = result.results?.some(
      (entry) => entry.status === "high" || entry.status === "low"
    );
    return hasFlagged || hasAbnormal || hasHighLow ? "review" : "normal";
  };

  const normalCount = labResults.filter(
    (result) => getResultStatus(result) === "normal"
  ).length;
  const reviewCount = Math.max(labResults.length - normalCount, 0);

  const styles = createThemedStyles((screenTheme) => ({
    container: {
      flex: 1,
      backgroundColor: screenTheme.colors.background.primary,
    },
    figmaLabHeaderWrap: {
      marginBottom: 12,
    },
    figmaLabHeaderContent: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 16,
    },
    figmaLabHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    figmaLabBackButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(0, 53, 67, 0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    figmaLabHeaderTitle: {
      flex: 1,
    },
    figmaLabTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    figmaLabTitle: {
      fontSize: 22,
      fontFamily: "Inter-Bold",
      color: "#003543",
    },
    figmaLabSubtitle: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "rgba(0, 53, 67, 0.85)",
    },
    figmaLabContent: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 160,
      gap: 24,
    },
    figmaLabSectionHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: 16,
    },
    figmaLabSectionTitle: {
      fontSize: 18,
      fontFamily: "Inter-SemiBold",
      color: "#1A1D1F",
    },
    figmaLabViewAllLink: {
      fontSize: 14,
      fontFamily: "Inter-Medium",
      color: "#003543",
    },
    figmaLabTipsCard: {
      backgroundColor: "transparent",
      borderRadius: 16,
      padding: 20,
      overflow: "hidden" as const,
    },
    figmaLabTipsCardInner: {
      padding: 20,
      borderRadius: 16,
    },
    figmaLabTipsTitle: {
      fontSize: 16,
      fontFamily: "Inter-SemiBold",
      color: "#1A1D1F",
      marginBottom: 8,
    },
    figmaLabTipsText: {
      fontSize: 14,
      fontFamily: "Inter-Regular",
      color: "#6C7280",
      lineHeight: 22,
    },
    figmaLabFAB: {
      position: "absolute" as const,
      right: 24,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#EB9C0C",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    content: {
      flex: 1,
    },
    header: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    headerTitle: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary),
      fontSize: 24,
    },
    addButton: {
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.borderRadius.full,
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    resultsList: {
      padding: theme.spacing.base,
      gap: theme.spacing.base,
    },
    resultCard: {
      marginBottom: theme.spacing.base,
    },
    resultHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: theme.spacing.sm,
    },
    resultTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.text.primary),
      flex: 1,
    },
    resultDate: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      marginTop: 4,
    },
    resultMeta: {
      flexDirection: isRTL ? "row-reverse" : "row",
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm,
      flexWrap: "wrap",
    },
    resultValues: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    resultValueItem: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.sm,
    },
    resultValueName: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.primary),
      flex: 1,
    },
    resultValueData: {
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    resultValueText: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
    },
    resultValueUnit: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
    },
    emptyText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      textAlign: "center",
      marginTop: theme.spacing.base,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    modalHeader: {
      flexDirection: isRTL ? "row-reverse" : "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    modalContent: {
      padding: theme.spacing.base,
    },
    rtlText: {
      textAlign: (isRTL ? "right" : "left") as TextStyle["textAlign"],
    } as TextStyle,
    // Figma-aligned stats row
    figmaLabStatsRow: {
      flexDirection: "row" as const,
      gap: 12,
      marginBottom: 20,
    },
    figmaLabStatCard: {
      flex: 1,
      backgroundColor: "#FFFFFF",
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 12,
      alignItems: "center" as const,
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    figmaLabStatValue: {
      fontSize: 20,
      fontFamily: "Inter-Bold",
      color: "#003543",
      marginBottom: 4,
    },
    figmaLabStatLabel: {
      fontSize: 11,
      fontFamily: "Inter-SemiBold",
      color: "#64748B",
    },
    // Figma-aligned result cards
    figmaLabCard: {
      padding: 20,
      marginBottom: 0,
    },
    figmaLabCardHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
      marginBottom: 12,
    },
    figmaLabCardTitleWrap: {
      flex: 1,
    },
    figmaLabCardTitle: {
      fontSize: 16,
      fontFamily: "Inter-SemiBold",
      color: "#1A1D1F",
      marginBottom: 4,
    },
    figmaLabCardMeta: {
      fontSize: 13,
      fontFamily: "Inter-Regular",
      color: "#6C7280",
    },
    figmaLabCardHeaderActions: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
    },
    figmaLabStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    figmaLabStatusText: {
      fontSize: 12,
      fontFamily: "Inter-SemiBold",
    },
    figmaLabDownloadButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: "rgba(0, 53, 67, 0.1)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    // Figma-aligned result rows
    figmaLabResultsList: {
      gap: 8,
      marginTop: 4,
    },
    figmaLabResultRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      backgroundColor: "#F9FAFB",
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    figmaLabResultLabel: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
    },
    figmaLabResultName: {
      fontSize: 14,
      fontFamily: "Inter-Medium",
      color: "#1A1D1F",
    },
    figmaLabResultIconWrap: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    figmaLabResultValue: {
      alignItems: "flex-end" as const,
    },
    figmaLabResultValueText: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: "#003543",
    },
    figmaLabResultRange: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: "#6C7280",
      marginTop: 2,
    },
    // View full report button
    figmaLabViewButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 4,
      paddingVertical: 10,
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: "#F3F4F6",
    },
    figmaLabViewButtonText: {
      fontSize: 14,
      fontFamily: "Inter-SemiBold",
      color: "#003543",
    },
  }))(theme);

  const loadLabResults = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const results = await labResultService.getUserLabResults(user.id);

        setLabResults(results);
      } catch (_error) {
        Alert.alert(
          isRTL ? "خطأ" : "Error",
          isRTL ? "فشل تحميل نتائج المختبر" : "Failed to load lab results"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, isRTL]
  );

  useEffect(() => {
    loadLabResults();
  }, [loadLabResults]);

  const formatDate = (date: Date) =>
    safeFormatDate(date, isRTL ? "ar-u-ca-gregory" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const getStatusColor = (status?: LabResult["results"][0]["status"]) => {
    switch (status) {
      case "high":
      case "critical":
        return theme.colors.accent.error;
      case "low":
        return theme.colors.accent.warning;
      case "abnormal":
        return theme.colors.accent.warning;
      case "normal":
        return theme.colors.accent.success;
      default:
        return theme.colors.text.secondary;
    }
  };

  const getStatusLabel = (status?: LabResult["results"][0]["status"]) => {
    if (!status) {
      return "";
    }
    const labels: Record<string, { en: string; ar: string }> = {
      normal: { en: "Normal", ar: "طبيعي" },
      high: { en: "High", ar: "مرتفع" },
      low: { en: "Low", ar: "منخفض" },
      abnormal: { en: "Abnormal", ar: "غير طبيعي" },
      critical: { en: "Critical", ar: "حرج" },
    };
    return isRTL ? labels[status]?.ar || status : labels[status]?.en || status;
  };

  const getTestTypeBadgeVariant = (type: LabResult["testType"]) => {
    if (type === "blood") {
      return "error";
    }
    if (type === "urine") {
      return "info";
    }
    return "outline";
  };

  const getResultBadgeVariant = (
    status?: LabResult["results"][0]["status"]
  ) => {
    if (status === "normal") {
      return "success";
    }
    if (status === "high" || status === "critical") {
      return "error";
    }
    return "warning";
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container as StyleProp<ViewStyle>}>
        <View style={styles.emptyContainer as StyleProp<ViewStyle>}>
          <Text style={styles.emptyText as StyleProp<TextStyle>}>
            {isRTL ? "يجب تسجيل الدخول" : "Please log in"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container as StyleProp<ViewStyle>}
    >
      <View style={styles.figmaLabHeaderWrap as StyleProp<ViewStyle>}>
        <WavyBackground curve="home" height={240} variant="teal">
          <View style={styles.figmaLabHeaderContent as StyleProp<ViewStyle>}>
            <View style={styles.figmaLabHeaderRow as StyleProp<ViewStyle>}>
              <TouchableOpacity
                onPress={() =>
                  params.returnTo === "track"
                    ? router.push("/(tabs)/track")
                    : router.back()
                }
                style={styles.figmaLabBackButton as StyleProp<ViewStyle>}
              >
                <ArrowLeft color="#003543" size={20} />
              </TouchableOpacity>
              <View style={styles.figmaLabHeaderTitle as StyleProp<ViewStyle>}>
                <View style={styles.figmaLabTitleRow as StyleProp<ViewStyle>}>
                  <Droplet color="#EB9C0C" size={20} />
                  <Text style={styles.figmaLabTitle as TextStyle}>
                    {isRTL ? "نتائج المختبر" : "Lab Results"}
                  </Text>
                </View>
                <Text style={styles.figmaLabSubtitle as TextStyle}>
                  {isRTL
                    ? "تتبع نتائج الفحوصات وحفظها"
                    : "Track and store test results"}
                </Text>
              </View>
            </View>
          </View>
        </WavyBackground>
      </View>
      {/* Results List */}
      {loading ? (
        <View style={styles.emptyContainer as StyleProp<ViewStyle>}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      ) : labResults.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer as StyleProp<ViewStyle>}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadLabResults(true)}
              refreshing={refreshing}
            />
          }
        >
          <TestTube color={theme.colors.text.secondary} size={64} />
          <Text
            style={[
              styles.emptyText as StyleProp<TextStyle>,
              isRTL && (styles.rtlText as StyleProp<TextStyle>),
            ]}
          >
            {isRTL ? "لا توجد نتائج مختبر مسجلة" : "No lab results recorded"}
          </Text>
          <Button
            onPress={() => router.push("/(tabs)/lab-results/add")}
            style={{ marginTop: theme.spacing.base }}
            title={isRTL ? "إضافة نتيجة مختبر" : "Add Lab Result"}
            variant="primary"
          />
          <View
            style={[
              styles.figmaLabTipsCard as StyleProp<ViewStyle>,
              { marginTop: 24, marginHorizontal: 20 },
            ]}
          >
            <View
              style={[
                styles.figmaLabTipsCardInner as StyleProp<ViewStyle>,
                { backgroundColor: "rgba(59, 130, 246, 0.1)" },
              ]}
            >
              <Text style={styles.figmaLabTipsTitle as TextStyle}>
                💡 {isRTL ? "نصائح فحص المختبر" : "Lab Test Tips"}
              </Text>
              <Text
                style={[
                  styles.figmaLabTipsText as TextStyle,
                  isRTL && (styles.rtlText as StyleProp<TextStyle>),
                ]}
              >
                {isRTL
                  ? "• صوم 8-12 ساعة قبل فحوصات الدهون والجلوكوز\n• اشرب الماء قبل سحب الدم\n• أحضر النتائج السابقة للمقارنة\n• ناقش النتائج غير الطبيعية مع طبيبك"
                  : "• Fast 8-12 hours before lipid and glucose tests\n• Stay hydrated before blood draws\n• Bring previous results for comparison\n• Discuss abnormal results with your doctor"}
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.figmaLabContent as StyleProp<ViewStyle>}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadLabResults(true)}
              refreshing={refreshing}
            />
          }
          style={styles.content as StyleProp<ViewStyle>}
        >
          <View style={styles.figmaLabStatsRow as StyleProp<ViewStyle>}>
            <View style={styles.figmaLabStatCard as StyleProp<ViewStyle>}>
              <Text style={styles.figmaLabStatValue as TextStyle}>
                {labResults.length}
              </Text>
              <Text style={styles.figmaLabStatLabel as TextStyle}>
                {isRTL ? "فحوصات حديثة" : "Recent Tests"}
              </Text>
            </View>
            <View style={styles.figmaLabStatCard as StyleProp<ViewStyle>}>
              <Text
                style={[
                  styles.figmaLabStatValue as TextStyle,
                  { color: "#10B981" },
                ]}
              >
                {normalCount}
              </Text>
              <Text style={styles.figmaLabStatLabel as TextStyle}>
                {isRTL ? "طبيعي" : "Normal"}
              </Text>
            </View>
            <View style={styles.figmaLabStatCard as StyleProp<ViewStyle>}>
              <Text
                style={[
                  styles.figmaLabStatValue as TextStyle,
                  { color: "#F97316" },
                ]}
              >
                {reviewCount}
              </Text>
              <Text style={styles.figmaLabStatLabel as TextStyle}>
                {isRTL ? "تحتاج مراجعة" : "Needs Review"}
              </Text>
            </View>
          </View>
          <View style={styles.figmaLabSectionHeader as StyleProp<ViewStyle>}>
            <Text style={styles.figmaLabSectionTitle as TextStyle}>
              {isRTL ? "الاختبارات الأخيرة" : "Recent Tests"}
            </Text>
            <TouchableOpacity>
              <Text style={styles.figmaLabViewAllLink as TextStyle}>
                {isRTL ? "عرض الكل" : "View All"}
              </Text>
            </TouchableOpacity>
          </View>
          {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: card markup includes multiple health-result render branches. */}
          {labResults.map((result) => {
            const status = getResultStatus(result);
            const statusColor = status === "normal" ? "#10B981" : "#F97316";
            const facilityLabel =
              result.facility || result.orderedBy || (isRTL ? "مختبر" : "Lab");
            const resultsPreview = result.results?.slice(0, 4) ?? [];
            return (
              <Card
                contentStyle={undefined}
                key={result.id}
                onPress={() => {
                  setSelectedResult(result);
                  setShowAddModal(true);
                }}
                style={styles.figmaLabCard as StyleProp<ViewStyle>}
                variant="elevated"
              >
                <View style={styles.figmaLabCardHeader as StyleProp<ViewStyle>}>
                  <View style={styles.figmaLabCardTitleWrap as ViewStyle}>
                    <TypographyText
                      style={styles.figmaLabCardTitle as TextStyle}
                      weight="bold"
                    >
                      {result.testName}
                    </TypographyText>
                    <Text style={styles.figmaLabCardMeta as TextStyle}>
                      {formatDate(result.testDate) || ""} •{" "}
                      {facilityLabel || ""}
                    </Text>
                  </View>
                  <View style={styles.figmaLabCardHeaderActions as ViewStyle}>
                    <View
                      style={[
                        styles.figmaLabStatusBadge as ViewStyle,
                        { backgroundColor: `${statusColor}15` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.figmaLabStatusText as TextStyle,
                          { color: statusColor },
                        ]}
                      >
                        {status === "normal"
                          ? isRTL
                            ? "طبيعي"
                            : "Normal"
                          : isRTL
                            ? "مراجعة"
                            : "Review"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        const url = result.attachments?.[0];
                        if (url) {
                          Linking.openURL(url).catch(() => {
                            Alert.alert(
                              isRTL ? "خطأ" : "Error",
                              isRTL
                                ? "تعذر فتح الملف."
                                : "Unable to open attachment."
                            );
                          });
                        }
                      }}
                      style={styles.figmaLabDownloadButton as ViewStyle}
                    >
                      <Download color="#003543" size={16} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.figmaLabResultsList as ViewStyle}>
                  {resultsPreview.map((value) => {
                    const valueStatus = value.status;
                    const valueColor =
                      valueStatus === "high"
                        ? "#F97316"
                        : valueStatus === "low"
                          ? "#3B82F6"
                          : valueStatus === "critical"
                            ? "#EF4444"
                            : "#10B981";
                    return (
                      <View
                        key={`${result.id}-${value.name}-${String(value.value)}-${value.unit ?? ""}`}
                        style={styles.figmaLabResultRow as ViewStyle}
                      >
                        <View style={styles.figmaLabResultLabel as ViewStyle}>
                          <Text style={styles.figmaLabResultName as TextStyle}>
                            {value.name}
                          </Text>
                          {valueStatus && valueStatus !== "normal" ? (
                            <View
                              style={[
                                styles.figmaLabResultIconWrap as ViewStyle,
                                { borderColor: valueColor },
                              ]}
                            >
                              {valueStatus === "low" ? (
                                <TrendingDown color={valueColor} size={12} />
                              ) : (
                                <TrendingUp color={valueColor} size={12} />
                              )}
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.figmaLabResultValue as ViewStyle}>
                          <Text style={styles.figmaLabResultValueText}>
                            {value.value} {value.unit || ""}
                          </Text>
                          {value.referenceRange ? (
                            <Text style={styles.figmaLabResultRange}>
                              Range: {value.referenceRange}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setSelectedResult(result);
                    setShowAddModal(true);
                  }}
                  style={styles.figmaLabViewButton as ViewStyle}
                >
                  <Text style={styles.figmaLabViewButtonText as TextStyle}>
                    View Full Report
                  </Text>
                  <ChevronRight color="#003543" size={14} />
                </TouchableOpacity>
              </Card>
            );
          })}
          <View style={styles.figmaLabTipsCard as StyleProp<ViewStyle>}>
            <View
              style={[
                styles.figmaLabTipsCardInner as StyleProp<ViewStyle>,
                {
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                },
              ]}
            >
              <Text style={styles.figmaLabTipsTitle as TextStyle}>
                💡 {isRTL ? "نصائح فحص المختبر" : "Lab Test Tips"}
              </Text>
              <Text
                style={[
                  styles.figmaLabTipsText as TextStyle,
                  isRTL && (styles.rtlText as StyleProp<TextStyle>),
                ]}
              >
                {isRTL
                  ? "• صوم 8-12 ساعة قبل فحوصات الدهون والجلوكوز\n• اشرب الماء قبل سحب الدم\n• أحضر النتائج السابقة للمقارنة\n• ناقش النتائج غير الطبيعية مع طبيبك"
                  : "• Fast 8-12 hours before lipid and glucose tests\n• Stay hydrated before blood draws\n• Bring previous results for comparison\n• Discuss abnormal results with your doctor"}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push("/(tabs)/lab-results/add")}
        style={[
          styles.figmaLabFAB as StyleProp<ViewStyle>,
          { bottom: Math.max(insets.bottom, 12) + 80 },
        ]}
      >
        <Plus color="#FFFFFF" size={24} />
      </TouchableOpacity>
      {/* Detail Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          setSelectedResult(null);
        }}
        presentationStyle="pageSheet"
        visible={showAddModal && !!selectedResult}
      >
        <SafeAreaView style={styles.modalContainer as StyleProp<ViewStyle>}>
          <View style={styles.modalHeader as StyleProp<ViewStyle>}>
            <Heading
              level={5}
              style={[
                styles.resultTitle as TextStyle,
                isRTL ? (styles.rtlText as TextStyle) : undefined,
              ]}
            >
              {selectedResult?.testName}
            </Heading>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                setSelectedResult(null);
              }}
            >
              <X color={theme.colors.text.primary} size={24} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent as StyleProp<ViewStyle>}>
            {selectedResult ? (
              <>
                <View style={{ marginBottom: theme.spacing.base }}>
                  <Caption
                    numberOfLines={1}
                    style={[
                      styles.resultDate as TextStyle,
                      isRTL ? (styles.rtlText as TextStyle) : undefined,
                    ]}
                  >
                    {isRTL ? "التاريخ: " : "Date: "}
                    {formatDate(selectedResult.testDate) || ""}
                  </Caption>
                  {selectedResult.facility ? (
                    <Caption
                      numberOfLines={1}
                      style={[
                        styles.resultDate as TextStyle,
                        isRTL ? (styles.rtlText as TextStyle) : undefined,
                      ]}
                    >
                      {isRTL ? "المنشأة: " : "Facility: "}
                      {selectedResult.facility}
                    </Caption>
                  ) : null}
                  {selectedResult.orderedBy ? (
                    <Caption
                      numberOfLines={1}
                      style={[
                        styles.resultDate as TextStyle,
                        isRTL ? (styles.rtlText as TextStyle) : undefined,
                      ]}
                    >
                      {isRTL ? "طلب من: " : "Ordered by: "}
                      {selectedResult.orderedBy}
                    </Caption>
                  ) : null}
                </View>

                {selectedResult.results.length > 0 ? (
                  <View style={styles.resultValues as StyleProp<ViewStyle>}>
                    {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: modal result items include conditional medical metadata badges and text. */}
                    {selectedResult.results.map((value) => (
                      <View
                        key={`${selectedResult.id}-${value.name}-${String(value.value)}-${value.referenceRange ?? ""}`}
                        style={styles.resultValueItem as StyleProp<ViewStyle>}
                      >
                        <View style={{ flex: 1 }}>
                          <TypographyText
                            style={[
                              styles.resultValueName as StyleProp<TextStyle>,
                              isRTL && (styles.rtlText as StyleProp<TextStyle>),
                            ]}
                            weight="semibold"
                          >
                            {value.name}
                          </TypographyText>
                          {value.referenceRange ? (
                            <Caption
                              numberOfLines={1}
                              style={[
                                styles.resultDate as StyleProp<TextStyle>,
                                isRTL &&
                                  (styles.rtlText as StyleProp<TextStyle>),
                              ]}
                            >
                              {isRTL ? "النطاق المرجعي: " : "Reference: "}
                              {value.referenceRange}
                            </Caption>
                          ) : null}
                        </View>
                        <View
                          style={styles.resultValueData as StyleProp<ViewStyle>}
                        >
                          <TypographyText
                            style={[
                              styles.resultValueText as StyleProp<TextStyle>,
                              { color: getStatusColor(value.status) },
                            ]}
                          >
                            {value.value}
                          </TypographyText>
                          {value.unit ? (
                            <Caption
                              numberOfLines={1}
                              style={
                                styles.resultValueUnit as StyleProp<TextStyle>
                              }
                            >
                              {value.unit}
                            </Caption>
                          ) : null}
                          {value.status ? (
                            <Badge
                              size="small"
                              style={{}}
                              variant={getResultBadgeVariant(value.status)}
                            >
                              {getStatusLabel(value.status)}
                            </Badge>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                {selectedResult.notes ? (
                  <View style={{ marginTop: theme.spacing.base }}>
                    <TypographyText
                      style={[
                        styles.resultValueName as StyleProp<TextStyle>,
                        isRTL && (styles.rtlText as StyleProp<TextStyle>),
                      ]}
                      weight="semibold"
                    >
                      {isRTL ? "ملاحظات" : "Notes"}
                    </TypographyText>
                    <Caption
                      numberOfLines={10}
                      style={[
                        styles.resultDate as StyleProp<TextStyle>,
                        isRTL && (styles.rtlText as StyleProp<TextStyle>),
                      ]}
                    >
                      {selectedResult.notes}
                    </Caption>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </GradientScreen>
  );
}
