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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/design-system";
import { useAuth } from "@/contexts/AuthContext";
import {
  type AIInsightsDashboard as AIInsightsDashboardData,
  aiInsightsService,
} from "@/lib/services/aiInsightsService";

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

const { width } = Dimensions.get("window");

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

interface AIInsightsDashboardProps {
  onInsightPress?: (insight: any) => void;
  compact?: boolean;
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("overview");

  useEffect(() => {
    loadInsights();
  }, [user?.id]);

  useEffect(() => {
    if (!insights || insights.insightsSummary) return;

    const riskLevel = insights.riskAssessment?.riskLevel || "low";
    const nextAssessmentDate =
      insights.riskAssessment?.nextAssessmentDate ?? new Date();

    setInsights((previous) => {
      if (!previous || previous.insightsSummary) return previous;

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

  const getCacheKey = (userId: string) => `${CACHE_KEY_PREFIX}${userId}`;

  const loadCachedInsights = async (
    userId: string
  ): Promise<AIInsightsDashboardData | null> => {
    try {
      const cacheKey = getCacheKey(userId);
      const cached = await AsyncStorage.getItem(cacheKey);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now - timestamp < CACHE_EXPIRATION_MS) {
        return data as AIInsightsDashboardData;
      }

      // Cache expired, remove it
      await AsyncStorage.removeItem(cacheKey);
      return null;
    } catch (error) {
      // Silently fail cache read
      return null;
    }
  };

  const saveCachedInsights = async (
    userId: string,
    data: AIInsightsDashboardData
  ) => {
    try {
      const cacheKey = getCacheKey(userId);
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      // Silently fail cache write
    }
  };

  const loadInsights = async (forceRefresh = false) => {
    if (!user?.id) return;

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
        false // Don't wait for AI narrative - load it separately
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

      const dashboard = await Promise.race([dashboardPromise, timeoutPromise]);

      setInsights(dashboard);
      await saveCachedInsights(user.id, dashboard);

      // Load AI narrative asynchronously after dashboard is shown
      // This way users see results faster even if narrative is slow
      // Use a separate timeout for narrative (20 seconds should be enough)
      const narrativeTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI narrative timeout")), 20_000)
      );

      Promise.race([
        aiInsightsService.generateAIInsightsDashboard(user.id, true),
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
        .catch((err) => {
          // Silently fail - narrative is optional and can be slow
          if (__DEV__) {
            console.warn("Failed to load AI narrative (optional):", err);
          }
        });
    } catch (err) {
      console.error("Failed to load AI insights:", err);
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
      // Don't clear insights if we have cached data
      if (!insights) {
        setInsights(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading && !insights) {
    return (
      <View className="items-center justify-center py-5">
        <ActivityIndicator color="#3B82F6" size="large" />
        <Text className="mt-2 text-on-surface-secondary text-sm">
          {t("aiInsightsAnalyzing", "Analyzing your health data...")}
        </Text>
      </View>
    );
  }

  if (error && !insights) {
    return (
      <View className="items-center justify-center py-5">
        <AlertTriangle color="#EF4444" size={48} />
        <Text className="mt-2 text-center text-on-surface-secondary text-sm">
          {error || t("aiInsightsUnableToLoad", "Unable to load insights")}
        </Text>
        <View className="mt-4">
          <Button
            onPress={() => loadInsights(true)}
            title={t("retry", "Retry")}
          />
        </View>
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
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Header */}
          <View className="mb-4">
            <Text className="mb-2 font-semibold text-2xl text-on-surface">
              {t("healthInsights", "Health Insights")}
            </Text>
            <Text className="text-on-surface-secondary">
              {t(
                "healthInsightsSubtitle",
                "Personalized analysis of your health patterns and recommendations"
              )}
            </Text>
          </View>

          {/* Summary Cards */}
          <View className="mb-4 flex-row">
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
            className="mb-4"
            horizontal
            showsHorizontalScrollIndicator={false}
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
                className={`mr-2 flex-row items-center rounded-full px-4 py-2 ${
                  selectedCategory === category.key
                    ? "bg-blue-600"
                    : "bg-surface-tertiary"
                }`}
                key={category.key}
                onPress={() => setSelectedCategory(category.key)}
              >
                {getIcon(
                  category.icon,
                  16,
                  selectedCategory === category.key ? "#FFFFFF" : "#64748B"
                )}
                <Text
                  className={`ml-1.5 text-sm ${
                    selectedCategory === category.key
                      ? "font-medium text-white"
                      : "text-on-surface-secondary"
                  }`}
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
            <View className="mb-4 rounded-xl bg-surface-secondary p-4">
              <View className="mb-2 flex-row items-center">
                {getIcon("Brain", 20, "#3B82F6")}
                <Text className="ml-2 font-semibold text-base text-on-surface">
                  {t("healthSummary", "Health Summary")}
                </Text>
              </View>
              <Text className="mt-2 text-on-surface text-sm leading-5">
                {insights.aiNarrative}
              </Text>
            </View>
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
    <View
      className="mx-1 flex-1 rounded-xl bg-surface-secondary p-4"
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <View className="flex-row items-center">
        {getIcon(icon, 24, color)}
        <View className="ml-3">
          <Text className="text-on-surface-secondary text-xs">{title}</Text>
          <Text className="font-semibold text-2xl" style={{ color }}>
            {value}
          </Text>
        </View>
      </View>
    </View>
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
  onInsightPress?: (insight: any) => void;
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
  onInsightPress?: (insight: any) => void;
}) {
  const topInsights = [
    ...(insights.medicationAlerts || []).slice(0, 2),
    ...(insights.symptomAnalysis?.diagnosisSuggestions || []).slice(0, 2),
    ...(insights.correlationAnalysis?.correlationResults || []).slice(0, 2),
    ...(insights.healthSuggestions || []).slice(0, 2),
  ];

  return (
    <View>
      {topInsights.map((insight, index) => (
        <InsightCard
          insight={insight}
          key={`overview-${index}`}
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
  onInsightPress?: (insight: any) => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text className="mb-3 font-semibold text-lg text-on-surface">
        {t("insightsHealthDataCorrelationsTitle", "Health Data Correlations")}
      </Text>
      {(insights.correlationAnalysis?.correlationResults || []).map(
        (correlation: any, index: number) => (
          <CorrelationCard
            correlation={correlation}
            key={`correlation-${index}`}
            onPress={() => onInsightPress?.(correlation)}
          />
        )
      )}
      {(insights.correlationAnalysis?.correlationResults || []).length ===
        0 && (
        <EmptyState
          message={t(
            "insightsNoSignificantCorrelations",
            "No significant correlations found in your recent health data."
          )}
        />
      )}
    </View>
  );
}

// Patterns Content
function PatternsContent({
  insights,
  onInsightPress,
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: any) => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text className="mb-3 font-semibold text-lg text-on-surface">
        {t("insightsSymptomPatternsTitle", "Symptom Patterns & Diagnosis")}
      </Text>
      {(insights.symptomAnalysis?.diagnosisSuggestions || []).map(
        (diagnosis: any, index: number) => (
          <DiagnosisCard
            diagnosis={diagnosis}
            key={`diagnosis-${index}`}
            onPress={() => onInsightPress?.(diagnosis)}
          />
        )
      )}
      {(insights.symptomAnalysis?.patterns || []).map(
        (pattern: any, index: number) => (
          <PatternCard
            key={`pattern-${index}`}
            onPress={() => onInsightPress?.(pattern)}
            pattern={pattern}
          />
        )
      )}
      {(insights.symptomAnalysis?.diagnosisSuggestions || []).length === 0 &&
        (insights.symptomAnalysis?.patterns || []).length === 0 && (
          <EmptyState
            message={t(
              "insightsNoSignificantSymptomPatterns",
              "No significant symptom patterns detected."
            )}
          />
        )}
    </View>
  );
}

// Risk Content
function RiskContent({
  insights,
  onInsightPress,
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: any) => void;
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
      <Text className="mb-3 font-semibold text-lg text-on-surface">
        {t("insightsRiskAssessmentTitle", "Health Risk Assessment")}
      </Text>

      <View className="mb-3 rounded-xl bg-surface-secondary p-4">
        <View className="flex-row items-center">
          {getIcon("Shield", 24, getRiskColor(risk.riskLevel))}
          <View className="ml-3">
            <Text className="font-semibold text-base text-on-surface">
              {t("overallRiskLabel", "Overall Risk")}:{" "}
              {risk.riskLevel.toUpperCase()}
            </Text>
            <Text className="mt-1 text-on-surface text-sm">
              {t("scoreLabel", "Score")}: {risk.overallRiskScore}/100
            </Text>
          </View>
        </View>

        <Text className="mt-3 text-on-surface text-sm">
          {t("nextAssessmentLabel", "Next Assessment")}:{" "}
          {new Intl.DateTimeFormat(isRTL ? "ar-u-ca-gregory" : "en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }).format(risk.nextAssessmentDate)}
        </Text>
      </View>

      <Text className="mb-2 text-on-surface-secondary">
        {t("keyRiskFactors", "Key Risk Factors")}
      </Text>
      {risk.riskFactors.slice(0, 5).map((factor: any, index: number) => (
        <RiskFactorCard
          factor={factor}
          key={`risk-factor-${index}`}
          onPress={() => onInsightPress?.(factor)}
        />
      ))}

      <Text className="mt-4 mb-2 text-on-surface-secondary">
        {t("recommendations", "Recommendations")}
      </Text>
      {risk.preventiveRecommendations.map((rec: any, index: number) => (
        <RecommendationCard
          key={`rec-${index}`}
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
  onInsightPress?: (insight: any) => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text className="mb-3 font-semibold text-lg text-on-surface">
        {t("insightsMedicationInsightsTitle", "Medication Insights")}
      </Text>
      {insights.medicationAlerts.map((alert: any, index: number) => (
        <MedicationAlertCard
          alert={alert}
          key={`med-alert-${index}`}
          onPress={() => onInsightPress?.(alert)}
        />
      ))}
      {insights.medicationAlerts.length === 0 && (
        <EmptyState
          message={t(
            "insightsNoMedicationConcerns",
            "No medication interaction concerns detected."
          )}
        />
      )}
    </View>
  );
}

// Suggestions Content
function SuggestionsContent({
  insights,
  onInsightPress,
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: any) => void;
}) {
  const { t } = useTranslation();
  return (
    <View>
      <Text className="mb-3 font-semibold text-lg text-on-surface">
        {t(
          "insightsPersonalizedRecommendationsTitle",
          "Personalized Recommendations"
        )}
      </Text>
      {insights.healthSuggestions.map((suggestion: any, index: number) => (
        <SuggestionCard
          key={`suggestion-${index}`}
          onPress={() => onInsightPress?.(suggestion)}
          suggestion={suggestion}
        />
      ))}
      {insights.personalizedTips.map((tip: any, index: number) => (
        <TipCard
          key={`tip-${index}`}
          onPress={() => onInsightPress?.({ type: "tip", content: tip })}
          tip={tip}
        />
      ))}
      {insights.healthSuggestions.length === 0 &&
        insights.personalizedTips.length === 0 && (
          <EmptyState
            message={t(
              "insightsNoRecommendationsYet",
              "No specific recommendations at this time. Keep tracking your health!"
            )}
          />
        )}
    </View>
  );
}

// Action Plan Section
function ActionPlanSection({
  insights,
}: {
  insights: AIInsightsDashboardData;
}) {
  const { t } = useTranslation();
  const [actionPlan, setActionPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadActionPlan = async () => {
    if (!insights.userId) {
      return;
    }

    try {
      setLoading(true);
      const plan = await aiInsightsService.generateActionPlan(insights.userId);
      setActionPlan(plan);
    } catch (error) {
      console.error("Failed to load action plan:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="mb-4 rounded-xl bg-surface-secondary p-4">
      <View className="flex-row items-center">
        {getIcon("Target", 20, "#3B82F6")}
        <Text className="ml-2 font-semibold text-base text-on-surface">
          {t("healthActionPlan", "Health Action Plan")}
        </Text>
      </View>

      {actionPlan ? (
        <View className="mt-3">
          {actionPlan.immediate.length > 0 ? (
            <View className="mb-3">
              <Text className="font-semibold text-red-500 text-xs">
                {t("immediateActions", "Immediate Actions")}
              </Text>
              {actionPlan.immediate.map((action: string, index: number) => (
                <Text
                  className="mt-1 text-on-surface text-sm"
                  key={`immediate-${index}`}
                >
                  • {action}
                </Text>
              ))}
            </View>
          ) : null}

          {actionPlan.shortTerm.length > 0 ? (
            <View className="mb-3">
              <Text className="font-semibold text-amber-500 text-xs">
                {t("shortTermGoals", "Short-term Goals")}
              </Text>
              {actionPlan.shortTerm.map((action: string, index: number) => (
                <Text
                  className="mt-1 text-on-surface text-sm"
                  key={`short-${index}`}
                >
                  • {action}
                </Text>
              ))}
            </View>
          ) : null}

          {actionPlan.longTerm.length > 0 ? (
            <View className="mb-3">
              <Text className="font-semibold text-emerald-500 text-xs">
                {t("longTermGoals", "Long-term Goals")}
              </Text>
              {actionPlan.longTerm.map((action: string, index: number) => (
                <Text
                  className="mt-1 text-on-surface text-sm"
                  key={`long-${index}`}
                >
                  • {action}
                </Text>
              ))}
            </View>
          ) : null}

          {actionPlan.monitoring.length > 0 ? (
            <View>
              <Text className="font-semibold text-on-surface-secondary text-xs">
                Ongoing Monitoring
              </Text>
              {actionPlan.monitoring.map((item: string, index: number) => (
                <Text
                  className="mt-1 text-on-surface text-sm"
                  key={`monitor-${index}`}
                >
                  • {item}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View className="mt-3">
          <Button
            loading={loading}
            onPress={loadActionPlan}
            title={t("generateActionPlan", "Generate Action Plan")}
          />
        </View>
      )}
    </View>
  );
}

// Compact Insights View
function CompactInsightsView({
  insights,
  onPress,
  isRTL = false,
}: {
  insights: AIInsightsDashboardData;
  onPress?: (insight: any) => void;
  isRTL?: boolean;
}) {
  // Safely access insightsSummary with fallback
  const insightsSummary = insights?.insightsSummary || {
    totalInsights: 0,
    highPriorityItems: 0,
    riskLevel: "low",
    nextAssessmentDate: new Date(),
  };

  const prioritizedInsights =
    insightsSummary.highPriorityItems > 0
      ? isRTL
        ? "هناك عناصر ذات أولوية عالية تحتاج إلى الاهتمام"
        : "High priority items need attention"
      : isRTL
        ? "بياناتك الصحية تبدو جيدة"
        : "Your health data looks good";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="mb-3 rounded-xl bg-surface-secondary p-4"
      onPress={() => onPress?.(insights)}
    >
      <View className="flex-row items-center">
        {getIcon("Brain", 24, "#3B82F6")}
        <View className="ml-3 flex-1">
          <Text className="font-semibold text-base text-on-surface">
            {isRTL ? "التحليلات الصحية " : "Health Insights"}
          </Text>
          <Text className="mt-1 text-on-surface-secondary text-sm">
            {prioritizedInsights}
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <View className="rounded-full bg-surface px-2 py-0.5">
              <Text className="font-medium text-on-surface-secondary text-xs">
                {insights?.riskAssessment?.riskLevel || "low"}
              </Text>
            </View>
            <Text className="text-on-surface-secondary text-xs">
              {insightsSummary.totalInsights}{" "}
              {isRTL ? "التحليل الصحي " : "insights"}
            </Text>
          </View>
        </View>
        {getIcon("ChevronRight", 16, "#94A3B8")}
      </View>
    </TouchableOpacity>
  );
}

// Helper Components
function InsightCard({
  insight,
  onPress,
}: {
  insight: any;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="mb-2 rounded-xl bg-surface-secondary p-4"
      onPress={onPress}
    >
      <Text className="font-semibold text-base text-on-surface">
        {insight.title || insight.condition || "Insight"}
      </Text>
      <Text className="mt-1 text-on-surface text-sm">
        {insight.description || insight.reasoning || "Details available"}
      </Text>
    </TouchableOpacity>
  );
}

function CorrelationCard({
  correlation,
  onPress,
}: {
  correlation: any;
  onPress?: () => void;
}) {
  const strengthColor =
    correlation.strength > 0.7
      ? "#10B981"
      : correlation.strength > 0.3
        ? "#F59E0B"
        : "#6B7280";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="mb-2 rounded-xl bg-surface-secondary p-4"
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <Text className="flex-1 font-semibold text-base text-on-surface">
          {correlation.data.factor1} ↔ {correlation.data.factor2}
        </Text>
        <View className="rounded-full bg-surface px-2 py-0.5">
          <Text className="font-medium text-on-surface-secondary text-xs">
            {`${(correlation.strength * 100).toFixed(0)}%`}
          </Text>
        </View>
      </View>
      <Text className="mt-1 text-on-surface text-sm">
        {correlation.description}
      </Text>
      {correlation.recommendation ? (
        <Text className="mt-1 text-on-surface-secondary text-xs">
          💡 {correlation.recommendation}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function DiagnosisCard({
  diagnosis,
  onPress,
}: {
  diagnosis: any;
  onPress?: () => void;
}) {
  const urgencyMap: { [key: string]: string } = {
    emergency: "#EF4444",
    high: "#EF4444",
    medium: "#F59E0B",
    low: "#10B981",
  };
  const urgencyColor = urgencyMap[String(diagnosis.urgency)] || "#6B7280";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="mb-2 rounded-xl bg-surface-secondary p-4"
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <Text className="flex-1 font-semibold text-base text-on-surface">
          {diagnosis.condition}
        </Text>
        <View className="rounded-full bg-surface px-2 py-0.5">
          <Text className="font-medium text-on-surface-secondary text-xs">
            {`${diagnosis.confidence}%`}
          </Text>
        </View>
      </View>
      <Text className="mt-1 text-on-surface text-sm">
        {diagnosis.reasoning}
      </Text>
      <Text className="mt-2 text-on-surface-secondary text-xs">
        {diagnosis.disclaimer}
      </Text>
      {diagnosis.recommendations && diagnosis.recommendations.length > 0 ? (
        <Text className="mt-2 text-on-surface-secondary text-xs">
          💡 {diagnosis.recommendations[0]}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function PatternCard({
  pattern,
  onPress,
}: {
  pattern: any;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="mb-2 rounded-xl bg-surface-secondary p-4"
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <Text className="flex-1 font-semibold text-base text-on-surface">
          {pattern.name}
        </Text>
        <View className="rounded-full bg-surface px-2 py-0.5">
          <Text className="font-medium text-on-surface-secondary text-xs">
            {`${pattern.confidence}%`}
          </Text>
        </View>
      </View>
      <Text className="mt-1 text-on-surface text-sm">
        {pattern.description}
      </Text>
    </TouchableOpacity>
  );
}

function RiskFactorCard({
  factor,
  onPress,
}: {
  factor: any;
  onPress?: () => void;
}) {
  const impactColor =
    factor.impact > 25 ? "#EF4444" : factor.impact > 15 ? "#F59E0B" : "#10B981";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="mb-2 rounded-xl bg-surface-secondary p-4"
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <Text className="flex-1 font-semibold text-base text-on-surface">
          {factor.name}
        </Text>
        <View className="rounded-full bg-surface px-2 py-0.5">
          <Text className="font-medium text-on-surface-secondary text-xs">
            Impact: {factor.impact}
          </Text>
        </View>
      </View>
      <Text className="mt-1 text-on-surface text-sm">{factor.description}</Text>
    </TouchableOpacity>
  );
}

function MedicationAlertCard({
  alert,
  onPress,
}: {
  alert: any;
  onPress?: () => void;
}) {
  const severityMap: { [key: string]: string } = {
    major: "#EF4444",
    moderate: "#F59E0B",
    minor: "#10B981",
  };
  const severityColor = severityMap[String(alert.severity)] || "#6B7280";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="mb-2 rounded-xl bg-surface-secondary p-4"
      onPress={onPress}
    >
      <View className="flex-row items-center">
        {getIcon("AlertTriangle", 20, severityColor)}
        <Text className="ml-2 font-semibold text-base text-on-surface">
          {alert.title}
        </Text>
      </View>
      <Text className="mt-1 text-on-surface text-sm">{alert.message}</Text>
      {alert.recommendations && alert.recommendations.length > 0 ? (
        <Text className="mt-1 text-on-surface-secondary text-xs">
          💡 {alert.recommendations[0]}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function SuggestionCard({
  suggestion,
  onPress,
}: {
  suggestion: any;
  onPress?: () => void;
}) {
  const priorityMap: { [key: string]: string } = {
    high: "#EF4444",
    medium: "#F59E0B",
    low: "#10B981",
  };
  const priorityColor = priorityMap[String(suggestion.priority)] || "#6B7280";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="mb-2 rounded-xl bg-surface-secondary p-4"
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <Text className="flex-1 font-semibold text-base text-on-surface">
          {suggestion.title}
        </Text>
        <View className="rounded-full bg-surface px-2 py-0.5">
          <Text className="font-medium text-on-surface-secondary text-xs">
            {suggestion.priority}
          </Text>
        </View>
      </View>
      <Text className="mt-1 text-on-surface text-sm">
        {suggestion.description}
      </Text>
      {suggestion.action?.label ? (
        <Text className="mt-1 font-semibold text-blue-600 text-xs">
          {suggestion.action.label}
        </Text>
      ) : null}
    </TouchableOpacity>
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
    <TouchableOpacity
      activeOpacity={0.7}
      className="mb-2 rounded-xl bg-surface-secondary p-4"
      onPress={onPress}
    >
      <Text className="text-center text-on-surface text-sm">
        • {recommendation}
      </Text>
    </TouchableOpacity>
  );
}

function TipCard({ tip, onPress }: { tip: string; onPress?: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="mb-2 rounded-xl bg-surface-secondary p-4"
      onPress={onPress}
    >
      <View className="flex-row items-center">
        {getIcon("Lightbulb", 16, "#F59E0B")}
        <Text className="ml-2 text-on-surface text-sm">{tip}</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View className="items-center justify-center py-4">
      {getIcon("Info", 32, "#9CA3AF")}
      <Text className="mt-2 text-center text-on-surface-secondary text-sm">
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

export { AIInsightsDashboard };
export default AIInsightsDashboard;
