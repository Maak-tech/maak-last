import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { aiInsightsService, type AIInsightsDashboard as AIInsightsDashboardData } from "@/lib/services/aiInsightsService";
import { correlationAnalysisService } from "@/lib/services/correlationAnalysisService";
import { symptomPatternRecognitionService } from "@/lib/services/symptomPatternRecognitionService";
import { riskAssessmentService } from "@/lib/services/riskAssessmentService";
import { medicationInteractionService } from "@/lib/services/medicationInteractionService";
import { proactiveHealthSuggestionsService } from "@/lib/services/proactiveHealthSuggestionsService";
import { Button, Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  AlertTriangle,
  Bot,
  Shield,
  Target,
  Brain,
  ChevronRight,
  Activity,
  Pill,
  Lightbulb,
  Info,
  TrendingUp,
  Heart,
  Users
} from "lucide-react-native";

// Icon mapping function
const getIcon = (name: string, size: number, color: string) => {
  switch (name) {
    case "Brain": return <Brain size={size} color={color} />;
    case "AlertTriangle": return <AlertTriangle size={size} color={color} />;
    case "Shield": return <Shield size={size} color={color} />;
    case "Target": return <Target size={size} color={color} />;
    case "ChevronRight": return <ChevronRight size={size} color={color} />;
    case "Activity": return <Activity size={size} color={color} />;
    case "Pill": return <Pill size={size} color={color} />;
    case "Lightbulb": return <Lightbulb size={size} color={color} />;
    case "Info": return <Info size={size} color={color} />;
    case "TrendingUp": return <TrendingUp size={size} color={color} />;
    case "Heart": return <Heart size={size} color={color} />;
    case "Users": return <Users size={size} color={color} />;
    default: return <Brain size={size} color={color} />;
  }
};
import { StyleSheet } from "react-native";

const { width } = Dimensions.get('window');

// Base styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#1F2937',
  },
  textSm: {
    fontSize: 12,
  },
  textMuted: {
    color: '#6B7280',
  },
  textCenter: {
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  lineHeight: {
    lineHeight: 20,
  },
  fontBold: {
    fontWeight: '600',
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
    backgroundColor: '#F3F4F6',
    flexDirection: 'row' as const,
    alignItems: 'center',
  },
  categoryTabActive: {
    backgroundColor: '#3B82F6',
  },
  categoryTabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#6B7280',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
});

interface AIInsightsDashboardProps {
  onInsightPress?: (insight: any) => void;
  compact?: boolean;
}

function AIInsightsDashboard({
  onInsightPress,
  compact = false
}: AIInsightsDashboardProps) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [insights, setInsights] = useState<AIInsightsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('overview');

  useEffect(() => {
    loadInsights();
  }, [user?.id]);

  const loadInsights = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const dashboard = await aiInsightsService.generateAIInsightsDashboard(user.id);
      setInsights(dashboard);
    } catch (err) {
      console.error('Failed to load AI insights:', err);
      setError('Failed to load insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={[styles.text, styles.mt2]}>Analyzing your health data...</Text>
      </View>
    );
  }

  if (error || !insights) {
    return (
      <View style={styles.center}>
        <AlertTriangle size={48} color="#EF4444" />
        <Text style={[styles.text, styles.mt2, styles.textCenter]}>
          {error || 'Unable to load insights'}
        </Text>
        <Button
          title="Retry"
          onPress={loadInsights}
          style={styles.mt4}
        />
      </View>
    );
  }

  if (compact) {
    return <CompactInsightsView insights={insights} onPress={onInsightPress} isRTL={isRTL} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.p4}>
          {/* Header */}
          <View style={styles.mb4}>
            <Text style={[styles.title, styles.mb2]}>{isRTL ? "الرؤى الصحية" : "Health Insights"}</Text>
            <Text style={[styles.subtitle, styles.textMuted]}>
              {isRTL 
                ? "تحليل مخصص لأنماط صحتك والتوصيات"
                : "Personalized analysis of your health patterns and recommendations"}
            </Text>
          </View>

          {/* Summary Cards */}
          <View style={[styles.row, styles.mb4]}>
            <SummaryCard
              title="Total Insights"
              value={insights.insightsSummary.totalInsights.toString()}
              icon="Brain"
              color="#3B82F6"
            />
            <SummaryCard
              title="High Priority"
              value={insights.insightsSummary.highPriorityItems.toString()}
              icon="AlertTriangle"
              color="#EF4444"
            />
            <SummaryCard
              title="Risk Level"
              value={insights.riskAssessment.riskLevel}
              icon="Shield"
              color={getRiskColor(insights.riskAssessment.riskLevel)}
            />
          </View>

          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mb4}
          >
            {[
              { key: 'overview', label: 'Overview', icon: 'Home' },
              { key: 'correlations', label: 'Correlations', icon: 'TrendingUp' },
              { key: 'patterns', label: 'Patterns', icon: 'Activity' },
              { key: 'risk', label: 'Risk Assessment', icon: 'Shield' },
              { key: 'medications', label: 'Medications', icon: 'Pill' },
              { key: 'suggestions', label: 'Recommendations', icon: 'Lightbulb' }
            ].map(category => (
              <TouchableOpacity
                key={category.key}
                style={[
                  styles.categoryTab,
                  selectedCategory === category.key && styles.categoryTabActive
                ]}
                onPress={() => setSelectedCategory(category.key)}
              >
                {getIcon(category.icon, 16, selectedCategory === category.key ? '#FFFFFF' : '#6B7280')}
                <Text style={[
                  styles.categoryTabText,
                  selectedCategory === category.key && styles.categoryTabTextActive
                ]}>
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
          {insights.aiNarrative && (
            <Card style={styles.mb4} onPress={() => {}} contentStyle={undefined}>
              <View style={styles.row}>
                {getIcon("Bot", 20, "#3B82F6")}
                <Text style={[styles.cardTitle, styles.ml2]}>{isRTL ? "ملخص الصحة" : "Health Summary"}</Text>
              </View>
              <Text style={[styles.text, styles.mt2, styles.lineHeight]}>
                {insights.aiNarrative}
              </Text>
            </Card>
          )}

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
  color
}: {
  title: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <Card style={[styles.summaryCard, { borderLeftColor: color, borderLeftWidth: 4 }]} onPress={() => {}} contentStyle={undefined}>
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
  onInsightPress
}: {
  category: string;
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: any) => void;
}) {
  switch (category) {
    case 'overview':
      return <OverviewContent insights={insights} onInsightPress={onInsightPress} />;
    case 'correlations':
      return <CorrelationsContent insights={insights} onInsightPress={onInsightPress} />;
    case 'patterns':
      return <PatternsContent insights={insights} onInsightPress={onInsightPress} />;
    case 'risk':
      return <RiskContent insights={insights} onInsightPress={onInsightPress} />;
    case 'medications':
      return <MedicationsContent insights={insights} onInsightPress={onInsightPress} />;
    case 'suggestions':
      return <SuggestionsContent insights={insights} onInsightPress={onInsightPress} />;
    default:
      return <OverviewContent insights={insights} onInsightPress={onInsightPress} />;
  }
}

// Overview Content
function OverviewContent({
  insights,
  onInsightPress
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: any) => void;
}) {
  const topInsights = [
    ...insights.medicationAlerts.slice(0, 2),
    ...insights.symptomAnalysis.diagnosisSuggestions.slice(0, 2),
    ...insights.correlationAnalysis.correlationResults.slice(0, 2),
    ...insights.healthSuggestions.slice(0, 2)
  ];

  return (
    <View>
      {topInsights.map((insight, index) => (
        <InsightCard
          key={`overview-${index}`}
          insight={insight}
          onPress={() => onInsightPress?.(insight)}
        />
      ))}
    </View>
  );
}

// Correlations Content
function CorrelationsContent({
  insights,
  onInsightPress
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: any) => void;
}) {
  return (
    <View>
      <Text style={[styles.sectionTitle, styles.mb3]}>
        Health Data Correlations
      </Text>
      {insights.correlationAnalysis.correlationResults.map((correlation: any, index: number) => (
        <CorrelationCard
          key={`correlation-${index}`}
          correlation={correlation}
          onPress={() => onInsightPress?.(correlation)}
        />
      ))}
      {insights.correlationAnalysis.correlationResults.length === 0 && (
        <EmptyState message="No significant correlations found in your recent health data." />
      )}
    </View>
  );
}

// Patterns Content
function PatternsContent({
  insights,
  onInsightPress
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: any) => void;
}) {
  return (
    <View>
      <Text style={[styles.sectionTitle, styles.mb3]}>
        Symptom Patterns & Diagnosis
      </Text>
      {insights.symptomAnalysis.diagnosisSuggestions.map((diagnosis: any, index: number) => (
        <DiagnosisCard
          key={`diagnosis-${index}`}
          diagnosis={diagnosis}
          onPress={() => onInsightPress?.(diagnosis)}
        />
      ))}
      {insights.symptomAnalysis.patterns.map((pattern: any, index: number) => (
        <PatternCard
          key={`pattern-${index}`}
          pattern={pattern}
          onPress={() => onInsightPress?.(pattern)}
        />
      ))}
      {insights.symptomAnalysis.diagnosisSuggestions.length === 0 &&
       insights.symptomAnalysis.patterns.length === 0 && (
        <EmptyState message="No significant symptom patterns detected." />
      )}
    </View>
  );
}

// Risk Content
function RiskContent({
  insights,
  onInsightPress
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: any) => void;
}) {
  const risk = insights.riskAssessment;

  return (
    <View>
      <Text style={[styles.sectionTitle, styles.mb3]}>
        Health Risk Assessment
      </Text>

      <Card style={styles.mb3} onPress={() => {}} contentStyle={undefined}>
        <View style={styles.row}>
          {getIcon("Shield", 24, getRiskColor(risk.riskLevel))}
          <View style={styles.ml3}>
            <Text style={styles.cardTitle}>
              Overall Risk: {risk.riskLevel.toUpperCase()}
            </Text>
            <Text style={[styles.text, styles.mt1]}>
              Score: {risk.overallRiskScore}/100
            </Text>
          </View>
        </View>

        <Text style={[styles.text, styles.mt3]}>
          Next Assessment: {risk.nextAssessmentDate.toLocaleDateString()}
        </Text>
      </Card>

      <Text style={[styles.subtitle, styles.mb2]}>Key Risk Factors</Text>
      {risk.riskFactors.slice(0, 5).map((factor: any, index: number) => (
        <RiskFactorCard
          key={`risk-factor-${index}`}
          factor={factor}
          onPress={() => onInsightPress?.(factor)}
        />
      ))}

      <Text style={[styles.subtitle, styles.mb2, styles.mt4]}>Recommendations</Text>
      {risk.preventiveRecommendations.map((rec: any, index: number) => (
        <RecommendationCard
          key={`rec-${index}`}
          recommendation={rec}
          onPress={() => onInsightPress?.({ type: 'recommendation', content: rec })}
        />
      ))}
    </View>
  );
}

// Medications Content
function MedicationsContent({
  insights,
  onInsightPress
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: any) => void;
}) {
  return (
    <View>
      <Text style={[styles.sectionTitle, styles.mb3]}>
        Medication Insights
      </Text>
      {insights.medicationAlerts.map((alert: any, index: number) => (
        <MedicationAlertCard
          key={`med-alert-${index}`}
          alert={alert}
          onPress={() => onInsightPress?.(alert)}
        />
      ))}
      {insights.medicationAlerts.length === 0 && (
        <EmptyState message="No medication interaction concerns detected." />
      )}
    </View>
  );
}

// Suggestions Content
function SuggestionsContent({
  insights,
  onInsightPress
}: {
  insights: AIInsightsDashboardData;
  onInsightPress?: (insight: any) => void;
}) {
  return (
    <View>
      <Text style={[styles.sectionTitle, styles.mb3]}>
        Personalized Recommendations
      </Text>
      {insights.healthSuggestions.map((suggestion: any, index: number) => (
        <SuggestionCard
          key={`suggestion-${index}`}
          suggestion={suggestion}
          onPress={() => onInsightPress?.(suggestion)}
        />
      ))}
      {insights.personalizedTips.map((tip: any, index: number) => (
        <TipCard
          key={`tip-${index}`}
          tip={tip}
          onPress={() => onInsightPress?.({ type: 'tip', content: tip })}
        />
      ))}
      {insights.healthSuggestions.length === 0 && insights.personalizedTips.length === 0 && (
        <EmptyState message="No specific recommendations at this time. Keep tracking your health!" />
      )}
    </View>
  );
}

// Action Plan Section
function ActionPlanSection({ insights }: { insights: AIInsightsDashboardData }) {
  const [actionPlan, setActionPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadActionPlan = async () => {
    if (!insights.userId) return;

    try {
      setLoading(true);
      const plan = await aiInsightsService.generateActionPlan(insights.userId);
      setActionPlan(plan);
    } catch (error) {
      console.error('Failed to load action plan:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={styles.mb4} onPress={() => {}} contentStyle={undefined}>
      <View style={styles.row}>
        {getIcon("Target", 20, "#3B82F6")}
        <Text style={[styles.cardTitle, styles.ml2]}>Health Action Plan</Text>
      </View>

      {!actionPlan ? (
        <Button
          title="Generate Action Plan"
          onPress={loadActionPlan}
          loading={loading}
          style={styles.mt3}
        />
      ) : (
        <View style={styles.mt3}>
          {actionPlan.immediate.length > 0 && (
            <View style={styles.mb3}>
              <Text style={[styles.textSm, styles.fontBold, { color: '#EF4444' }]}>
                Immediate Actions
              </Text>
              {actionPlan.immediate.map((action: string, index: number) => (
                <Text key={`immediate-${index}`} style={[styles.text, styles.mt1]}>
                  • {action}
                </Text>
              ))}
            </View>
          )}

          {actionPlan.shortTerm.length > 0 && (
            <View style={styles.mb3}>
              <Text style={[styles.textSm, styles.fontBold, { color: '#F59E0B' }]}>
                Short-term Goals
              </Text>
              {actionPlan.shortTerm.map((action: string, index: number) => (
                <Text key={`short-${index}`} style={[styles.text, styles.mt1]}>
                  • {action}
                </Text>
              ))}
            </View>
          )}

          {actionPlan.longTerm.length > 0 && (
            <View style={styles.mb3}>
              <Text style={[styles.textSm, styles.fontBold, { color: '#10B981' }]}>
                Long-term Goals
              </Text>
              {actionPlan.longTerm.map((action: string, index: number) => (
                <Text key={`long-${index}`} style={[styles.text, styles.mt1]}>
                  • {action}
                </Text>
              ))}
            </View>
          )}

          {actionPlan.monitoring.length > 0 && (
            <View>
              <Text style={[styles.textSm, styles.fontBold, { color: '#6B7280' }]}>
                Ongoing Monitoring
              </Text>
              {actionPlan.monitoring.map((item: string, index: number) => (
                <Text key={`monitor-${index}`} style={[styles.text, styles.mt1]}>
                  • {item}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

// Compact Insights View
function CompactInsightsView({
  insights,
  onPress,
  isRTL = false
}: {
  insights: AIInsightsDashboardData;
  onPress?: (insight: any) => void;
  isRTL?: boolean;
}) {
  const prioritizedInsights = insights.insightsSummary.highPriorityItems > 0
    ? (isRTL ? "هناك عناصر ذات أولوية عالية تحتاج إلى الاهتمام" : "High priority items need attention")
    : (isRTL ? "بياناتك الصحية تبدو جيدة" : "Your health data looks good");

  return (
    <Card style={styles.mb3} onPress={() => onPress?.(insights)} contentStyle={undefined}>
      <View style={styles.row}>
        {getIcon("Brain", 24, "#3B82F6")}
        <View style={styles.ml3}>
          <Text style={styles.cardTitle}>{isRTL ? "الرؤى الصحية" : "Health Insights"}</Text>
          <Text style={[styles.text, styles.textMuted]}>
            {prioritizedInsights}
          </Text>
          <View style={[styles.row, styles.mt1]}>
            <Badge style={{}}>{insights.riskAssessment.riskLevel}</Badge>
            <Text style={[styles.textSm, styles.textMuted, styles.ml2]}>
              {insights.insightsSummary.totalInsights} {isRTL ? "رؤى" : "insights"}
            </Text>
          </View>
        </View>
        {getIcon("ChevronRight", 16, "#6B7280")}
      </View>
    </Card>
  );
}

// Helper Components
function InsightCard({ insight, onPress }: { insight: any; onPress?: () => void }) {
  return (
    <Card style={styles.mb2} onPress={onPress} contentStyle={undefined}>
      <Text style={styles.cardTitle}>{insight.title || insight.condition || 'Insight'}</Text>
      <Text style={[styles.text, styles.mt1]}>
        {insight.description || insight.reasoning || 'Details available'}
      </Text>
    </Card>
  );
}

function CorrelationCard({ correlation, onPress }: { correlation: any; onPress?: () => void }) {
  const strengthColor = correlation.strength > 0.7 ? '#10B981' : correlation.strength > 0.3 ? '#F59E0B' : '#6B7280';

  return (
    <Card style={styles.mb2} onPress={onPress} contentStyle={undefined}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{correlation.data.factor1} ↔ {correlation.data.factor2}</Text>
        <Badge style={{}}>{`${(correlation.strength * 100).toFixed(0)}%`}</Badge>
      </View>
      <Text style={[styles.text, styles.mt1]}>{correlation.description}</Text>
      {correlation.recommendation && (
        <Text style={[styles.textSm, styles.textMuted, styles.mt1]}>
          💡 {correlation.recommendation}
        </Text>
      )}
    </Card>
  );
}

function DiagnosisCard({ diagnosis, onPress }: { diagnosis: any; onPress?: () => void }) {
  const urgencyMap: { [key: string]: string } = {
    emergency: '#EF4444',
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#10B981'
  };
  const urgencyColor = urgencyMap[String(diagnosis.urgency)] || '#6B7280';

  return (
    <Card style={styles.mb2} onPress={onPress} contentStyle={undefined}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{diagnosis.condition}</Text>
        <Badge style={{}}>{`${diagnosis.confidence}%`}</Badge>
      </View>
      <Text style={[styles.text, styles.mt1]}>{diagnosis.reasoning}</Text>
      <Text style={[styles.textSm, styles.textMuted, styles.mt2]}>
        {diagnosis.disclaimer}
      </Text>
      {diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
        <Text style={[styles.textSm, styles.mt2]}>
          💡 {diagnosis.recommendations[0]}
        </Text>
      )}
    </Card>
  );
}

function PatternCard({ pattern, onPress }: { pattern: any; onPress?: () => void }) {
  return (
    <Card style={styles.mb2} onPress={onPress} contentStyle={undefined}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{pattern.name}</Text>
        <Badge style={{}}>{`${pattern.confidence}%`}</Badge>
      </View>
      <Text style={[styles.text, styles.mt1]}>{pattern.description}</Text>
    </Card>
  );
}

function RiskFactorCard({ factor, onPress }: { factor: any; onPress?: () => void }) {
  const impactColor = factor.impact > 25 ? '#EF4444' : factor.impact > 15 ? '#F59E0B' : '#10B981';

  return (
    <Card style={styles.mb2} onPress={onPress} contentStyle={undefined}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{factor.name}</Text>
        <Badge style={{}}>{`Impact: ${factor.impact}`}</Badge>
      </View>
      <Text style={[styles.text, styles.mt1]}>{factor.description}</Text>
    </Card>
  );
}

function MedicationAlertCard({ alert, onPress }: { alert: any; onPress?: () => void }) {
  const severityMap: { [key: string]: string } = {
    major: '#EF4444',
    moderate: '#F59E0B',
    minor: '#10B981'
  };
  const severityColor = severityMap[String(alert.severity)] || '#6B7280';

  return (
    <Card style={styles.mb2} onPress={onPress} contentStyle={undefined}>
      <View style={styles.row}>
        {getIcon("AlertTriangle", 20, severityColor)}
        <Text style={[styles.cardTitle, styles.ml2]}>{alert.title}</Text>
      </View>
      <Text style={[styles.text, styles.mt1]}>{alert.message}</Text>
      {alert.recommendations && alert.recommendations.length > 0 && (
        <Text style={[styles.textSm, styles.textMuted, styles.mt1]}>
          💡 {alert.recommendations[0]}
        </Text>
      )}
    </Card>
  );
}

function SuggestionCard({ suggestion, onPress }: { suggestion: any; onPress?: () => void }) {
  const priorityMap: { [key: string]: string } = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#10B981'
  };
  const priorityColor = priorityMap[String(suggestion.priority)] || '#6B7280';

  return (
    <Card style={styles.mb2} onPress={onPress} contentStyle={undefined}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{suggestion.title}</Text>
        <Badge style={{}}>{suggestion.priority}</Badge>
      </View>
      <Text style={[styles.text, styles.mt1]}>{suggestion.description}</Text>
      {suggestion.action?.label && (
        <Text style={[styles.textSm, styles.fontBold, styles.mt1, { color: '#3B82F6' }]}>
          {suggestion.action.label}
        </Text>
      )}
    </Card>
  );
}

function RecommendationCard({ recommendation, onPress }: { recommendation: string; onPress?: () => void }) {
  return (
    <Card style={styles.mb2} onPress={onPress} contentStyle={undefined}>
      <Text style={[styles.text, styles.textCenter]}>• {recommendation}</Text>
    </Card>
  );
}

function TipCard({ tip, onPress }: { tip: string; onPress?: () => void }) {
  return (
    <Card style={styles.mb2} onPress={onPress} contentStyle={undefined}>
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
      <Text style={[styles.text, styles.textMuted, styles.mt2, styles.textCenter]}>
        {message}
      </Text>
    </View>
  );
}

// Helper functions
function getRiskColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'very_high': return '#EF4444';
    case 'high': return '#F59E0B';
    case 'moderate': return '#F59E0B';
    case 'low': return '#10B981';
    default: return '#6B7280';
  }
}


export { AIInsightsDashboard };