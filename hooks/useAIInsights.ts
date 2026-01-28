import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AIInsightsDashboard as AIInsightsDashboardData,
  aiInsightsService,
} from "@/lib/services/aiInsightsService";
import {
  type CorrelationInsight,
  correlationAnalysisService,
} from "@/lib/services/correlationAnalysisService";
import {
  type MedicationInteractionAlert,
  medicationInteractionService,
} from "@/lib/services/medicationInteractionService";
import {
  type HealthSuggestion,
  proactiveHealthSuggestionsService,
} from "@/lib/services/proactiveHealthSuggestionsService";
import {
  type HealthRiskAssessment,
  riskAssessmentService,
} from "@/lib/services/riskAssessmentService";
import {
  type PatternAnalysisResult,
  symptomPatternRecognitionService,
} from "@/lib/services/symptomPatternRecognitionService";

interface UseAIInsightsOptions {
  autoLoad?: boolean;
  includeNarrative?: boolean;
  cacheTimeout?: number; // minutes
}

interface UseAIInsightsReturn {
  // Main dashboard
  dashboard: AIInsightsDashboardData | null;
  loading: boolean;
  error: string | null;

  // Individual insights
  correlations: CorrelationInsight | null;
  symptomAnalysis: PatternAnalysisResult | null;
  riskAssessment: HealthRiskAssessment | null;
  medicationAlerts: MedicationInteractionAlert[];
  healthSuggestions: HealthSuggestion[];

  // Actions
  refresh: () => Promise<void>;
  loadCorrelations: () => Promise<void>;
  loadSymptomAnalysis: () => Promise<void>;
  loadRiskAssessment: () => Promise<void>;
  loadMedicationAlerts: () => Promise<void>;
  loadHealthSuggestions: () => Promise<void>;

  // Utilities
  getPrioritizedInsights: () => Promise<any>;
  getActionPlan: () => Promise<any>;
  dismissInsight: (insightId: string) => Promise<void>;
}

export function useAIInsights(
  userId: string | undefined,
  options: UseAIInsightsOptions = {}
): UseAIInsightsReturn {
  const {
    autoLoad = true,
    includeNarrative = true,
    cacheTimeout = 30, // 30 minutes
  } = options;

  // State
  const [dashboard, setDashboard] = useState<AIInsightsDashboardData | null>(
    null
  );
  const [correlations, setCorrelations] = useState<CorrelationInsight | null>(
    null
  );
  const [symptomAnalysis, setSymptomAnalysis] =
    useState<PatternAnalysisResult | null>(null);
  const [riskAssessment, setRiskAssessment] =
    useState<HealthRiskAssessment | null>(null);
  const [medicationAlerts, setMedicationAlerts] = useState<
    MedicationInteractionAlert[]
  >([]);
  const [healthSuggestions, setHealthSuggestions] = useState<
    HealthSuggestion[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache management
  const [lastLoadTime, setLastLoadTime] = useState<Date | null>(null);
  const lastLoadTimeRef = useRef<Date | null>(lastLoadTime);
  const dashboardRef = useRef<AIInsightsDashboardData | null>(null);

  useEffect(() => {
    lastLoadTimeRef.current = lastLoadTime;
  }, [lastLoadTime]);

  useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

  const isCacheValid = useCallback(() => {
    if (!lastLoadTimeRef.current) return false;
    const now = new Date();
    const diffMinutes =
      (now.getTime() - lastLoadTimeRef.current.getTime()) / (1000 * 60);
    return diffMinutes < cacheTimeout;
  }, [cacheTimeout]);

  // Load full dashboard
  const loadDashboard = useCallback(
    async (force = false) => {
      if (!userId) return;

      if (!force && isCacheValid() && dashboardRef.current) {
        return; // Use cached data
      }

      try {
        setLoading(true);
        setError(null);

        const result = await aiInsightsService.generateAIInsightsDashboard(
          userId,
          includeNarrative
        );

        setDashboard(result);
        setCorrelations(result.correlationAnalysis);
        setSymptomAnalysis(result.symptomAnalysis);
        setRiskAssessment(result.riskAssessment);
        setMedicationAlerts(result.medicationAlerts);
        setHealthSuggestions(result.healthSuggestions);

        setLastLoadTime(new Date());
      } catch (err) {
        console.error("Failed to load AI insights dashboard:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load insights"
        );
      } finally {
        setLoading(false);
      }
    },
    [userId, includeNarrative, isCacheValid]
  );

  // Load individual insights
  const loadCorrelations = useCallback(async () => {
    if (!userId) return;

    try {
      const result =
        await correlationAnalysisService.generateCorrelationAnalysis(userId);
      setCorrelations(result);
    } catch (err) {
      console.error("Failed to load correlations:", err);
    }
  }, [userId]);

  const loadSymptomAnalysis = useCallback(async () => {
    if (!userId) return;

    try {
      const symptoms =
        await symptomPatternRecognitionService.analyzeSymptomPatterns(
          userId,
          []
        );
      setSymptomAnalysis(symptoms);
    } catch (err) {
      console.error("Failed to load symptom analysis:", err);
    }
  }, [userId]);

  const loadRiskAssessment = useCallback(async () => {
    if (!userId) return;

    try {
      const result = await riskAssessmentService.generateRiskAssessment(userId);
      setRiskAssessment(result);
    } catch (err) {
      console.error("Failed to load risk assessment:", err);
    }
  }, [userId]);

  const loadMedicationAlerts = useCallback(async () => {
    if (!userId) return;

    try {
      const alerts =
        await medicationInteractionService.generateRealtimeAlerts(userId);
      setMedicationAlerts(alerts);
    } catch (err) {
      console.error("Failed to load medication alerts:", err);
    }
  }, [userId]);

  const loadHealthSuggestions = useCallback(async () => {
    if (!userId) return;

    try {
      const suggestions =
        await proactiveHealthSuggestionsService.generateSuggestions(userId);
      setHealthSuggestions(suggestions);
    } catch (err) {
      console.error("Failed to load health suggestions:", err);
    }
  }, [userId]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await loadDashboard(true);
  }, [loadDashboard]);

  // Get prioritized insights
  const getPrioritizedInsights = useCallback(async () => {
    if (!userId) return { critical: [], high: [], medium: [], low: [] };
    return aiInsightsService.getPrioritizedInsights(userId);
  }, [userId]);

  // Get action plan
  const getActionPlan = useCallback(async () => {
    if (!userId)
      return { immediate: [], shortTerm: [], longTerm: [], monitoring: [] };
    return aiInsightsService.generateActionPlan(userId);
  }, [userId]);

  // Dismiss insight (placeholder for future implementation)
  const dismissInsight = useCallback(async (insightId: string) => {
    // This would implement dismissal logic with local storage or backend
    console.log(`Dismissing insight: ${insightId}`);
    // For now, just log - could be implemented to hide insights from UI
  }, []);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && userId) {
      loadDashboard();
    }
  }, [autoLoad, userId, loadDashboard]);

  return {
    // Main dashboard
    dashboard,
    loading,
    error,

    // Individual insights
    correlations,
    symptomAnalysis,
    riskAssessment,
    medicationAlerts,
    healthSuggestions,

    // Actions
    refresh,
    loadCorrelations,
    loadSymptomAnalysis,
    loadRiskAssessment,
    loadMedicationAlerts,
    loadHealthSuggestions,

    // Utilities
    getPrioritizedInsights,
    getActionPlan,
    dismissInsight,
  };
}
