/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Legacy analytics screen pending modular refactor. */
/* biome-ignore-all lint/style/noNestedTernary: Existing localized copy and UI branching retained in this patch. */
/* biome-ignore-all lint/correctness/useExhaustiveDependencies: Intentional hook dependency omissions retained to avoid behavior changes. */
/* biome-ignore-all lint/nursery/noShadow: Legacy style factory callback naming retained with current structure. */

import { useRouter } from "expo-router";
import { ArrowLeft, Brain } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  InteractionManager,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { AIInsightsDashboard } from "@/app/components/AIInsightsDashboard";
import CorrelationChart from "@/app/components/CorrelationChart";
import HealthChart from "@/app/components/HealthChart";
import TrendPredictionChart from "@/app/components/TrendPredictionChart";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useAIInsights } from "@/hooks/useAIInsights";
import { chartsService } from "@/lib/services/chartsService";
import { healthDataService } from "@/lib/services/healthDataService";
import { medicationService } from "@/lib/services/medicationService";
import { symptomService } from "@/lib/services/symptomService";
import type { Medication, Symptom, VitalSign } from "@/types";

type DateRange = "7d" | "30d" | "90d" | "custom";

export default function AnalyticsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [_vitals, setVitals] = useState<VitalSign[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonRange, setComparisonRange] = useState<DateRange | null>(
    null
  );
  const [showAIInsights, setShowAIInsights] = useState(false);

  // AI Insights hook
  const aiInsights = useAIInsights(user?.id, {
    autoLoad: false, // Load on demand to avoid slowing down analytics
    includeNarrative: true,
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: "transparent",
        },
        headerWrap: {
          marginHorizontal: -20,
          marginTop: -20,
          marginBottom: 12,
        },
        headerContent: {
          paddingHorizontal: 24,
          paddingTop: 20,
          paddingBottom: 16,
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        backButton: {
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: "rgba(255, 255, 255, 0.5)",
          alignItems: "center",
          justifyContent: "center",
        },
        headerTitle: {
          flex: 1,
        },
        headerTitleRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        },
        headerTitleText: {
          fontSize: 22,
          fontFamily: "Inter-Bold",
          color: "#FFFFFF",
        },
        headerSubtitle: {
          fontSize: 13,
          fontFamily: "Inter-SemiBold",
          color: "rgba(0, 53, 67, 0.85)",
        },
        content: {
          paddingHorizontal: 20,
          paddingBottom: 140,
        },
        rangeRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        },
        rangeChip: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: "#E2E8F0",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
        },
        rangeChipActive: {
          backgroundColor: "#003543",
          borderColor: "#003543",
        },
        rangeText: {
          fontSize: 12,
          fontFamily: "Inter-SemiBold",
          color: "#0F172A",
        },
        rangeTextActive: {
          color: "#FFFFFF",
        },
        section: {
          marginBottom: 20,
        },
        sectionHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        },
        sectionTitle: {
          fontSize: 16,
          fontFamily: "Inter-Bold",
          color: "#0F172A",
        },
        sectionAction: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        },
        sectionActionText: {
          fontSize: 12,
          fontFamily: "Inter-SemiBold",
          color: "#0F766E",
        },
        chartStack: {
          gap: 12,
        },
        chartCard: {
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: 12,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        },
        comparisonNote: {
          paddingHorizontal: 4,
        },
        comparisonText: {
          fontSize: 12,
          fontFamily: "Inter-SemiBold",
        },
        aiCard: {
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: 16,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        },
        aiState: {
          alignItems: "center",
          paddingVertical: 12,
        },
        aiStateText: {
          fontSize: 12,
          fontFamily: "Inter-SemiBold",
          color: "#0F172A",
          marginTop: 6,
          textAlign: "center",
        },
        errorText: {
          fontSize: 12,
          fontFamily: "Inter-SemiBold",
          color: "#EF4444",
        },
        primaryButton: {
          marginTop: 10,
          alignSelf: "flex-start",
          backgroundColor: "#003543",
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 10,
        },
        primaryButtonText: {
          fontSize: 12,
          fontFamily: "Inter-SemiBold",
          color: "#FFFFFF",
        },
        summaryGrid: {
          flexDirection: "row",
          gap: 12,
        },
        summaryCard: {
          flex: 1,
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: 16,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 4,
        },
        summaryLabel: {
          fontSize: 12,
          fontFamily: "Inter-SemiBold",
          color: "#64748B",
          marginBottom: 6,
        },
        summaryValue: {
          fontSize: 20,
          fontFamily: "Inter-Bold",
          color: "#0F172A",
        },
        emptyContainer: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        },
        emptyText: {
          fontSize: 13,
          fontFamily: "Inter-SemiBold",
          color: "#64748B",
          textAlign: "center",
          marginTop: 8,
        },
        rtlText: {
          textAlign: "right",
        },
      }),
    []
  );

  const getDaysFromRange = useCallback((range: DateRange): number => {
    switch (range) {
      case "7d":
        return 7;
      case "30d":
        return 30;
      case "90d":
        return 90;
      default:
        return 30;
    }
  }, []);

  const buildIsoDateSeries = useCallback((days: number): string[] => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d.toISOString();
    });
  }, []);

  const loadAnalyticsData = useCallback(
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

        // Load data in parallel
        const [userSymptoms, userMedications, _userVitals] = await Promise.all([
          symptomService.getUserSymptoms(user.id, 1000), // Get more for better charts
          medicationService.getUserMedications(user.id),
          healthDataService.getLatestVitals(), // This might need to be updated to get historical vitals
        ]);

        setSymptoms(userSymptoms);
        setMedications(userMedications);
        // Note: getLatestVitals returns VitalSigns object, not VitalSign[]
        // For now, we'll keep vitals as empty array since it's not used in the analytics
        setVitals([]);
      } catch (_error) {
        // Handle error silently
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        loadAnalyticsData();
      }
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [loadAnalyticsData]);

  const dateRanges: Array<{ value: DateRange; label: string }> = [
    { value: "7d", label: isRTL ? "7 أيام" : "7 Days" },
    { value: "30d", label: isRTL ? "30 يوم" : "30 Days" },
    { value: "90d", label: isRTL ? "90 يوم" : "90 Days" },
  ];

  // Prepare chart data
  const daysInRange = useMemo(
    () => getDaysFromRange(dateRange),
    [dateRange, getDaysFromRange]
  );

  const symptomChartData = useMemo(
    () => chartsService.prepareSymptomTimeSeries(symptoms, daysInRange),
    [symptoms, daysInRange]
  );

  const medicationComplianceData = useMemo(
    () =>
      chartsService.prepareMedicationComplianceTimeSeries(
        medications,
        daysInRange
      ),
    [medications, daysInRange]
  );

  const correlationData = useMemo(
    () =>
      chartsService.calculateCorrelation(symptoms, medications, daysInRange),
    [symptoms, medications, daysInRange]
  );

  const symptomIsoDates = useMemo(
    () => buildIsoDateSeries(daysInRange),
    [daysInRange, buildIsoDateSeries]
  );

  const symptomTrend = useMemo(
    () =>
      chartsService.predictTrend(
        symptomIsoDates.map((iso, index) => ({
          x: iso,
          y: symptomChartData.datasets[0].data[index],
        })),
        7
      ),
    [symptomIsoDates, symptomChartData]
  );

  // Prepare comparison data if comparison is enabled
  const symptomComparisonData = useMemo(() => {
    if (!(showComparison && comparisonRange)) {
      return null;
    }

    const currentDays = getDaysFromRange(dateRange);
    const previousDays = getDaysFromRange(comparisonRange);
    const previousSymptomChartData = chartsService.prepareSymptomTimeSeries(
      symptoms,
      previousDays
    );
    const currentIsoDates = buildIsoDateSeries(currentDays);
    const previousIsoDates = buildIsoDateSeries(previousDays);

    return chartsService.prepareComparisonData(
      currentIsoDates.map((iso, index) => ({
        x: iso,
        y: symptomChartData.datasets[0].data[index],
      })),
      previousIsoDates.map((iso, index) => ({
        x: iso,
        y: previousSymptomChartData.datasets[0].data[index],
      }))
    );
  }, [
    showComparison,
    comparisonRange,
    dateRange,
    symptoms,
    symptomChartData,
    buildIsoDateSeries,
    getDaysFromRange,
  ]);

  if (!user) {
    return (
      <GradientScreen
        edges={["top"]}
        pointerEvents="box-none"
        style={styles.container as ViewStyle}
      >
        <View style={styles.emptyContainer as ViewStyle}>
          <Text style={[styles.emptyText, isRTL && styles.rtlText]}>
            {isRTL ? "يجب تسجيل الدخول" : "Please log in"}
          </Text>
        </View>
      </GradientScreen>
    );
  }

  return (
    <GradientScreen
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container as ViewStyle}
    >
      <View style={styles.headerWrap as ViewStyle}>
        <WavyBackground height={180} variant="teal">
          <View style={styles.headerContent as ViewStyle}>
            <View
              style={[
                styles.headerRow,
                isRTL && { flexDirection: "row-reverse" as const },
              ]}
            >
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton as ViewStyle}
              >
                <ArrowLeft
                  color="#003543"
                  size={20}
                  style={
                    isRTL ? { transform: [{ rotate: "180deg" }] } : undefined
                  }
                />
              </TouchableOpacity>
              <View style={styles.headerTitle as ViewStyle}>
                <View
                  style={[
                    styles.headerTitleRow,
                    isRTL && { flexDirection: "row-reverse" as const },
                  ]}
                >
                  <Brain color="#EB9C0C" size={20} />
                  <Text style={styles.headerTitleText as TextStyle}>
                    {isRTL ? "التحليلات الصحية والاتجاهات" : "Analytics"}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.headerSubtitle as TextStyle,
                    isRTL && styles.rtlText,
                  ]}
                >
                  {t("trendsAndInsights", "Trends and insights")}
                </Text>
              </View>
            </View>
          </View>
        </WavyBackground>
      </View>

      {loading ? (
        <View style={styles.emptyContainer as ViewStyle}>
          <ActivityIndicator color="#0F766E" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content as ViewStyle}
          refreshControl={
            <RefreshControl
              onRefresh={() => loadAnalyticsData(true)}
              refreshing={refreshing}
              tintColor="#0F766E"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.rangeRow as ViewStyle,
              isRTL && { flexDirection: "row-reverse" as const },
            ]}
          >
            {dateRanges.map((range) => (
              <TouchableOpacity
                key={range.value}
                onPress={() => setDateRange(range.value)}
                style={[
                  styles.rangeChip,
                  dateRange === range.value
                    ? styles.rangeChipActive
                    : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.rangeText,
                    dateRange === range.value
                      ? styles.rangeTextActive
                      : undefined,
                  ]}
                >
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Symptom Trends */}
          {symptoms.length > 0 && (
            <View style={styles.section as ViewStyle}>
              <View style={styles.sectionHeader as ViewStyle}>
                <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "اتجاهات الأعراض الصحية" : "Symptom Trends"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    if (showComparison) {
                      setShowComparison(false);
                      setComparisonRange(null);
                    } else {
                      if (dateRange === "7d") {
                        setComparisonRange("7d");
                      } else if (dateRange === "30d") {
                        setComparisonRange("30d");
                      } else if (dateRange === "90d") {
                        setComparisonRange("90d");
                      }
                      setShowComparison(true);
                    }
                  }}
                  style={[
                    styles.sectionAction,
                    isRTL && { flexDirection: "row-reverse" as const },
                  ]}
                >
                  <Text
                    style={[
                      styles.sectionActionText,
                      { color: showComparison ? "#0F766E" : "#94A3B8" },
                    ]}
                  >
                    {isRTL
                      ? showComparison
                        ? "إخفاء المقارنة"
                        : "مقارنة"
                      : showComparison
                        ? "Hide Comparison"
                        : "Compare"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.chartStack as ViewStyle}>
                {showComparison && symptomComparisonData ? (
                  <>
                    <View style={styles.chartCard as ViewStyle}>
                      <HealthChart
                        data={symptomComparisonData.current}
                        title={isRTL ? "الفترة الحالية" : "Current Period"}
                        yAxisLabel="Severity"
                        yAxisSuffix=""
                      />
                    </View>
                    <View style={styles.chartCard as ViewStyle}>
                      <HealthChart
                        data={symptomComparisonData.previous}
                        title={isRTL ? "الفترة السابقة" : "Previous Period"}
                        yAxisLabel="Severity"
                        yAxisSuffix=""
                      />
                    </View>
                    <View style={styles.comparisonNote as ViewStyle}>
                      <Text
                        style={[
                          styles.comparisonText,
                          {
                            color:
                              symptomComparisonData.change > 0
                                ? "#EF4444"
                                : symptomComparisonData.change < 0
                                  ? "#10B981"
                                  : "#94A3B8",
                          },
                        ]}
                      >
                        {isRTL
                          ? `التغير المتوقع: ${symptomComparisonData.change > 0 ? "+" : ""}${symptomComparisonData.change.toFixed(1)}%`
                          : `Change: ${symptomComparisonData.change > 0 ? "+" : ""}${symptomComparisonData.change.toFixed(1)}%`}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.chartCard as ViewStyle}>
                    <HealthChart
                      data={symptomChartData}
                      title=""
                      yAxisLabel="Severity"
                      yAxisSuffix=""
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Symptom Trend Prediction */}
          {symptoms.length > 7 && (
            <View style={styles.section as ViewStyle}>
              <View style={styles.sectionHeader as ViewStyle}>
                <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "التنبؤ باتجاه الأعراض الصحية" : "Trend Prediction"}
                </Text>
              </View>
              <View style={styles.chartCard as ViewStyle}>
                <TrendPredictionChart
                  prediction={symptomTrend}
                  title=""
                  yAxisLabel="Severity"
                />
              </View>
            </View>
          )}

          {/* Medication Compliance */}
          {medications.length > 0 && (
            <View style={styles.section as ViewStyle}>
              <View style={styles.sectionHeader as ViewStyle}>
                <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "الالتزام بالأدوية" : "Medication Compliance"}
                </Text>
              </View>
              <View style={styles.chartCard as ViewStyle}>
                <HealthChart
                  data={medicationComplianceData}
                  title=""
                  yAxisLabel=""
                  yAxisSuffix="%"
                />
              </View>
            </View>
          )}

          {/* Correlation Analysis */}
          {symptoms.length > 0 && medications.length > 0 && (
            <View style={styles.section as ViewStyle}>
              <View style={styles.sectionHeader as ViewStyle}>
                <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "تحليل الارتباط بين الأعراض الصحية والأدوية"
                    : "Correlation Analysis"}
                </Text>
              </View>
              <View style={styles.chartStack as ViewStyle}>
                <View style={styles.chartCard as ViewStyle}>
                  <CorrelationChart data={correlationData} title="" />
                </View>
                <View style={styles.aiCard as ViewStyle}>
                  <Text style={styles.sectionTitle as TextStyle}>
                    {isRTL ? "التفسير الصحي" : "Interpretation"}
                  </Text>
                  <Text style={styles.aiStateText as TextStyle}>
                    {correlationData.correlation > 0.3
                      ? isRTL
                        ? "يبدو أن الالتزام بالأدوية يرتبط بانخفاض شدة الأعراض الصحية"
                        : "Medication compliance appears to correlate with lower symptom severity"
                      : correlationData.correlation < -0.3
                        ? isRTL
                          ? "يبدو أن انخفاض الالتزام بالأدوية يرتبط بزيادة شدة الأعراض الصحية"
                          : "Lower medication compliance appears to correlate with higher symptom severity"
                        : isRTL
                          ? "لا يوجد ارتباط واضح بين الالتزام بالأدوية وشدة الأعراض الصحية"
                          : "No clear correlation found between medication compliance and symptom severity"}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* AI Insights Section */}
          <View style={styles.section as ViewStyle}>
            <View style={styles.sectionHeader as ViewStyle}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                {isRTL ? "رؤى الذكاء الاصطناعي" : "AI Insights"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowAIInsights(!showAIInsights)}
                style={[
                  styles.sectionAction,
                  isRTL && { flexDirection: "row-reverse" as const },
                ]}
              >
                <Brain
                  color={showAIInsights ? "#0F766E" : "#94A3B8"}
                  size={16}
                />
                <Text
                  style={[
                    styles.sectionActionText,
                    { color: showAIInsights ? "#0F766E" : "#94A3B8" },
                  ]}
                >
                  {isRTL
                    ? showAIInsights
                      ? "إخفاء"
                      : "عرض"
                    : showAIInsights
                      ? "Hide"
                      : "Show"}
                </Text>
              </TouchableOpacity>
            </View>

            {Boolean(showAIInsights) && (
              <View style={styles.aiCard as ViewStyle}>
                {aiInsights.loading ? (
                  <View style={styles.aiState as ViewStyle}>
                    <ActivityIndicator color="#0F766E" size="small" />
                    <Text style={styles.aiStateText as TextStyle}>
                      {isRTL ? "تحليل بياناتك..." : "Analyzing your data..."}
                    </Text>
                  </View>
                ) : aiInsights.error ? (
                  <View>
                    <Text style={styles.errorText as TextStyle}>
                      {isRTL
                        ? "فشل في تحميل الرؤى الذكية"
                        : "Failed to load AI insights"}
                    </Text>
                    <TouchableOpacity
                      onPress={aiInsights.refresh}
                      style={styles.primaryButton as ViewStyle}
                    >
                      <Text style={styles.primaryButtonText as TextStyle}>
                        {isRTL ? "إعادة المحاولة" : "Retry"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <AIInsightsDashboard
                    compact={true}
                    onInsightPress={(_insight: unknown) => {
                      // Handle insight press - could navigate to detailed view
                    }}
                  />
                )}
              </View>
            )}
          </View>

          {/* Summary Stats */}
          <View style={styles.section as ViewStyle}>
            <View style={styles.sectionHeader as ViewStyle}>
              <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                {isRTL ? "ملخص الإحصائيات" : "Summary Statistics"}
              </Text>
            </View>
            <View style={styles.summaryGrid as ViewStyle}>
              <View style={styles.summaryCard as ViewStyle}>
                <Text style={styles.summaryLabel as TextStyle}>
                  {isRTL
                    ? "متوسط شدة الأعراض الصحية"
                    : "Average Symptom Severity"}
                </Text>
                <Text style={styles.summaryValue as TextStyle}>
                  {symptomChartData.datasets[0].data.length > 0
                    ? (
                        symptomChartData.datasets[0].data.reduce(
                          (a, b) => a + b,
                          0
                        ) / symptomChartData.datasets[0].data.length
                      ).toFixed(1)
                    : "0"}
                  /5
                </Text>
              </View>

              <View style={styles.summaryCard as ViewStyle}>
                <Text style={styles.summaryLabel as TextStyle}>
                  {isRTL
                    ? "متوسط الالتزام بالأدوية"
                    : "Average Medication Compliance"}
                </Text>
                <Text style={styles.summaryValue as TextStyle}>
                  {medicationComplianceData.datasets[0].data.length > 0
                    ? (
                        medicationComplianceData.datasets[0].data.reduce(
                          (a, b) => a + b,
                          0
                        ) / medicationComplianceData.datasets[0].data.length
                      ).toFixed(0)
                    : "100"}
                  %
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </GradientScreen>
  );
}
