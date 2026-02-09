import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronRight,
  Heart,
  Info,
  Lightbulb,
  Pill,
  Shield,
  Target,
  TrendingUp,
  Users,
} from "lucide-react-native";
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
import { Button, Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { useAuth } from "@/contexts/AuthContext";
import {
  type AIInsightsDashboard as AIInsightsDashboardData,
  aiInsightsService,
} from "@/lib/services/aiInsightsService";
import { safeFormatDate } from "@/utils/dateFormat";

// Icon mapping function
const getIcon = (name: string, size: number, color: string) => {
  switch (name) {
    case "Brain":
      return <Brain color={color} size={size} />;
    case "AlertTriangle":
      return <AlertTriangle color={color} size={size} />;
    case "Shield":
      return <Shield color={color} size={size} />;
    case "Target":
      return <Target color={color} size={size} />;
    case "ChevronRight":
      return <ChevronRight color={color} size={size} />;
    case "Activity":
      return <Activity color={color} size={size} />;
    case "Pill":
      return <Pill color={color} size={size} />;
    case "Lightbulb":
      return <Lightbulb color={color} size={size} />;
    case "Info":
      return <Info color={color} size={size} />;
    case "TrendingUp":
      return <TrendingUp color={color} size={size} />;
    case "Heart":
      return <Heart color={color} size={size} />;
    case "Users":
      return <Users color={color} size={size} />;
    default:
      return <Brain color={color} size={size} />;
  }
};

import { StyleSheet } from "react-native";

// Base styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  p4: {
    padding: 16,
  },
  mb2: {
    marginBottom: 8,
  },
  mb3: {
    marginBottom: 12,
  },
  mb4: {
    marginBottom: 16,
  },
  mt1: {
    marginTop: 4,
  },
  mt2: {
    marginTop: 8,
  },
  mt3: {
    marginTop: 12,
  },
  mt4: {
    marginTop: 16,
  },
  ml2: {
    marginLeft: 8,
  },
  ml3: {
    marginLeft: 12,
  },
  text: {
    fontSize: 14,
    color: "#1F2937",
  },
  textSm: {
    fontSize: 12,
  },
  textMuted: {
    color: "#6B7280",
  },
  textCenter: {
    textAlign: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1F2937",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  lineHeight: {
    lineHeight: 20,
  },
  fontBold: {
    fontWeight: "600",
  },
  py4: {
    paddingVertical: 16,
  },
  summaryCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    flexDirection: "row" as const,
    alignItems: "center",
  },
  categoryTabActive: {
    backgroundColor: "#3B82F6",
  },
  categoryTabText: {
    marginLeft: 6,
    fontSize: 14,
    color: "#6B7280",
  },
  categoryTabTextActive: {
    color: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
});

type AIInsightsDashboardProps = {
  onInsightPress?: (insight: unknown) => void;
  compact?: boolean;
};

type CorrelationResult =
  AIInsightsDashboardData["correlationAnalysis"]["correlationResults"][number];
type DiagnosisSuggestion =
  AIInsightsDashboardData["symptomAnalysis"]["diagnosisSuggestions"][number];
type SymptomPattern =
  AIInsightsDashboardData["symptomAnalysis"]["patterns"][number];
type RiskFactor =
  AIInsightsDashboardData["riskAssessment"]["riskFactors"][number];
type MedicationAlert = AIInsightsDashboardData["medicationAlerts"][number];
type HealthSuggestion = AIInsightsDashboardData["healthSuggestions"][number];
type ActionPlan = Awaited<
  ReturnType<typeof aiInsightsService.generateActionPlan>
>;

function getStableKey(prefix: string, value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return `${prefix}-${String(value)}`;
  }

  if (typeof value === "object" && value !== null) {
    const candidateKeys = [
      "id",
      "title",
      "name",
      "condition",
      "type",
      "message",
    ];
    const record = value as Record<string, unknown>;
    for (const key of candidateKeys) {
      const candidate = record[key];
      if (typeof candidate === "string" || typeof candidate === "number") {
        return `${prefix}-${String(candidate)}`;
      }
    }
  }

  return `${prefix}-${JSON.stringify(value)}`;
}

// Cache key and expiration time (5 minutes)
const CACHE_KEY_PREFIX = "ai_insights_dashboard_";
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

function AIInsightsDashboard({
  onInsightPress,
  compact = false,
}: AIInsightsDashboardProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [insights, setInsights] = useState<AIInsightsDashboardData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [_refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("overview");

  useEffect(() => {
    if (!insights || insights.insightsSummary) {
      return;
    }

    const riskLevel = insights.riskAssessment?.riskLevel || "low";
    const nextAssessmentDate =
      insights.riskAssessment?.nextAssessmentDate ?? new Date();

    setInsights((previous) => {
      if (!previous || previous.insightsSummary) {
        return previous;
      }

      return {
        ...previous,
        insightsSummary: {
          totalInsights: 0,
          highPriorityItems: 0,
          riskLevel,
          nextAssessmentDate,
        },
      };
    });
  }, [insights]);

  const getCacheKey = useCallback(
    (userId: string) => `${CACHE_KEY_PREFIX}${userId}`,
    []
  );

  const loadCachedInsights = useCallback(
    async (userId: string): Promise<AIInsightsDashboardData | null> => {
      try {
        const cacheKey = getCacheKey(userId);
        const cached = await AsyncStorage.getItem(cacheKey);
        if (!cached) {
          return null;
        }

        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();

        // Check if cache is still valid
        if (now - timestamp < CACHE_EXPIRATION_MS) {
          return data as AIInsightsDashboardData;
        }

        // Cache expired, remove it
        await AsyncStorage.removeItem(cacheKey);
        return null;
      } catch (_error) {
        // Silently fail cache read
        return null;
      }
    },
    [getCacheKey]
  );

  const saveCachedInsights = useCallback(
    async (userId: string, data: AIInsightsDashboardData) => {
      try {
        const cacheKey = getCacheKey(userId);
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({
            data,
            timestamp: Date.now(),
          })
        );
      } catch (_error) {
        // Silently fail cache write
      }
    },
    [getCacheKey]
  );

  const loadInsights = useCallback(
    async (forceRefresh = false) => {
      if (!user?.id) {
        return;
      }

      try {
        // Try to load from cache first (unless forcing refresh)
        if (!forceRefresh) {
          const cachedInsights = await loadCachedInsights(user.id);
          if (cachedInsights) {
            setInsights(cachedInsights);
            setLoading(false);
            // Refresh in background without blocking
            setTimeout(() => loadInsights(true), 100);
            return;
          }
        }

        if (forceRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        // Load dashboard without AI narrative first (faster, avoids OpenAI API delay)
        // AI narrative will be loaded separately if needed
        const dashboardPromise = aiInsightsService.generateAIInsightsDashboard(
          user.id,
          false, // Don't wait for AI narrative - load it separately
          isRTL // Pass Arabic language flag
        );

        // Use a longer timeout but don't block - show cached/partial data if available
        const timeoutPromise = new Promise<AIInsightsDashboardData>(
          (resolve) =>
            setTimeout(() => {
              // Return fallback data instead of rejecting
              const fallback: AIInsightsDashboardData = {
                id: `fallback-${user.id}`,
                userId: user.id,
                timestamp: new Date(),
                correlationAnalysis: {
                  id: `fallback-${user.id}`,
                  title: "Health Data Correlation Analysis",
                  description: "Loading analysis...",
                  correlationResults: [],
                  timestamp: new Date(),
                  userId: user.id,
                },
                symptomAnalysis: {
                  patterns: [],
                  diagnosisSuggestions: [],
                  riskAssessment: {
                    overallRisk: "low",
                    concerns: [],
                    recommendations: [],
                  },
                  analysisTimestamp: new Date(),
                },
                riskAssessment: {
                  id: `fallback-risk-${user.id}`,
                  userId: user.id,
                  overallRiskScore: 0,
                  riskLevel: "low",
                  riskFactors: [],
                  conditionRisks: [],
                  preventiveRecommendations: [],
                  timeline: "long_term",
                  assessmentDate: new Date(),
                  nextAssessmentDate: new Date(),
                },
                medicationAlerts: [],
                healthSuggestions: [],
                personalizedTips: [],
                insightsSummary: {
                  totalInsights: 0,
                  highPriorityItems: 0,
                  riskLevel: "low",
                  nextAssessmentDate: new Date(),
                },
                aiNarrative: undefined,
              };
              resolve(fallback);
            }, 20_000) // Reduced from 30s to 20s
        );

        const dashboard = await Promise.race([
          dashboardPromise,
          timeoutPromise,
        ]);

        setInsights(dashboard);
        await saveCachedInsights(user.id, dashboard);

        // Load AI narrative asynchronously after dashboard is shown
        // This way users see results faster even if narrative is slow
        // Use a separate timeout for narrative (20 seconds should be enough)
        const narrativeTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("AI narrative timeout")), 20_000)
        );

        Promise.race([
          aiInsightsService.generateAIInsightsDashboard(user.id, true, isRTL),
          narrativeTimeoutPromise,
        ])
          .then((dashboardWithNarrative) => {
            if (
              dashboardWithNarrative &&
              typeof dashboardWithNarrative === "object" &&
              "aiNarrative" in dashboardWithNarrative &&
              dashboardWithNarrative.aiNarrative
            ) {
              const updatedDashboard = {
                ...dashboard,
                aiNarrative: (dashboardWithNarrative as AIInsightsDashboardData)
                  .aiNarrative,
              };
              setInsights(updatedDashboard);
              // Save cache in background - don't wait for it
              saveCachedInsights(user.id, updatedDashboard).catch(() => {
                // Silently fail cache save
              });
            }
          })
          .catch((_err) => {
            // Silently fail - narrative is optional and can be slow
          });
      } catch (err) {
        const errorMessage =
          err instanceof Error && err.message.includes("timeout")
            ? t(
                "insightsTimeout",
                "Loading insights is taking longer than expected. Some features may be unavailable."
              )
            : t(
                "failedToLoadInsights",
                "Failed to load insights. Please try again."
              );
        setError(errorMessage);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isRTL, loadCachedInsights, saveCachedInsights, t, user?.id]
  );

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  if (loading && !insights) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#3B82F6" size="large" />
        <Text style={[styles.text, styles.mt2]}>
          {t("aiInsightsAnalyzing", "Analyzing your health data...")}
        </Text>
      </View>
    );
  }

  if (error && !insights) {
    return (
      <View style={styles.center}>
        <AlertTriangle color="#EF4444" size={48} />
        <Text style={[styles.text, styles.mt2, styles.textCenter]}>
          {error || t("aiInsightsUnableToLoad", "Unable to load insights")}
        </Text>
        <Button
          onPress={() => loadInsights(true)}
          style={styles.mt4}
          title={t("retry", "Retry")}
        />
      </View>
    );
  }

  if (!insights) {
    return null;
  }

  if (compact) {
    return (
      <CompactInsightsView
        insights={insights}
        isRTL={isRTL}
        onPress={onInsightPress}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
        <View style={styles.p4}>
          {/* Header */}
          <View style={styles.mb4}>
            <Text style={[styles.title, styles.mb2]}>
              {t("healthInsights", "Health Insights")}
            </Text>
            <Text style={[styles.subtitle, styles.textMuted]}>
              {t(
                "healthInsightsSubtitle",
                "Personalized analysis of your health patterns and recommendations"
              )}
            </Text>
          </View>

          {/* Summary Cards */}
          <View style={[styles.row, styles.mb4]}>
            <SummaryCard
              color="#3B82F6"
              icon="Brain"
              title={t("totalInsights", "Total Insights")}
              value={
                insights?.insightsSummary?.totalInsights?.toString() || "0"
              }
            />
            <SummaryCard
              color="#EF4444"
              icon="AlertTriangle"
              title={t("highPriority", "High Priority")}
              value={
                insights?.insightsSummary?.highPriorityItems?.toString() || "0"
              }
            />
            <SummaryCard
              color={getRiskColor(insights?.riskAssessment?.riskLevel || "low")}
              icon="Shield"
              title={t("riskLevel", "Risk Level")}
              value={insights?.riskAssessment?.riskLevel || "low"}
            />
          </View>

          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mb4}
          >
            {[
              {
                key: "overview",
                label: t("insightsOverview", "Overview"),
                icon: "Home",
              },
              {
                key: "correlations",
                label: t("insightsCorrelations", "Correlations"),
                icon: "TrendingUp",
              },
              {
                key: "patterns",
                label: t("insightsPatterns", "Patterns"),
                icon: "Activity",
              },
              {
                key: "risk",
                label: t("insightsRiskAssessment", "Risk Assessment"),
                icon: "Shield",
              },
              {
                key: "medications",
                label: t("medications", "Medications"),
                icon: "Pill",
              },
              {
                key: "suggestions",
                label: t("recommendations", "Recommendations"),
                icon: "Lightbulb",
              },
            ].map((category) => (
              <TouchableOpacity
                key={category.key}
                onPress={() => setSelectedCategory(category.key)}
                style={[
                  styles.categoryTab,
                  selectedCategory === category.key && styles.categoryTabActive,
                ]}
              >
                {getIcon(
                  category.icon,
                  16,
                  selectedCategory === category.key ? "#FFFFFF" : "#6B7280"
                )}
                <Text
                  style={[
                    styles.categoryTabText,
                    selectedCategory === category.key &&
                      styles.categoryTabTextActive,
                  ]}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Content based on selected category */}
          <CategoryContent
            category={selectedCategory}
            insights={insights}
            onInsightPress={onInsightPress}
          />

          {/* AI Narrative */}
          {insights.aiNarrative ? (
            <Card
              contentStyle={undefined}
              onPress={undefined}
              style={styles.mb4}
            >
              <View style={styles.row}>
                {getIcon("Brain", 20, "#3B82F6")}
                <Text style={[styles.cardTitle, styles.ml2]}>
                  {t("healthSummary", "Health Summary")}
                </Text>
              </View>
              <Text style={[styles.text, styles.mt2, styles.lineHeight]}>
                {insights.aiNarrative}
              </Text>
            </Card>
          ) : null}

          {/* Action Plan */}
          <ActionPlanSection insights={insights} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Summary Card Component
function SummaryCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <Card
      contentStyle={undefined}
      onPress={undefined}
      style={[
        styles.summaryCard,
        { borderLeftColor: color, borderLeftWidth: 4 },
      ]}
    >
      <View style={styles.row}>
        {getIcon(icon, 24, color)}
        <View style={styles.ml3}>
          <Text style={[styles.textSm, styles.textMuted]}>{title}</Text>
          <Text style={[styles.title, { color }]}>{value}</Text>
        </View>
      </View>
    </Card>
  );
}

// Category Content Component
function CategoryContent({
  category,
  insights,
  onInsightPress,
}: {
  category: string;
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: unknown) => void;
}) {
  switch (category) {
    case "overview":
      return (
        <OverviewContent insights={insights} onInsightPress={onInsightPress} />
      );
    case "correlations":
      return (
        <CorrelationsContent
          insights={insights}
          onInsightPress={onInsightPress}
        />
      );
    case "patterns":
      return (
        <PatternsContent insights={insights} onInsightPress={onInsightPress} />
      );
    case "risk":
      return (
        <RiskContent insights={insights} onInsightPress={onInsightPress} />
      );
    case "medications":
      return (
        <MedicationsContent
          insights={insights}
          onInsightPress={onInsightPress}
        />
      );
    case "suggestions":
      return (
        <SuggestionsContent
          insights={insights}
          onInsightPress={onInsightPress}
        />
      );
    default:
      return (
        <OverviewContent insights={insights} onInsightPress={onInsightPress} />
      );
  }
}

// Overview Content
function OverviewContent({
  insights,
  onInsightPress,
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: unknown) => void;
}) {
  const topInsights: unknown[] = [
    ...(insights.medicationAlerts || []).slice(0, 2),
    ...(insights.symptomAnalysis?.diagnosisSuggestions || []).slice(0, 2),
    ...(insights.correlationAnalysis?.correlationResults || []).slice(0, 2),
    ...(insights.healthSuggestions || []).slice(0, 2),
  ];

  return (
    <View>
      {topInsights.map((insight) => (
        <InsightCard
          insight={insight}
          key={getStableKey("overview", insight)}
          onPress={() => onInsightPress?.(insight)}
        />
      ))}
    </View>
  );
}

// Correlations Content
function CorrelationsContent({
  insights,
  onInsightPress,
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: unknown) => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={[styles.sectionTitle, styles.mb3]}>
        {t("insightsHealthDataCorrelationsTitle", "Health Data Correlations")}
      </Text>
      {(insights.correlationAnalysis?.correlationResults || []).map(
        (correlation: CorrelationResult) => (
          <CorrelationCard
            correlation={correlation}
            key={getStableKey("correlation", correlation)}
            onPress={() => onInsightPress?.(correlation)}
          />
        )
      )}
      {(insights.correlationAnalysis?.correlationResults || []).length === 0 ? (
        <EmptyState
          message={t(
            "insightsNoSignificantCorrelations",
            "No significant correlations found in your recent health data."
          )}
        />
      ) : null}
    </View>
  );
}

// Patterns Content
function PatternsContent({
  insights,
  onInsightPress,
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: unknown) => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={[styles.sectionTitle, styles.mb3]}>
        {t("insightsSymptomPatternsTitle", "Symptom Patterns & Diagnosis")}
      </Text>
      {(insights.symptomAnalysis?.diagnosisSuggestions || []).map(
        (diagnosis: DiagnosisSuggestion) => (
          <DiagnosisCard
            diagnosis={diagnosis}
            key={getStableKey("diagnosis", diagnosis)}
            onPress={() => onInsightPress?.(diagnosis)}
          />
        )
      )}
      {(insights.symptomAnalysis?.patterns || []).map(
        (pattern: SymptomPattern) => (
          <PatternCard
            key={getStableKey("pattern", pattern)}
            onPress={() => onInsightPress?.(pattern)}
            pattern={pattern}
          />
        )
      )}
      {(insights.symptomAnalysis?.diagnosisSuggestions || []).length === 0 &&
      (insights.symptomAnalysis?.patterns || []).length === 0 ? (
        <EmptyState
          message={t(
            "insightsNoSignificantSymptomPatterns",
            "No significant symptom patterns detected."
          )}
        />
      ) : null}
    </View>
  );
}

// Risk Content
function RiskContent({
  insights,
  onInsightPress,
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: unknown) => void;
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const risk = insights.riskAssessment || {
    id: "fallback",
    userId: "unknown",
    overallRiskScore: 0,
    riskLevel: "low",
    riskFactors: [],
    conditionRisks: [],
    preventiveRecommendations: [],
    timeline: "long_term",
    assessmentDate: new Date(),
    nextAssessmentDate: new Date(),
  };

  return (
    <View>
      <Text style={[styles.sectionTitle, styles.mb3]}>
        {t("insightsRiskAssessmentTitle", "Health Risk Assessment")}
      </Text>

      <Card contentStyle={undefined} onPress={undefined} style={styles.mb3}>
        <View style={styles.row}>
          {getIcon("Shield", 24, getRiskColor(risk.riskLevel))}
          <View style={styles.ml3}>
            <Text style={styles.cardTitle}>
              {t("overallRiskLabel", "Overall Risk")}:{" "}
              {risk.riskLevel.toUpperCase()}
            </Text>
            <Text style={[styles.text, styles.mt1]}>
              {t("scoreLabel", "Score")}: {risk.overallRiskScore}/100
            </Text>
          </View>
        </View>

        <Text style={[styles.text, styles.mt3]}>
          {t("nextAssessmentLabel", "Next Assessment")}:{" "}
          {formatDateShort(risk.nextAssessmentDate, isRTL)}
        </Text>
      </Card>

      <Text style={[styles.subtitle, styles.mb2]}>
        {t("keyRiskFactors", "Key Risk Factors")}
      </Text>
      {risk.riskFactors.slice(0, 5).map((factor: RiskFactor) => (
        <RiskFactorCard
          factor={factor}
          key={getStableKey("risk-factor", factor)}
          onPress={() => onInsightPress?.(factor)}
        />
      ))}

      <Text style={[styles.subtitle, styles.mb2, styles.mt4]}>
        {t("recommendations", "Recommendations")}
      </Text>
      {risk.preventiveRecommendations.map((rec) => (
        <RecommendationCard
          key={getStableKey("recommendation", rec)}
          onPress={() =>
            onInsightPress?.({ type: "recommendation", content: rec })
          }
          recommendation={rec}
        />
      ))}
    </View>
  );
}

// Medications Content
function MedicationsContent({
  insights,
  onInsightPress,
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: unknown) => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={[styles.sectionTitle, styles.mb3]}>
        {t("insightsMedicationInsightsTitle", "Medication Insights")}
      </Text>
      {insights.medicationAlerts.map((alert: MedicationAlert) => (
        <MedicationAlertCard
          alert={alert}
          key={getStableKey("med-alert", alert)}
          onPress={() => onInsightPress?.(alert)}
        />
      ))}
      {insights.medicationAlerts.length === 0 ? (
        <EmptyState
          message={t(
            "insightsNoMedicationConcerns",
            "No medication interaction concerns detected."
          )}
        />
      ) : null}
    </View>
  );
}

// Suggestions Content
function SuggestionsContent({
  insights,
  onInsightPress,
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: unknown) => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={[styles.sectionTitle, styles.mb3]}>
        {t(
          "insightsPersonalizedRecommendationsTitle",
          "Personalized Recommendations"
        )}
      </Text>
      {insights.healthSuggestions.map((suggestion: HealthSuggestion) => (
        <SuggestionCard
          key={getStableKey("suggestion", suggestion)}
          onPress={() => onInsightPress?.(suggestion)}
          suggestion={suggestion}
        />
      ))}
      {insights.personalizedTips.map((tip) => (
        <TipCard
          key={getStableKey("tip", tip)}
          onPress={() => onInsightPress?.({ type: "tip", content: tip })}
          tip={tip}
        />
      ))}
      {insights.healthSuggestions.length === 0 &&
      insights.personalizedTips.length === 0 ? (
        <EmptyState
          message={t(
            "insightsNoRecommendationsYet",
            "No specific recommendations at this time. Keep tracking your health!"
          )}
        />
      ) : null}
    </View>
  );
}

// Action Plan Section
function ActionPlanSection({
  insights,
}: {
  insights: AIInsightsDashboardData;
}) {
  const { t, i18n } = useTranslation();
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const isRTL = i18n.language === "ar";

  const loadActionPlan = async () => {
    if (!insights.userId) {
      return;
    }

    try {
      setLoading(true);
      const plan = await aiInsightsService.generateActionPlan(
        insights.userId,
        isRTL
      );
      setActionPlan(plan);
    } catch (_error) {
      // Failed to load action plan
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card contentStyle={undefined} onPress={undefined} style={styles.mb4}>
      <View style={styles.row}>
        {getIcon("Target", 20, "#3B82F6")}
        <Text style={[styles.cardTitle, styles.ml2]}>
          {t("healthActionPlan", "Health Action Plan")}
        </Text>
      </View>

      {actionPlan ? (
        <View style={styles.mt3}>
          {actionPlan.immediate.length > 0 ? (
            <View style={styles.mb3}>
              <Text
                style={[styles.textSm, styles.fontBold, { color: "#EF4444" }]}
              >
                {t("immediateActions", "Immediate Actions")}
              </Text>
              {actionPlan.immediate.map((action: string) => (
                <Text
                  key={getStableKey("immediate", action)}
                  style={[styles.text, styles.mt1]}
                >
                  • {action}
                </Text>
              ))}
            </View>
          ) : null}

          {actionPlan.shortTerm.length > 0 ? (
            <View style={styles.mb3}>
              <Text
                style={[styles.textSm, styles.fontBold, { color: "#F59E0B" }]}
              >
                {t("shortTermGoals", "Short-term Goals")}
              </Text>
              {actionPlan.shortTerm.map((action: string) => (
                <Text
                  key={getStableKey("short-term", action)}
                  style={[styles.text, styles.mt1]}
                >
                  • {action}
                </Text>
              ))}
            </View>
          ) : null}

          {actionPlan.longTerm.length > 0 ? (
            <View style={styles.mb3}>
              <Text
                style={[styles.textSm, styles.fontBold, { color: "#10B981" }]}
              >
                {t("longTermGoals", "Long-term Goals")}
              </Text>
              {actionPlan.longTerm.map((action: string) => (
                <Text
                  key={getStableKey("long-term", action)}
                  style={[styles.text, styles.mt1]}
                >
                  • {action}
                </Text>
              ))}
            </View>
          ) : null}

          {actionPlan.monitoring.length > 0 ? (
            <View>
              <Text
                style={[styles.textSm, styles.fontBold, { color: "#6B7280" }]}
              >
                Ongoing Monitoring
              </Text>
              {actionPlan.monitoring.map((item: string) => (
                <Text
                  key={getStableKey("monitor", item)}
                  style={[styles.text, styles.mt1]}
                >
                  • {item}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <Button
          loading={loading}
          onPress={loadActionPlan}
          style={styles.mt3}
          title={t("generateActionPlan", "Generate Action Plan")}
        />
      )}
    </Card>
  );
}

// Compact Insights View
function CompactInsightsView({
  insights,
  onPress,
  isRTL = false,
}: {
  insights: AIInsightsDashboardData;
  onPress?: (insight: unknown) => void;
  isRTL?: boolean;
}) {
  // Safely access insightsSummary with fallback
  const insightsSummary = insights?.insightsSummary || {
    totalInsights: 0,
    highPriorityItems: 0,
    riskLevel: "low",
    nextAssessmentDate: new Date(),
  };

  let prioritizedInsights = "Your health data looks good";
  if (isRTL && insightsSummary.highPriorityItems > 0) {
    prioritizedInsights =
      "Ù‡Ù†Ø§Ùƒ Ø¹Ù†Ø§ØµØ± Ø°Ø§Øª Ø£ÙˆÙ„ÙˆÙŠØ© Ø¹Ø§Ù„ÙŠØ© ØªØ­ØªØ§Ø¬ Ø¥Ù„Ù‰ Ø§Ù„Ø§Ù‡ØªÙ…Ø§Ù…";
  } else if (isRTL) {
    prioritizedInsights = "Ø¨ÙŠØ§Ù†Ø§ØªÙƒ Ø§Ù„ØµØ­ÙŠØ© ØªØ¨Ø¯Ùˆ Ø¬ÙŠØ¯Ø©";
  } else if (insightsSummary.highPriorityItems > 0) {
    prioritizedInsights = "High priority items need attention";
  }

  return (
    <Card
      contentStyle={undefined}
      onPress={() => onPress?.(insights)}
      style={styles.mb3}
    >
      <View style={styles.row}>
        {getIcon("Brain", 24, "#3B82F6")}
        <View style={styles.ml3}>
          <Text style={styles.cardTitle}>
            {isRTL ? "Ø§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª Ø§Ù„ØµØ­ÙŠØ© " : "Health Insights"}
          </Text>
          <Text style={[styles.text, styles.textMuted]}>
            {prioritizedInsights}
          </Text>
          <View style={[styles.row, styles.mt1]}>
            <Badge style={{}}>
              {insights?.riskAssessment?.riskLevel || "low"}
            </Badge>
            <Text style={[styles.textSm, styles.textMuted, styles.ml2]}>
              {insightsSummary.totalInsights}{" "}
              {isRTL ? "Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø§Ù„ØµØ­ÙŠ " : "insights"}
            </Text>
          </View>
        </View>
        {getIcon("ChevronRight", 16, "#6B7280")}
      </View>
    </Card>
  );
}

// Helper Components
function InsightCard({
  insight,
  onPress,
}: {
  insight: unknown;
  onPress?: () => void;
}) {
  const typedInsight = insight as
    | {
        title?: string;
        condition?: string;
        description?: string;
        reasoning?: string;
      }
    | undefined;

  return (
    <Card contentStyle={undefined} onPress={onPress} style={styles.mb2}>
      <Text style={styles.cardTitle}>
        {typedInsight?.title || typedInsight?.condition || "Insight"}
      </Text>
      <Text style={[styles.text, styles.mt1]}>
        {typedInsight?.description ||
          typedInsight?.reasoning ||
          "Details available"}
      </Text>
    </Card>
  );
}

function CorrelationCard({
  correlation,
  onPress,
}: {
  correlation: CorrelationResult;
  onPress?: () => void;
}) {
  return (
    <Card contentStyle={undefined} onPress={onPress} style={styles.mb2}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>
          {correlation.data.factor1} â†” {correlation.data.factor2}
        </Text>
        <Badge
          style={{}}
        >{`${(correlation.strength * 100).toFixed(0)}%`}</Badge>
      </View>
      <Text style={[styles.text, styles.mt1]}>{correlation.description}</Text>
      {correlation.recommendation ? (
        <Text style={[styles.textSm, styles.textMuted, styles.mt1]}>
          ðŸ’¡ {correlation.recommendation}
        </Text>
      ) : null}
    </Card>
  );
}

function DiagnosisCard({
  diagnosis,
  onPress,
}: {
  diagnosis: DiagnosisSuggestion;
  onPress?: () => void;
}) {
  return (
    <Card contentStyle={undefined} onPress={onPress} style={styles.mb2}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{diagnosis.condition}</Text>
        <Badge style={{}}>{`${diagnosis.confidence}%`}</Badge>
      </View>
      <Text style={[styles.text, styles.mt1]}>{diagnosis.reasoning}</Text>
      <Text style={[styles.textSm, styles.textMuted, styles.mt2]}>
        {diagnosis.disclaimer}
      </Text>
      {diagnosis.recommendations && diagnosis.recommendations.length > 0 ? (
        <Text style={[styles.textSm, styles.mt2]}>
          ðŸ’¡ {diagnosis.recommendations[0]}
        </Text>
      ) : null}
    </Card>
  );
}

function PatternCard({
  pattern,
  onPress,
}: {
  pattern: SymptomPattern;
  onPress?: () => void;
}) {
  return (
    <Card contentStyle={undefined} onPress={onPress} style={styles.mb2}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{pattern.name}</Text>
        <Badge style={{}}>{`${pattern.confidence}%`}</Badge>
      </View>
      <Text style={[styles.text, styles.mt1]}>{pattern.description}</Text>
    </Card>
  );
}

function RiskFactorCard({
  factor,
  onPress,
}: {
  factor: RiskFactor;
  onPress?: () => void;
}) {
  return (
    <Card contentStyle={undefined} onPress={onPress} style={styles.mb2}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{factor.name}</Text>
        <Badge style={{}}>{`Impact: ${factor.impact}`}</Badge>
      </View>
      <Text style={[styles.text, styles.mt1]}>{factor.description}</Text>
    </Card>
  );
}

function MedicationAlertCard({
  alert,
  onPress,
}: {
  alert: MedicationAlert;
  onPress?: () => void;
}) {
  const severityMap: { [key: string]: string } = {
    major: "#EF4444",
    moderate: "#F59E0B",
    minor: "#10B981",
  };
  const severityColor = severityMap[String(alert.severity)] || "#6B7280";

  return (
    <Card contentStyle={undefined} onPress={onPress} style={styles.mb2}>
      <View style={styles.row}>
        {getIcon("AlertTriangle", 20, severityColor)}
        <Text style={[styles.cardTitle, styles.ml2]}>{alert.title}</Text>
      </View>
      <Text style={[styles.text, styles.mt1]}>{alert.message}</Text>
      {alert.recommendations && alert.recommendations.length > 0 ? (
        <Text style={[styles.textSm, styles.textMuted, styles.mt1]}>
          ðŸ’¡ {alert.recommendations[0]}
        </Text>
      ) : null}
    </Card>
  );
}

function SuggestionCard({
  suggestion,
  onPress,
}: {
  suggestion: HealthSuggestion;
  onPress?: () => void;
}) {
  return (
    <Card contentStyle={undefined} onPress={onPress} style={styles.mb2}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{suggestion.title}</Text>
        <Badge style={{}}>{suggestion.priority}</Badge>
      </View>
      <Text style={[styles.text, styles.mt1]}>{suggestion.description}</Text>
      {suggestion.action?.label ? (
        <Text
          style={[
            styles.textSm,
            styles.fontBold,
            styles.mt1,
            { color: "#3B82F6" },
          ]}
        >
          {suggestion.action.label}
        </Text>
      ) : null}
    </Card>
  );
}

function RecommendationCard({
  recommendation,
  onPress,
}: {
  recommendation: string;
  onPress?: () => void;
}) {
  return (
    <Card contentStyle={undefined} onPress={onPress} style={styles.mb2}>
      <Text style={[styles.text, styles.textCenter]}>â€¢ {recommendation}</Text>
    </Card>
  );
}

function TipCard({ tip, onPress }: { tip: string; onPress?: () => void }) {
  return (
    <Card contentStyle={undefined} onPress={onPress} style={styles.mb2}>
      <View style={styles.row}>
        {getIcon("Lightbulb", 16, "#F59E0B")}
        <Text style={[styles.text, styles.ml2]}>{tip}</Text>
      </View>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={[styles.center, styles.py4]}>
      {getIcon("Info", 32, "#9CA3AF")}
      <Text
        style={[styles.text, styles.textMuted, styles.mt2, styles.textCenter]}
      >
        {message}
      </Text>
    </View>
  );
}

// Helper functions
function getRiskColor(riskLevel: string): string {
  switch (riskLevel) {
    case "very_high":
      return "#EF4444";
    case "high":
      return "#F59E0B";
    case "moderate":
      return "#F59E0B";
    case "low":
      return "#10B981";
    default:
      return "#6B7280";
  }
}

function formatDateShort(date: Date | string, isRTL: boolean): string {
  return safeFormatDate(date, isRTL ? "ar-u-ca-gregory" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export { AIInsightsDashboard };
export default AIInsightsDashboard;
