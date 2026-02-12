import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  MedicalHistory,
  Medication,
  MedicationInteractionAlert,
  Symptom,
} from "@/types";
import { safeFormatDate } from "@/utils/dateFormat";
import {
  type CorrelationInsight,
  correlationAnalysisService,
} from "./correlationAnalysisService";
import { medicalHistoryService } from "./medicalHistoryService";
import { medicationInteractionService } from "./medicationInteractionService";
import { medicationService } from "./medicationService";
import openaiService from "./openaiService";
import {
  type HealthSuggestion,
  proactiveHealthSuggestionsService,
} from "./proactiveHealthSuggestionsService";
import {
  type HealthRiskAssessment,
  riskAssessmentService,
} from "./riskAssessmentService";
import {
  type PatternAnalysisResult,
  symptomPatternRecognitionService,
} from "./symptomPatternRecognitionService";
import { symptomService } from "./symptomService";

const SYMPTOM_FETCH_LIMIT = 50;

export type AIInsightsDashboard = {
  id: string;
  userId: string;
  timestamp: Date;

  // Core AI insights
  correlationAnalysis: CorrelationInsight;
  symptomAnalysis: PatternAnalysisResult;
  riskAssessment: HealthRiskAssessment;
  medicationAlerts: MedicationInteractionAlert[];

  // Personalized recommendations
  healthSuggestions: HealthSuggestion[];
  personalizedTips: string[];

  // Summary metrics
  insightsSummary: {
    totalInsights: number;
    highPriorityItems: number;
    riskLevel: string;
    nextAssessmentDate: Date;
  };

  // AI-generated narrative
  aiNarrative?: string;
};

export type InsightPriority = {
  level: "low" | "medium" | "high" | "critical";
  score: number;
  reasons: string[];
};

type NarrativeContext = {
  correlations?: Array<{ type: string; strength: string; description: string }>;
  symptomPatterns?: Array<{
    name: string;
    confidence: number;
    severity: string;
  }>;
  diagnosisSuggestions?: Array<{
    condition: string;
    confidence: number;
    urgency: string;
  }>;
  riskLevel: string;
  riskScore: number;
  topRiskFactors: string[];
  topSuggestions: string[];
};

type PrioritizedInsight = {
  type: string;
  data: unknown;
};

class AIInsightsService {
  private withTimeout<T>(
    _label: string,
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T
  ): Promise<T> {
    const safePromise = promise.catch(() => fallback);

    const timeoutPromise = new Promise<T>((resolve) => {
      setTimeout(() => {
        resolve(fallback);
      }, timeoutMs);
    });

    return Promise.race([safePromise, timeoutPromise]);
  }

  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Baseline suggestions intentionally combine multiple health-data scenarios into one deterministic fallback path. */
  /* biome-ignore lint/nursery/useMaxParams: Inputs are explicit domain datasets required to build deterministic baseline suggestions. */
  private buildBaselineSuggestions(
    userId: string,
    symptoms: Symptom[],
    medications: Medication[],
    medicalHistory: MedicalHistory[],
    hasVitalsData: boolean,
    isArabic: boolean
  ): {
    healthSuggestions: HealthSuggestion[];
    personalizedTips: string[];
  } {
    const now = new Date();
    const suggestions: HealthSuggestion[] = [];
    const tips: string[] = [];

    const addSuggestion = (
      suggestion: Omit<HealthSuggestion, "id" | "timestamp">
    ) => {
      suggestions.push({
        id: `baseline-${userId}-${suggestions.length + 1}`,
        timestamp: now,
        ...suggestion,
      });
    };

    if (
      symptoms.length === 0 &&
      medications.length === 0 &&
      medicalHistory.length === 0 &&
      !hasVitalsData
    ) {
      addSuggestion({
        type: "preventive",
        priority: "medium",
        title: isArabic
          ? "ابدأ بتتبع بياناتك الصحية"
          : "Start tracking your health data",
        description: isArabic
          ? "سجّل الأعراض، المزاج، والدواء بشكل منتظم لنتمكن من تقديم رؤى أكثر دقة."
          : "Log symptoms, mood, and medications regularly to unlock accurate insights.",
        category: isArabic ? "الوقاية" : "Preventive",
        action: {
          label: isArabic ? "ابدأ التتبع" : "Start Tracking",
          route: "/(tabs)/track",
        },
      });
      tips.push(
        isArabic
          ? "أضف 3 إلى 5 سجلات خلال الأسبوع للحصول على أول تحليل مفيد."
          : "Add 3 to 5 records this week to get your first useful insight."
      );
      return { healthSuggestions: suggestions, personalizedTips: tips };
    }

    if (
      hasVitalsData &&
      symptoms.length === 0 &&
      medications.length === 0 &&
      medicalHistory.length === 0
    ) {
      addSuggestion({
        type: "preventive",
        priority: "medium",
        title: isArabic
          ? "لديك قراءات حيوية جيدة، أضف سياقًا صحيًا"
          : "You have vitals data, add more health context",
        description: isArabic
          ? "تم اكتشاف قراءات حيوية بالفعل. أضف الأعراض أو الأدوية أو التاريخ الطبي للحصول على رؤى أعمق وأكثر دقة."
          : "Vital readings were detected. Add symptoms, medications, or medical history to unlock deeper and more personalized insights.",
        category: isArabic ? "الوقاية" : "Preventive",
        action: {
          label: isArabic ? "أضف أعراضًا" : "Add Symptoms",
          route: "/(tabs)/symptoms",
        },
      });
      tips.push(
        isArabic
          ? "استمر في تسجيل العلامات الحيوية يوميًا، وأضف الأعراض لتحسين جودة التحليل."
          : "Keep logging vitals daily and add symptoms to improve insight quality."
      );
    }

    if (medications.length > 0) {
      addSuggestion({
        type: "medication",
        priority: "medium",
        title: isArabic
          ? "حافظ على الالتزام بالأدوية"
          : "Keep medication adherence consistent",
        description: isArabic
          ? "المتابعة اليومية للجرعات تحسن جودة الرؤى وتقلل المخاطر."
          : "Daily dose tracking improves insight quality and helps reduce risk.",
        category: isArabic ? "الأدوية" : "Medication",
        action: {
          label: isArabic ? "عرض الأدوية" : "View Medications",
          route: "/(tabs)/medications",
        },
      });
    }

    if (symptoms.length > 0) {
      const highSeverityCount = symptoms.filter((s) => s.severity >= 4).length;
      addSuggestion({
        type: "symptom",
        priority: highSeverityCount > 0 ? "high" : "medium",
        title: isArabic
          ? "تابع شدة الأعراض بانتظام"
          : "Track symptom severity consistently",
        description: isArabic
          ? "تسجيل الشدة والوقت يساعد على اكتشاف الأنماط الأسرع تأثيرًا."
          : "Logging severity and timing helps detect impactful patterns faster.",
        category: isArabic ? "الأعراض" : "Symptoms",
        action: {
          label: isArabic ? "عرض الأعراض" : "View Symptoms",
          route: "/(tabs)/symptoms",
        },
      });
    }

    if (medicalHistory.length > 0) {
      addSuggestion({
        type: "preventive",
        priority: "low",
        title: isArabic
          ? "راجع الخطة الصحية دوريًا"
          : "Review your health plan regularly",
        description: isArabic
          ? "تحديث السجل الطبي يرفع دقة تقييم المخاطر والتوصيات."
          : "Keeping medical history updated improves risk scoring and recommendations.",
        category: isArabic ? "الصحة" : "Health",
        action: {
          label: isArabic ? "عرض السجل الطبي" : "View Medical History",
          route: "/profile/medical-history",
        },
      });
    }

    if (tips.length === 0) {
      tips.push(
        isArabic
          ? "استمر في إدخال البيانات يوميًا للحصول على توصيات أدق."
          : "Continue daily tracking to unlock more accurate recommendations."
      );
    }

    return {
      healthSuggestions: suggestions.slice(0, 3),
      personalizedTips: tips,
    };
  }
  /**
   * Batch fetch all required data once to reduce database queries
   */
  private async fetchRequiredData(userId: string): Promise<{
    symptoms: Symptom[];
    medications: Medication[];
    medicalHistory: MedicalHistory[];
    hasVitalsData: boolean;
  }> {
    // Fetch all data in parallel with optimized limits
    const [symptoms, medications, medicalHistory, hasVitalsData] =
      await Promise.all([
        symptomService.getUserSymptoms(userId, SYMPTOM_FETCH_LIMIT), // Limit for faster loads
        medicationService.getUserMedications(userId),
        medicalHistoryService.getUserMedicalHistory(userId),
        this.withTimeout(
          "hasVitalsData",
          this.hasVitalsData(userId),
          2500,
          false
        ),
      ]);

    return { symptoms, medications, medicalHistory, hasVitalsData };
  }

  private async hasVitalsData(userId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, "vitals"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc"),
        limit(1)
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch {
      return false;
    }
  }

  /**
   * Generate comprehensive AI insights dashboard for a user
   */
  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Dashboard generation orchestrates multiple asynchronous insight pipelines with explicit fallback behavior. */
  async generateAIInsightsDashboard(
    userId: string,
    includeAINarrative = true,
    isArabic = false
  ): Promise<AIInsightsDashboard> {
    // Fetch all required data once
    const { symptoms, medications, medicalHistory, hasVitalsData } =
      await this.withTimeout(
        "fetchRequiredData",
        this.fetchRequiredData(userId),
        8000,
        {
          symptoms: [],
          medications: [],
          medicalHistory: [],
          hasVitalsData: false,
        }
      );

    const now = new Date();
    const fallbackCorrelation: CorrelationInsight = {
      id: `correlation-${userId}-${now.getTime()}`,
      title: isArabic
        ? "تحليل ارتباط البيانات الصحية"
        : "Health Data Correlation Analysis",
      description: isArabic
        ? "تحليل العلاقات بين أعراضك الصحية والأدوية والمزاج والعلامات الحيوية."
        : "Analysis of relationships between your symptoms, medications, mood, and vital signs.",
      correlationResults: [],
      timestamp: now,
      userId,
    };

    const fallbackSymptomAnalysis: PatternAnalysisResult = {
      patterns: [],
      diagnosisSuggestions: [],
      riskAssessment: {
        overallRisk: "low",
        concerns: [],
        recommendations: [],
      },
      analysisTimestamp: now,
    };

    const fallbackRiskAssessment: HealthRiskAssessment = {
      id: `risk-assessment-${userId}-${now.getTime()}`,
      userId,
      overallRiskScore: 0,
      riskLevel: "low",
      riskFactors: [],
      conditionRisks: [],
      preventiveRecommendations: [],
      timeline: "long_term",
      assessmentDate: now,
      nextAssessmentDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    };

    const hasData =
      symptoms.length > 0 ||
      medications.length > 0 ||
      medicalHistory.length > 0 ||
      hasVitalsData;
    if (!hasData) {
      const baseline = this.buildBaselineSuggestions(
        userId,
        symptoms,
        medications,
        medicalHistory,
        hasVitalsData,
        isArabic
      );
      const insightsSummary = this.calculateInsightsSummary(
        fallbackCorrelation,
        fallbackSymptomAnalysis,
        fallbackRiskAssessment,
        baseline.healthSuggestions,
        []
      );
      return {
        id: `ai-insights-${userId}-${Date.now()}`,
        userId,
        timestamp: new Date(),
        correlationAnalysis: fallbackCorrelation,
        symptomAnalysis: fallbackSymptomAnalysis,
        riskAssessment: fallbackRiskAssessment,
        medicationAlerts: [],
        healthSuggestions: baseline.healthSuggestions,
        personalizedTips: baseline.personalizedTips,
        insightsSummary,
        aiNarrative: undefined,
      };
    }

    // Generate all AI insights in parallel, reusing fetched data
    // Use Promise.allSettled to allow partial results and prevent blocking
    const results = await Promise.allSettled([
      this.withTimeout(
        "correlationAnalysis",
        correlationAnalysisService.generateCorrelationAnalysis(
          userId,
          90,
          isArabic
        ),
        8000, // Reduced from 12s to 8s for faster loading
        fallbackCorrelation
      ),
      this.withTimeout(
        "symptomAnalysis",
        this.generateSymptomAnalysis(
          userId,
          symptoms,
          medications,
          medicalHistory,
          isArabic
        ),
        6000, // Reduced from 10s to 6s
        fallbackSymptomAnalysis
      ),
      this.withTimeout(
        "riskAssessment",
        riskAssessmentService.generateRiskAssessment(userId, isArabic),
        8000, // Reduced from 12s to 8s
        fallbackRiskAssessment
      ),
      this.withTimeout(
        "medicationAlerts",
        medicationInteractionService.generateRealtimeAlerts(userId),
        5000, // Reduced from 8s to 5s
        [] as MedicationInteractionAlert[]
      ),
      this.withTimeout(
        "healthSuggestions",
        proactiveHealthSuggestionsService.generateSuggestions(userId, isArabic),
        5000, // Reduced from 8s to 5s
        [] as HealthSuggestion[]
      ),
      this.withTimeout(
        "personalizedTips",
        proactiveHealthSuggestionsService.getPersonalizedTips(userId, isArabic),
        4000, // Reduced from 6s to 4s
        [] as string[]
      ),
    ]);

    // Extract results with fallbacks - allows partial data to be shown
    const correlationAnalysis =
      results[0].status === "fulfilled"
        ? results[0].value
        : fallbackCorrelation;
    const symptomAnalysis =
      results[1].status === "fulfilled"
        ? results[1].value
        : fallbackSymptomAnalysis;
    const riskAssessment =
      results[2].status === "fulfilled"
        ? results[2].value
        : fallbackRiskAssessment;
    const medicationAlerts =
      results[3].status === "fulfilled" ? results[3].value : [];
    let healthSuggestions =
      results[4].status === "fulfilled" ? results[4].value : [];
    let personalizedTips =
      results[5].status === "fulfilled" ? results[5].value : [];

    const noPrimaryInsights =
      correlationAnalysis.correlationResults.length === 0 &&
      symptomAnalysis.patterns.length === 0 &&
      symptomAnalysis.diagnosisSuggestions.length === 0 &&
      medicationAlerts.length === 0 &&
      healthSuggestions.length === 0;

    if (noPrimaryInsights) {
      const baseline = this.buildBaselineSuggestions(
        userId,
        symptoms,
        medications,
        medicalHistory,
        hasVitalsData,
        isArabic
      );
      if (baseline.healthSuggestions.length > 0) {
        healthSuggestions = baseline.healthSuggestions;
      }
      if (baseline.personalizedTips.length > 0) {
        personalizedTips = [
          ...baseline.personalizedTips,
          ...personalizedTips,
        ].slice(0, 4);
      }
    }

    // Generate AI narrative if requested
    let aiNarrative: string | undefined;
    if (includeAINarrative) {
      aiNarrative = await this.generateAINarrative(
        correlationAnalysis,
        symptomAnalysis,
        riskAssessment,
        healthSuggestions
      );
    }

    // Calculate insights summary
    const insightsSummary = this.calculateInsightsSummary(
      correlationAnalysis,
      symptomAnalysis,
      riskAssessment,
      healthSuggestions,
      medicationAlerts
    );

    const dashboard: AIInsightsDashboard = {
      id: `ai-insights-${userId}-${Date.now()}`,
      userId,
      timestamp: new Date(),
      correlationAnalysis,
      symptomAnalysis,
      riskAssessment,
      medicationAlerts,
      healthSuggestions,
      personalizedTips,
      insightsSummary,
      aiNarrative,
    };

    return dashboard;
  }

  /**
   * Generate symptom analysis with pattern recognition
   */
  // biome-ignore lint/nursery/useMaxParams: Backward-compatible API keeps optional pre-fetched datasets explicit.
  private async generateSymptomAnalysis(
    userId: string,
    symptoms?: Symptom[],
    medications?: Medication[],
    medicalHistory?: MedicalHistory[],
    isArabic = false
  ): Promise<PatternAnalysisResult> {
    // Use provided data or fetch if not provided (for backward compatibility)
    const [symptomsData, medicalHistoryData, medicationsData] =
      await Promise.all([
        symptoms ? Promise.resolve(symptoms) : this.getRecentSymptoms(userId),
        medicalHistory
          ? Promise.resolve(medicalHistory)
          : this.getMedicalHistory(userId),
        medications
          ? Promise.resolve(medications)
          : this.getMedications(userId),
      ]);

    return symptomPatternRecognitionService.analyzeSymptomPatterns(
      userId,
      symptomsData,
      medicalHistoryData,
      medicationsData,
      isArabic
    );
  }

  /**
   * Generate AI-powered narrative summarizing all insights
   */
  private async generateAINarrative(
    correlationAnalysis: CorrelationInsight,
    symptomAnalysis: PatternAnalysisResult,
    riskAssessment: HealthRiskAssessment,
    healthSuggestions: HealthSuggestion[]
  ): Promise<string> {
    try {
      // Prepare context for AI narrative generation
      const context = {
        correlations: correlationAnalysis.correlationResults
          .slice(0, 3)
          .map((c) => ({
            type: c.type,
            strength: c.strength.toFixed(2),
            description: c.description,
          })),
        symptomPatterns: symptomAnalysis.patterns.slice(0, 2).map((p) => ({
          name: p.name,
          confidence: p.confidence,
          severity: p.severity,
        })),
        diagnosisSuggestions: symptomAnalysis.diagnosisSuggestions
          .slice(0, 2)
          .map((d) => ({
            condition: d.condition,
            confidence: d.confidence,
            urgency: d.urgency,
          })),
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.overallRiskScore,
        topRiskFactors: riskAssessment.riskFactors
          .slice(0, 3)
          .map((f) => f.name),
        topSuggestions: healthSuggestions.slice(0, 3).map((s) => s.title),
      };

      const prompt = `
        Based on this health data analysis, write a personalized, empathetic narrative (2-3 paragraphs) that:
        1. Summarizes the key insights from correlation analysis, symptom patterns, and risk assessment
        2. Explains what the data means in simple, understandable terms
        3. Provides encouragement and actionable next steps
        4. Maintains a supportive, non-alarming tone

        Health Data Summary:
        - Correlation Analysis: ${context.correlations.map((c) => `${c.type} (${c.strength}): ${c.description}`).join(", ")}
        - Symptom Patterns: ${context.symptomPatterns.map((p) => `${p.name} (${p.confidence}% confidence)`).join(", ")}
        - Diagnosis Suggestions: ${context.diagnosisSuggestions.map((d) => `${d.condition} (${d.confidence}% confidence, ${d.urgency} urgency)`).join(", ")}
        - Overall Risk Level: ${context.riskLevel} (${context.riskScore}/100)
        - Key Risk Factors: ${context.topRiskFactors.join(", ")}
        - Top Recommendations: ${context.topSuggestions.join(", ")}

        Write the narrative in a warm, supportive voice that empowers the user to take control of their health.
      `;

      const narrative = await openaiService.generateHealthInsights(prompt);
      if (!narrative) {
        return this.generateFallbackNarrative(context);
      }
      return typeof narrative.narrative === "string"
        ? narrative.narrative
        : this.generateFallbackNarrative(context);
    } catch (_error) {
      // Missing API key or network errors should not spam logs; fallback is fine.
      return this.generateFallbackNarrative({
        correlations: [],
        symptomPatterns: [],
        diagnosisSuggestions: [],
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.overallRiskScore,
        topRiskFactors: riskAssessment.riskFactors
          .slice(0, 3)
          .map((f) => f.name),
        topSuggestions: healthSuggestions.slice(0, 3).map((s) => s.title),
      });
    }
  }

  /**
   * Generate fallback narrative when AI fails
   */
  private generateFallbackNarrative(context: NarrativeContext): string {
    return `Your health data shows ${context.riskLevel} overall risk with a score of ${context.riskScore}/100. ${
      context.topRiskFactors.length > 0
        ? `Key areas to focus on include: ${context.topRiskFactors.join(", ")}. `
        : ""
    }Consider the following recommendations to support your health journey: ${context.topSuggestions.join(
      ", "
    )}. Remember, small consistent steps lead to meaningful improvements in your well-being.`;
  }

  /**
   * Calculate insights summary metrics
   */
  // biome-ignore lint/nursery/useMaxParams: Inputs represent distinct computed sections of the dashboard.
  private calculateInsightsSummary(
    correlationAnalysis: CorrelationInsight,
    symptomAnalysis: PatternAnalysisResult,
    riskAssessment: HealthRiskAssessment,
    healthSuggestions: HealthSuggestion[],
    medicationAlerts: MedicationInteractionAlert[]
  ) {
    const totalInsights =
      correlationAnalysis.correlationResults.length +
      symptomAnalysis.patterns.length +
      symptomAnalysis.diagnosisSuggestions.length +
      healthSuggestions.length +
      medicationAlerts.length;

    const highPriorityItems =
      correlationAnalysis.correlationResults.filter((c) => c.confidence > 80)
        .length +
      symptomAnalysis.diagnosisSuggestions.filter(
        (d) => d.urgency === "high" || d.urgency === "emergency"
      ).length +
      healthSuggestions.filter((s) => s.priority === "high").length +
      medicationAlerts.filter((a) => a.severity === "major").length;

    return {
      totalInsights,
      highPriorityItems,
      riskLevel: riskAssessment.riskLevel,
      nextAssessmentDate: riskAssessment.nextAssessmentDate,
    };
  }

  /**
   * Get prioritized insights for quick access
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Prioritization merges multiple insight streams into severity buckets.
  async getPrioritizedInsights(userId: string): Promise<{
    critical: PrioritizedInsight[];
    high: PrioritizedInsight[];
    medium: PrioritizedInsight[];
    low: PrioritizedInsight[];
  }> {
    const dashboard = await this.generateAIInsightsDashboard(userId, false);

    const critical: PrioritizedInsight[] = [];
    const high: PrioritizedInsight[] = [];
    const medium: PrioritizedInsight[] = [];
    const low: PrioritizedInsight[] = [];

    // Medication alerts
    for (const alert of dashboard.medicationAlerts) {
      if (alert.severity === "major") {
        critical.push({ type: "medication_alert", data: alert });
      } else if (alert.severity === "moderate") {
        high.push({ type: "medication_alert", data: alert });
      } else {
        medium.push({ type: "medication_alert", data: alert });
      }
    }

    // Diagnosis suggestions
    for (const suggestion of dashboard.symptomAnalysis.diagnosisSuggestions) {
      if (suggestion.urgency === "emergency") {
        critical.push({ type: "diagnosis_suggestion", data: suggestion });
      } else if (suggestion.urgency === "high") {
        high.push({ type: "diagnosis_suggestion", data: suggestion });
      } else if (suggestion.urgency === "medium") {
        medium.push({ type: "diagnosis_suggestion", data: suggestion });
      } else {
        low.push({ type: "diagnosis_suggestion", data: suggestion });
      }
    }

    // Risk assessment
    if (dashboard.riskAssessment.riskLevel === "very_high") {
      critical.push({
        type: "risk_assessment",
        data: dashboard.riskAssessment,
      });
    } else if (dashboard.riskAssessment.riskLevel === "high") {
      high.push({ type: "risk_assessment", data: dashboard.riskAssessment });
    }

    // Health suggestions
    for (const suggestion of dashboard.healthSuggestions) {
      if (suggestion.priority === "high") {
        high.push({ type: "health_suggestion", data: suggestion });
      } else if (suggestion.priority === "medium") {
        medium.push({ type: "health_suggestion", data: suggestion });
      } else {
        low.push({ type: "health_suggestion", data: suggestion });
      }
    }

    // Correlation insights
    for (const correlation of dashboard.correlationAnalysis
      .correlationResults) {
      if (correlation.confidence > 90) {
        high.push({ type: "correlation", data: correlation });
      } else if (correlation.confidence > 70) {
        medium.push({ type: "correlation", data: correlation });
      } else {
        low.push({ type: "correlation", data: correlation });
      }
    }

    return { critical, high, medium, low };
  }

  /**
   * Get insights by category
   */
  async getInsightsByCategory(
    userId: string,
    category: string
  ): Promise<unknown[]> {
    const dashboard = await this.generateAIInsightsDashboard(userId, false);

    switch (category) {
      case "correlations":
        return dashboard.correlationAnalysis.correlationResults;
      case "symptoms":
        return dashboard.symptomAnalysis.patterns;
      case "diagnosis":
        return dashboard.symptomAnalysis.diagnosisSuggestions;
      case "risk":
        return [dashboard.riskAssessment];
      case "medications":
        return dashboard.medicationAlerts;
      case "suggestions":
        return dashboard.healthSuggestions;
      default:
        return [];
    }
  }

  /**
   * Generate health action plan based on insights
   */
  async generateActionPlan(
    userId: string,
    isArabic = false
  ): Promise<{
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    monitoring: string[];
  }> {
    const dashboard = await this.generateAIInsightsDashboard(
      userId,
      false,
      isArabic
    );

    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];
    const monitoring: string[] = [];

    // Immediate actions from critical insights
    // biome-ignore lint/complexity/noForEach: Chained filter + forEach keeps the action criteria explicit.
    dashboard.medicationAlerts
      .filter((a) => a.severity === "major")
      .forEach((alert) => {
        immediate.push(
          isArabic
            ? `معالجة تفاعل الدواء: ${alert.title}`
            : `Address medication interaction: ${alert.title}`
        );
      });

    // biome-ignore lint/complexity/noForEach: Chained filter + forEach keeps the action criteria explicit.
    dashboard.symptomAnalysis.diagnosisSuggestions
      .filter((d) => d.urgency === "emergency" || d.urgency === "high")
      .forEach((suggestion) => {
        immediate.push(
          isArabic
            ? `اطلب الرعاية الطبية لاحتمال ${suggestion.condition}`
            : `Seek medical attention for possible ${suggestion.condition}`
        );
      });

    // Short-term actions
    // biome-ignore lint/complexity/noForEach: Chained filter + forEach keeps the action criteria explicit.
    dashboard.healthSuggestions
      .filter((s) => s.priority === "high")
      .forEach((suggestion) => {
        shortTerm.push(suggestion.title);
      });

    // biome-ignore lint/complexity/noForEach: Slice + forEach keeps the top recommendation extraction explicit.
    dashboard.riskAssessment.preventiveRecommendations
      .slice(0, 3)
      .forEach((rec) => {
        shortTerm.push(rec);
      });

    // Long-term actions
    // biome-ignore lint/complexity/noForEach: Chained filter + forEach keeps correlation recommendation extraction explicit.
    dashboard.correlationAnalysis.correlationResults
      .filter((c) => c.actionable)
      .forEach((correlation) => {
        if (correlation.recommendation) {
          longTerm.push(correlation.recommendation);
        }
      });

    // Monitoring actions
    monitoring.push(
      isArabic
        ? "استمر في تتبع الأعراض الصحية والعلامات الحيوية بانتظام"
        : "Continue tracking symptoms and vital signs regularly"
    );
    monitoring.push(
      isArabic
        ? "راقب فعالية الأدوية والآثار الجانبية"
        : "Monitor medication effectiveness and side effects"
    );
    monitoring.push(
      isArabic
        ? "حدد مواعيد فحوصات صحية منتظمة بناءً على تقييم المخاطر"
        : "Schedule regular health check-ups based on risk assessment"
    );

    if (dashboard.riskAssessment.nextAssessmentDate) {
      const assessmentDate = safeFormatDate(
        dashboard.riskAssessment.nextAssessmentDate,
        isArabic ? "ar-u-ca-gregory" : "en-US"
      );
      monitoring.push(
        isArabic
          ? `التقييم الشامل التالي: ${assessmentDate}`
          : `Next comprehensive assessment: ${assessmentDate}`
      );
    }

    return { immediate, shortTerm, longTerm, monitoring };
  }

  // Helper methods for data access

  private async getRecentSymptoms(userId: string): Promise<Symptom[]> {
    try {
      return await symptomService.getUserSymptoms(userId, SYMPTOM_FETCH_LIMIT);
    } catch (_error) {
      return [];
    }
  }

  private async getMedicalHistory(userId: string): Promise<MedicalHistory[]> {
    try {
      return await medicalHistoryService.getUserMedicalHistory(userId);
    } catch (_error) {
      return [];
    }
  }

  private async getMedications(userId: string): Promise<Medication[]> {
    try {
      return await medicationService.getUserMedications(userId);
    } catch (_error) {
      return [];
    }
  }
}

export const aiInsightsService = new AIInsightsService();
