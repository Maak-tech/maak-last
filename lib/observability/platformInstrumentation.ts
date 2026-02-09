import { circuitBreaker } from "./circuitBreaker";
import { observabilityEmitter } from "./eventEmitter";

type ErrorDetails = {
  code?: string;
  message: string;
  stack?: string;
};

function getErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    const code =
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code?: string }).code
        : undefined;

    return {
      code,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function isExpectedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const withFlags = error as {
    isExpectedError?: unknown;
    isApiKeyError?: unknown;
  };

  return withFlags.isExpectedError === true || withFlags.isApiKeyError === true;
}

export type InstrumentationOptions = {
  source: string;
  trackLatency?: boolean;
  useCircuitBreaker?: boolean;
  circuitBreakerFallback?: () => Promise<unknown> | unknown;
};

export function instrumentAsync<T>(
  operationName: string,
  operation: () => Promise<T>,
  options: InstrumentationOptions
): Promise<T> {
  const startTime = Date.now();
  const correlationId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const executeOperation = async (): Promise<T> => {
    try {
      const result = await operation();
      const durationMs = Date.now() - startTime;

      if (options.trackLatency !== false) {
        await observabilityEmitter.recordMetric(
          `${options.source}_${operationName}_latency`,
          durationMs,
          "ms",
          "platform",
          { status: "success" }
        );
      }

      await observabilityEmitter.emitPlatformEvent(
        `${operationName}_completed`,
        `${operationName} completed successfully`,
        {
          source: options.source,
          severity: "info",
          status: "success",
          durationMs,
          correlationId,
        }
      );

      return result;
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;
      const details = getErrorDetails(error);

      if (options.trackLatency !== false) {
        await observabilityEmitter.recordMetric(
          `${options.source}_${operationName}_latency`,
          durationMs,
          "ms",
          "platform",
          { status: "failure" }
        );
      }

      // Suppress error logging for expected errors (e.g., missing API keys)
      // These are handled gracefully by callers and don't need to be logged as errors
      const expectedError = isExpectedError(error);

      if (!expectedError) {
        await observabilityEmitter.emitPlatformEvent(
          `${operationName}_failed`,
          `${operationName} failed: ${details.message}`,
          {
            source: options.source,
            severity: "error",
            status: "failure",
            durationMs,
            correlationId,
            error: details,
          }
        );
      }

      throw error;
    }
  };

  if (options.useCircuitBreaker) {
    return circuitBreaker.execute(
      `${options.source}_${operationName}`,
      executeOperation,
      options.circuitBreakerFallback
    ) as Promise<T>;
  }

  return executeOperation();
}

export function createServiceInstrumenter(serviceName: string) {
  return {
    track<T>(
      operationName: string,
      operation: () => Promise<T>,
      options: Partial<InstrumentationOptions> = {}
    ): Promise<T> {
      return instrumentAsync(operationName, operation, {
        source: serviceName,
        ...options,
      });
    },

    trackWithCircuitBreaker<T>(
      operationName: string,
      operation: () => Promise<T>,
      fallback?: () => T | Promise<T>
    ): Promise<T> {
      return instrumentAsync(operationName, operation, {
        source: serviceName,
        useCircuitBreaker: true,
        circuitBreakerFallback: fallback,
      });
    },

    recordSuccess(
      operationName: string,
      metadata?: Record<string, unknown>
    ): void {
      observabilityEmitter.emitPlatformEvent(
        `${operationName}_success`,
        `${operationName} succeeded`,
        {
          source: serviceName,
          severity: "info",
          status: "success",
          metadata,
        }
      );
    },

    recordFailure(
      operationName: string,
      error: Error,
      metadata?: Record<string, unknown>
    ): void {
      const details = getErrorDetails(error);
      observabilityEmitter.emitPlatformEvent(
        `${operationName}_failure`,
        `${operationName} failed: ${details.message}`,
        {
          source: serviceName,
          severity: "error",
          status: "failure",
          error: details,
          metadata,
        }
      );
    },

    recordLatency(
      operationName: string,
      durationMs: number,
      success: boolean
    ): void {
      observabilityEmitter.recordMetric(
        `${serviceName}_${operationName}_latency`,
        durationMs,
        "ms",
        "platform",
        { status: success ? "success" : "failure" }
      );
    },

    recordCount(
      metricName: string,
      value = 1,
      tags?: Record<string, string>
    ): void {
      observabilityEmitter.recordMetric(
        `${serviceName}_${metricName}`,
        value,
        "count",
        "platform",
        tags
      );
    },
  };
}

export const apiInstrumenter = createServiceInstrumenter("api");
export const syncInstrumenter = createServiceInstrumenter("sync");
export const notificationInstrumenter =
  createServiceInstrumenter("notification");
export const aiInstrumenter = createServiceInstrumenter("ai");
export const authInstrumenter = createServiceInstrumenter("auth");
export const paymentInstrumenter = createServiceInstrumenter("payment");
