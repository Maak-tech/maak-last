import type {
  MedicalHistory,
  Medication,
  Mood,
  Symptom,
  User,
  VitalSign,
} from "@/types";
import { medicalHistoryService } from "./medicalHistoryService";
// Vitals accessed directly from Firestore
import { medicationService } from "./medicationService";
import { symptomService } from "./symptomService";

export interface RiskFactor {
  id: string;
  name: string;
  category: "genetic" | "lifestyle" | "medical" | "environmental" | "age";
  riskLevel: "low" | "moderate" | "high" | "very_high";
  description: string;
  impact: number; // 0-100, contribution to overall risk
  evidence: string;
  modifiable: boolean;
  recommendations?: string[];
}

export interface HealthRiskAssessment {
  id: string;
  userId: string;
  overallRiskScore: number; // 0-100
  riskLevel: "low" | "moderate" | "high" | "very_high";
  riskFactors: RiskFactor[];
  conditionRisks: ConditionRisk[];
  preventiveRecommendations: string[];
  timeline: "immediate" | "short_term" | "long_term";
  assessmentDate: Date;
  nextAssessmentDate: Date;
}

export interface ConditionRisk {
  condition: string;
  riskScore: number; // 0-100
  riskLevel: "low" | "moderate" | "high" | "very_high";
  contributingFactors: string[];
  preventiveMeasures: string[];
  screeningRecommendations?: string[];
}

// Risk assessment rules and weights
const RISK_FACTORS = {
  // Age-related risks
  age_65_plus: { weight: 25, category: "age" as const, modifiable: false },
  age_45_64: { weight: 15, category: "age" as const, modifiable: false },
  age_30_44: { weight: 5, category: "age" as const, modifiable: false },

  // Family history risks
  family_heart_disease: {
    weight: 30,
    category: "genetic" as const,
    modifiable: false,
  },
  family_diabetes: {
    weight: 25,
    category: "genetic" as const,
    modifiable: false,
  },
  family_cancer: {
    weight: 20,
    category: "genetic" as const,
    modifiable: false,
  },
  family_hypertension: {
    weight: 15,
    category: "genetic" as const,
    modifiable: false,
  },

  // Lifestyle risks
  smoking: { weight: 40, category: "lifestyle" as const, modifiable: true },
  obesity: { weight: 25, category: "lifestyle" as const, modifiable: true },
  sedentary: { weight: 20, category: "lifestyle" as const, modifiable: true },
  poor_diet: { weight: 15, category: "lifestyle" as const, modifiable: true },
  excessive_alcohol: {
    weight: 20,
    category: "lifestyle" as const,
    modifiable: true,
  },

  // Medical history risks
  diabetes: { weight: 35, category: "medical" as const, modifiable: false },
  hypertension: { weight: 30, category: "medical" as const, modifiable: true },
  high_cholesterol: {
    weight: 20,
    category: "medical" as const,
    modifiable: true,
  },
  heart_disease: { weight: 40, category: "medical" as const, modifiable: true },
  asthma: { weight: 15, category: "medical" as const, modifiable: true },

  // Current health indicators
  high_blood_pressure: {
    weight: 25,
    category: "medical" as const,
    modifiable: true,
  },
  high_blood_sugar: {
    weight: 20,
    category: "medical" as const,
    modifiable: true,
  },
  irregular_heart_rate: {
    weight: 15,
    category: "medical" as const,
    modifiable: true,
  },
  frequent_symptoms: {
    weight: 10,
    category: "medical" as const,
    modifiable: true,
  },
  low_mood: { weight: 12, category: "medical" as const, modifiable: true },
};

const CONDITION_SPECIFIC_RISKS = {
  cardiovascular: {
    conditions: ["heart disease", "stroke", "heart attack"],
    factors: [
      "family_heart_disease",
      "hypertension",
      "high_cholesterol",
      "smoking",
      "diabetes",
      "obesity",
      "sedentary",
    ],
    screening: [
      "Regular blood pressure checks",
      "Cholesterol screening",
      "EKG if indicated",
    ],
    prevention: [
      "Heart-healthy diet",
      "Regular exercise",
      "Weight management",
      "Quit smoking",
      "Stress management",
    ],
  },
  diabetes: {
    conditions: ["type 2 diabetes", "diabetic complications"],
    factors: [
      "family_diabetes",
      "obesity",
      "sedentary",
      "poor_diet",
      "age_45_64",
      "age_65_plus",
    ],
    screening: ["Annual blood glucose screening", "HbA1c testing"],
    prevention: [
      "Weight management",
      "Regular exercise",
      "Healthy diet",
      "Regular health screenings",
    ],
  },
  cancer: {
    conditions: ["various cancers"],
    factors: [
      "family_cancer",
      "smoking",
      "obesity",
      "age_45_64",
      "age_65_plus",
    ],
    screening: ["Age-appropriate cancer screenings", "Regular check-ups"],
    prevention: [
      "Quit smoking",
      "Healthy diet",
      "Regular exercise",
      "Limit alcohol",
      "Sun protection",
    ],
  },
  respiratory: {
    conditions: ["COPD", "asthma exacerbation", "lung cancer"],
    factors: ["smoking", "asthma", "family_cancer"],
    screening: ["Lung function tests if indicated", "Regular check-ups"],
    prevention: [
      "Quit smoking",
      "Avoid pollutants",
      "Regular exercise",
      "Healthy diet",
    ],
  },
  mental_health: {
    conditions: ["depression", "anxiety disorders"],
    factors: ["low_mood", "family_history", "stress", "sedentary"],
    screening: ["Mental health assessments", "Regular mood tracking"],
    prevention: [
      "Stress management",
      "Regular exercise",
      "Social connections",
      "Healthy sleep habits",
    ],
  },
};

class RiskAssessmentService {
  /**
   * Generate comprehensive risk assessment for a user
   */
  async generateRiskAssessment(
    userId: string,
    isArabic = false
  ): Promise<HealthRiskAssessment> {
    // Gather all relevant health data
    const [user, medicalHistory, symptoms, vitals, medications, moods] =
      await Promise.all([
        this.getUserProfile(userId),
        medicalHistoryService.getUserMedicalHistory(userId),
        symptomService.getUserSymptoms(userId, 100),
        this.getRecentVitals(userId),
        medicationService.getUserMedications(userId),
        this.getRecentMoods(userId),
      ]);

    // Assess individual risk factors
    const riskFactors = await this.assessRiskFactors(
      user,
      medicalHistory,
      symptoms,
      vitals,
      medications,
      moods,
      isArabic
    );

    // Calculate condition-specific risks
    const conditionRisks = this.calculateConditionRisks(riskFactors, isArabic);

    // Calculate overall risk score
    const overallRiskScore = this.calculateOverallRiskScore(riskFactors);

    // Generate preventive recommendations
    const preventiveRecommendations = this.generatePreventiveRecommendations(
      riskFactors,
      conditionRisks,
      isArabic
    );

    // Determine timeline
    const timeline = this.determineAssessmentTimeline(
      overallRiskScore,
      riskFactors
    );

    const assessment: HealthRiskAssessment = {
      id: `risk-assessment-${userId}-${Date.now()}`,
      userId,
      overallRiskScore,
      riskLevel: this.scoreToRiskLevel(overallRiskScore),
      riskFactors,
      conditionRisks,
      preventiveRecommendations,
      timeline,
      assessmentDate: new Date(),
      nextAssessmentDate: this.calculateNextAssessmentDate(timeline),
    };

    return assessment;
  }

  /**
   * Assess individual risk factors
   */
  private assessRiskFactors(
    user: User,
    medicalHistory: MedicalHistory[],
    symptoms: Symptom[],
    vitals: VitalSign[],
    medications: Medication[],
    moods: Mood[],
    _isArabic = false
  ): RiskFactor[] {
    const riskFactors: RiskFactor[] = [];

    // Age-based risks
    const age = this.calculateAge(user);
    if (age >= 65) {
      riskFactors.push(
        this.createRiskFactor("age_65_plus", RISK_FACTORS.age_65_plus)
      );
    } else if (age >= 45) {
      riskFactors.push(
        this.createRiskFactor("age_45_64", RISK_FACTORS.age_45_64)
      );
    } else if (age >= 30) {
      riskFactors.push(
        this.createRiskFactor("age_30_44", RISK_FACTORS.age_30_44)
      );
    }

    // Family history risks
    const familyHistory = this.getFamilyMedicalHistory(user);
    const familyRisks = this.assessFamilyHistoryRisks(familyHistory);
    riskFactors.push(...familyRisks);

    // Medical history risks
    const medicalRisks = this.assessMedicalHistoryRisks(medicalHistory);
    riskFactors.push(...medicalRisks);

    // Lifestyle risks
    const lifestyleRisks = this.assessLifestyleRisks(
      user,
      symptoms,
      medications
    );
    riskFactors.push(...lifestyleRisks);

    // Current health indicators
    const healthIndicatorRisks = this.assessCurrentHealthRisks(
      symptoms,
      vitals,
      medications,
      moods
    );
    riskFactors.push(...healthIndicatorRisks);

    return riskFactors;
  }

  /**
   * Calculate condition-specific risks
   */
  private calculateConditionRisks(
    riskFactors: RiskFactor[],
    _isArabic = false
  ): ConditionRisk[] {
    const conditionRisks: ConditionRisk[] = [];

    for (const [_category, config] of Object.entries(CONDITION_SPECIFIC_RISKS)) {
      const relevantFactors = riskFactors.filter((factor) =>
        config.factors.includes(factor.id)
      );

      if (relevantFactors.length > 0) {
        const riskScore = Math.min(
          100,
          relevantFactors.reduce((sum, factor) => sum + factor.impact, 0)
        );

        conditionRisks.push({
          condition: config.conditions[0], // Primary condition
          riskScore,
          riskLevel: this.scoreToRiskLevel(riskScore),
          contributingFactors: relevantFactors.map((f) => f.name),
          preventiveMeasures: config.prevention,
          screeningRecommendations: config.screening,
        });
      }
    }

    return conditionRisks.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallRiskScore(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) {
      return 0;
    }

    // Weighted average of all risk factors
    const totalWeight = riskFactors.reduce(
      (sum, factor) => sum + factor.impact,
      0
    );
    const weightedScore = riskFactors.reduce((sum, factor) => {
      const weight =
        RISK_FACTORS[factor.id as keyof typeof RISK_FACTORS]?.weight || 10;
      return sum + factor.impact * weight;
    }, 0);

    return Math.min(100, totalWeight > 0 ? weightedScore / totalWeight : 0);
  }

  /**
   * Generate preventive recommendations
   */
  private generatePreventiveRecommendations(
    riskFactors: RiskFactor[],
    conditionRisks: ConditionRisk[],
    isArabic = false
  ): string[] {
    const recommendations: Set<string> = new Set();

    // Add recommendations from high-impact risk factors
    for (const factor of riskFactors) {
      if (factor.impact <= 20 || !factor.modifiable || !factor.recommendations) {
        continue;
      }
      for (const recommendation of factor.recommendations) {
        recommendations.add(recommendation);
      }
    }

    // Add condition-specific recommendations
    for (const risk of conditionRisks) {
      if (risk.riskScore <= 30) {
        continue;
      }
      for (const measure of risk.preventiveMeasures) {
        recommendations.add(measure);
      }
      if (!risk.screeningRecommendations) {
        continue;
      }
      for (const screening of risk.screeningRecommendations) {
        recommendations.add(screening);
      }
    }

    // Add general recommendations based on risk level
    const highRiskFactors = riskFactors.filter(
      (f) => f.riskLevel === "high" || f.riskLevel === "very_high"
    );
    if (highRiskFactors.length > 0) {
      recommendations.add(
        isArabic
          ? "استشر مقدم الرعاية الصحية حول عوامل الخطر لديك"
          : "Consult with healthcare provider about your risk factors"
      );
      recommendations.add(
        isArabic
          ? "فكر في مراقبة صحية أكثر تكراراً"
          : "Consider more frequent health monitoring"
      );
    }

    return Array.from(recommendations);
  }

  // Helper methods

  private calculateAge(user: User): number {
    const birthDate = new Date(user.firstName); // This is a placeholder - should be actual birth date
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age -= 1;
    }
    return age;
  }

  private createRiskFactor(
    id: string,
    config: {
      weight: number;
      category: RiskFactor["category"];
      modifiable: boolean;
    }
  ): RiskFactor {
    const factorConfig = RISK_FACTORS[id as keyof typeof RISK_FACTORS];
    if (!factorConfig) {
      throw new Error(`Unknown risk factor ID: ${id}`);
    }

    return {
      id,
      name: this.getRiskFactorName(id),
      category: config.category,
      riskLevel:
        config.weight > 30 ? "high" : config.weight > 20 ? "moderate" : "low",
      description: this.getRiskFactorDescription(id),
      impact: config.weight,
      evidence: this.getRiskFactorEvidence(id),
      modifiable: config.modifiable,
      recommendations: this.getRiskFactorRecommendations(id),
    };
  }

  private getRiskFactorName(id: string): string {
    const names: Record<string, string> = {
      age_65_plus: "Age 65+",
      age_45_64: "Age 45-64",
      age_30_44: "Age 30-44",
      family_heart_disease: "Family History of Heart Disease",
      family_diabetes: "Family History of Diabetes",
      family_cancer: "Family History of Cancer",
      smoking: "Smoking",
      obesity: "Obesity",
      sedentary: "Sedentary Lifestyle",
      diabetes: "Diabetes",
      hypertension: "Hypertension",
      high_cholesterol: "High Cholesterol",
      high_blood_pressure: "High Blood Pressure Reading",
      frequent_symptoms: "Frequent Symptoms",
    };
    return names[id] || id;
  }

  private getRiskFactorDescription(id: string): string {
    const descriptions: Record<string, string> = {
      age_65_plus:
        "Advanced age is a significant risk factor for many health conditions",
      family_heart_disease:
        "Family history increases genetic predisposition to heart disease",
      smoking:
        "Smoking significantly increases risk of heart disease, cancer, and respiratory conditions",
      hypertension:
        "High blood pressure increases risk of heart disease and stroke",
      diabetes:
        "Diabetes affects multiple organ systems and increases cardiovascular risk",
    };
    return descriptions[id] || "Contributes to overall health risk";
  }

  private getRiskFactorEvidence(id: string): string {
    const evidence: Record<string, string> = {
      age_65_plus:
        "Based on epidemiological studies showing age-related risk increase",
      smoking:
        "Supported by extensive research linking smoking to multiple health conditions",
      hypertension: "Established through clinical studies and guidelines",
    };
    return evidence[id] || "Based on medical research and clinical guidelines";
  }

  private getRiskFactorRecommendations(id: string): string[] | undefined {
    const recommendations: Record<string, string[]> = {
      smoking: [
        "Quit smoking",
        "Seek smoking cessation support",
        "Avoid secondhand smoke",
      ],
      obesity: [
        "Weight management through diet and exercise",
        "Consult nutritionist",
      ],
      sedentary: [
        "Aim for 150 minutes of moderate exercise weekly",
        "Incorporate daily activity",
      ],
      hypertension: [
        "Regular blood pressure monitoring",
        "Dietary changes (DASH diet)",
        "Medication adherence",
      ],
      high_cholesterol: [
        "Heart-healthy diet",
        "Regular exercise",
        "Medication if prescribed",
      ],
    };
    return recommendations[id];
  }

  private getFamilyMedicalHistory(_user: User): MedicalHistory[] {
    // This would need to be implemented to get family member medical history
    // For now, return empty array
    return [];
  }

  private assessFamilyHistoryRisks(
    familyHistory: MedicalHistory[]
  ): RiskFactor[] {
    const risks: RiskFactor[] = [];
    const familyConditions = familyHistory.map((h) =>
      h.condition.toLowerCase()
    );

    if (
      familyConditions.some((c) => c.includes("heart") || c.includes("cardiac"))
    ) {
      risks.push(
        this.createRiskFactor(
          "family_heart_disease",
          RISK_FACTORS.family_heart_disease
        )
      );
    }
    if (familyConditions.some((c) => c.includes("diabetes"))) {
      risks.push(
        this.createRiskFactor("family_diabetes", RISK_FACTORS.family_diabetes)
      );
    }
    if (familyConditions.some((c) => c.includes("cancer"))) {
      risks.push(
        this.createRiskFactor("family_cancer", RISK_FACTORS.family_cancer)
      );
    }
    if (familyConditions.some((c) => c.includes("hypertension"))) {
      risks.push(
        this.createRiskFactor(
          "family_hypertension",
          RISK_FACTORS.family_hypertension
        )
      );
    }

    return risks;
  }

  private assessMedicalHistoryRisks(
    medicalHistory: MedicalHistory[]
  ): RiskFactor[] {
    const risks: RiskFactor[] = [];
    const conditions = medicalHistory.map((h) => h.condition.toLowerCase());

    if (conditions.some((c) => c.includes("diabetes"))) {
      risks.push(this.createRiskFactor("diabetes", RISK_FACTORS.diabetes));
    }
    if (conditions.some((c) => c.includes("hypertension"))) {
      risks.push(
        this.createRiskFactor("hypertension", RISK_FACTORS.hypertension)
      );
    }
    if (conditions.some((c) => c.includes("cholesterol"))) {
      risks.push(
        this.createRiskFactor("high_cholesterol", RISK_FACTORS.high_cholesterol)
      );
    }
    if (conditions.some((c) => c.includes("heart"))) {
      risks.push(
        this.createRiskFactor("heart_disease", RISK_FACTORS.heart_disease)
      );
    }
    if (conditions.some((c) => c.includes("asthma"))) {
      risks.push(this.createRiskFactor("asthma", RISK_FACTORS.asthma));
    }

    return risks;
  }

  private assessLifestyleRisks(
    _user: User,
    symptoms: Symptom[],
    medications: Medication[]
  ): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Check for smoking-related medications or symptoms
    if (medications.some((m) => m.name.toLowerCase().includes("smoking"))) {
      risks.push(this.createRiskFactor("smoking", RISK_FACTORS.smoking));
    }

    // Check for obesity indicators
    // This would need BMI calculation or weight data

    // Check for sedentary indicators
    const recentSymptoms = symptoms.filter(
      (s) => Date.now() - s.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000
    );
    if (recentSymptoms.length < 5) {
      // Low symptom reporting might indicate sedentary lifestyle
      risks.push(this.createRiskFactor("sedentary", RISK_FACTORS.sedentary));
    }

    return risks;
  }

  private assessCurrentHealthRisks(
    symptoms: Symptom[],
    vitals: VitalSign[],
    _medications: Medication[],
    moods: Mood[]
  ): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Check for high blood pressure readings
    const bpReadings = vitals.filter((v) => v.type === "bloodPressure");
    const highBPReadings = bpReadings.filter((v) => {
      const [systolic] = v.value.toString().split("/").map(Number);
      return systolic >= 140;
    });
    if (highBPReadings.length > bpReadings.length * 0.5) {
      risks.push(
        this.createRiskFactor(
          "high_blood_pressure",
          RISK_FACTORS.high_blood_pressure
        )
      );
    }

    // Check for frequent symptoms
    const recentSymptoms = symptoms.filter(
      (s) => Date.now() - s.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    );
    if (recentSymptoms.length > 10) {
      risks.push(
        this.createRiskFactor(
          "frequent_symptoms",
          RISK_FACTORS.frequent_symptoms
        )
      );
    }

    // Check for low mood
    const recentMoods = moods.filter(
      (m) => Date.now() - m.timestamp.getTime() < 14 * 24 * 60 * 60 * 1000
    );
    const lowMoods = recentMoods.filter((m) => m.intensity < 3);
    if (lowMoods.length > recentMoods.length * 0.6) {
      risks.push(this.createRiskFactor("low_mood", RISK_FACTORS.low_mood));
    }

    return risks;
  }

  private scoreToRiskLevel(
    score: number
  ): "low" | "moderate" | "high" | "very_high" {
    if (score >= 75) {
      return "very_high";
    }
    if (score >= 50) {
      return "high";
    }
    if (score >= 25) {
      return "moderate";
    }
    return "low";
  }

  private determineAssessmentTimeline(
    riskScore: number,
    riskFactors: RiskFactor[]
  ): "immediate" | "short_term" | "long_term" {
    const highRiskFactors = riskFactors.filter(
      (f) => f.riskLevel === "high" || f.riskLevel === "very_high"
    );
    const criticalSymptoms = riskFactors.some(
      (f) => f.id === "high_blood_pressure" || f.id === "frequent_symptoms"
    );

    if (riskScore >= 75 || criticalSymptoms || highRiskFactors.length >= 3) {
      return "immediate";
    }
    if (riskScore >= 50 || highRiskFactors.length >= 1) {
      return "short_term";
    }
    return "long_term";
  }

  private calculateNextAssessmentDate(timeline: string): Date {
    const now = new Date();
    switch (timeline) {
      case "immediate":
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week
      case "short_term":
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 1 month
      case "long_term":
        return new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 6 months
      default:
        return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 3 months
    }
  }

  // Data access methods (simplified - would need proper implementation)
  private getUserProfile(userId: string): User {
    // This should fetch user profile from database
    // For now, return a mock user
    return {
      id: userId,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      createdAt: new Date(),
      role: "admin",
      onboardingCompleted: true,
      preferences: {
        language: "en",
        notifications: true,
        emergencyContacts: [],
      },
    };
  }

  private getRecentVitals(_userId: string): VitalSign[] {
    // This should fetch recent vitals from database
    return [];
  }

  private getRecentMoods(_userId: string): Mood[] {
    // This should fetch recent moods from database
    return [];
  }
}

export const riskAssessmentService = new RiskAssessmentService();
