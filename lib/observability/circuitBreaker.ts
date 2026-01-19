import { logger } from "@/lib/utils/logger";
import { observabilityEmitter } from "./eventEmitter";
import type { CircuitBreakerState } from "./types";

interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenRequests: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30_000,
  halfOpenRequests: 3,
};

class CircuitBreaker {
  private states: Map<string, CircuitBreakerState> = new Map();
  private options: Map<string, CircuitBreakerOptions> = new Map();
  private halfOpenSuccesses: Map<string, number> = new Map();

  configure(
    serviceName: string,
    options: Partial<CircuitBreakerOptions>
  ): void {
    this.options.set(serviceName, { ...DEFAULT_OPTIONS, ...options });
  }

  private getOptions(serviceName: string): CircuitBreakerOptions {
    return this.options.get(serviceName) || DEFAULT_OPTIONS;
  }

  private getState(serviceName: string): CircuitBreakerState {
    if (!this.states.has(serviceName)) {
      this.states.set(serviceName, {
        serviceName,
        state: "closed",
        failureCount: 0,
      });
    }
    return this.states.get(serviceName)!;
  }

  isOpen(serviceName: string): boolean {
    const state = this.getState(serviceName);

    if (state.state === "open") {
      if (state.nextRetryAt && new Date() >= state.nextRetryAt) {
        this.transitionToHalfOpen(serviceName);
        return false;
      }
      return true;
    }

    return false;
  }

  canExecute(serviceName: string): boolean {
    const state = this.getState(serviceName);

    if (state.state === "closed") {
      return true;
    }

    if (state.state === "open") {
      if (state.nextRetryAt && new Date() >= state.nextRetryAt) {
        this.transitionToHalfOpen(serviceName);
        return true;
      }
      return false;
    }

    if (state.state === "half_open") {
      const options = this.getOptions(serviceName);
      const currentSuccesses = this.halfOpenSuccesses.get(serviceName) || 0;
      return currentSuccesses < options.halfOpenRequests;
    }

    return true;
  }

  recordSuccess(serviceName: string): void {
    const state = this.getState(serviceName);
    const options = this.getOptions(serviceName);

    if (state.state === "half_open") {
      const successes = (this.halfOpenSuccesses.get(serviceName) || 0) + 1;
      this.halfOpenSuccesses.set(serviceName, successes);

      if (successes >= options.successThreshold) {
        this.transitionToClosed(serviceName);
      }
    } else if (state.state === "closed") {
      state.failureCount = 0;
      state.lastSuccess = new Date();
    }
  }

  recordFailure(serviceName: string, error?: Error): void {
    const state = this.getState(serviceName);
    const options = this.getOptions(serviceName);

    state.failureCount++;
    state.lastFailure = new Date();

    if (state.state === "half_open") {
      this.transitionToOpen(serviceName, options.timeout);
    } else if (
      state.state === "closed" &&
      state.failureCount >= options.failureThreshold
    ) {
      this.transitionToOpen(serviceName, options.timeout);
    }

    logger.warn(
      `Circuit breaker failure recorded for ${serviceName}`,
      {
        failureCount: state.failureCount,
        state: state.state,
        error: error?.message,
      },
      "CircuitBreaker"
    );
  }

  private transitionToOpen(serviceName: string, timeout: number): void {
    const state = this.getState(serviceName);
    const previousState = state.state;

    state.state = "open";
    state.nextRetryAt = new Date(Date.now() + timeout);
    this.halfOpenSuccesses.delete(serviceName);

    logger.warn(
      `Circuit breaker OPENED for ${serviceName}`,
      { timeout, nextRetryAt: state.nextRetryAt },
      "CircuitBreaker"
    );

    observabilityEmitter.emitPlatformEvent(
      "circuit_breaker_opened",
      `Circuit breaker opened for ${serviceName}`,
      {
        source: "CircuitBreaker",
        severity: "error",
        status: "failure",
        metadata: {
          serviceName,
          previousState,
          failureCount: state.failureCount,
          timeout,
        },
      }
    );
  }

  private transitionToHalfOpen(serviceName: string): void {
    const state = this.getState(serviceName);
    state.state = "half_open";
    this.halfOpenSuccesses.set(serviceName, 0);

    logger.info(
      `Circuit breaker HALF-OPEN for ${serviceName}`,
      {},
      "CircuitBreaker"
    );

    observabilityEmitter.emitPlatformEvent(
      "circuit_breaker_half_open",
      `Circuit breaker half-open for ${serviceName}`,
      {
        source: "CircuitBreaker",
        severity: "info",
        status: "pending",
        metadata: { serviceName },
      }
    );
  }

  private transitionToClosed(serviceName: string): void {
    const state = this.getState(serviceName);
    state.state = "closed";
    state.failureCount = 0;
    state.nextRetryAt = undefined;
    this.halfOpenSuccesses.delete(serviceName);

    logger.info(
      `Circuit breaker CLOSED for ${serviceName}`,
      {},
      "CircuitBreaker"
    );

    observabilityEmitter.emitPlatformEvent(
      "circuit_breaker_closed",
      `Circuit breaker closed for ${serviceName}`,
      {
        source: "CircuitBreaker",
        severity: "info",
        status: "success",
        metadata: { serviceName },
      }
    );
  }

  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    if (!this.canExecute(serviceName)) {
      logger.warn(
        `Circuit breaker is open for ${serviceName}, using fallback`,
        {},
        "CircuitBreaker"
      );

      if (fallback) {
        return fallback();
      }
      throw new Error(
        `Service ${serviceName} is currently unavailable (circuit breaker open)`
      );
    }

    const startTime = Date.now();

    try {
      const result = await operation();
      this.recordSuccess(serviceName);

      observabilityEmitter.recordMetric(
        `${serviceName}_latency`,
        Date.now() - startTime,
        "ms",
        "platform",
        { status: "success" }
      );

      return result;
    } catch (error) {
      this.recordFailure(serviceName, error as Error);

      observabilityEmitter.recordMetric(
        `${serviceName}_latency`,
        Date.now() - startTime,
        "ms",
        "platform",
        { status: "failure" }
      );

      if (fallback && this.isOpen(serviceName)) {
        return fallback();
      }

      throw error;
    }
  }

  getStatus(serviceName: string): CircuitBreakerState {
    return this.getState(serviceName);
  }

  getAllStatuses(): CircuitBreakerState[] {
    return Array.from(this.states.values());
  }

  reset(serviceName: string): void {
    this.states.delete(serviceName);
    this.halfOpenSuccesses.delete(serviceName);
    logger.info(
      `Circuit breaker reset for ${serviceName}`,
      {},
      "CircuitBreaker"
    );
  }

  resetAll(): void {
    this.states.clear();
    this.halfOpenSuccesses.clear();
    logger.info("All circuit breakers reset", {}, "CircuitBreaker");
  }
}

export const circuitBreaker = new CircuitBreaker();

export function withCircuitBreaker<T>(
  serviceName: string,
  fallback?: () => T | Promise<T>
) {
  return (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return circuitBreaker.execute(
        serviceName,
        () => originalMethod.apply(this, args),
        fallback
      );
    };

    return descriptor;
  };
}
