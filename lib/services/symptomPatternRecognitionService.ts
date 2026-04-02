import type { PatternInsight } from "./healthPatternDetectionService";
import { api } from "@/lib/apiClient";

export const symptomPatternRecognitionService = {
  async detectPatterns(userId: string): Promise<PatternInsight[]> {
    try {
      const data = await api.get<PatternInsight[]>(
        `/api/health/symptom-patterns?userId=${userId}`
      );
      return data ?? [];
    } catch {
      return [];
    }
  },
};
