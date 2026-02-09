/**
 * Request correlation tracking
 * Generates and manages trace IDs for distributed tracing
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

// Store trace context per async execution
const asyncLocalStorage = new AsyncLocalStorage<{ traceId: string }>();

/**
 * Generate a new trace ID
 */
export function createTraceId(): string {
  return `trace_${randomUUID()}`;
}

/**
 * Set trace ID for current execution context
 */
export function setTraceId(traceId: string): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.traceId = traceId;
  }
}

/**
 * Get trace ID from current execution context
 * Creates a new one if none exists
 */
export function getTraceId(): string {
  const store = asyncLocalStorage.getStore();
  if (store?.traceId) {
    return store.traceId;
  }
  // Return new trace ID if not in async context
  return createTraceId();
}

/**
 * Run function with trace context
 */
export function runWithTrace<T>(fn: () => T): T {
  const traceId = createTraceId();
  return asyncLocalStorage.run({ traceId }, fn);
}

/**
 * Run async function with trace context
 */
export function runWithTraceAsync<T>(fn: () => Promise<T>): Promise<T> {
  const traceId = createTraceId();
  return asyncLocalStorage.run({ traceId }, fn);
}
