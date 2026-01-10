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
}

export const proactiveHealthSuggestionsService = new ProactiveHealthSuggestionsService();
