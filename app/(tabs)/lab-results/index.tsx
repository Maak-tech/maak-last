/* biome-ignore-all lint/style/noNestedTernary: preserving existing conditional layout flow while iterating in batches. */
import { router } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Droplet,
  TestTube,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
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
import { SafeAreaView } from "react-native-safe-area-context";
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
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const isRTL = i18n.language === "ar";

  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<LabResult | null>(null);
  const [filterType, setFilterType] = useState<LabResult["testType"] | "all">(
    "all"
  );

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

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: large screen style map.
  const styles = createThemedStyles((screenTheme) => ({
    container: {
      flex: 1,
      backgroundColor: screenTheme.colors.background.primary,
    },
    figmaLabHeaderWrap: {
      marginHorizontal: -20,
      marginTop: -20,
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
      backgroundColor: "rgba(255, 255, 255, 0.5)",
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
      color: "#FFFFFF",
    },
    figmaLabSubtitle: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "rgba(0, 53, 67, 0.85)",
    },
    figmaLabAddButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "#003543",
      alignItems: "center",
      justifyContent: "center",
    },
    figmaLabFilters: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 8,
    },
    figmaLabContent: {
      paddingHorizontal: 20,
      paddingBottom: 140,
      gap: 12,
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
    filterContainer: {
      flexDirection: isRTL ? "row-reverse" : "row",
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    filterChip: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
      backgroundColor: theme.colors.background.secondary,
    },
    filterChipActive: {
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.main,
    },
    filterChipText: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
      fontSize: 12,
    },
    filterChipTextActive: {
      color: theme.colors.neutral.white,
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

        let results: LabResult[];
        if (filterType === "all") {
          results = await labResultService.getUserLabResults(user.id);
        } else {
          results = await labResultService.getLabResultsByType(
            user.id,
            filterType
          );
        }

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
    [user, filterType, isRTL]
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

  const testTypes = [
    { value: "all" as const, label: isRTL ? "الكل" : "All" },
    { value: "blood" as const, label: isRTL ? "فحص الدم" : "Blood" },
    { value: "urine" as const, label: isRTL ? "فحص البول" : "Urine" },
    { value: "imaging" as const, label: isRTL ? "التصوير" : "Imaging" },
    { value: "other" as const, label: isRTL ? "أخرى" : "Other" },
  ];

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
        <WavyBackground height={240} variant="teal">
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
                    Lab Results
                  </Text>
                </View>
                <Text style={styles.figmaLabSubtitle as TextStyle}>
                  Track and store test results
                </Text>
              </View>
            </View>
          </View>
        </WavyBackground>
      </View>
      {/* Filters */}
      <ScrollView
        contentContainerStyle={styles.figmaLabFilters as StyleProp<ViewStyle>}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {testTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            onPress={() => setFilterType(type.value)}
            style={[
              styles.filterChip as StyleProp<ViewStyle>,
              filterType === type.value &&
                (styles.filterChipActive as StyleProp<ViewStyle>),
            ]}
          >
            <Text
              style={[
                styles.filterChipText as StyleProp<TextStyle>,
                filterType === type.value &&
                  (styles.filterChipTextActive as StyleProp<TextStyle>),
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
                Recent Tests
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
              <Text style={styles.figmaLabStatLabel as TextStyle}>Normal</Text>
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
                Needs Review
              </Text>
            </View>
          </View>
          {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: card markup includes multiple health-result render branches. */}
          {labResults.map((result) => {
            const status = getResultStatus(result);
            const statusColor = status === "normal" ? "#10B981" : "#F97316";
            const facilityLabel = result.facility || result.orderedBy || "Lab";
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
                        {status === "normal" ? "Normal" : "Review"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        if (result.attachments && result.attachments[0]) {
                          router.push(result.attachments[0]);
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
        </ScrollView>
      )}
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
      ;
    </GradientScreen>
  );
}
