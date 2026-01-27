import type { MedicalHistory, Medication, Symptom } from "@/types";
import {
  type CorrelationInsight,
  correlationAnalysisService,
} from "./correlationAnalysisService";
import { medicalHistoryService } from "./medicalHistoryService";
import {
  type MedicationInteractionAlert,
  medicationInteractionService,
} from "./medicationInteractionService";
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

export interface AIInsightsDashboard {
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
}

export interface InsightPriority {
  level: "low" | "medium" | "high" | "critical";
  score: number;
  reasons: string[];
}

class AIInsightsService {
  private async withTimeout<T>(
    label: string,
    promise: Promise<T>,
    timeoutMs: number,
    fallback: T
  ): Promise<T> {
    const safePromise = promise.catch((error) => {
      if (__DEV__) {
        console.warn(`[AIInsights] ${label} failed`, error);
      }
      return fallback;
    });

    const timeoutPromise = new Promise<T>((resolve) => {
      setTimeout(() => {
        if (__DEV__) {
          console.warn(`[AIInsights] ${label} timed out after ${timeoutMs}ms`);
        }
        resolve(fallback);
      }, timeoutMs);
    });

    return Promise.race([safePromise, timeoutPromise]);
  }
  /**
   * Batch fetch all required data once to reduce database queries
   */
  private async fetchRequiredData(userId: string): Promise<{
    symptoms: Symptom[];
    medications: Medication[];
    medicalHistory: MedicalHistory[];
  }> {
    // Fetch all data in parallel with optimized limits
    const [symptoms, medications, medicalHistory] = await Promise.all([
      symptomService.getUserSymptoms(userId, SYMPTOM_FETCH_LIMIT), // Limit for faster loads
      medicationService.getUserMedications(userId),
      medicalHistoryService.getUserMedicalHistory(userId),
    ]);

    return { symptoms, medications, medicalHistory };
  }

  /**
   * Generate comprehensive AI insights dashboard for a user
   */
  async generateAIInsightsDashboard(
    userId: string,
    includeAINarrative = true
  ): Promise<AIInsightsDashboard> {
    // Fetch all required data once
    const { symptoms, medications, medicalHistory } = await this.withTimeout(
      "fetchRequiredData",
      this.fetchRequiredData(userId),
      8000,
      { symptoms: [], medications: [], medicalHistory: [] }
    );

    const now = new Date();
    const fallbackCorrelation: CorrelationInsight = {
      id: `correlation-${userId}-${now.getTime()}`,
      title: "Health Data Correlation Analysis",
      description:
        "Analysis of relationships between your symptoms, medications, mood, and vital signs.",
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
      medicalHistory.length > 0;
    if (!hasData) {
      const insightsSummary = this.calculateInsightsSummary(
        fallbackCorrelation,
        fallbackSymptomAnalysis,
        fallbackRiskAssessment,
        [],
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
        healthSuggestions: [],
        personalizedTips: [],
        insightsSummary,
        aiNarrative: undefined,
      };
    }

    // Generate all AI insights in parallel, reusing fetched data
    // Use Promise.allSettled to allow partial results and prevent blocking
    const results = await Promise.allSettled([
      this.withTimeout(
        "correlationAnalysis",
        correlationAnalysisService.generateCorrelationAnalysis(userId),
        8000, // Reduced from 12s to 8s for faster loading
        fallbackCorrelation
      ),
      this.withTimeout(
        "symptomAnalysis",
        this.generateSymptomAnalysis(
          userId,
          symptoms,
          medications,
          medicalHistory
        ),
        6000, // Reduced from 10s to 6s
        fallbackSymptomAnalysis
      ),
      this.withTimeout(
        "riskAssessment",
        riskAssessmentService.generateRiskAssessment(userId),
        8000, // Reduced from 12s to 8s
        fallbackRiskAssessment
      ),
      this.withTimeout(
        "medicationAlerts",
        medicationInteractionService.generateRealtimeAlerts(userId),
        5000, // Reduced from 8s to 5s
        []
      ),
      this.withTimeout(
        "healthSuggestions",
        proactiveHealthSuggestionsService.generateSuggestions(userId),
        5000, // Reduced from 8s to 5s
        []
      ),
      this.withTimeout(
        "personalizedTips",
        proactiveHealthSuggestionsService.getPersonalizedTips(userId),
        4000, // Reduced from 6s to 4s
        []
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
    const healthSuggestions =
      results[4].status === "fulfilled" ? results[4].value : [];
    const personalizedTips =
      results[5].status === "fulfilled" ? results[5].value : [];

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
  private async generateSymptomAnalysis(
    userId: string,
    symptoms?: Symptom[],
    medications?: Medication[],
    medicalHistory?: MedicalHistory[]
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
      medicationsData
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
      if (!narrative) return this.generateFallbackNarrative(context);
      return narrative?.narrative || this.generateFallbackNarrative(context);
    } catch (error) {
      // Missing API key or network errors should not spam logs; fallback is fine.
      if (__DEV__) console.warn("AI narrative generation failed", error);
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
  private generateFallbackNarrative(context: any): string {
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
  async getPrioritizedInsights(userId: string): Promise<{
    critical: any[];
    high: any[];
    medium: any[];
    low: any[];
  }> {
    const dashboard = await this.generateAIInsightsDashboard(userId, false);

    const critical: any[] = [];
    const high: any[] = [];
    const medium: any[] = [];
    const low: any[] = [];

    // Medication alerts
    dashboard.medicationAlerts.forEach((alert) => {
      if (alert.severity === "major") {
        critical.push({ type: "medication_alert", data: alert });
      } else if (alert.severity === "moderate") {
        high.push({ type: "medication_alert", data: alert });
      } else {
        medium.push({ type: "medication_alert", data: alert });
      }
    });

    // Diagnosis suggestions
    dashboard.symptomAnalysis.diagnosisSuggestions.forEach((suggestion) => {
      if (suggestion.urgency === "emergency") {
        critical.push({ type: "diagnosis_suggestion", data: suggestion });
      } else if (suggestion.urgency === "high") {
        high.push({ type: "diagnosis_suggestion", data: suggestion });
      } else if (suggestion.urgency === "medium") {
        medium.push({ type: "diagnosis_suggestion", data: suggestion });
      } else {
        low.push({ type: "diagnosis_suggestion", data: suggestion });
      }
    });

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
    dashboard.healthSuggestions.forEach((suggestion) => {
      if (suggestion.priority === "high") {
        high.push({ type: "health_suggestion", data: suggestion });
      } else if (suggestion.priority === "medium") {
        medium.push({ type: "health_suggestion", data: suggestion });
      } else {
        low.push({ type: "health_suggestion", data: suggestion });
      }
    });

    // Correlation insights
    dashboard.correlationAnalysis.correlationResults.forEach((correlation) => {
      if (correlation.confidence > 90) {
        high.push({ type: "correlation", data: correlation });
      } else if (correlation.confidence > 70) {
        medium.push({ type: "correlation", data: correlation });
      } else {
        low.push({ type: "correlation", data: correlation });
      }
    });

    return { critical, high, medium, low };
  }

  /**
   * Get insights by category
   */
  async getInsightsByCategory(
    userId: string,
    category: string
  ): Promise<any[]> {
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
  async generateActionPlan(userId: string): Promise<{
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    monitoring: string[];
  }> {
    const dashboard = await this.generateAIInsightsDashboard(userId, false);

    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];
    const monitoring: string[] = [];

    // Immediate actions from critical insights
    dashboard.medicationAlerts
      .filter((a) => a.severity === "major")
      .forEach((alert) => {
        immediate.push(`Address medication interaction: ${alert.title}`);
      });

    dashboard.symptomAnalysis.diagnosisSuggestions
      .filter((d) => d.urgency === "emergency" || d.urgency === "high")
      .forEach((suggestion) => {
        immediate.push(
          `Seek medical attention for possible ${suggestion.condition}`
        );
      });

    // Short-term actions
    dashboard.healthSuggestions
      .filter((s) => s.priority === "high")
      .forEach((suggestion) => {
        shortTerm.push(suggestion.title);
      });

    dashboard.riskAssessment.preventiveRecommendations
      .slice(0, 3)
      .forEach((rec) => {
        shortTerm.push(rec);
      });

    // Long-term actions
    dashboard.correlationAnalysis.correlationResults
      .filter((c) => c.actionable)
      .forEach((correlation) => {
        if (correlation.recommendation) {
          longTerm.push(correlation.recommendation);
        }
      });

    // Monitoring actions
    monitoring.push("Continue tracking symptoms and vital signs regularly");
    monitoring.push("Monitor medication effectiveness and side effects");
    monitoring.push(
      "Schedule regular health check-ups based on risk assessment"
    );

    if (dashboard.riskAssessment.nextAssessmentDate) {
      monitoring.push(
        `Next comprehensive assessment: ${dashboard.riskAssessment.nextAssessmentDate.toLocaleDateString()}`
      );
    }

    return { immediate, shortTerm, longTerm, monitoring };
  }

  // Helper methods for data access

  private async getRecentSymptoms(userId: string): Promise<Symptom[]> {
    try {
      return await symptomService.getUserSymptoms(userId, SYMPTOM_FETCH_LIMIT);
    } catch (error) {
      console.error("Failed to fetch symptoms:", error);
      return [];
    }
  }

  private async getMedicalHistory(userId: string): Promise<MedicalHistory[]> {
    try {
      return await medicalHistoryService.getUserMedicalHistory(userId);
    } catch (error) {
      console.error("Failed to fetch medical history:", error);
      return [];
    }
  }

  private async getMedications(userId: string): Promise<Medication[]> {
    try {
      return await medicationService.getUserMedications(userId);
    } catch (error) {
      console.error("Failed to fetch medications:", error);
      return [];
    }
  }
}

export const aiInsightsService = new AIInsightsService();
