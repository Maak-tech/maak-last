import { Brain } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
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
import { Button, Card } from "@/components/design-system";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAIInsights } from "@/hooks/useAIInsights";
import { chartsService } from "@/lib/services/chartsService";
import { healthDataService } from "@/lib/services/healthDataService";
import { medicationService } from "@/lib/services/medicationService";
import { symptomService } from "@/lib/services/symptomService";
import type { Medication, Symptom, VitalSign } from "@/types";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type DateRange = "7d" | "30d" | "90d" | "custom";

export default function AnalyticsScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [vitals, setVitals] = useState<VitalSign[]>([]);
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

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    } as ViewStyle,
    header: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    } as ViewStyle,
    headerTitle: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary),
      fontSize: 24,
    } as TextStyle,
    dateRangeSelector: {
      flexDirection: (isRTL
        ? "row-reverse"
        : "row") as ViewStyle["flexDirection"],
      gap: theme.spacing.xs,
      flexWrap: "wrap" as ViewStyle["flexWrap"],
    } as ViewStyle,
    dateRangeButton: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor:
        typeof theme.colors.border === "string"
          ? theme.colors.border
          : theme.colors.border.light,
      backgroundColor: theme.colors.background.secondary,
    } as ViewStyle,
    dateRangeButtonActive: {
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.main,
    } as ViewStyle,
    dateRangeButtonText: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
      fontSize: 12,
    } as TextStyle,
    dateRangeButtonTextActive: {
      color: theme.colors.neutral.white,
    } as TextStyle,
    content: {
      paddingBottom: theme.spacing.xl,
    } as ViewStyle,
    section: {
      marginVertical: theme.spacing.base,
    } as ViewStyle,
    sectionHeader: {
      flexDirection: (isRTL
        ? "row-reverse"
        : "row") as ViewStyle["flexDirection"],
      justifyContent: "space-between" as ViewStyle["justifyContent"],
      alignItems: "center" as ViewStyle["alignItems"],
      paddingHorizontal: theme.spacing.base,
      marginBottom: theme.spacing.sm,
    } as ViewStyle,
    comparisonToggle: {
      flexDirection: (isRTL
        ? "row-reverse"
        : "row") as ViewStyle["flexDirection"],
      alignItems: "center" as ViewStyle["alignItems"],
      gap: theme.spacing.xs,
    } as ViewStyle,
    emptyContainer: {
      flex: 1,
      justifyContent: "center" as ViewStyle["justifyContent"],
      alignItems: "center" as ViewStyle["alignItems"],
      padding: theme.spacing.xl,
    } as ViewStyle,
    emptyText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      textAlign: "center" as TextStyle["textAlign"],
      marginTop: theme.spacing.base,
    } as TextStyle & ViewStyle,
    rtlText: {
      textAlign: (isRTL ? "right" : "left") as TextStyle["textAlign"],
    } as TextStyle,
    text: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
    } as TextStyle,
    mt2: {
      marginTop: theme.spacing.xs,
    } as TextStyle,
  }))(theme);

  const getDaysFromRange = (range: DateRange): number => {
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
  };

  const buildIsoDateSeries = (days: number): string[] => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d.toISOString();
    });
  };

  const loadAnalyticsData = useCallback(
    async (isRefresh = false) => {
      if (!user) return;

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const days = getDaysFromRange(dateRange);

        // Load data in parallel
        const [userSymptoms, userMedications, userVitals] = await Promise.all([
          symptomService.getUserSymptoms(user.id, 1000), // Get more for better charts
          medicationService.getUserMedications(user.id),
          healthDataService.getLatestVitals(), // This might need to be updated to get historical vitals
        ]);

        setSymptoms(userSymptoms);
        setMedications(userMedications);
        // Note: getLatestVitals returns VitalSigns object, not VitalSign[]
        // For now, we'll keep vitals as empty array since it's not used in the analytics
        setVitals([]);
      } catch (error) {
        // Handle error silently
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, dateRange]
  );

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  const dateRanges: Array<{ value: DateRange; label: string }> = [
    { value: "7d", label: isRTL ? "7 أيام" : "7 Days" },
    { value: "30d", label: isRTL ? "30 يوم" : "30 Days" },
    { value: "90d", label: isRTL ? "90 يوم" : "90 Days" },
  ];

  // Prepare chart data
  const symptomChartData = chartsService.prepareSymptomTimeSeries(
    symptoms,
    getDaysFromRange(dateRange)
  );

  const medicationComplianceData =
    chartsService.prepareMedicationComplianceTimeSeries(
      medications,
      getDaysFromRange(dateRange)
    );

  const correlationData = chartsService.calculateCorrelation(
    symptoms,
    medications,
    getDaysFromRange(dateRange)
  );

  const symptomIsoDates = buildIsoDateSeries(getDaysFromRange(dateRange));
  const symptomTrend = chartsService.predictTrend(
    symptomIsoDates.map((iso, index) => ({
      x: iso,
      y: symptomChartData.datasets[0].data[index],
    })),
    7
  );

  // Prepare comparison data if comparison is enabled
  const symptomComparisonData =
    showComparison && comparisonRange
      ? (() => {
          const currentDays = getDaysFromRange(dateRange);
          const previousDays = getDaysFromRange(comparisonRange);
          const previousSymptomChartData =
            chartsService.prepareSymptomTimeSeries(symptoms, previousDays);
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
        })()
      : null;

  if (!user) {
    return (
      <SafeAreaView style={styles.container as ViewStyle}>
        <View style={styles.emptyContainer as ViewStyle}>
          <Text style={styles.emptyText as TextStyle}>
            {isRTL ? "يجب تسجيل الدخول" : "Please log in"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container as ViewStyle}>
      <View style={styles.header as ViewStyle}>
        <View style={{ marginBottom: theme.spacing.base }}>
          <Heading
            level={4}
            style={[
              styles.headerTitle as TextStyle,
              isRTL && (styles.rtlText as TextStyle),
            ]}
          >
            {isRTL ? "التحليلات الصحية والاتجاهات" : "Analytics & Trends"}
          </Heading>
        </View>

        {/* Date Range Selector */}
        <View style={styles.dateRangeSelector as ViewStyle}>
          {dateRanges.map((range) => (
            <TouchableOpacity
              key={range.value}
              onPress={() => setDateRange(range.value)}
              style={
                [
                  styles.dateRangeButton,
                  dateRange === range.value
                    ? styles.dateRangeButtonActive
                    : undefined,
                ] as ViewStyle[]
              }
            >
              <Text
                style={
                  [
                    styles.dateRangeButtonText,
                    dateRange === range.value
                      ? styles.dateRangeButtonTextActive
                      : undefined,
                  ] as TextStyle[]
                }
              >
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyContainer as ViewStyle}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              onRefresh={() => loadAnalyticsData(true)}
              refreshing={refreshing}
            />
          }
          style={styles.content as ViewStyle}
        >
          {/* Symptom Trends */}
          {symptoms.length > 0 && (
            <View style={styles.section as ViewStyle}>
              <View style={styles.sectionHeader as ViewStyle}>
                <Heading level={6} style={styles.rtlText as TextStyle}>
                  {isRTL ? "اتجاهات الأعراض الصحية" : "Symptom Trends"}
                </Heading>
                <TouchableOpacity
                  onPress={() => {
                    if (showComparison) {
                      setShowComparison(false);
                      setComparisonRange(null);
                    } else {
                      // Set comparison range to previous period
                      const currentDays = getDaysFromRange(dateRange);
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
                  style={styles.comparisonToggle as ViewStyle}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: showComparison
                        ? theme.colors.primary.main
                        : theme.colors.text.secondary,
                    }}
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
              {showComparison && symptomComparisonData ? (
                <View>
                  <HealthChart
                    data={symptomComparisonData.current}
                    title={isRTL ? "الفترة الحالية" : "Current Period"}
                    yAxisLabel="Severity"
                    yAxisSuffix=""
                  />
                  <HealthChart
                    data={symptomComparisonData.previous}
                    title={isRTL ? "الفترة السابقة" : "Previous Period"}
                    yAxisLabel="Severity"
                    yAxisSuffix=""
                  />
                  <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color:
                          symptomComparisonData.change > 0
                            ? theme.colors.accent.error
                            : symptomComparisonData.change < 0
                              ? theme.colors.accent.success
                              : theme.colors.text.secondary,
                      }}
                    >
                      {isRTL
                        ? `التغير المتوقع: ${symptomComparisonData.change > 0 ? "+" : ""}${symptomComparisonData.change.toFixed(1)}%`
                        : `Change: ${symptomComparisonData.change > 0 ? "+" : ""}${symptomComparisonData.change.toFixed(1)}%`}
                    </Text>
                  </View>
                </View>
              ) : (
                <HealthChart
                  data={symptomChartData}
                  title=""
                  yAxisLabel="Severity"
                  yAxisSuffix=""
                />
              )}
            </View>
          )}

          {/* Symptom Trend Prediction */}
          {symptoms.length > 7 && (
            <View style={styles.section as ViewStyle}>
              <View style={styles.sectionHeader as ViewStyle}>
                <Heading level={6} style={styles.rtlText as TextStyle}>
                  {isRTL ? "التنبؤ باتجاه الأعراض الصحية" : "Trend Prediction"}
                </Heading>
              </View>
              <TrendPredictionChart
                prediction={symptomTrend}
                title=""
                yAxisLabel="Severity"
              />
            </View>
          )}

          {/* Medication Compliance */}
          {medications.length > 0 && (
            <View style={styles.section as ViewStyle}>
              <View style={styles.sectionHeader as ViewStyle}>
                <Heading level={6} style={styles.rtlText as TextStyle}>
                  {isRTL ? "الالتزام بالأدوية" : "Medication Compliance"}
                </Heading>
              </View>
              <HealthChart
                data={medicationComplianceData}
                title=""
                yAxisLabel=""
                yAxisSuffix="%"
              />
            </View>
          )}

          {/* Correlation Analysis */}
          {symptoms.length > 0 && medications.length > 0 && (
            <View style={styles.section as ViewStyle}>
              <View style={styles.sectionHeader as ViewStyle}>
                <Heading level={6} style={styles.rtlText as TextStyle}>
                  {isRTL
                    ? "تحليل الارتباط بين الأعراض الصحية والأدوية"
                    : "Correlation Analysis"}
                </Heading>
              </View>
              <CorrelationChart data={correlationData} title="" />
              <Card
                contentStyle={undefined}
                onPress={undefined}
                style={{ marginHorizontal: 16, marginTop: 8 }}
                variant="elevated"
              >
                <View style={{ padding: 16 }}>
                  <TypographyText style={{ marginBottom: 8 }} weight="semibold">
                    {isRTL ? "التفسير الصحي" : "Interpretation"}
                  </TypographyText>
                  <Caption numberOfLines={5} style={{}}>
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
                  </Caption>
                </View>
              </Card>
            </View>
          )}

          {/* AI Insights Section */}
          <View style={styles.section as ViewStyle}>
            <View style={styles.sectionHeader as ViewStyle}>
              <Heading level={6} style={styles.rtlText as TextStyle}>
                {isRTL ? "رؤى الذكاء الاصطناعي" : "AI Insights"}
              </Heading>
              <TouchableOpacity
                onPress={() => setShowAIInsights(!showAIInsights)}
                style={styles.comparisonToggle as ViewStyle}
              >
                <Brain
                  color={
                    showAIInsights
                      ? theme.colors.primary.main
                      : theme.colors.text.secondary
                  }
                  size={16}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: showAIInsights
                      ? theme.colors.primary.main
                      : theme.colors.text.secondary,
                  }}
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

            {showAIInsights && (
              <View style={{ marginHorizontal: 16 }}>
                {aiInsights.loading ? (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <ActivityIndicator
                      color={theme.colors.primary.main}
                      size="small"
                    />
                    <Text
                      style={{
                        ...getTextStyle(
                          theme,
                          "body",
                          "regular",
                          theme.colors.text.primary
                        ),
                        marginTop: theme.spacing.xs,
                      }}
                    >
                      {isRTL ? "تحليل بياناتك..." : "Analyzing your data..."}
                    </Text>
                  </View>
                ) : aiInsights.error ? (
                  <Card
                    contentStyle={undefined}
                    onPress={() => {}}
                    style={{ marginBottom: 8 }}
                    variant="elevated"
                  >
                    <View style={{ padding: 16 }}>
                      <Text
                        style={{
                          ...getTextStyle(
                            theme,
                            "body",
                            "regular",
                            theme.colors.text.primary
                          ),
                          color: theme.colors.accent.error,
                        }}
                      >
                        {isRTL
                          ? "فشل في تحميل الرؤى الذكية"
                          : "Failed to load AI insights"}
                      </Text>
                      <Button
                        onPress={aiInsights.refresh}
                        style={{ marginTop: 8 }}
                        title={isRTL ? "إعادة المحاولة" : "Retry"}
                      />
                    </View>
                  </Card>
                ) : (
                  <AIInsightsDashboard
                    compact={true}
                    onInsightPress={(insight: any) => {
                      // Handle insight press - could navigate to detailed view
                      console.log("Insight pressed:", insight);
                    }}
                  />
                )}
              </View>
            )}
          </View>

          {/* Summary Stats */}
          <View style={styles.section as ViewStyle}>
            <View style={styles.sectionHeader as ViewStyle}>
              <Heading level={6} style={styles.rtlText as TextStyle}>
                {isRTL ? "ملخص الإحصائيات" : "Summary Statistics"}
              </Heading>
            </View>
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <Card
                contentStyle={undefined}
                onPress={undefined}
                style={undefined}
                variant="elevated"
              >
                <View style={{ padding: 16 }}>
                  <TypographyText style={{ marginBottom: 4 }} weight="semibold">
                    {isRTL
                      ? "متوسط شدة الأعراض الصحية"
                      : "Average Symptom Severity"}
                  </TypographyText>
                  <TypographyText size="large" style={{}} weight="bold">
                    {symptomChartData.datasets[0].data.length > 0
                      ? (
                          symptomChartData.datasets[0].data.reduce(
                            (a, b) => a + b,
                            0
                          ) / symptomChartData.datasets[0].data.length
                        ).toFixed(1)
                      : "0"}
                    /5
                  </TypographyText>
                </View>
              </Card>

              <Card
                contentStyle={undefined}
                onPress={undefined}
                style={undefined}
                variant="elevated"
              >
                <View style={{ padding: 16 }}>
                  <TypographyText style={{ marginBottom: 4 }} weight="semibold">
                    {isRTL
                      ? "متوسط الالتزام بالأدوية"
                      : "Average Medication Compliance"}
                  </TypographyText>
                  <TypographyText size="large" style={{}} weight="bold">
                    {medicationComplianceData.datasets[0].data.length > 0
                      ? (
                          medicationComplianceData.datasets[0].data.reduce(
                            (a, b) => a + b,
                            0
                          ) / medicationComplianceData.datasets[0].data.length
                        ).toFixed(0)
                      : "100"}
                    %
                  </TypographyText>
                </View>
              </Card>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
