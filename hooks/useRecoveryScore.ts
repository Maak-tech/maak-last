import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export interface RecoveryScore {
  score: number;          // 0–100
  level: "poor" | "fair" | "good" | "excellent";
  drivers: string[];
  computedAt: string;
}

interface UseRecoveryScoreResult {
  recoveryScore: RecoveryScore | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useRecoveryScore(userId: string | undefined): UseRecoveryScoreResult {
  const [recoveryScore, setRecoveryScore] = useState<RecoveryScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<RecoveryScore>(`/api/health/recovery-score?userId=${userId}`)
      .then((data) => {
        if (!cancelled) setRecoveryScore(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, tick]);

  return { recoveryScore, loading, error, refresh: () => setTick((t) => t + 1) };
}
