import { circuitBreaker } from "./circuitBreaker";
import { observabilityEmitter } from "./eventEmitter";

export interface InstrumentationOptions {
  source: string;
  trackLatency?: boolean;
  useCircuitBreaker?: boolean;
  circuitBreakerFallback?: () => any;
}

export async function instrumentAsync<T>(
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
    } catch (error: any) {
      const durationMs = Date.now() - startTime;

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
      const isExpectedError =
        error?.isExpectedError === true || error?.isApiKeyError === true;

      if (!isExpectedError) {
        await observabilityEmitter.emitPlatformEvent(
          `${operationName}_failed`,
          `${operationName} failed: ${error.message}`,
          {
            source: options.source,
            severity: "error",
            status: "failure",
            durationMs,
            correlationId,
            error: {
              code: error.code,
              message: error.message,
              stack: error.stack,
            },
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
    );
  }

  return executeOperation();
}

export function createServiceInstrumenter(serviceName: string) {
  return {
    async track<T>(
      operationName: string,
      operation: () => Promise<T>,
      options: Partial<InstrumentationOptions> = {}
    ): Promise<T> {
      return instrumentAsync(operationName, operation, {
        source: serviceName,
        ...options,
      });
    },

    async trackWithCircuitBreaker<T>(
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
      observabilityEmitter.emitPlatformEvent(
        `${operationName}_failure`,
        `${operationName} failed: ${error.message}`,
        {
          source: serviceName,
          severity: "error",
          status: "failure",
          error: {
            code: (error as any).code,
            message: error.message,
            stack: error.stack,
          },
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
