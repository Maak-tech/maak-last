import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Caption, Heading } from "@/components/design-system/Typography";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  type HealthInsight,
  type HealthPattern,
  type HealthSummary,
  type HealthTrend,
  healthSummaryService,
} from "@/lib/services/healthSummaryService";
import { safeFormatDate } from "@/utils/dateFormat";
import { getTextStyle } from "@/utils/styles";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Screen aggregates multiple complex health sections.
export default function HealthSummaryScreen() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const isRTL = i18n.language === "ar";

  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"weekly" | "monthly">(
    (params.period as "weekly" | "monthly") || "weekly"
  );

  const styles = {
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    periodSelector: {
      flexDirection: "row" as const,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xs,
      marginTop: theme.spacing.md,
    },
    periodButton: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: "center" as const,
    },
    periodButtonActive: {
      backgroundColor: theme.colors.primary.main,
    },
    periodButtonText: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.secondary),
    },
    periodButtonTextActive: {
      color: theme.colors.neutral.white,
      fontWeight: "600" as const,
    },
    content: {
      flex: 1,
      padding: theme.spacing.base,
    },
    overviewCard: {
      marginBottom: theme.spacing.lg,
    },
    overviewGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: theme.spacing.md,
    },
    metricCard: {
      flex: 1,
      minWidth: 160,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      alignItems: "center" as const,
    },
    metricValue: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.primary.main),
      fontSize: 24,
      marginBottom: theme.spacing.xs,
    },
    metricLabel: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
      textAlign: "center" as const,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.text.primary),
      marginBottom: theme.spacing.md,
    },
    insightCard: {
      marginBottom: theme.spacing.sm,
    },
    insightHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.xs,
    },
    insightIcon: {
      marginEnd: theme.spacing.sm,
    },
    insightTitle: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.text.primary),
      flex: 1,
    },
    insightDescription: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      marginBottom: theme.spacing.xs,
    },
    insightMetric: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.primary.main),
    },
    patternCard: {
      marginBottom: theme.spacing.sm,
    },
    patternConfidence: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.tertiary),
      marginBottom: theme.spacing.xs,
    },
    patternExamples: {
      marginTop: theme.spacing.sm,
    },
    patternExample: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      marginBottom: theme.spacing.xs,
    },
    recommendationCard: {
      backgroundColor: theme.colors.primary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      borderStartWidth: 4,
      borderStartColor: theme.colors.primary.main,
    },
    recommendationText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.primary.main),
    },
    trendCard: {
      marginBottom: theme.spacing.sm,
    },
    trendHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.xs,
    },
    trendChange: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.secondary),
    },
    trendChangePositive: {
      color: theme.colors.accent.success,
    },
    trendChangeNegative: {
      color: theme.colors.accent.error,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingVertical: theme.spacing.xl,
    },
    emptyText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      textAlign: "center" as const,
    },
    rtlText: {
      textAlign: isRTL ? ("right" as const) : ("left" as const),
    },
  };

  const loadSummary = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setLoading(true);
    try {
      let summaryData: HealthSummary;
      if (period === "weekly") {
        summaryData = await healthSummaryService.generateWeeklySummary(
          user.id,
          undefined,
          isRTL
        );
      } else {
        summaryData = await healthSummaryService.generateMonthlySummary(
          user.id,
          undefined,
          isRTL
        );
      }
      setSummary(summaryData);
    } catch (_error) {
      // Error loading health summary
    } finally {
      setLoading(false);
    }
  }, [isRTL, period, user?.id]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const getInsightIcon = (type: HealthInsight["type"]) => {
    const iconProps = { size: 20 };
    switch (type) {
      case "positive":
        return (
          <Ionicons
            color={theme.colors.accent.success}
            name="trending-up"
            {...iconProps}
          />
        );
      case "concerning":
        return (
          <Ionicons
            color={theme.colors.accent.error}
            name="warning"
            {...iconProps}
          />
        );
      default:
        return (
          <Ionicons
            color={theme.colors.neutral[500]}
            name="information-circle"
            {...iconProps}
          />
        );
    }
  };

  const getPatternIcon = (type: HealthPattern["type"]) => {
    const iconProps = { size: 20, color: theme.colors.primary.main };
    switch (type) {
      case "temporal":
        return <Ionicons name="time" {...iconProps} />;
      case "symptom":
        return <Ionicons name="pulse" {...iconProps} />;
      case "medication":
        return <Ionicons name="medical" {...iconProps} />;
      default:
        return <Ionicons name="analytics" {...iconProps} />;
    }
  };

  const getTrendIcon = (trend: HealthTrend["trend"]) => {
    const iconProps = { size: 16 };
    switch (trend) {
      case "up":
        return (
          <Ionicons
            color={theme.colors.accent.error}
            name="trending-up"
            {...iconProps}
          />
        );
      case "down":
        return (
          <Ionicons
            color={theme.colors.accent.success}
            name="trending-down"
            {...iconProps}
          />
        );
      default:
        return (
          <Ionicons
            color={theme.colors.neutral[500]}
            name="remove"
            {...iconProps}
          />
        );
    }
  };

  const getCurrentPeriodLabel = (trendPeriod: HealthTrend["period"]) => {
    if (trendPeriod === "weekly") {
      return isRTL ? "هذا الأسبوع" : "this week";
    }
    return isRTL ? "هذا الشهر" : "this month";
  };

  const getPreviousPeriodLabel = (trendPeriod: HealthTrend["period"]) => {
    if (trendPeriod === "weekly") {
      return isRTL ? "الأسبوع الماضي" : "last week";
    }
    return isRTL ? "الشهر الماضي" : "last month";
  };

  const getTrendChangeStyle = (change: number) => {
    if (change > 0) {
      return styles.trendChangeNegative;
    }
    if (change < 0) {
      return styles.trendChangePositive;
    }
    return {};
  };

  const formatDateRange = (start: Date, end: Date): string => {
    const options = {
      month: "short",
      day: "numeric",
      year:
        start.getFullYear() !== new Date().getFullYear()
          ? "numeric"
          : undefined,
    } as const;

    const locale = isRTL ? "ar-u-ca-gregory" : "en-US";
    const startStr = safeFormatDate(start, locale, options);
    const endStr = safeFormatDate(end, locale, options);

    return `${startStr} - ${endStr}`;
  };

  const renderOverview = () => {
    if (!summary) {
      return null;
    }

    const { overview } = summary;

    return (
      <Card
        contentStyle={{}}
        onPress={undefined}
        pressable={false}
        style={styles.overviewCard}
        variant="elevated"
      >
        <Heading
          level={4}
          style={[styles.sectionTitle, isRTL && styles.rtlText]}
        >
          {isRTL ? "نظرة عامة" : "Overview"}
        </Heading>

        <View style={styles.overviewGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{overview.totalSymptoms}</Text>
            <Text style={styles.metricLabel}>
              {isRTL ? "الأعراض الصحية" : "Symptoms"}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{overview.averageSeverity}</Text>
            <Text style={styles.metricLabel}>
              {isRTL ? "متوسط الشدة" : "Avg Severity"}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>
              {overview.medicationAdherence}%
            </Text>
            <Text style={styles.metricLabel}>
              {isRTL ? "الالتزام بالدواء" : "Med Adherence"}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{overview.healthScore}</Text>
            <Text style={styles.metricLabel}>
              {isRTL ? "نقاط الصحة" : "Health Score"}
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  const renderInsights = () => {
    if (!summary || summary.insights.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Heading
          level={4}
          style={[styles.sectionTitle, isRTL && styles.rtlText]}
        >
          {isRTL ? "التحليلات" : "Insights"}
        </Heading>

        {summary.insights.map((insight) => (
          <Card
            contentStyle={{}}
            key={`${insight.type}-${insight.title}-${insight.metric ?? "none"}`}
            onPress={undefined}
            pressable={false}
            style={styles.insightCard}
            variant="outlined"
          >
            <View style={styles.insightHeader}>
              {getInsightIcon(insight.type)}
              <Text style={[styles.insightTitle, isRTL && styles.rtlText]}>
                {insight.title}
              </Text>
            </View>

            <Text style={[styles.insightDescription, isRTL && styles.rtlText]}>
              {insight.description}
            </Text>

            {insight.metric ? (
              <Text style={[styles.insightMetric, isRTL && styles.rtlText]}>
                {insight.metric}:{" "}
                {insight.change !== undefined &&
                  `${insight.change > 0 ? "+" : ""}${insight.change.toFixed(1)}`}
              </Text>
            ) : null}
          </Card>
        ))}
      </View>
    );
  };

  const renderPatterns = () => {
    if (!summary || summary.patterns.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Heading
          level={4}
          style={[styles.sectionTitle, isRTL && styles.rtlText]}
        >
          {isRTL ? "الأنماط الصحية المكتشفة" : "Detected Patterns"}
        </Heading>

        {summary.patterns.map((pattern) => (
          <Card
            contentStyle={{}}
            key={`${pattern.type}-${pattern.title}-${pattern.confidence}`}
            onPress={undefined}
            pressable={false}
            style={styles.patternCard}
            variant="outlined"
          >
            <View style={styles.insightHeader}>
              {getPatternIcon(pattern.type)}
              <Text style={[styles.insightTitle, isRTL && styles.rtlText]}>
                {pattern.title}
              </Text>
              <Badge size="small" style={{}} variant="outline">
                {(pattern.confidence * 100).toFixed(0)}%
              </Badge>
            </View>

            <Text style={[styles.insightDescription, isRTL && styles.rtlText]}>
              {pattern.description}
            </Text>

            {pattern.examples.length > 0 ? (
              <View style={styles.patternExamples}>
                {pattern.examples.map((example) => (
                  <Text
                    key={`${pattern.title}-${example}`}
                    style={[styles.patternExample, isRTL && styles.rtlText]}
                  >
                    - {example}
                  </Text>
                ))}
              </View>
            ) : null}

            {pattern.recommendation ? (
              <Text
                style={[
                  styles.insightDescription,
                  isRTL && styles.rtlText,
                  { marginTop: theme.spacing.sm },
                ]}
              >
                {isRTL ? "نصيحة: " : "Tip: "}
                {pattern.recommendation}
              </Text>
            ) : null}
          </Card>
        ))}
      </View>
    );
  };

  const renderTrends = () => {
    if (!summary || summary.trends.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Heading
          level={4}
          style={[styles.sectionTitle, isRTL && styles.rtlText]}
        >
          {isRTL ? "الاتجاهات الصحية" : "Trends"}
        </Heading>

        {summary.trends.map((trend) => (
          <Card
            contentStyle={{}}
            key={`${trend.metric}-${trend.period}`}
            onPress={undefined}
            pressable={false}
            style={styles.trendCard}
            variant="outlined"
          >
            <View style={styles.trendHeader}>
              <Text style={[styles.insightTitle, isRTL && styles.rtlText]}>
                {trend.metric}
              </Text>
              {getTrendIcon(trend.trend)}
            </View>

            <Text style={[styles.insightDescription, isRTL && styles.rtlText]}>
              {trend.currentValue} {getCurrentPeriodLabel(trend.period)}
              {" vs "} {trend.previousValue}{" "}
              {getPreviousPeriodLabel(trend.period)}
            </Text>

            <Text
              style={[
                styles.trendChange,
                getTrendChangeStyle(trend.change),
                isRTL && styles.rtlText,
              ]}
            >
              {trend.change > 0 ? "+" : ""}
              {trend.change.toFixed(1)} change
            </Text>
          </Card>
        ))}
      </View>
    );
  };

  const renderRecommendations = () => {
    if (!summary || summary.recommendations.length === 0) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Heading
          level={4}
          style={[styles.sectionTitle, isRTL && styles.rtlText]}
        >
          {isRTL ? "التوصيات" : "Recommendations"}
        </Heading>

        {summary.recommendations.map((recommendation) => (
          <View key={recommendation} style={styles.recommendationCard}>
            <Text style={[styles.recommendationText, isRTL && styles.rtlText]}>
              {recommendation}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {isRTL
              ? "يجب تسجيل الدخول لعرض ملخص الصحة"
              : "Please log in to view health summary"}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginBottom: theme.spacing.sm }}
        >
          <Ionicons
            color={theme.colors.text.primary}
            name="arrow-back"
            size={24}
          />
        </TouchableOpacity>

        <Heading level={3} style={[isRTL && styles.rtlText]}>
          {isRTL ? "ملخص الصحة" : "Health Summary"}
        </Heading>

        {summary ? (
          <Caption
            style={[isRTL && styles.rtlText, { marginTop: theme.spacing.xs }]}
          >
            {formatDateRange(summary.startDate, summary.endDate)}
          </Caption>
        ) : null}

        <View style={styles.periodSelector}>
          <TouchableOpacity
            onPress={() => setPeriod("weekly")}
            style={[
              styles.periodButton,
              period === "weekly" && styles.periodButtonActive,
            ]}
          >
            <Text
              style={[
                styles.periodButtonText,
                period === "weekly" && styles.periodButtonTextActive,
              ]}
            >
              {isRTL ? "أسبوعي" : "Weekly"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPeriod("monthly")}
            style={[
              styles.periodButton,
              period === "monthly" && styles.periodButtonActive,
            ]}
          >
            <Text
              style={[
                styles.periodButtonText,
                period === "monthly" && styles.periodButtonTextActive,
              ]}
            >
              {isRTL ? "شهري" : "Monthly"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
          <Text style={[styles.emptyText, { marginTop: theme.spacing.md }]}>
            {isRTL
              ? "جاري تحليل بياناتك الصحية..."
              : "Analyzing your health data..."}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
          {renderOverview()}
          {renderInsights()}
          {renderPatterns()}
          {renderTrends()}
          {renderRecommendations()}

          {(!summary ||
            (summary.insights.length === 0 &&
              summary.patterns.length === 0)) && (
            <View style={styles.emptyContainer}>
              <Ionicons
                color={theme.colors.text.tertiary}
                name="analytics-outline"
                size={48}
              />
              <Text style={styles.emptyText}>
                {isRTL
                  ? "لا توجد بيانات كافية لإنشاء ملخص. سجل المزيد من الأعراض والأدوية للحصول على تحليلات صحية مفيدة."
                  : "Not enough data to generate insights. Log more symptoms and medications for personalized insights."}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
