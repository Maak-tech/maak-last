/**
 * PPG ML Service Client
 *
 * Communicates with the Python ML service for advanced PPG signal analysis
 * using PaPaGei, REBAR, and ResNet1D models.
 */

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

type PPGMLServiceConfig = {
  baseUrl: string;
  timeout?: number;
  apiKey?: string;
};

class PPGMLService {
  private readonly config: PPGMLServiceConfig;

  constructor(config: PPGMLServiceConfig) {
    this.config = {
      timeout: 10_000, // 10 seconds default
      ...config,
    };
  }

  /**
   * Analyze PPG signal using ML models
   */
  async analyzePPG(request: PPGAnalysisRequest): Promise<PPGAnalysisResponse> {
    const url = `${this.config.baseUrl}/api/ppg/analyze`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.config.timeout || 10_000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ML service error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data as PPGAnalysisResponse;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to connect to ML service";
      // Return fallback response
      return {
        success: false,
        signalQuality: 0,
        warnings: [],
        error: message,
      };
    }
  }

  /**
   * Extract embeddings from PPG signal
   */
  async extractEmbeddings(
    signal: number[],
    frameRate: number,
    returnSegments = false
  ): Promise<number[] | number[][]> {
    const url = `${this.config.baseUrl}/api/ppg/embeddings`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey && {
          Authorization: `Bearer ${this.config.apiKey}`,
        }),
      },
      body: JSON.stringify({
        signal,
        frameRate,
        returnSegments,
      }),
      signal: AbortSignal.timeout(this.config.timeout || 10_000),
    });

    if (!response.ok) {
      throw new Error(`ML service error: ${response.status}`);
    }

    const data = (await response.json()) as {
      embeddings: number[] | number[][];
    };
    return data.embeddings;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    const url = `${this.config.baseUrl}/api/health`;

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

// Create singleton instance
const mlServiceBaseUrl =
  process.env.PPG_ML_SERVICE_URL || "http://localhost:8000";

export const ppgMLService = new PPGMLService({
  baseUrl: mlServiceBaseUrl,
  timeout: 10_000,
  apiKey: process.env.PPG_ML_SERVICE_API_KEY,
});

/**
 * Firebase Cloud Function wrapper for PPG ML analysis
 */
export async function analyzePPGWithML(
  signal: number[],
  frameRate: number,
  userId?: string,
  apiKey?: string
): Promise<PPGAnalysisResponse> {
  try {
    // Use provided API key or fall back to singleton instance
    const service = apiKey
      ? new PPGMLService({
          baseUrl: mlServiceBaseUrl,
          timeout: 10_000,
          apiKey,
        })
      : ppgMLService;

    const result = await service.analyzePPG({
      signal,
      frameRate,
      userId,
      metadata: {
        source: "firebase-functions",
        timestamp: new Date().toISOString(),
      },
    });

    return result;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "ML analysis failed";
    return {
      success: false,
      signalQuality: 0,
      warnings: [],
      error: message,
    };
  }
}
