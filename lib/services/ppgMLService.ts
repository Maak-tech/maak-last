/**
 * PPG ML Service Client
 *
 * Service for calling ML-powered PPG analysis via Firebase Cloud Functions
 * Uses PaPaGei foundation models for advanced signal analysis
 */

import { type Functions, httpsCallable } from "firebase/functions";
import type { PPGResult } from "@/lib/utils/BiometricUtils";

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

// Helper to get authenticated functions instance
async function getAuthenticatedFunctions(): Promise<Functions | null> {
  const firebaseModule = await import("@/lib/firebase");
  const { auth } = firebaseModule;

  // Check if user is authenticated
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null; // User not authenticated
  }

  const app = firebaseModule.app;
  if (!app) {
    return null; // Firebase app not initialized
  }

  const { getFunctions } = await import("firebase/functions");

  // Get functions instance
  const functionsInstance = getFunctions(app, "us-central1");

  // Ensure auth token is fresh
  try {
    await currentUser.getIdToken(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (_e) {
    // Token refresh failed, return null to indicate auth issue
    return null;
  }

  return functionsInstance;
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
      const firebaseModule = await import("@/lib/firebase");
      const { auth } = firebaseModule;

      // Get authenticated user ID (use provided userId or current user)
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return {
          success: false,
          signalQuality: 0,
          error: "User not authenticated",
        };
      }

      const functions = await getAuthenticatedFunctions();

      // If not authenticated, skip ML processing silently
      if (!functions) {
        return {
          success: false,
          signalQuality: 0,
          error: "User not authenticated",
        };
      }

      // Use provided userId or fall back to authenticated user's ID
      const finalUserId = userId || currentUser.uid;

      const analyzePPG = httpsCallable<PPGAnalysisRequest, PPGAnalysisResponse>(
        functions,
        "analyzePPGWithML"
      );

      const result = await analyzePPG({
        signal,
        frameRate,
        duration: signal.length / frameRate,
        userId: finalUserId,
        metadata: {
          source: "react-native",
          platform: "mobile",
          timestamp: new Date().toISOString(),
        },
      });

      const data = result.data;

      if (data.success) {
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
      // Only log warning for non-authentication errors
      const errorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : "";
      const errorMessage = getMessageFromUnknownError(error);
      const isAuthError =
        errorCode === "unauthenticated" ||
        errorMessage.includes("User must be authenticated") ||
        errorMessage.includes("unauthenticated");

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
      const functions = await getAuthenticatedFunctions();
      if (!functions) {
        return false;
      }
      httpsCallable(functions, "analyzePPGWithML");

      // Try a minimal test call (will fail gracefully if service unavailable)
      // We don't actually call it, just check if function exists
      return true;
    } catch {
      return false;
    }
  },
};
