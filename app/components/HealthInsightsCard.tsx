import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  healthInsightsService,
  type PatternInsight,
  type WeeklySummary,
} from "@/lib/services/healthInsightsService";
import { Card } from "@/components/design-system";
import { Heading, Text, Caption } from "@/components/design-system/Typography";
import { Badge } from "@/components/design-system/AdditionalComponents";

interface HealthInsightsCardProps {
  onViewDetails?: () => void;
}

export default function HealthInsightsCard({
  onViewDetails,
}: HealthInsightsCardProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(
    null
  );
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const styles = getStyles(theme, isRTL);

  useEffect(() => {
    loadInsights();
  }, [user]);

  const loadInsights = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [summary, allInsights] = await Promise.all([
        healthInsightsService.getWeeklySummary(user.id),
        healthInsightsService.getAllInsights(user.id),
      ]);
      setWeeklySummary(summary);
      setInsights(allInsights.slice(0, 3)); // Show top 3 insights
    } catch (error) {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  };

  const getInsightIcon = (type: PatternInsight["type"]) => {
    switch (type) {
      case "temporal":
        return "📅";
      case "correlation":
        return "🔗";
      case "trend":
        return "📈";
      case "recommendation":
        return "💡";
      default:
        return "ℹ️";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return theme.colors.accent.success || "#10B981";
    if (confidence >= 60) return theme.colors.accent.warning || "#F59E0B";
    return theme.colors.text.secondary;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
      month: "short",
      day: "numeric",
      calendar: "gregory", // Force Gregorian calendar (AD) even for Arabic
    });
  };

  if (loading) {
    return (
      <Card style={styles.card} onPress={undefined} contentStyle={undefined}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary.main} />
          <Caption numberOfLines={1} style={styles.loadingText}>
            {isRTL ? "جاري تحليل البيانات..." : "Analyzing data..."}
          </Caption>
        </View>
      </Card>
    );
  }

  if (!weeklySummary) {
    return null;
  }

  return (
    <Card style={styles.card} onPress={undefined} contentStyle={undefined}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={styles.header}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.icon}>📊</Text>
          <View style={styles.headerText}>
            <Heading level={5} style={styles.title}>
              {t("healthInsights")}
            </Heading>
            <Caption numberOfLines={2} style={styles.subtitle}>
              {isRTL
                ? `ملخص الأسبوع: ${formatDate(weeklySummary.weekStart)} - ${formatDate(weeklySummary.weekEnd)}`
                : `Week Summary: ${formatDate(weeklySummary.weekStart)} - ${formatDate(weeklySummary.weekEnd)}`}
            </Caption>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.colors.text.secondary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {weeklySummary.symptoms.total}
              </Text>
              <Caption numberOfLines={1} style={styles.statLabel}>
                {isRTL ? "أعراض" : "Symptoms"}
              </Caption>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {weeklySummary.medications.compliance}%
              </Text>
              <Caption numberOfLines={1} style={styles.statLabel}>
                {isRTL ? "امتثال" : "Compliance"}
              </Caption>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {weeklySummary.moods.averageIntensity.toFixed(1)}
              </Text>
              <Caption numberOfLines={1} style={styles.statLabel}>
                {isRTL ? "مزاج" : "Mood"}
              </Caption>
            </View>
          </View>

          {/* Trend Indicators */}
          <View style={styles.trendsRow}>
            {weeklySummary.symptoms.trend !== "stable" && (
              <View style={styles.trendItem}>
                <Ionicons
                  name={
                    weeklySummary.symptoms.trend === "increasing"
                      ? "trending-up"
                      : "trending-down"
                  }
                  size={16}
                  color={
                    weeklySummary.symptoms.trend === "increasing"
                      ? theme.colors.accent.error || "#EF4444"
                      : theme.colors.accent.success || "#10B981"
                  }
                />
                <Caption
                  numberOfLines={1}
                  style={[
                    styles.trendText,
                    {
                      color:
                        weeklySummary.symptoms.trend === "increasing"
                          ? theme.colors.accent.error || "#EF4444"
                          : theme.colors.accent.success || "#10B981",
                    },
                  ]}
                >
                  {isRTL
                    ? weeklySummary.symptoms.trend === "increasing"
                      ? "أعراض متزايدة"
                      : "أعراض متناقصة"
                    : weeklySummary.symptoms.trend === "increasing"
                      ? "Symptoms ↑"
                      : "Symptoms ↓"}
                </Caption>
              </View>
            )}
            {weeklySummary.moods.trend !== "stable" && (
              <View style={styles.trendItem}>
                <Ionicons
                  name={
                    weeklySummary.moods.trend === "improving"
                      ? "trending-up"
                      : "trending-down"
                  }
                  size={16}
                  color={
                    weeklySummary.moods.trend === "improving"
                      ? theme.colors.accent.success || "#10B981"
                      : theme.colors.accent.error || "#EF4444"
                  }
                />
                <Caption
                  numberOfLines={1}
                  style={[
                    styles.trendText,
                    {
                      color:
                        weeklySummary.moods.trend === "improving"
                          ? theme.colors.accent.success || "#10B981"
                          : theme.colors.accent.error || "#EF4444",
                    },
                  ]}
                >
                  {isRTL
                    ? weeklySummary.moods.trend === "improving"
                      ? "مزاج أفضل"
                      : "مزاج أسوأ"
                    : weeklySummary.moods.trend === "improving"
                      ? "Mood ↑"
                      : "Mood ↓"}
                </Caption>
              </View>
            )}
          </View>

          {/* Insights */}
          {insights.length > 0 && (
            <View style={styles.insightsSection}>
              <Text style={styles.sectionTitle}>
                {isRTL ? "رؤى مهمة" : "Key Insights"}
              </Text>
              {insights.map((insight, index) => (
                <View key={index} style={styles.insightItem}>
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightIcon}>
                      {getInsightIcon(insight.type)}
                    </Text>
                    <View style={styles.insightText}>
                      <Text style={styles.insightTitle}>{insight.title}</Text>
                      <Caption numberOfLines={2} style={styles.insightDescription}>
                        {insight.description}
                      </Caption>
                    </View>
                    <Badge
                      variant="outline"
                      style={[
                        styles.confidenceBadge,
                        {
                          borderColor: getConfidenceColor(insight.confidence),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.confidenceText,
                          { color: getConfidenceColor(insight.confidence) },
                        ]}
                      >
                        {insight.confidence}%
                      </Text>
                    </Badge>
                  </View>
                  {insight.recommendation && (
                    <View style={styles.recommendationBox}>
                      <Caption numberOfLines={3} style={styles.recommendationText}>
                        💡 {insight.recommendation}
                      </Caption>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Most Common Symptoms */}
          {weeklySummary.symptoms.mostCommon.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isRTL ? "الأعراض الأكثر شيوعاً" : "Most Common Symptoms"}
              </Text>
              <View style={styles.tagsContainer}>
                {weeklySummary.symptoms.mostCommon.map((symptom, index) => (
                  <Badge key={index} variant="outline" style={styles.tag}>
                    <Text style={styles.tagText}>
                      {symptom.type} ({symptom.count})
                    </Text>
                  </Badge>
                ))}
              </View>
            </View>
          )}

          {onViewDetails && (
            <TouchableOpacity
              onPress={onViewDetails}
              style={styles.viewAllButton}
              activeOpacity={0.7}
            >
              <Text style={styles.viewAllText}>
                {isRTL ? "عرض التفاصيل الكاملة" : "View Full Details"}
              </Text>
              <Ionicons
                name={isRTL ? "arrow-forward" : "arrow-forward"}
                size={16}
                color={theme.colors.primary.main}
              />
            </TouchableOpacity>
          )}
        </View>
      )}
    </Card>
  );
}

const getStyles = (theme: any, isRTL: boolean) => ({
  card: {
    marginBottom: theme.spacing.base,
  } as ViewStyle,
  header: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: theme.spacing.base,
  } as ViewStyle,
  headerLeft: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    flex: 1,
  } as ViewStyle,
  icon: {
    fontSize: 24,
    marginRight: isRTL ? 0 : theme.spacing.base,
    marginLeft: isRTL ? theme.spacing.base : 0,
  },
  headerText: {
    flex: 1,
  },
  title: {
    marginBottom: theme.spacing.xs / 2,
  },
  subtitle: {
    color: theme.colors.text.secondary,
  },
  content: {
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.base,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  centerContainer: {
    padding: theme.spacing.xl,
    alignItems: "center" as const,
  } as ViewStyle,
  loadingText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.text.secondary,
  },
  statsRow: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    justifyContent: "space-around" as const,
    paddingVertical: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.base,
  } as ViewStyle,
  statItem: {
    alignItems: "center" as const,
  } as ViewStyle,
  statValue: {
    ...theme.typography.heading,
    fontSize: 24,
    color: theme.colors.primary.main,
    marginBottom: theme.spacing.xs / 2,
  },
  statLabel: {
    color: theme.colors.text.secondary,
    fontSize: 12,
  },
  trendsRow: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    gap: theme.spacing.base,
    marginBottom: theme.spacing.base,
    flexWrap: "wrap" as const,
  } as ViewStyle,
  trendItem: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    gap: theme.spacing.xs,
  } as ViewStyle,
  trendText: {
    fontSize: 12,
    fontWeight: "600",
  },
  insightsSection: {
    marginBottom: theme.spacing.base,
  },
  section: {
    marginBottom: theme.spacing.base,
  },
  sectionTitle: {
    ...theme.typography.subheading,
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  insightItem: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  insightHeader: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "flex-start" as const,
    gap: theme.spacing.sm,
  } as ViewStyle,
  insightIcon: {
    fontSize: 20,
  },
  insightText: {
    flex: 1,
  },
  insightTitle: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs / 2,
  },
  insightDescription: {
    color: theme.colors.text.secondary,
    fontSize: 13,
  },
  confidenceBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: "600",
  },
  recommendationBox: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.primary.light || theme.colors.background.secondary,
    borderRadius: theme.borderRadius.sm,
  },
  recommendationText: {
    color: theme.colors.primary.main,
    fontSize: 12,
    lineHeight: 18,
  },
  tagsContainer: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    flexWrap: "wrap" as const,
    gap: theme.spacing.xs,
  } as ViewStyle,
  tag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  tagText: {
    ...theme.typography.caption,
    fontSize: 12,
  },
  viewAllButton: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  } as ViewStyle,
  viewAllText: {
    ...theme.typography.body,
    color: theme.colors.primary.main,
    fontWeight: "600",
  },
});
