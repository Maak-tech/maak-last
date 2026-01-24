import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Caption, Heading, Text } from "@/components/design-system/Typography";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  healthInsightsService,
  type PatternInsight,
  type WeeklySummary,
} from "@/lib/services/healthInsightsService";
import { userService } from "@/lib/services/userService";
import type { User } from "@/types";

interface HealthInsightsCardProps {
  onViewDetails?: () => void;
}

interface FamilyMemberInsights {
  member: User;
  summary: WeeklySummary;
  insights: PatternInsight[];
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
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyInsights, setFamilyInsights] = useState<FamilyMemberInsights[]>(
    []
  );
  const [expanded, setExpanded] = useState(false);

  const styles = getStyles(theme, isRTL);

  const loadInsights = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Health insights loading timeout")),
          15_000
        )
      );

      const dataPromise = Promise.all([
        healthInsightsService.getWeeklySummary(user.id, undefined, isRTL),
        healthInsightsService.getAllInsights(user.id, isRTL),
      ]);

      const [summary, allInsights] = (await Promise.race([
        dataPromise,
        timeoutPromise,
      ])) as [WeeklySummary, PatternInsight[]];

      setWeeklySummary(summary);
      setInsights(allInsights.slice(0, 3)); // Show top 3 insights
    } catch {
      // Silently handle errors - set empty state to prevent infinite loading
      setWeeklySummary(null);
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, [user, isRTL]);

  const loadFamilyInsights = useCallback(async () => {
    if (!user?.familyId || user?.role !== "admin") return;

    try {
      setFamilyLoading(true);
      const members = await userService.getFamilyMembers(user.familyId);
      const otherMembers = members.filter((member) => member.id !== user.id);

      const results = await Promise.allSettled(
        otherMembers.map(async (member) => {
          const [summary, allInsights] = await Promise.all([
            healthInsightsService.getWeeklySummary(member.id, undefined, isRTL),
            healthInsightsService.getAllInsights(member.id, isRTL),
          ]);

          return {
            member,
            summary,
            insights: allInsights.slice(0, 2),
          };
        })
      );

      const memberInsights = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : []
      );

      setFamilyInsights(memberInsights);
    } catch {
      setFamilyInsights([]);
    } finally {
      setFamilyLoading(false);
    }
  }, [user?.familyId, user?.id, user?.role, isRTL]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    if (!user?.familyId || user?.role !== "admin") {
      setFamilyInsights([]);
      return;
    }

    loadFamilyInsights();
  }, [user?.familyId, user?.role, isRTL, loadFamilyInsights]);

  const getInsightIcon = (type: PatternInsight["type"]) => {
    switch (type) {
      case "temporal":
        return "time-outline";
      case "correlation":
        return "link-outline";
      case "trend":
        return "trending-up-outline";
      case "recommendation":
        return "bulb-outline";
      default:
        return "information-circle-outline";
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

  const getMemberName = (member: User) => {
    const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
    return name || (isRTL ? "عضو العائلة" : "Family Member");
  };

  const renderFamilyInsights = () => {
    if (user?.role !== "admin" || !user?.familyId) {
      return null;
    }

    return (
      <View style={styles.familySection}>
        <Text style={styles.sectionTitle}>
          {t("familyInsights", "Family Insights")}
        </Text>
        {familyLoading ? (
          <View style={styles.familyLoading}>
            <ActivityIndicator color={theme.colors.primary.main} size="small" />
            <Caption numberOfLines={1} style={styles.loadingText}>
              {isRTL
                ? "جاري تحميل رؤى العائلة..."
                : "Loading family insights..."}
            </Caption>
          </View>
        ) : familyInsights.length > 0 ? (
          familyInsights.map(({ member, summary, insights }) => (
            <View key={member.id} style={styles.familyCard}>
              <View style={styles.familyHeader}>
                <Text style={styles.familyName}>{getMemberName(member)}</Text>
                <Badge style={styles.familyBadge} variant="outline">
                  <Text style={styles.familyBadgeText}>
                    {summary.symptoms.total} {isRTL ? "أعراض" : "symptoms"}
                  </Text>
                </Badge>
              </View>
              <Caption numberOfLines={1} style={styles.familySubtitle}>
                {isRTL
                  ? `ملخص الأسبوع: ${formatDate(summary.weekStart)} - ${formatDate(summary.weekEnd)}`
                  : `Week Summary: ${formatDate(summary.weekStart)} - ${formatDate(summary.weekEnd)}`}
              </Caption>
              <View style={styles.familyStatsRow}>
                <View style={styles.familyStatItem}>
                  <Text style={styles.familyStatValue}>
                    {summary.medications.compliance}%
                  </Text>
                  <Caption numberOfLines={1} style={styles.familyStatLabel}>
                    {isRTL ? "الالتزام" : "Compliance"}
                  </Caption>
                </View>
                <View style={styles.familyStatItem}>
                  <Text style={styles.familyStatValue}>
                    {summary.moods.averageIntensity.toFixed(1)}
                  </Text>
                  <Caption numberOfLines={1} style={styles.familyStatLabel}>
                    {isRTL ? "المزاج" : "Mood"}
                  </Caption>
                </View>
                <View style={styles.familyStatItem}>
                  <Text style={styles.familyStatValue}>
                    {summary.symptoms.averageSeverity.toFixed(1)}
                  </Text>
                  <Caption numberOfLines={1} style={styles.familyStatLabel}>
                    {isRTL ? "الشدة" : "Severity"}
                  </Caption>
                </View>
              </View>
              {insights.length > 0 && (
                <View style={styles.familyInsightsList}>
                  {insights.map((insight, index) => (
                    <View key={`${member.id}-insight-${index}`}>
                      <View style={styles.familyInsightHeader}>
                        <Ionicons
                          color={theme.colors.primary.main}
                          name={getInsightIcon(insight.type)}
                          size={16}
                        />
                        <Text style={styles.familyInsightTitle}>
                          {insight.title}
                        </Text>
                        <Badge
                          style={[
                            styles.familyInsightBadge,
                            {
                              borderColor: getConfidenceColor(
                                insight.confidence
                              ),
                            },
                          ]}
                          variant="outline"
                        >
                          <Text
                            style={[
                              styles.familyInsightBadgeText,
                              {
                                color: getConfidenceColor(insight.confidence),
                              },
                            ]}
                          >
                            {insight.confidence}%
                          </Text>
                        </Badge>
                      </View>
                      <Caption
                        numberOfLines={2}
                        style={styles.familyInsightDescription}
                      >
                        {insight.description}
                      </Caption>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        ) : (
          <Caption numberOfLines={2} style={styles.familyEmptyState}>
            {isRTL
              ? "لا توجد رؤى صحية لأفراد العائلة بعد."
              : "No family insights available yet."}
          </Caption>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <Card contentStyle={undefined} onPress={undefined} style={styles.card}>
        <View style={styles.centerContainer}>
          <ActivityIndicator color={theme.colors.primary.main} size="small" />
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
    <Card contentStyle={undefined} onPress={undefined} style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded(!expanded)}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Ionicons
            color={theme.colors.primary.main}
            name="analytics-outline"
            size={24}
            style={styles.icon}
          />
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
          color={theme.colors.text.secondary}
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
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
                {isRTL ? "أعراض صحية" : "Symptoms"}
              </Caption>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {weeklySummary.medications.compliance}%
              </Text>
              <Caption numberOfLines={1} style={styles.statLabel}>
                {isRTL ? "الالتزام بالأدوية" : "Compliance"}
              </Caption>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {weeklySummary.moods.averageIntensity.toFixed(1)}
              </Text>
              <Caption numberOfLines={1} style={styles.statLabel}>
                {isRTL ? "مزاج نفسي" : "Mood"}
              </Caption>
            </View>
          </View>

          {/* Trend Indicators */}
          <View style={styles.trendsRow}>
            {weeklySummary.symptoms.trend !== "stable" && (
              <View style={styles.trendItem}>
                <Ionicons
                  color={
                    weeklySummary.symptoms.trend === "increasing"
                      ? theme.colors.accent.error || "#EF4444"
                      : theme.colors.accent.success || "#10B981"
                  }
                  name={
                    weeklySummary.symptoms.trend === "increasing"
                      ? "trending-up"
                      : "trending-down"
                  }
                  size={16}
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
                  color={
                    weeklySummary.moods.trend === "improving"
                      ? theme.colors.accent.success || "#10B981"
                      : theme.colors.accent.error || "#EF4444"
                  }
                  name={
                    weeklySummary.moods.trend === "improving"
                      ? "trending-up"
                      : "trending-down"
                  }
                  size={16}
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
                      ? "مزاج نفسي أفضل"
                      : "مزاج نفسي أسوأ"
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
              <Text style={styles.sectionTitle}>{t("keyInsights")}</Text>
              {insights.map((insight, index) => (
                <View key={index} style={styles.insightItem}>
                  <View style={styles.insightHeader}>
                    <Ionicons
                      color={theme.colors.primary.main}
                      name={getInsightIcon(insight.type)}
                      size={20}
                      style={styles.insightIcon}
                    />
                    <View style={styles.insightText}>
                      <Text style={styles.insightTitle}>{insight.title}</Text>
                      <Caption
                        numberOfLines={2}
                        style={styles.insightDescription}
                      >
                        {insight.description}
                      </Caption>
                    </View>
                    <Badge
                      style={[
                        styles.confidenceBadge,
                        {
                          borderColor: getConfidenceColor(insight.confidence),
                        },
                      ]}
                      variant="outline"
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
                      <Caption
                        numberOfLines={3}
                        style={styles.recommendationText}
                      >
                        {insight.recommendation}
                      </Caption>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {renderFamilyInsights()}

          {/* Most Common Symptoms */}
          {weeklySummary.symptoms.mostCommon.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isRTL ? "الأعراض الصحية الأكثر شيوعاً" : "Most Common Symptoms"}
              </Text>
              <View style={styles.tagsContainer}>
                {weeklySummary.symptoms.mostCommon.map((symptom, index) => (
                  <Badge key={index} style={styles.tag} variant="outline">
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
              activeOpacity={0.7}
              onPress={onViewDetails}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>
                {isRTL ? "عرض التفاصيل الكاملة" : "View Full Details"}
              </Text>
              <Ionicons
                color={theme.colors.primary.main}
                name={isRTL ? "arrow-forward" : "arrow-forward"}
                size={16}
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
    marginRight: isRTL ? 0 : theme.spacing.base,
    marginLeft: isRTL ? theme.spacing.base : 0,
  },
  headerText: {
    flex: 1,
  },
  title: {
    marginBottom: theme.spacing.xs / 2,
    color: theme.colors.primary.main,
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
    fontWeight: "600" as const,
  },
  insightsSection: {
    marginBottom: theme.spacing.base,
  },
  familySection: {
    marginBottom: theme.spacing.base,
  },
  familyLoading: {
    alignItems: "center" as const,
    paddingVertical: theme.spacing.base,
  },
  familyCard: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  familyHeader: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: theme.spacing.sm,
  },
  familyName: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.text.primary,
  },
  familyBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  familyBadgeText: {
    fontSize: 10,
    color: theme.colors.text.secondary,
  },
  familySubtitle: {
    marginTop: theme.spacing.xs,
    color: theme.colors.text.secondary,
  },
  familyStatsRow: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    justifyContent: "space-between" as const,
    marginTop: theme.spacing.sm,
  },
  familyStatItem: {
    alignItems: "center" as const,
    flex: 1,
  },
  familyStatValue: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.primary.main,
  },
  familyStatLabel: {
    color: theme.colors.text.secondary,
    fontSize: 11,
  },
  familyInsightsList: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  familyInsightHeader: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  familyInsightTitle: {
    flex: 1,
    ...theme.typography.caption,
    color: theme.colors.text.primary,
  },
  familyInsightBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  familyInsightBadgeText: {
    fontSize: 9,
    fontWeight: "600" as const,
  },
  familyInsightDescription: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  familyEmptyState: {
    color: theme.colors.text.secondary,
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
    marginTop: 2,
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
    fontWeight: "600" as const,
  },
  recommendationBox: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor:
      theme.colors.primary.light || theme.colors.background.secondary,
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
