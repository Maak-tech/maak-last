import type { MedicalHistory, Medication, Symptom } from "@/types";
import openaiService from "./openaiService";
import { symptomService } from "./symptomService";

export interface SymptomPattern {
  id: string;
  name: string;
  symptoms: string[];
  confidence: number; // 0-100
  severity: "mild" | "moderate" | "severe";
  duration: "acute" | "chronic" | "recurring";
  triggers?: string[];
  description: string;
}

export interface DiagnosisSuggestion {
  id: string;
  condition: string;
  confidence: number; // 0-100
  reasoning: string;
  symptoms: string[];
  riskFactors?: string[];
  recommendations: string[];
  urgency: "low" | "medium" | "high" | "emergency";
  disclaimer: string;
}

export interface PatternAnalysisResult {
  patterns: SymptomPattern[];
  diagnosisSuggestions: DiagnosisSuggestion[];
  riskAssessment: {
    overallRisk: "low" | "medium" | "high";
    concerns: string[];
    recommendations: string[];
  };
  analysisTimestamp: Date;
}

// Symptom pattern definitions based on common medical patterns
const SYMPTOM_PATTERNS: Record<string, SymptomPattern> = {
  // Respiratory patterns
  common_cold: {
    id: "common_cold",
    name: "Common Cold",
    symptoms: [
      "sore throat",
      "runny nose",
      "cough",
      "congestion",
      "sneezing",
      "fatigue",
    ],
    confidence: 0,
    severity: "mild",
    duration: "acute",
    triggers: ["seasonal", "viral exposure"],
    description: "Typical viral upper respiratory infection",
  },
  flu_like: {
    id: "flu_like",
    name: "Flu-like Illness",
    symptoms: ["fever", "body aches", "fatigue", "headache", "cough", "chills"],
    confidence: 0,
    severity: "moderate",
    duration: "acute",
    triggers: ["viral infection", "seasonal"],
    description: "Influenza or influenza-like viral infection",
  },
  asthma_exacerbation: {
    id: "asthma_exacerbation",
    name: "Asthma Exacerbation",
    symptoms: [
      "shortness of breath",
      "wheezing",
      "chest tightness",
      "cough",
      "difficulty breathing",
    ],
    confidence: 0,
    severity: "moderate",
    duration: "acute",
    triggers: ["allergens", "exercise", "cold air", "stress"],
    description: "Worsening of asthma symptoms requiring attention",
  },

  // Gastrointestinal patterns
  gastrointestinal_virus: {
    id: "gastrointestinal_virus",
    name: "Gastrointestinal Viral Infection",
    symptoms: [
      "nausea",
      "vomiting",
      "diarrhea",
      "abdominal pain",
      "fever",
      "fatigue",
    ],
    confidence: 0,
    severity: "moderate",
    duration: "acute",
    triggers: ["contaminated food/water", "viral exposure"],
    description: "Viral gastroenteritis (stomach flu)",
  },
  acid_reflux: {
    id: "acid_reflux",
    name: "Acid Reflux/GERD",
    symptoms: [
      "heartburn",
      "chest pain",
      "difficulty swallowing",
      "regurgitation",
      "cough",
    ],
    confidence: 0,
    severity: "mild",
    duration: "chronic",
    triggers: ["spicy foods", "large meals", "lying down", "stress"],
    description: "Gastroesophageal reflux disease",
  },

  // Cardiovascular patterns
  hypertension_symptoms: {
    id: "hypertension_symptoms",
    name: "Hypertension Symptoms",
    symptoms: [
      "headache",
      "dizziness",
      "blurred vision",
      "chest pain",
      "shortness of breath",
    ],
    confidence: 0,
    severity: "moderate",
    duration: "chronic",
    triggers: ["stress", "high salt intake", "lack of exercise"],
    description: "Symptoms associated with high blood pressure",
  },

  // Neurological patterns
  migraine: {
    id: "migraine",
    name: "Migraine",
    symptoms: [
      "severe headache",
      "nausea",
      "sensitivity to light",
      "sensitivity to sound",
      "aura",
    ],
    confidence: 0,
    severity: "moderate",
    duration: "recurring",
    triggers: ["stress", "certain foods", "hormonal changes", "lack of sleep"],
    description: "Migraine headache episode",
  },
  tension_headache: {
    id: "tension_headache",
    name: "Tension Headache",
    symptoms: [
      "headache",
      "neck pain",
      "shoulder tension",
      "fatigue",
      "stress",
    ],
    confidence: 0,
    severity: "mild",
    duration: "acute",
    triggers: ["stress", "poor posture", "lack of sleep"],
    description: "Muscle tension-related headache",
  },

  // Endocrine patterns
  hypoglycemia: {
    id: "hypoglycemia",
    name: "Hypoglycemia",
    symptoms: [
      "shaking",
      "sweating",
      "anxiety",
      "confusion",
      "rapid heartbeat",
      "hunger",
    ],
    confidence: 0,
    severity: "moderate",
    duration: "acute",
    triggers: ["skipping meals", "excessive exercise", "diabetes medication"],
    description: "Low blood sugar episode",
  },

  // Musculoskeletal patterns
  muscle_strain: {
    id: "muscle_strain",
    name: "Muscle Strain",
    symptoms: [
      "muscle pain",
      "stiffness",
      "swelling",
      "limited mobility",
      "bruising",
    ],
    confidence: 0,
    severity: "mild",
    duration: "acute",
    triggers: ["exercise", "overuse", "injury"],
    description: "Muscle strain or sprain",
  },

  // Mental health patterns
  anxiety_episode: {
    id: "anxiety_episode",
    name: "Anxiety Episode",
    symptoms: [
      "anxiety",
      "rapid heartbeat",
      "sweating",
      "trembling",
      "shortness of breath",
      "panic",
    ],
    confidence: 0,
    severity: "moderate",
    duration: "acute",
    triggers: ["stress", "caffeine", "lack of sleep"],
    description: "Acute anxiety or panic attack",
  },
  depression_symptoms: {
    id: "depression_symptoms",
    name: "Depressive Symptoms",
    symptoms: [
      "sadness",
      "fatigue",
      "loss of interest",
      "sleep changes",
      "appetite changes",
      "concentration problems",
    ],
    confidence: 0,
    severity: "moderate",
    duration: "chronic",
    triggers: ["stress", "life changes", "seasonal"],
    description: "Symptoms consistent with depression",
  },
};

// Diagnosis suggestions based on symptom patterns
const DIAGNOSIS_RULES: Array<{
  condition: string;
  requiredSymptoms: string[];
  optionalSymptoms: string[];
  riskFactors?: string[];
  urgency: "low" | "medium" | "high" | "emergency";
  recommendations: string[];
}> = [
  {
    condition: "Influenza (Flu)",
    requiredSymptoms: ["fever", "body aches"],
    optionalSymptoms: ["cough", "fatigue", "headache", "chills", "sore throat"],
    riskFactors: ["elderly", "chronic conditions", "weakened immune system"],
    urgency: "medium",
    recommendations: [
      "Rest and hydrate",
      "Consider antiviral medication if caught early",
      "Monitor for complications",
      "Isolate to prevent spread",
    ],
  },
  {
    condition: "Migraine Headache",
    requiredSymptoms: ["severe headache"],
    optionalSymptoms: [
      "nausea",
      "sensitivity to light",
      "sensitivity to sound",
      "aura",
    ],
    riskFactors: [
      "family history",
      "female gender",
      "stress",
      "hormonal changes",
    ],
    urgency: "low",
    recommendations: [
      "Rest in dark, quiet room",
      "Try prescribed migraine medication",
      "Apply cold compress",
      "Track triggers for prevention",
    ],
  },
  {
    condition: "Acute Bronchitis",
    requiredSymptoms: ["cough"],
    optionalSymptoms: [
      "chest congestion",
      "fever",
      "fatigue",
      "shortness of breath",
    ],
    riskFactors: ["smoking", "recent cold", "weakened immune system"],
    urgency: "medium",
    recommendations: [
      "Rest and stay hydrated",
      "Use humidifier",
      "Consider cough syrup if needed",
      "See doctor if symptoms worsen or persist",
    ],
  },
  {
    condition: "Urinary Tract Infection",
    requiredSymptoms: ["frequent urination", "burning urination"],
    optionalSymptoms: ["lower abdominal pain", "blood in urine", "fever"],
    riskFactors: ["female gender", "sexual activity", "diabetes", "menopause"],
    urgency: "medium",
    recommendations: [
      "Increase water intake",
      "Urinate after sexual activity",
      "See healthcare provider for antibiotics",
      "Avoid irritants (caffeine, alcohol)",
    ],
  },
  {
    condition: "Gastroesophageal Reflux Disease (GERD)",
    requiredSymptoms: ["heartburn"],
    optionalSymptoms: [
      "chest pain",
      "difficulty swallowing",
      "regurgitation",
      "chronic cough",
    ],
    riskFactors: ["obesity", "pregnancy", "hiatal hernia", "smoking"],
    urgency: "low",
    recommendations: [
      "Avoid trigger foods (spicy, fatty, acidic)",
      "Eat smaller meals",
      "Don't lie down for 2-3 hours after eating",
      "Elevate head of bed",
    ],
  },
  {
    condition: "Tension Headache",
    requiredSymptoms: ["headache"],
    optionalSymptoms: ["neck pain", "shoulder tension", "stress", "fatigue"],
    riskFactors: ["stress", "poor posture", "lack of sleep", "eye strain"],
    urgency: "low",
    recommendations: [
      "Practice relaxation techniques",
      "Improve posture",
      "Take breaks from screen time",
      "Try over-the-counter pain relief",
    ],
  },
  {
    condition: "Allergic Reaction",
    requiredSymptoms: ["rash", "itching"],
    optionalSymptoms: [
      "swelling",
      "difficulty breathing",
      "runny nose",
      "sneezing",
    ],
    riskFactors: ["known allergies", "seasonal exposure", "food allergies"],
    urgency: "high",
    recommendations: [
      "Identify and avoid allergen",
      "Use antihistamines",
      "Seek immediate medical attention if severe",
      "Consider carrying emergency medication",
    ],
  },
  {
    condition: "Anxiety/Panic Attack",
    requiredSymptoms: ["anxiety", "rapid heartbeat"],
    optionalSymptoms: [
      "shortness of breath",
      "sweating",
      "trembling",
      "chest pain",
    ],
    riskFactors: ["stress", "family history", "caffeine", "lack of sleep"],
    urgency: "medium",
    recommendations: [
      "Practice deep breathing exercises",
      "Use relaxation techniques",
      "Consider speaking with mental health professional",
      "Limit caffeine and stimulants",
    ],
  },
];

class SymptomPatternRecognitionService {
  /**
   * Analyze symptom patterns and provide diagnosis suggestions
   */
  async analyzeSymptomPatterns(
    userId: string,
    recentSymptoms: Symptom[],
    medicalHistory?: MedicalHistory[],
    medications?: Medication[]
  ): Promise<PatternAnalysisResult> {
    // Identify symptom patterns
    const patterns = this.identifySymptomPatterns(recentSymptoms);

    // Generate diagnosis suggestions
    const diagnosisSuggestions = await this.generateDiagnosisSuggestions(
      recentSymptoms,
      medicalHistory || [],
      medications || [],
      patterns
    );

    // Assess overall risk
    const riskAssessment = this.assessOverallRisk(
      recentSymptoms,
      diagnosisSuggestions,
      medicalHistory || []
    );

    return {
      patterns,
      diagnosisSuggestions,
      riskAssessment,
      analysisTimestamp: new Date(),
    };
  }

  /**
   * Identify symptom patterns in the data
   */
  private identifySymptomPatterns(symptoms: Symptom[]): SymptomPattern[] {
    const patterns: SymptomPattern[] = [];
    const symptomCounts: Record<string, number> = {};

    // Count symptom occurrences
    symptoms.forEach((symptom) => {
      symptomCounts[symptom.type] = (symptomCounts[symptom.type] || 0) + 1;
    });

    // Calculate pattern confidence based on symptom matches
    Object.values(SYMPTOM_PATTERNS).forEach((patternTemplate) => {
      const matchedSymptoms = patternTemplate.symptoms.filter(
        (symptom) => symptomCounts[symptom] && symptomCounts[symptom] > 0
      );

      if (matchedSymptoms.length >= 2) {
        // Require at least 2 matching symptoms
        const confidence = Math.min(
          100,
          (matchedSymptoms.length / patternTemplate.symptoms.length) * 100 +
            (symptoms.length / 20) * 20 // Bonus for more data points
        );

        patterns.push({
          ...patternTemplate,
          confidence,
        });
      }
    });

    // Sort by confidence
    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate diagnosis suggestions based on symptom patterns
   */
  private async generateDiagnosisSuggestions(
    symptoms: Symptom[],
    medicalHistory: MedicalHistory[],
    medications: Medication[],
    patterns: SymptomPattern[]
  ): Promise<DiagnosisSuggestion[]> {
    const suggestions: DiagnosisSuggestion[] = [];
    const symptomTypes = symptoms.map((s) => s.type.toLowerCase());
    const uniqueSymptoms = [...new Set(symptomTypes)];

    // Check against diagnosis rules
    DIAGNOSIS_RULES.forEach((rule) => {
      const hasRequiredSymptoms = rule.requiredSymptoms.every((symptom) =>
        uniqueSymptoms.includes(symptom.toLowerCase())
      );

      if (hasRequiredSymptoms) {
        const optionalMatches = rule.optionalSymptoms.filter((symptom) =>
          uniqueSymptoms.includes(symptom.toLowerCase())
        );

        // Calculate confidence based on symptom matches and medical context
        let confidence =
          rule.requiredSymptoms.length * 30 + optionalMatches.length * 15;

        // Adjust confidence based on medical history
        if (
          medicalHistory.some((h) =>
            h.condition
              .toLowerCase()
              .includes(rule.condition.toLowerCase().split(" ")[0])
          )
        ) {
          confidence += 20; // History of similar condition
        }

        // Adjust confidence based on medications
        if (
          rule.condition.toLowerCase().includes("hypertension") &&
          medications.some((m) =>
            m.name.toLowerCase().includes("blood pressure")
          )
        ) {
          confidence += 15;
        }

        confidence = Math.min(95, confidence); // Cap at 95%

        const reasoning = this.generateDiagnosisReasoning(
          rule,
          uniqueSymptoms,
          optionalMatches,
          medicalHistory
        );

        suggestions.push({
          id: `diagnosis-${rule.condition.toLowerCase().replace(/\s+/g, "-")}`,
          condition: rule.condition,
          confidence,
          reasoning,
          symptoms: [...rule.requiredSymptoms, ...optionalMatches],
          riskFactors: rule.riskFactors,
          recommendations: rule.recommendations,
          urgency: rule.urgency,
          disclaimer:
            "This is not a medical diagnosis. Please consult with a healthcare professional for proper evaluation and treatment.",
        });
      }
    });

    // Use AI for additional insights if confidence is low
    if (
      suggestions.length === 0 ||
      suggestions.every((s) => s.confidence < 60)
    ) {
      const aiSuggestions = await this.generateAISuggestions(
        symptoms,
        medicalHistory,
        medications
      );
      suggestions.push(...aiSuggestions);
    }

    // Sort by confidence and urgency
    return suggestions
      .sort((a, b) => {
        const urgencyWeight = { emergency: 4, high: 3, medium: 2, low: 1 };
        const urgencyDiff = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
        return urgencyDiff !== 0 ? urgencyDiff : b.confidence - a.confidence;
      })
      .slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Generate reasoning for diagnosis suggestions
   */
  private generateDiagnosisReasoning(
    rule: any,
    userSymptoms: string[],
    optionalMatches: string[],
    medicalHistory: MedicalHistory[]
  ): string {
    let reasoning = `Based on presence of ${rule.requiredSymptoms.join(", ")}`;

    if (optionalMatches.length > 0) {
      reasoning += ` along with ${optionalMatches.join(", ")}`;
    }

    if (
      medicalHistory.some((h) =>
        h.condition
          .toLowerCase()
          .includes(rule.condition.toLowerCase().split(" ")[0])
      )
    ) {
      reasoning += ". Medical history supports this pattern";
    }

    reasoning +=
      ". This pattern matches common presentations of this condition.";

    return reasoning;
  }

  /**
   * Use AI to generate additional diagnosis suggestions
   */
  private async generateAISuggestions(
    symptoms: Symptom[],
    medicalHistory: MedicalHistory[],
    medications: Medication[]
  ): Promise<DiagnosisSuggestion[]> {
    try {
      // Prepare context for AI analysis
      const symptomSummary = this.summarizeSymptoms(symptoms);
      const historySummary = medicalHistory.map((h) => h.condition).join(", ");
      const medicationSummary = medications.map((m) => m.name).join(", ");

      const prompt = `
        Based on the following health data, suggest up to 3 possible conditions that could explain these symptoms.
        Be conservative and emphasize that this is not medical advice.

        Symptoms: ${symptomSummary}
        Medical History: ${historySummary || "None provided"}
        Current Medications: ${medicationSummary || "None provided"}

        Format your response as JSON with this structure:
        [
          {
            "condition": "Condition Name",
            "confidence": 0-100,
            "reasoning": "Brief explanation",
            "urgency": "low|medium|high|emergency",
            "recommendations": ["recommendation1", "recommendation2"]
          }
        ]
      `;

      const aiResponse = await openaiService.generateHealthInsights(prompt);
      if (!aiResponse) return [];

      if (aiResponse && aiResponse.suggestions) {
        return aiResponse.suggestions.map((suggestion: any) => ({
          id: `ai-diagnosis-${Date.now()}-${Math.random()}`,
          condition: suggestion.condition,
          confidence: Math.min(60, suggestion.confidence || 50), // Cap AI suggestions lower
          reasoning: suggestion.reasoning,
          symptoms: symptoms.map((s) => s.type),
          recommendations: suggestion.recommendations || [],
          urgency: suggestion.urgency || "low",
          disclaimer:
            "AI-generated suggestion. This is not a medical diagnosis. Please consult with a healthcare professional.",
        }));
      }
    } catch (error) {
      // Missing API key or network errors should not spam logs; fallback is fine.
      if (__DEV__) console.warn("AI diagnosis generation failed", error);
    }

    return [];
  }

  /**
   * Assess overall health risk based on symptoms and suggestions
   */
  private assessOverallRisk(
    symptoms: Symptom[],
    diagnosisSuggestions: DiagnosisSuggestion[],
    medicalHistory: MedicalHistory[]
  ): PatternAnalysisResult["riskAssessment"] {
    let overallRisk: "low" | "medium" | "high" = "low";
    const concerns: string[] = [];
    const recommendations: string[] = [];

    // Check for high-severity symptoms
    const highSeveritySymptoms = symptoms.filter((s) => s.severity >= 4);
    if (highSeveritySymptoms.length > 0) {
      overallRisk = "medium";
      concerns.push(
        `${highSeveritySymptoms.length} high-severity symptom(s) reported`
      );
      recommendations.push(
        "Monitor symptoms closely and consider consulting healthcare provider"
      );
    }

    // Check for emergency symptoms
    const emergencySymptoms = symptoms.filter((s) =>
      [
        "chest pain",
        "difficulty breathing",
        "severe headache",
        "confusion",
        "fainting",
      ].includes(s.type)
    );
    if (emergencySymptoms.length > 0) {
      overallRisk = "high";
      concerns.push("Emergency symptoms detected");
      recommendations.push("Seek immediate medical attention");
    }

    // Check diagnosis suggestions
    const highUrgencySuggestions = diagnosisSuggestions.filter(
      (s) => s.urgency === "high" || s.urgency === "emergency"
    );
    if (highUrgencySuggestions.length > 0) {
      overallRisk = overallRisk === "high" ? "high" : "medium";
      concerns.push("Potential serious conditions suggested");
      recommendations.push("Consult healthcare provider for evaluation");
    }

    // Check for chronic conditions in history
    const chronicConditions = medicalHistory.filter(
      (h) =>
        h.condition.toLowerCase().includes("diabetes") ||
        h.condition.toLowerCase().includes("hypertension") ||
        h.condition.toLowerCase().includes("heart") ||
        h.condition.toLowerCase().includes("cancer")
    );
    if (chronicConditions.length > 0) {
      recommendations.push(
        "Consider how current symptoms relate to existing chronic conditions"
      );
    }

    // Duration-based assessment
    const recentSymptoms = symptoms.filter(
      (s) =>
        new Date().getTime() - s.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );
    if (recentSymptoms.length > 10) {
      overallRisk = overallRisk === "low" ? "medium" : overallRisk;
      concerns.push("High frequency of symptoms in recent days");
      recommendations.push(
        "Track symptom patterns and discuss with healthcare provider"
      );
    }

    return {
      overallRisk,
      concerns,
      recommendations,
    };
  }

  /**
   * Summarize symptoms for AI analysis
   */
  private summarizeSymptoms(symptoms: Symptom[]): string {
    const symptomCounts: Record<
      string,
      { count: number; avgSeverity: number; recent: number }
    > = {};

    symptoms.forEach((symptom) => {
      if (!symptomCounts[symptom.type]) {
        symptomCounts[symptom.type] = { count: 0, avgSeverity: 0, recent: 0 };
      }
      symptomCounts[symptom.type].count++;
      symptomCounts[symptom.type].avgSeverity += symptom.severity;

      // Count recent occurrences (last 7 days)
      if (
        new Date().getTime() - symptom.timestamp.getTime() <
        7 * 24 * 60 * 60 * 1000
      ) {
        symptomCounts[symptom.type].recent++;
      }
    });

    const summary = Object.entries(symptomCounts)
      .map(([type, data]) => {
        const avgSeverity = (data.avgSeverity / data.count).toFixed(1);
        return `${type} (${data.count} times, avg severity ${avgSeverity}, ${data.recent} recent)`;
      })
      .join(", ");

    return summary;
  }

  /**
   * Get pattern-based recommendations
   */
  async getPatternRecommendations(
    userId: string,
    daysBack = 30
  ): Promise<string[]> {
    try {
      const symptoms = await symptomService.getUserSymptoms(userId, 200);
      const recentSymptoms = symptoms.filter(
        (s) =>
          new Date().getTime() - s.timestamp.getTime() <
          daysBack * 24 * 60 * 60 * 1000
      );

      const analysis = await this.analyzeSymptomPatterns(
        userId,
        recentSymptoms
      );

      const recommendations: string[] = [];

      // Add recommendations from diagnosis suggestions
      analysis.diagnosisSuggestions.slice(0, 3).forEach((suggestion) => {
        recommendations.push(...suggestion.recommendations);
      });

      // Add risk-based recommendations
      recommendations.push(...analysis.riskAssessment.recommendations);

      // Add pattern-based recommendations
      analysis.patterns.slice(0, 2).forEach((pattern) => {
        if (pattern.triggers) {
          recommendations.push(
            `Consider avoiding or managing triggers: ${pattern.triggers.join(", ")}`
          );
        }
      });

      return [...new Set(recommendations)]; // Remove duplicates
    } catch (error) {
      return [];
    }
  }
}

export const symptomPatternRecognitionService =
  new SymptomPatternRecognitionService();
