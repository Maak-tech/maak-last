import type { Medication, Symptom, Mood, User } from "@/types";
import { medicationService } from "./medicationService";
import { symptomService } from "./symptomService";
import { moodService } from "./moodService";
import { healthScoreService } from "./healthScoreService";
import { healthInsightsService } from "./healthInsightsService";
import { medicationRefillService } from "./medicationRefillService";
import { sharedMedicationScheduleService } from "./sharedMedicationScheduleService";
import healthContextService from "./healthContextService";

export interface HealthSuggestion {
  id: string;
  type:
    | "medication"
    | "symptom"
    | "lifestyle"
    | "appointment"
    | "compliance"
    | "wellness"
    | "preventive";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  action?: {
    label: string;
    route?: string;
    action?: () => void;
  };
  icon?: string;
  category: string;
  timestamp: Date;
  dismissed?: boolean;
}

class ProactiveHealthSuggestionsService {
  /**
   * Generate proactive health suggestions for a user
   */
  async generateSuggestions(userId: string): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    try {
      // Load user data
      const [
        medications,
        symptoms,
        moods,
        healthContext,
      ] = await Promise.all([
        medicationService.getUserMedications(userId),
        symptomService.getUserSymptoms(userId, 30),
        moodService.getUserMoods(userId, 30),
        healthContextService.getUserHealthContext(userId),
      ]);

      const activeMedications = medications.filter((m) => m.isActive);

      // 1. Medication compliance suggestions
      const complianceSuggestions = await this.getComplianceSuggestions(
        userId,
        activeMedications
      );
      suggestions.push(...complianceSuggestions);

      // 2. Medication refill suggestions
      const refillSuggestions = await this.getRefillSuggestions(activeMedications);
      suggestions.push(...refillSuggestions);

      // 3. Symptom pattern suggestions
      const symptomSuggestions = await this.getSymptomPatternSuggestions(symptoms);
      suggestions.push(...symptomSuggestions);

      // 4. Mood-based suggestions
      const moodSuggestions = await this.getMoodSuggestions(moods);
      suggestions.push(...moodSuggestions);

      // 5. Health score suggestions
      const healthScoreSuggestions = await this.getHealthScoreSuggestions(
        symptoms,
        activeMedications
      );
      suggestions.push(...healthScoreSuggestions);

      // 6. Lifestyle suggestions
      const lifestyleSuggestions = await this.getLifestyleSuggestions(
        healthContext,
        symptoms,
        moods
      );
      suggestions.push(...lifestyleSuggestions);

      // 7. Preventive care suggestions
      const preventiveSuggestions = await this.getPreventiveSuggestions(
        healthContext
      );
      suggestions.push(...preventiveSuggestions);

      // 8. Trend analysis suggestions
      const trendSuggestions = await this.getTrendAnalysisSuggestions(
        symptoms,
        moods,
        activeMedications
      );
      suggestions.push(...trendSuggestions);

      // 9. Predictive health suggestions
      const predictiveSuggestions = await this.getPredictiveHealthSuggestions(
        symptoms,
        healthContext
      );
      suggestions.push(...predictiveSuggestions);

      // 10. Personalized wellness suggestions
      const wellnessSuggestions = await this.getPersonalizedWellnessSuggestions(
        healthContext,
        symptoms,
        moods
      );
      suggestions.push(...wellnessSuggestions);

      // Sort by priority (high first)
      suggestions.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      return suggestions.slice(0, 10); // Return top 10 suggestions
    } catch (error) {
      return [];
    }
  }

  /**
   * Get medication compliance suggestions
   */
  private async getComplianceSuggestions(
    userId: string,
    medications: Medication[]
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    if (medications.length === 0) return suggestions;

    try {
      const scheduleEntries =
        await sharedMedicationScheduleService.getMemberMedicationSchedule(
          userId,
          ""
        );

      const lowCompliance = scheduleEntries.filter(
        (entry) => entry.complianceRate !== undefined && entry.complianceRate < 70
      );

      if (lowCompliance.length > 0) {
        suggestions.push({
          id: "compliance-low",
          type: "compliance",
          priority: "high",
          title: "Low Medication Compliance",
          description: `You're missing ${lowCompliance.length} medication dose${lowCompliance.length === 1 ? "" : "s"}. Consistent medication adherence is important for your health.`,
          action: {
            label: "View Schedule",
            route: "/(tabs)/family",
          },
          icon: "Pill",
          category: "Medication",
          timestamp: new Date(),
        });
      }

      const missedDoses = scheduleEntries.reduce(
        (sum, entry) => sum + (entry.missedDoses || 0),
        0
      );

      if (missedDoses > 0) {
        suggestions.push({
          id: "missed-doses",
          type: "compliance",
          priority: missedDoses > 3 ? "high" : "medium",
          title: "Missed Medication Doses",
          description: `You have ${missedDoses} missed dose${missedDoses === 1 ? "" : "s"} this week. Consider setting additional reminders.`,
          action: {
            label: "Manage Medications",
            route: "/(tabs)/medications",
          },
          icon: "AlertTriangle",
          category: "Medication",
          timestamp: new Date(),
        });
      }
    } catch (error) {
      // Silently handle error
    }

    return suggestions;
  }

  /**
   * Get medication refill suggestions
   */
  private async getRefillSuggestions(
    medications: Medication[]
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    const refillAlerts = medicationRefillService.checkRefillNeeds(medications);

    refillAlerts.forEach((alert) => {
      if (alert.urgency === "urgent" || alert.urgency === "soon") {
        suggestions.push({
          id: `refill-${alert.medicationId}`,
          type: "medication",
          priority: alert.urgency === "urgent" ? "high" : "medium",
          title: `Refill ${alert.medicationName}`,
          description: alert.message,
          action: {
            label: "View Medications",
            route: "/(tabs)/medications",
          },
          icon: "Pill",
          category: "Medication",
          timestamp: new Date(),
        });
      }
    });

    return suggestions;
  }

  /**
   * Get symptom pattern suggestions
   */
  private async getSymptomPatternSuggestions(
    symptoms: Symptom[]
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    if (symptoms.length < 3) return suggestions;

    // Check for frequent symptoms
    const symptomCounts = new Map<string, number>();
    symptoms.forEach((symptom) => {
      const count = symptomCounts.get(symptom.type) || 0;
      symptomCounts.set(symptom.type, count + 1);
    });

    const frequentSymptoms = Array.from(symptomCounts.entries())
      .filter(([_, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]);

    if (frequentSymptoms.length > 0) {
      const [symptomType, count] = frequentSymptoms[0];
      suggestions.push({
        id: `symptom-frequent-${symptomType}`,
        type: "symptom",
        priority: count >= 5 ? "high" : "medium",
        title: `Frequent ${symptomType} Symptoms`,
        description: `You've recorded ${symptomType} ${count} times recently. Consider discussing this pattern with your healthcare provider.`,
        action: {
          label: "View Symptoms",
          route: "/(tabs)/symptoms",
        },
        icon: "Activity",
        category: "Symptoms",
        timestamp: new Date(),
      });
    }

    // Check for high severity symptoms
    const highSeveritySymptoms = symptoms.filter((s) => s.severity >= 4);
    if (highSeveritySymptoms.length > 0) {
      suggestions.push({
        id: "symptom-severe",
        type: "symptom",
        priority: "high",
        title: "High Severity Symptoms",
        description: `You've recorded ${highSeveritySymptoms.length} high-severity symptom${highSeveritySymptoms.length === 1 ? "" : "s"}. Consider seeking medical attention.`,
        action: {
          label: "View Symptoms",
          route: "/(tabs)/symptoms",
        },
        icon: "AlertTriangle",
        category: "Symptoms",
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Get mood-based suggestions
   */
  private async getMoodSuggestions(moods: Mood[]): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    if (moods.length < 3) return suggestions;

    // Check for negative mood patterns
    const negativeMoods = moods.filter(
      (m) =>
        ["sad", "anxious", "stressed", "tired", "empty", "apathetic"].includes(
          m.mood.toLowerCase()
        )
    );

    if (negativeMoods.length >= moods.length * 0.6) {
      suggestions.push({
        id: "mood-negative-pattern",
        type: "wellness",
        priority: "medium",
        title: "Mood Pattern Detected",
        description: "You've been experiencing more negative moods recently. Consider activities that help improve your mood or speak with a healthcare provider.",
        action: {
          label: "View Moods",
          route: "/(tabs)/moods",
        },
        icon: "Smile",
        category: "Wellness",
        timestamp: new Date(),
      });
    }

    // Check for low mood intensity
    const averageIntensity =
      moods.reduce((sum, m) => sum + m.intensity, 0) / moods.length;
    if (averageIntensity <= 2) {
      suggestions.push({
        id: "mood-low-intensity",
        type: "wellness",
        priority: "low",
        title: "Low Mood Intensity",
        description: "Your mood intensity has been low. Consider activities that boost your energy and mood.",
        action: {
          label: "Track Mood",
          route: "/(tabs)/moods",
        },
        icon: "Smile",
        category: "Wellness",
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Get health score suggestions
   */
  private async getHealthScoreSuggestions(
    symptoms: Symptom[],
    medications: Medication[]
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    const healthScoreResult = healthScoreService.calculateHealthScoreFromData(
      symptoms,
      medications
    );

    if (healthScoreResult.score < 60) {
      suggestions.push({
        id: "health-score-low",
        type: "wellness",
        priority: "high",
        title: "Low Health Score",
        description: `Your health score is ${healthScoreResult.score}. Focus on improving your symptoms and medication adherence to boost your score.`,
        action: {
          label: "View Dashboard",
          route: "/(tabs)/",
        },
        icon: "Heart",
        category: "Health",
        timestamp: new Date(),
      });
    } else if (healthScoreResult.score < 75) {
      suggestions.push({
        id: "health-score-improve",
        type: "wellness",
        priority: "medium",
        title: "Improve Health Score",
        description: `Your health score is ${healthScoreResult.score}. Small improvements in symptom management and lifestyle can help increase it.`,
        action: {
          label: "View Insights",
          route: "/(tabs)/",
        },
        icon: "TrendingUp",
        category: "Health",
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Get lifestyle suggestions
   */
  private async getLifestyleSuggestions(
    healthContext: any,
    symptoms: Symptom[],
    moods: Mood[]
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    // Check for lack of activity tracking
    if (symptoms.length > 0 && moods.length === 0) {
      suggestions.push({
        id: "track-mood",
        type: "lifestyle",
        priority: "low",
        title: "Track Your Mood",
        description: "Tracking your mood can help identify patterns and improve your overall wellness.",
        action: {
          label: "Track Mood",
          route: "/(tabs)/moods",
        },
        icon: "Smile",
        category: "Lifestyle",
        timestamp: new Date(),
      });
    }

    // Check for stress-related symptoms
    const stressSymptoms = symptoms.filter(
      (s) =>
        s.type.toLowerCase().includes("headache") ||
        s.type.toLowerCase().includes("fatigue") ||
        s.type.toLowerCase().includes("anxiety")
    );

    if (stressSymptoms.length >= 3) {
      suggestions.push({
        id: "stress-management",
        type: "lifestyle",
        priority: "medium",
        title: "Stress Management",
        description: "You've been experiencing stress-related symptoms. Consider stress management techniques like meditation, exercise, or relaxation.",
        action: {
          label: "View Resources",
          route: "/(tabs)/resources",
        },
        icon: "Activity",
        category: "Lifestyle",
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Get preventive care suggestions
   */
  private async getPreventiveSuggestions(
    healthContext: any
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    // Check for annual checkup reminder (simplified - would check actual last checkup date)
    const currentMonth = new Date().getMonth();
    if (currentMonth === 0 || currentMonth === 6) {
      // January or July
      suggestions.push({
        id: "annual-checkup",
        type: "appointment",
        priority: "low",
        title: "Annual Health Checkup",
        description: "Consider scheduling your annual health checkup to stay on top of your preventive care.",
        action: {
          label: "Schedule Appointment",
          route: "/(tabs)/calendar/add",
        },
        icon: "Calendar",
        category: "Preventive Care",
        timestamp: new Date(),
      });
    }

    return suggestions;
  }

  /**
   * Get personalized health tips
   */
  async getPersonalizedTips(userId: string): Promise<string[]> {
    try {
      const insights = await healthInsightsService.getHealthInsights(userId);
      const tips: string[] = [];

      // Generate tips based on insights
      if (insights.patterns.length > 0) {
        insights.patterns.forEach((pattern) => {
          if (pattern.type === "temporal") {
            tips.push(
              `Your symptoms tend to ${pattern.description}. Consider planning activities accordingly.`
            );
          }
        });
      }

      if (insights.recommendations.length > 0) {
        insights.recommendations.forEach((rec) => {
          tips.push(rec);
        });
      }

      return tips.slice(0, 5); // Return top 5 tips
    } catch (error) {
      return [];
    }
  }

  /**
   * Get trend analysis suggestions based on symptom and medication patterns
   */
  private async getTrendAnalysisSuggestions(
    symptoms: Symptom[],
    moods: Mood[],
    medications: Medication[]
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    try {
      // Analyze symptom trends over time
      const recentSymptoms = symptoms.filter(
        s => new Date().getTime() - s.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000 // Last 30 days
      );

      if (recentSymptoms.length > 5) {
        const symptomTypes = recentSymptoms.reduce((acc, symptom) => {
          acc[symptom.type] = (acc[symptom.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const mostCommonSymptom = Object.entries(symptomTypes)
          .sort(([,a], [,b]) => b - a)[0];

        if (mostCommonSymptom && mostCommonSymptom[1] >= 3) {
          suggestions.push({
            id: "symptom-pattern",
            type: "wellness",
            priority: "medium",
            title: "Recurring Symptom Pattern",
            description: `You've reported ${mostCommonSymptom[0]} ${mostCommonSymptom[1]} times in the last month. Consider tracking what triggers this symptom.`,
            action: {
              label: "View Symptom History",
              route: "/(tabs)/symptoms",
            },
            icon: "TrendingUp",
            category: "Symptoms",
            timestamp: new Date(),
          });
        }
      }

      // Analyze mood trends
      const recentMoods = moods.filter(
        m => new Date().getTime() - m.timestamp.getTime() < 14 * 24 * 60 * 60 * 1000 // Last 14 days
      );

      if (recentMoods.length > 3) {
        const avgMood = recentMoods.reduce((sum, m) => sum + m.moodRating, 0) / recentMoods.length;

        if (avgMood < 3) {
          suggestions.push({
            id: "mood-trend",
            type: "wellness",
            priority: "medium",
            title: "Mood Support",
            description: "Your recent mood entries suggest you might benefit from additional support. Consider activities that boost your mood.",
            action: {
              label: "View Mood History",
              route: "/(tabs)/moods",
            },
            icon: "Smile",
            category: "Wellness",
            timestamp: new Date(),
          });
        }
      }

      // Medication effectiveness analysis
      if (medications.length > 0 && symptoms.length > 10) {
        const symptomTrends = this.analyzeSymptomMedicationCorrelation(symptoms, medications);

        if (symptomTrends.length > 0) {
          suggestions.push({
            id: "medication-effectiveness",
            type: "medication",
            priority: "high",
            title: "Medication Effectiveness Review",
            description: "We notice some patterns in your symptoms that may relate to your medication schedule. Consider reviewing with your healthcare provider.",
            action: {
              label: "Discuss with Provider",
              route: "/ai-assistant",
            },
            icon: "Activity",
            category: "Medication",
            timestamp: new Date(),
          });
        }
      }

    } catch (error) {
      // Silently handle error
    }

    return suggestions;
  }

  /**
   * Get predictive health suggestions based on patterns
   */
  private async getPredictiveHealthSuggestions(
    symptoms: Symptom[],
    healthContext: any
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    try {
      // Predict potential flare-ups based on patterns
      const flareUpPrediction = this.predictFlareUps(symptoms);

      if (flareUpPrediction.likelihood > 0.7) {
        suggestions.push({
          id: "flare-up-warning",
          type: "preventive",
          priority: "high",
          title: "Potential Symptom Flare-Up",
          description: `Based on your symptom patterns, there may be an increased risk of ${flareUpPrediction.symptomType} flare-up in the next few days.`,
          action: {
            label: "Take Preventive Measures",
            route: "/ai-assistant",
          },
          icon: "AlertTriangle",
          category: "Preventive Care",
          timestamp: new Date(),
        });
      }

      // Predict medication needs
      const medicationPrediction = this.predictMedicationNeeds(symptoms, healthContext);

      if (medicationPrediction.needsAdjustment) {
        suggestions.push({
          id: "medication-adjustment",
          type: "medication",
          priority: "high",
          title: "Medication Adjustment Needed",
          description: "Your symptom patterns suggest your current medication regimen may need adjustment. Consider consulting your healthcare provider.",
          action: {
            label: "Consult Provider",
            route: "/ai-assistant",
          },
          icon: "Pill",
          category: "Medication",
          timestamp: new Date(),
        });
      }

      // Seasonal health predictions
      const seasonalPrediction = this.getSeasonalHealthPrediction();

      if (seasonalPrediction) {
        suggestions.push({
          id: "seasonal-health",
          type: "preventive",
          priority: "low",
          title: seasonalPrediction.title,
          description: seasonalPrediction.description,
          action: {
            label: seasonalPrediction.actionLabel,
            route: "/ai-assistant",
          },
          icon: "Calendar",
          category: "Preventive Care",
          timestamp: new Date(),
        });
      }

    } catch (error) {
      // Silently handle error
    }

    return suggestions;
  }

  /**
   * Get personalized wellness suggestions
   */
  private async getPersonalizedWellnessSuggestions(
    healthContext: any,
    symptoms: Symptom[],
    moods: Mood[]
  ): Promise<HealthSuggestion[]> {
    const suggestions: HealthSuggestion[] = [];

    try {
      // Activity level analysis
      const activitySuggestion = this.analyzeActivityNeeds(healthContext, symptoms);
      if (activitySuggestion) {
        suggestions.push(activitySuggestion);
      }

      // Sleep pattern analysis
      const sleepSuggestion = this.analyzeSleepPatterns(healthContext);
      if (sleepSuggestion) {
        suggestions.push(sleepSuggestion);
      }

      // Nutrition suggestions based on symptoms
      const nutritionSuggestion = this.analyzeNutritionNeeds(symptoms, healthContext);
      if (nutritionSuggestion) {
        suggestions.push(nutritionSuggestion);
      }

      // Stress management suggestions
      const stressSuggestion = this.analyzeStressLevels(moods, symptoms);
      if (stressSuggestion) {
        suggestions.push(stressSuggestion);
      }

      // Social connection suggestions
      const socialSuggestion = this.analyzeSocialNeeds(moods);
      if (socialSuggestion) {
        suggestions.push(socialSuggestion);
      }

    } catch (error) {
      // Silently handle error
    }

    return suggestions;
  }

  /**
   * Analyze symptom-medication correlations
   */
  private analyzeSymptomMedicationCorrelation(symptoms: Symptom[], medications: Medication[]): string[] {
    const correlations: string[] = [];

    try {
      // Simple correlation analysis - in a real implementation this would be more sophisticated
      const symptomTypes = [...new Set(symptoms.map(s => s.type))];

      symptomTypes.forEach(symptomType => {
        const symptomOccurrences = symptoms.filter(s => s.type === symptomType);
        const medicationNames = medications.map(m => m.name);

        // Look for patterns - this is a simplified version
        if (symptomOccurrences.length > 5) {
          correlations.push(`${symptomType} appears frequently`);
        }
      });
    } catch (error) {
      // Silently handle error
    }

    return correlations;
  }

  /**
   * Predict potential flare-ups based on symptom patterns
   */
  private predictFlareUps(symptoms: Symptom[]): { likelihood: number; symptomType: string } {
    try {
      if (symptoms.length < 10) return { likelihood: 0, symptomType: "" };

      // Simple pattern recognition - look for increasing frequency or severity
      const recentSymptoms = symptoms.filter(
        s => new Date().getTime() - s.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
      );

      const symptomTypes = recentSymptoms.reduce((acc, symptom) => {
        acc[symptom.type] = (acc[symptom.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostCommon = Object.entries(symptomTypes)
        .sort(([,a], [,b]) => b - a)[0];

      // If a symptom appears more than 3 times in a week, consider it a potential flare-up
      const likelihood = mostCommon && mostCommon[1] >= 3 ? 0.8 : 0.2;

      return { likelihood, symptomType: mostCommon ? mostCommon[0] : "" };
    } catch (error) {
      return { likelihood: 0, symptomType: "" };
    }
  }

  /**
   * Predict medication needs based on symptom patterns
   */
  private predictMedicationNeeds(symptoms: Symptom[], healthContext: any): { needsAdjustment: boolean } {
    try {
      // Simple analysis - if symptoms are increasing despite medication, suggest adjustment
      const recentSymptoms = symptoms.filter(
        s => new Date().getTime() - s.timestamp.getTime() < 14 * 24 * 60 * 60 * 1000 // Last 14 days
      );

      const avgSeverity = recentSymptoms.reduce((sum, s) => sum + s.severity, 0) / recentSymptoms.length;

      // If average severity is high and there are many symptoms, suggest adjustment
      const needsAdjustment = avgSeverity > 3 && recentSymptoms.length > 10;

      return { needsAdjustment };
    } catch (error) {
      return { needsAdjustment: false };
    }
  }

  /**
   * Get seasonal health predictions
   */
  private getSeasonalHealthPrediction(): { title: string; description: string; actionLabel: string } | null {
    try {
      const month = new Date().getMonth();

      // Seasonal recommendations based on month
      if (month >= 11 || month <= 1) { // Winter
        return {
          title: "Winter Wellness",
          description: "Cold weather can affect your symptoms. Stay warm and maintain your vitamin D levels.",
          actionLabel: "Winter Health Tips"
        };
      } else if (month >= 2 && month <= 4) { // Spring
        return {
          title: "Spring Allergies",
          description: "Pollen season may increase allergy symptoms. Consider allergy management strategies.",
          actionLabel: "Allergy Management"
        };
      } else if (month >= 5 && month <= 7) { // Summer
        return {
          title: "Summer Hydration",
          description: "Hot weather increases the need for hydration. Monitor your fluid intake carefully.",
          actionLabel: "Hydration Tips"
        };
      } else { // Fall
        return {
          title: "Fall Transition",
          description: "Seasonal changes can affect sleep and energy levels. Maintain consistent routines.",
          actionLabel: "Seasonal Adjustment"
        };
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze activity needs based on health context and symptoms
   */
  private analyzeActivityNeeds(healthContext: any, symptoms: Symptom[]): HealthSuggestion | null {
    try {
      const recentSymptoms = symptoms.filter(
        s => new Date().getTime() - s.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
      );

      const fatigueSymptoms = recentSymptoms.filter(s => s.type === "fatigue" || s.type === "tired").length;

      if (fatigueSymptoms >= 3) {
        return {
          id: "activity-fatigue",
          type: "lifestyle",
          priority: "medium",
          title: "Gentle Activity",
          description: "You've reported fatigue several times this week. Consider gentle activities like short walks or light stretching.",
          action: {
            label: "Activity Suggestions",
            route: "/ai-assistant",
          },
          icon: "Activity",
          category: "Lifestyle",
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze sleep patterns
   */
  private analyzeSleepPatterns(healthContext: any): HealthSuggestion | null {
    try {
      // This would analyze actual sleep data if available
      // For now, return a general suggestion if sleep symptoms are present
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze nutrition needs based on symptoms
   */
  private analyzeNutritionNeeds(symptoms: Symptom[], healthContext: any): HealthSuggestion | null {
    try {
      const nauseaSymptoms = symptoms.filter(s => s.type === "nausea").length;
      const appetiteSymptoms = symptoms.filter(s => s.type === "lossOfAppetite").length;

      if (nauseaSymptoms >= 2 || appetiteSymptoms >= 2) {
        return {
          id: "nutrition-support",
          type: "lifestyle",
          priority: "medium",
          title: "Nutrition Support",
          description: "You've mentioned digestive or appetite issues. Consider speaking with a nutritionist for dietary adjustments.",
          action: {
            label: "Nutrition Advice",
            route: "/ai-assistant",
          },
          icon: "Heart",
          category: "Lifestyle",
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze stress levels and suggest management techniques
   */
  private analyzeStressLevels(moods: Mood[], symptoms: Symptom[]): HealthSuggestion | null {
    try {
      const recentMoods = moods.filter(
        m => new Date().getTime() - m.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
      );

      const lowMoods = recentMoods.filter(m => m.moodRating < 4).length;
      const anxietySymptoms = symptoms.filter(s => s.type === "anxiety").length;

      if (lowMoods >= 3 || anxietySymptoms >= 2) {
        return {
          id: "stress-management",
          type: "wellness",
          priority: "medium",
          title: "Stress Management",
          description: "Consider stress reduction techniques like meditation, deep breathing, or gentle exercise.",
          action: {
            label: "Stress Relief Tips",
            route: "/ai-assistant",
          },
          icon: "Smile",
          category: "Wellness",
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Analyze social connection needs
   */
  private analyzeSocialNeeds(moods: Mood[]): HealthSuggestion | null {
    try {
      const recentMoods = moods.filter(
        m => new Date().getTime() - m.timestamp.getTime() < 14 * 24 * 60 * 60 * 1000
      );

      const lonelyMoods = recentMoods.filter(m =>
        m.notes?.toLowerCase().includes("lonely") ||
        m.notes?.toLowerCase().includes("alone")
      ).length;

      if (lonelyMoods >= 2) {
        return {
          id: "social-connection",
          type: "wellness",
          priority: "low",
          title: "Social Connection",
          description: "Social connections are important for mental health. Consider reaching out to friends or family.",
          action: {
            label: "Connection Tips",
            route: "/ai-assistant",
          },
          icon: "Users",
          category: "Wellness",
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

export const proactiveHealthSuggestionsService = new ProactiveHealthSuggestionsService();
