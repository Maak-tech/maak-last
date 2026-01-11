import { symptomService } from "./symptomService";
import { medicationService } from "./medicationService";
import type { Symptom, Medication } from "@/types";

/**
 * Health Score Calculation Service
 * 
 * Provides a standardized, evidence-based health score calculation
 * across the entire application.
 * 
 * Score Range: 0-100
 * - 90-100: Excellent health
 * - 80-89: Good health
 * - 70-79: Fair health
 * - 60-69: Poor health
 * - Below 60: Critical attention needed
 */

export interface HealthScoreResult {
  score: number;
  breakdown: {
    baseScore: number;
    symptomPenalty: number;
    medicationBonus: number;
  };
  factors: {
    recentSymptoms: number;
    symptomSeverityAvg: number;
    medicationCompliance: number;
    activeMedications: number;
  };
  rating: "excellent" | "good" | "fair" | "poor" | "critical";
}

/**
 * Symptom severity weights for health score calculation
 * Based on 1-10 severity scale
 */
const SYMPTOM_SEVERITY_WEIGHTS = {
  mild: 1.0,      // Severity 1-3
  moderate: 2.0,  // Severity 4-6
  severe: 3.5,    // Severity 7-8
  critical: 5.0,  // Severity 9-10
};

/**
 * Time window for health score calculation (7 days)
 * Clinically relevant for recent health status assessment
 */
const HEALTH_SCORE_WINDOW_DAYS = 7;

/**
 * Maximum symptom penalty to prevent score from dropping too drastically
 */
const MAX_SYMPTOM_PENALTY = 35;

/**
 * Medication compliance weight
 * Good compliance provides a health bonus
 */
const MEDICATION_COMPLIANCE_WEIGHT = 15;

/**
 * Get symptom severity category
 */
function getSymptomSeverityCategory(severity: number): keyof typeof SYMPTOM_SEVERITY_WEIGHTS {
  if (severity >= 9) return "critical";
  if (severity >= 7) return "severe";
  if (severity >= 4) return "moderate";
  return "mild";
}

/**
 * Calculate symptom penalty based on count and severity
 */
function calculateSymptomPenalty(symptoms: Symptom[]): { penalty: number; avgSeverity: number } {
  if (symptoms.length === 0) {
    return { penalty: 0, avgSeverity: 0 };
  }

  // Calculate weighted penalty based on symptom severity
  let totalWeightedPenalty = 0;
  let totalSeverity = 0;

  symptoms.forEach((symptom) => {
    const severity = symptom.severity || 5; // Default to moderate if not specified
    const category = getSymptomSeverityCategory(severity);
    const weight = SYMPTOM_SEVERITY_WEIGHTS[category];
    
    totalWeightedPenalty += weight;
    totalSeverity += severity;
  });

  const avgSeverity = totalSeverity / symptoms.length;
  const penalty = Math.min(totalWeightedPenalty, MAX_SYMPTOM_PENALTY);

  return { penalty, avgSeverity };
}

/**
 * Calculate medication compliance bonus
 * Good compliance (>80%) provides a health bonus
 * Poor compliance (<50%) provides a penalty
 */
function calculateMedicationBonus(
  medications: Medication[],
  compliancePercentage: number
): number {
  // No medications = neutral (no bonus or penalty)
  if (medications.length === 0) {
    return 0;
  }

  // Excellent compliance (90-100%): +15 points
  if (compliancePercentage >= 90) {
    return MEDICATION_COMPLIANCE_WEIGHT;
  }
  
  // Good compliance (80-89%): +10 points
  if (compliancePercentage >= 80) {
    return MEDICATION_COMPLIANCE_WEIGHT * 0.67;
  }
  
  // Fair compliance (60-79%): +5 points
  if (compliancePercentage >= 60) {
    return MEDICATION_COMPLIANCE_WEIGHT * 0.33;
  }
  
  // Poor compliance (40-59%): 0 points
  if (compliancePercentage >= 40) {
    return 0;
  }
  
  // Very poor compliance (<40%): -10 points (penalty)
  return -MEDICATION_COMPLIANCE_WEIGHT * 0.67;
}

/**
 * Calculate medication compliance percentage
 */
function calculateCompliancePercentage(medications: Medication[]): number {
  if (medications.length === 0) {
    return 100; // No medications = 100% compliant
  }

  const today = new Date().toDateString();
  let totalReminders = 0;
  let takenReminders = 0;

  medications.forEach((med) => {
    const reminders = Array.isArray(med.reminders) ? med.reminders : [];
    totalReminders += reminders.length;

    reminders.forEach((reminder) => {
      if (reminder.taken && reminder.takenAt) {
        const takenDate = (reminder.takenAt as any).toDate
          ? (reminder.takenAt as any).toDate()
          : new Date(reminder.takenAt);
        if (takenDate.toDateString() === today) {
          takenReminders++;
        }
      }
    });
  });

  return totalReminders > 0 ? (takenReminders / totalReminders) * 100 : 100;
}

/**
 * Get health rating based on score
 */
function getHealthRating(score: number): HealthScoreResult["rating"] {
  if (score >= 90) return "excellent";
  if (score >= 80) return "good";
  if (score >= 70) return "fair";
  if (score >= 60) return "poor";
  return "critical";
}

/**
 * Calculate comprehensive health score for a user
 * 
 * @param userId - User ID to calculate score for
 * @returns Health score result with detailed breakdown
 */
export async function calculateHealthScore(userId: string): Promise<HealthScoreResult> {
  try {
    // Fetch recent symptoms and medications in parallel
    const [symptoms, medications] = await Promise.all([
      symptomService.getUserSymptoms(userId, 100), // Get more than needed, we'll filter
      medicationService.getUserMedications(userId),
    ]);

    // Filter symptoms to last 7 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - HEALTH_SCORE_WINDOW_DAYS);
    
    const recentSymptoms = symptoms.filter((symptom) => {
      if (!symptom.timestamp) return false;
      const symptomDate = symptom.timestamp instanceof Date 
        ? symptom.timestamp 
        : new Date(symptom.timestamp);
      return !isNaN(symptomDate.getTime()) && symptomDate >= cutoffDate;
    });

    // Get active medications
    const activeMedications = medications.filter((med) => med.isActive);

    // Calculate compliance for today's medications
    const todaysMedications = activeMedications.filter((med) => {
      return Array.isArray(med.reminders) && med.reminders.length > 0;
    });
    
    const compliancePercentage = calculateCompliancePercentage(todaysMedications);

    // Calculate components
    const baseScore = 100;
    const { penalty: symptomPenalty, avgSeverity } = calculateSymptomPenalty(recentSymptoms);
    const medicationBonus = calculateMedicationBonus(activeMedications, compliancePercentage);

    // Calculate final score (clamped between 0 and 100)
    const rawScore = baseScore - symptomPenalty + medicationBonus;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    return {
      score,
      breakdown: {
        baseScore,
        symptomPenalty: Math.round(symptomPenalty * 10) / 10,
        medicationBonus: Math.round(medicationBonus * 10) / 10,
      },
      factors: {
        recentSymptoms: recentSymptoms.length,
        symptomSeverityAvg: Math.round(avgSeverity * 10) / 10,
        medicationCompliance: Math.round(compliancePercentage),
        activeMedications: activeMedications.length,
      },
      rating: getHealthRating(score),
    };
  } catch (error) {
    // Return default score in case of error
    return {
      score: 75,
      breakdown: {
        baseScore: 100,
        symptomPenalty: 0,
        medicationBonus: 0,
      },
      factors: {
        recentSymptoms: 0,
        symptomSeverityAvg: 0,
        medicationCompliance: 100,
        activeMedications: 0,
      },
      rating: "fair",
    };
  }
}

/**
 * Calculate health score using pre-fetched data (more efficient)
 * Use this when you already have symptoms and medications loaded
 * 
 * @param symptoms - User's symptoms
 * @param medications - User's medications
 * @returns Health score result with detailed breakdown
 */
export function calculateHealthScoreFromData(
  symptoms: Symptom[],
  medications: Medication[]
): HealthScoreResult {
  try {
    // Filter symptoms to last 7 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - HEALTH_SCORE_WINDOW_DAYS);
    
    const recentSymptoms = symptoms.filter((symptom) => {
      if (!symptom.timestamp) return false;
      const symptomDate = symptom.timestamp instanceof Date 
        ? symptom.timestamp 
        : new Date(symptom.timestamp);
      return !isNaN(symptomDate.getTime()) && symptomDate >= cutoffDate;
    });

    // Get active medications
    const activeMedications = medications.filter((med) => med.isActive);

    // Calculate compliance for today's medications
    const todaysMedications = activeMedications.filter((med) => {
      return Array.isArray(med.reminders) && med.reminders.length > 0;
    });
    
    const compliancePercentage = calculateCompliancePercentage(todaysMedications);

    // Calculate components
    const baseScore = 100;
    const { penalty: symptomPenalty, avgSeverity } = calculateSymptomPenalty(recentSymptoms);
    const medicationBonus = calculateMedicationBonus(activeMedications, compliancePercentage);

    // Calculate final score (clamped between 0 and 100)
    const rawScore = baseScore - symptomPenalty + medicationBonus;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    return {
      score,
      breakdown: {
        baseScore,
        symptomPenalty: Math.round(symptomPenalty * 10) / 10,
        medicationBonus: Math.round(medicationBonus * 10) / 10,
      },
      factors: {
        recentSymptoms: recentSymptoms.length,
        symptomSeverityAvg: Math.round(avgSeverity * 10) / 10,
        medicationCompliance: Math.round(compliancePercentage),
        activeMedications: activeMedications.length,
      },
      rating: getHealthRating(score),
    };
  } catch (error) {
    // Return default score in case of error
    return {
      score: 75,
      breakdown: {
        baseScore: 100,
        symptomPenalty: 0,
        medicationBonus: 0,
      },
      factors: {
        recentSymptoms: 0,
        symptomSeverityAvg: 0,
        medicationCompliance: 100,
        activeMedications: 0,
      },
      rating: "fair",
    };
  }
}

export const healthScoreService = {
  calculateHealthScore,
  calculateHealthScoreFromData,
  HEALTH_SCORE_WINDOW_DAYS,
};
