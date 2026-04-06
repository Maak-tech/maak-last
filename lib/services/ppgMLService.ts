/**
 * PPG ML Service Client
 *
 * Service for calling ML-powered PPG analysis via the REST API.
 * Uses PaPaGei foundation models for advanced signal analysis.
 */

import { api } from "@/lib/apiClient";
import type { PPGResult } from "@/lib/utils/BiometricUtils";
import { ppgEmbeddingsService } from "./ppgEmbeddingsService";

type PPGAnalysisRequest = {
  signal: number[];
  frameRate: number;
  duration?: number;
  userId?: string;
  metadata?: Record<string, unknown>;
};

type PPGAnalysisResponse = {
  success: boolean;
  heartRate?: number;
  heartRateVariability?: number;
  respiratoryRate?: number;
  signalQuality: number;
  confidence?: number;
  embeddings?: number[];
  warnings: string[];
  error?: string;
};

function mapSignalQuality(q: number): "poor" | "fair" | "good" | "excellent" {
  if (q >= 0.8) return "excellent";
  if (q >= 0.6) return "good";
  if (q >= 0.4) return "fair";
  return "poor";
}

let hasLoggedMlUnavailable = false;
const IS_DEV = process.env.NODE_ENV !== "production";

const getMessageFromUnknownError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "ML service unavailable";
};

export const ppgMLService = {
  /**
   * Analyze PPG signal using ML models (PaPaGei)
   * Falls back to traditional processing if ML service is unavailable
   */
  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This method intentionally orchestrates auth, ML invocation, and fallback handling for degraded modes. */
  async analyzePPG(
    signal: number[],
    frameRate: number,
    userId?: string
  ): Promise<PPGResult> {
    try {
      const request: PPGAnalysisRequest = {
        signal,
        frameRate,
        duration: signal.length / frameRate,
        userId,
        metadata: {
          source: "react-native",
          platform: "mobile",
          timestamp: new Date().toISOString(),
        },
      };

      const data = await api.post<PPGAnalysisResponse>(
        "/api/health/ppg/analyze",
        request
      );

      if (data.success) {
        // Persist embeddings for longitudinal cardiac fingerprinting (fire-and-forget)
        if (data.embeddings && data.embeddings.length > 0 && userId) {
          // Fire-and-forget: embedding persistence must not block the PPG result
          ppgEmbeddingsService.persist(userId, data.embeddings, {
            heartRate: data.heartRate,
            hrv: data.heartRateVariability,
            respiratoryRate: data.respiratoryRate,
            signalQuality: data.signalQuality,
            confidence: data.confidence,
          }).catch((err) => {
            console.warn('[ppg] Failed to persist embeddings (non-fatal):', err instanceof Error ? err.message : String(err));
          });
        }
        return {
          heartRate: data.heartRate ?? null,
          spo2: null,
          hrv: data.heartRateVariability ?? null,
          confidence: (data.confidence ?? 0) * 100,
          signalQuality: mapSignalQuality(data.signalQuality),
          processingTimeMs: 0,
          rawPeakIntervals: [],
        };
      }

      // ML service failed — return a minimal valid PPGResult
      return {
        heartRate: data.heartRate ?? null,
        spo2: null,
        hrv: data.heartRateVariability ?? null,
        confidence: (data.confidence ?? 0) * 100,
        signalQuality: mapSignalQuality(data.signalQuality || 0),
        processingTimeMs: 0,
        rawPeakIntervals: [],
      };
    } catch (error: unknown) {
      const errorMessage = getMessageFromUnknownError(error);
      const isAuthError =
        errorMessage.includes("unauthenticated") ||
        errorMessage.includes("User must be authenticated");

      if (IS_DEV && !isAuthError && !hasLoggedMlUnavailable) {
        hasLoggedMlUnavailable = true;
      }

      // Return error result - caller should fallback to traditional processing
      return {
        heartRate: null,
        spo2: null,
        hrv: null,
        confidence: 0,
        signalQuality: "poor",
        processingTimeMs: 0,
        rawPeakIntervals: [],
      };
    }
  },

  /**
   * Check if ML service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await api.get("/api/health/ppg/analyze");
      return true;
    } catch {
      return false;
    }
  },
};
