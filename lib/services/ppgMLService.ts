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
          ppgEmbeddingsService.persist(userId, data.embeddings, {
            heartRate: data.heartRate,
            hrv: data.heartRateVariability,
            respiratoryRate: data.respiratoryRate,
            signalQuality: data.signalQuality,
            confidence: data.confidence,
          });
        }
        return {
          success: true,
          heartRate: data.heartRate,
          heartRateVariability: data.heartRateVariability,
          respiratoryRate: data.respiratoryRate,
          signalQuality: data.signalQuality,
          confidence: data.confidence,
          isEstimate: (data.confidence || 0) < 0.7,
          error:
            data.warnings.length > 0 ? data.warnings.join(", ") : undefined,
        };
      }

      // ML service failed, but if it still produced a heart rate,
      // return it as a low-confidence estimate to prefer ML outputs.
      if (Number.isFinite(data.heartRate)) {
        return {
          success: false,
          heartRate: data.heartRate,
          heartRateVariability: data.heartRateVariability,
          respiratoryRate: data.respiratoryRate,
          signalQuality: data.signalQuality || 0,
          confidence: data.confidence,
          isEstimate: true,
          error:
            data.warnings.length > 0
              ? data.warnings.join(", ")
              : data.error || "ML analysis low confidence",
        };
      }

      // ML service failed without usable output
      return {
        success: false,
        signalQuality: data.signalQuality || 0,
        error: data.error || "ML analysis failed",
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
        success: false,
        signalQuality: 0,
        error: errorMessage,
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
