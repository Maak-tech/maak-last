import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export interface PredictiveForecast {
  score7d: number | null;       // predicted VHI score in 7 days
  score30d: number | null;      // predicted VHI score in 30 days
  trend: "improving" | "stable" | "declining";
  confidence: number;           // 0–100
  topRiskFactors: string[];
}

interface UsePredictiveScoreResult {
  forecast: PredictiveForecast | null;
  loading: boolean;
  error: Error | null;
}

export function usePredictiveScore(userId: string | undefined): UsePredictiveScoreResult {
  const [forecast, setForecast] = useState<PredictiveForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<PredictiveForecast>(`/api/health/predictive-score?userId=${userId}`)
      .then((data) => {
        if (!cancelled) setForecast(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  return { forecast, loading, error };
}
