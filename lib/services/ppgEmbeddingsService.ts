/**
 * PPG Embeddings Service
 *
 * Persists PaPaGei ML embeddings returned by the analyzePPGWithML Cloud
 * Function into Firestore so they can be used for:
 *  - Longitudinal cardiac fingerprinting
 *  - Cosine-similarity anomaly detection (future)
 *  - Embedding drift analysis to surface unusual cardiac patterns
 *
 * Collection: users/{userId}/ppg_embeddings/{docId}
 * Schema:
 *   embeddings: number[]    — raw float32 vector from PaPaGei
 *   heartRate?: number
 *   hrv?: number            — heartRateVariability
 *   respiratoryRate?: number
 *   signalQuality: number
 *   confidence?: number
 *   capturedAt: Timestamp
 */

import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
    try {
      await addDoc(collection(db, "users", userId, "ppg_embeddings"), {
        embeddings,
        heartRate: meta.heartRate ?? null,
        hrv: meta.hrv ?? null,
        respiratoryRate: meta.respiratoryRate ?? null,
        signalQuality: meta.signalQuality,
        confidence: meta.confidence ?? null,
        capturedAt: Timestamp.now(),
      });
    } catch {
      // Silently fail — embedding persistence is best-effort
    }
  },

  /**
   * Fetch the most recent N embeddings for a user.
   */
  async getRecentEmbeddings(
    userId: string,
    limitCount = 10
  ): Promise<PPGEmbeddingRecord[]> {
    const q = query(
      collection(db, "users", userId, "ppg_embeddings"),
      orderBy("capturedAt", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        embeddings: (data.embeddings as number[]) ?? [],
        heartRate: data.heartRate as number | undefined,
        hrv: data.hrv as number | undefined,
        respiratoryRate: data.respiratoryRate as number | undefined,
        signalQuality: data.signalQuality as number,
        confidence: data.confidence as number | undefined,
        capturedAt:
          data.capturedAt instanceof Timestamp
            ? data.capturedAt.toDate()
            : new Date(),
      };
    });
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
