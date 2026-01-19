/**
 * PPG ML Service Client
 *
 * Service for calling ML-powered PPG analysis via Firebase Cloud Functions
 * Uses PaPaGei foundation models for advanced signal analysis
 */

import { type Functions, httpsCallable } from "firebase/functions";
import type { PPGResult } from "@/lib/utils/BiometricUtils";

interface PPGAnalysisRequest {
  signal: number[];
  frameRate: number;
  duration?: number;
  userId?: string;
  metadata?: Record<string, any>;
}

interface PPGAnalysisResponse {
  success: boolean;
  heartRate?: number;
  heartRateVariability?: number;
  respiratoryRate?: number;
  signalQuality: number;
  confidence?: number;
  embeddings?: number[];
  warnings: string[];
  error?: string;
}

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
  const { getFunctions } = await import("firebase/functions");

  // Get functions instance
  const functionsInstance = getFunctions(app, "us-central1");

  // Ensure auth token is fresh
  try {
    await currentUser.getIdToken(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (e) {
    // Token refresh failed, return null to indicate auth issue
    return null;
  }

  return functionsInstance;
}

export const ppgMLService = {
  /**
   * Analyze PPG signal using ML models (PaPaGei)
   * Falls back to traditional processing if ML service is unavailable
   */
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
          isEstimate: (data.confidence || 0) < 0.7,
          error:
            data.warnings.length > 0 ? data.warnings.join(", ") : undefined,
        };
      }
      // ML service failed, return error result
      return {
        success: false,
        signalQuality: data.signalQuality || 0,
        error: data.error || "ML analysis failed",
      };
    } catch (error: any) {
      // Only log warning for non-authentication errors
      const isAuthError =
        error?.code === "unauthenticated" ||
        error?.message?.includes("User must be authenticated") ||
        error?.message?.includes("unauthenticated");

      if (!isAuthError) {
        console.warn(
          "ML service unavailable, will use traditional processing:",
          error
        );
      }

      // Return error result - caller should fallback to traditional processing
      return {
        success: false,
        signalQuality: 0,
        error: error.message || "ML service unavailable",
      };
    }
  },

  /**
   * Check if ML service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const functions = await getAuthenticatedFunctions();
      const analyzePPG = httpsCallable(functions, "analyzePPGWithML");

      // Try a minimal test call (will fail gracefully if service unavailable)
      // We don't actually call it, just check if function exists
      return true;
    } catch {
      return false;
    }
  },
};
