import type { Symptom } from "@/types";
import type { PatternInsight } from "./healthPatternDetectionService";
import { api } from "@/lib/apiClient";

export interface SymptomPattern {
  name: string;
  description: string;
  severity: "mild" | "moderate" | "severe";
  confidence: number;
  symptoms: Symptom[];
}

export interface SymptomPatternAnalysis {
  patterns: SymptomPattern[];
}

export const symptomPatternRecognitionService = {
  async detectPatterns(userId: string): Promise<PatternInsight[]> {
    try {
      const data = await api.get<PatternInsight[]>(
        `/api/health/symptom-patterns?userId=${userId}`
      );
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[symptomPatternRecognition] detectPatterns failed:', err);
      return [];
    }
  },

  async analyzeSymptomPatterns(
    userId: string,
    symptoms: Symptom[],
    _from?: Date,
    _to?: Date,
    _isArabic?: boolean
  ): Promise<SymptomPatternAnalysis> {
    try {
      const data = await api.post<SymptomPatternAnalysis>(
        `/api/health/symptom-patterns/analyze`,
        { userId, symptoms }
      );
      return data ?? { patterns: [] };
    } catch (err) {
      console.warn('[symptomPatternRecognition] analyzeSymptomPatterns failed:', err);
      return { patterns: [] };
    }
  },
};
