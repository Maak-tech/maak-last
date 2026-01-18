import type { User, Symptom, Medication, MedicalHistory } from "@/types";
import { correlationAnalysisService, type CorrelationInsight } from "./correlationAnalysisService";
import { symptomPatternRecognitionService, type PatternAnalysisResult } from "./symptomPatternRecognitionService";
import { riskAssessmentService, type HealthRiskAssessment } from "./riskAssessmentService";
import { medicationInteractionService, type MedicationInteractionAlert } from "./medicationInteractionService";
import { proactiveHealthSuggestionsService, type HealthSuggestion } from "./proactiveHealthSuggestionsService";
import openaiService from "./openaiService";

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
  /**
   * Generate comprehensive AI insights dashboard for a user
   */
  async generateAIInsightsDashboard(
    userId: string,
    includeAINarrative: boolean = true
  ): Promise<AIInsightsDashboard> {
    console.log(`Generating AI insights dashboard for user ${userId}`);

    // Generate all AI insights in parallel
    const [
      correlationAnalysis,
      symptomAnalysis,
      riskAssessment,
      medicationAlerts,
      healthSuggestions,
      personalizedTips
    ] = await Promise.all([
      correlationAnalysisService.generateCorrelationAnalysis(userId),
      this.generateSymptomAnalysis(userId),
      riskAssessmentService.generateRiskAssessment(userId),
      medicationInteractionService.generateRealtimeAlerts(userId),
      proactiveHealthSuggestionsService.generateSuggestions(userId),
      proactiveHealthSuggestionsService.getPersonalizedTips(userId)
    ]);

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
      aiNarrative
    };

    return dashboard;
  }

  /**
   * Generate symptom analysis with pattern recognition
   */
  private async generateSymptomAnalysis(userId: string): Promise<PatternAnalysisResult> {
    const symptoms = await this.getRecentSymptoms(userId);
    const medicalHistory = await this.getMedicalHistory(userId);
    const medications = await this.getMedications(userId);

    return symptomPatternRecognitionService.analyzeSymptomPatterns(
      userId,
      symptoms,
      medicalHistory,
      medications
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
        correlations: correlationAnalysis.correlationResults.slice(0, 3).map(c => ({
          type: c.type,
          strength: c.strength.toFixed(2),
          description: c.description
        })),
        symptomPatterns: symptomAnalysis.patterns.slice(0, 2).map(p => ({
          name: p.name,
          confidence: p.confidence,
          severity: p.severity
        })),
        diagnosisSuggestions: symptomAnalysis.diagnosisSuggestions.slice(0, 2).map(d => ({
          condition: d.condition,
          confidence: d.confidence,
          urgency: d.urgency
        })),
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.overallRiskScore,
        topRiskFactors: riskAssessment.riskFactors.slice(0, 3).map(f => f.name),
        topSuggestions: healthSuggestions.slice(0, 3).map(s => s.title)
      };

      const prompt = `
        Based on this health data analysis, write a personalized, empathetic narrative (2-3 paragraphs) that:
        1. Summarizes the key insights from correlation analysis, symptom patterns, and risk assessment
        2. Explains what the data means in simple, understandable terms
        3. Provides encouragement and actionable next steps
        4. Maintains a supportive, non-alarming tone

        Health Data Summary:
        - Correlation Analysis: ${context.correlations.map(c => `${c.type} (${c.strength}): ${c.description}`).join(', ')}
        - Symptom Patterns: ${context.symptomPatterns.map(p => `${p.name} (${p.confidence}% confidence)`).join(', ')}
        - Diagnosis Suggestions: ${context.diagnosisSuggestions.map(d => `${d.condition} (${d.confidence}% confidence, ${d.urgency} urgency)`).join(', ')}
        - Overall Risk Level: ${context.riskLevel} (${context.riskScore}/100)
        - Key Risk Factors: ${context.topRiskFactors.join(', ')}
        - Top Recommendations: ${context.topSuggestions.join(', ')}

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
        topRiskFactors: riskAssessment.riskFactors.slice(0, 3).map(f => f.name),
        topSuggestions: healthSuggestions.slice(0, 3).map(s => s.title)
      });
    }
  }

  /**
   * Generate fallback narrative when AI fails
   */
  private generateFallbackNarrative(context: any): string {
    return `Your health data shows ${context.riskLevel} overall risk with a score of ${context.riskScore}/100. ${
      context.topRiskFactors.length > 0
        ? `Key areas to focus on include: ${context.topRiskFactors.join(', ')}. `
        : ''
    }Consider the following recommendations to support your health journey: ${
      context.topSuggestions.join(', ')
    }. Remember, small consistent steps lead to meaningful improvements in your well-being.`;
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
      correlationAnalysis.correlationResults.filter(c => c.confidence > 80).length +
      symptomAnalysis.diagnosisSuggestions.filter(d => d.urgency === 'high' || d.urgency === 'emergency').length +
      healthSuggestions.filter(s => s.priority === 'high').length +
      medicationAlerts.filter(a => a.severity === 'major').length;

    return {
      totalInsights,
      highPriorityItems,
      riskLevel: riskAssessment.riskLevel,
      nextAssessmentDate: riskAssessment.nextAssessmentDate
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
    dashboard.medicationAlerts.forEach(alert => {
      if (alert.severity === 'major') {
        critical.push({ type: 'medication_alert', data: alert });
      } else if (alert.severity === 'moderate') {
        high.push({ type: 'medication_alert', data: alert });
      } else {
        medium.push({ type: 'medication_alert', data: alert });
      }
    });

    // Diagnosis suggestions
    dashboard.symptomAnalysis.diagnosisSuggestions.forEach(suggestion => {
      if (suggestion.urgency === 'emergency') {
        critical.push({ type: 'diagnosis_suggestion', data: suggestion });
      } else if (suggestion.urgency === 'high') {
        high.push({ type: 'diagnosis_suggestion', data: suggestion });
      } else if (suggestion.urgency === 'medium') {
        medium.push({ type: 'diagnosis_suggestion', data: suggestion });
      } else {
        low.push({ type: 'diagnosis_suggestion', data: suggestion });
      }
    });

    // Risk assessment
    if (dashboard.riskAssessment.riskLevel === 'very_high') {
      critical.push({ type: 'risk_assessment', data: dashboard.riskAssessment });
    } else if (dashboard.riskAssessment.riskLevel === 'high') {
      high.push({ type: 'risk_assessment', data: dashboard.riskAssessment });
    }

    // Health suggestions
    dashboard.healthSuggestions.forEach(suggestion => {
      if (suggestion.priority === 'high') {
        high.push({ type: 'health_suggestion', data: suggestion });
      } else if (suggestion.priority === 'medium') {
        medium.push({ type: 'health_suggestion', data: suggestion });
      } else {
        low.push({ type: 'health_suggestion', data: suggestion });
      }
    });

    // Correlation insights
    dashboard.correlationAnalysis.correlationResults.forEach(correlation => {
      if (correlation.confidence > 90) {
        high.push({ type: 'correlation', data: correlation });
      } else if (correlation.confidence > 70) {
        medium.push({ type: 'correlation', data: correlation });
      } else {
        low.push({ type: 'correlation', data: correlation });
      }
    });

    return { critical, high, medium, low };
  }

  /**
   * Get insights by category
   */
  async getInsightsByCategory(userId: string, category: string): Promise<any[]> {
    const dashboard = await this.generateAIInsightsDashboard(userId, false);

    switch (category) {
      case 'correlations':
        return dashboard.correlationAnalysis.correlationResults;
      case 'symptoms':
        return dashboard.symptomAnalysis.patterns;
      case 'diagnosis':
        return dashboard.symptomAnalysis.diagnosisSuggestions;
      case 'risk':
        return [dashboard.riskAssessment];
      case 'medications':
        return dashboard.medicationAlerts;
      case 'suggestions':
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
      .filter(a => a.severity === 'major')
      .forEach(alert => {
        immediate.push(`Address medication interaction: ${alert.title}`);
      });

    dashboard.symptomAnalysis.diagnosisSuggestions
      .filter(d => d.urgency === 'emergency' || d.urgency === 'high')
      .forEach(suggestion => {
        immediate.push(`Seek medical attention for possible ${suggestion.condition}`);
      });

    // Short-term actions
    dashboard.healthSuggestions
      .filter(s => s.priority === 'high')
      .forEach(suggestion => {
        shortTerm.push(suggestion.title);
      });

    dashboard.riskAssessment.preventiveRecommendations
      .slice(0, 3)
      .forEach(rec => {
        shortTerm.push(rec);
      });

    // Long-term actions
    dashboard.correlationAnalysis.correlationResults
      .filter(c => c.actionable)
      .forEach(correlation => {
        if (correlation.recommendation) {
          longTerm.push(correlation.recommendation);
        }
      });

    // Monitoring actions
    monitoring.push("Continue tracking symptoms and vital signs regularly");
    monitoring.push("Monitor medication effectiveness and side effects");
    monitoring.push("Schedule regular health check-ups based on risk assessment");

    if (dashboard.riskAssessment.nextAssessmentDate) {
      monitoring.push(`Next comprehensive assessment: ${dashboard.riskAssessment.nextAssessmentDate.toLocaleDateString()}`);
    }

    return { immediate, shortTerm, longTerm, monitoring };
  }

  // Helper methods for data access

  private async getRecentSymptoms(userId: string): Promise<Symptom[]> {
    // This should use the symptom service
    return [];
  }

  private async getMedicalHistory(userId: string): Promise<MedicalHistory[]> {
    // This should use the medical history service
    return [];
  }

  private async getMedications(userId: string): Promise<Medication[]> {
    // This should use the medication service
    return [];
  }
}

export const aiInsightsService = new AIInsightsService();