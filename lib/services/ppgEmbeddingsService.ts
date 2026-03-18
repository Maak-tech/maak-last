/**
 * PPG Embeddings Service
 *
 * Persists PaPaGei ML embeddings returned by the analyzePPGWithML API
 * into the backend so they can be used for:
 *  - Longitudinal cardiac fingerprinting
 *  - Cosine-similarity anomaly detection (future)
 *  - Embedding drift analysis to surface unusual cardiac patterns
 *
 * REST endpoint: /api/health/ppg-embeddings
 */

import { api } from "@/lib/apiClient";

export type PPGEmbeddingRecord = {
  id: string;
  embeddings: number[];
  heartRate?: number;
  hrv?: number;
  respiratoryRate?: number;
  signalQuality: number;
  confidence?: number;
  capturedAt: Date;
};

export type EmbeddingSimilarityResult = {
  /** cosine similarity to the latest embedding baseline (0-1) */
  similarity: number;
  /** whether the similarity is below the anomaly threshold */
  isAnomaly: boolean;
  /** how many embeddings are in the baseline */
  baselineCount: number;
};

const ANOMALY_THRESHOLD = 0.82; // cosine similarity < 0.82 → unusual pattern

/** Dot product */
function dot(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}

/** L2 norm */
function norm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

/** Cosine similarity in [0, 1] */
function cosineSimilarity(a: number[], b: number[]): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return Math.max(0, Math.min(1, dot(a, b) / (na * nb)));
}

/** Average of multiple vectors (centroid) */
function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const len = vectors[0].length;
  const result = new Array<number>(len).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < len; i++) {
      result[i] += (v[i] ?? 0) / vectors.length;
    }
  }
  return result;
}

export const ppgEmbeddingsService = {
  /**
   * Persist a new PPG embedding record for a user.
   * Fire-and-forget: errors are swallowed so PPG capture is never blocked.
   */
  async persist(
    userId: string,
    embeddings: number[],
    meta: {
      heartRate?: number;
      hrv?: number;
      respiratoryRate?: number;
      signalQuality: number;
      confidence?: number;
    }
  ): Promise<void> {
    await api
      .post("/api/health/ppg-embeddings", {
        userId,
        embeddings,
        heartRate: meta.heartRate ?? null,
        hrv: meta.hrv ?? null,
        respiratoryRate: meta.respiratoryRate ?? null,
        signalQuality: meta.signalQuality,
        confidence: meta.confidence ?? null,
        capturedAt: new Date().toISOString(),
      })
      .catch(() => {
        // Silently fail — embedding persistence is best-effort
      });
  },

  /**
   * Fetch the most recent N embeddings for a user.
   */
  async getRecentEmbeddings(
    userId: string,
    limitCount = 10
  ): Promise<PPGEmbeddingRecord[]> {
    const raw = await api
      .get<Record<string, unknown>[]>(
        "/api/health/ppg-embeddings?limit=" + limitCount
      )
      .catch(() => [] as Record<string, unknown>[]);

    return (raw ?? []).map((d) => ({
      id: d.id as string,
      embeddings: (d.embeddings as number[]) ?? [],
      heartRate: d.heartRate as number | undefined,
      hrv: d.hrv as number | undefined,
      respiratoryRate: d.respiratoryRate as number | undefined,
      signalQuality: d.signalQuality as number,
      confidence: d.confidence as number | undefined,
      capturedAt: d.capturedAt ? new Date(d.capturedAt as string) : new Date(),
    }));
  },

  /**
   * Compare a new embedding against the user's baseline (centroid of last 5).
   * Returns a similarity score and anomaly flag.
   */
  async compareToBaseline(
    userId: string,
    newEmbedding: number[]
  ): Promise<EmbeddingSimilarityResult | null> {
    try {
      const recent = await this.getRecentEmbeddings(userId, 5);
      if (recent.length < 2) {
        // Not enough data to establish baseline
        return null;
      }
      const baselineVectors = recent
        .slice(1) // exclude the very latest (just captured)
        .map((r) => r.embeddings)
        .filter((v) => v.length > 0);

      if (baselineVectors.length === 0) return null;

      const baseline = centroid(baselineVectors);
      const similarity = cosineSimilarity(newEmbedding, baseline);
      return {
        similarity,
        isAnomaly: similarity < ANOMALY_THRESHOLD,
        baselineCount: baselineVectors.length,
      };
    } catch {
      return null;
    }
  },
};
