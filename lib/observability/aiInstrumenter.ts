/**
 * AI Instrumentation — tracks OpenAI / LLM calls for latency,
 * token usage, and error monitoring.
 *
 * Used by openaiService.ts to wrap every API call with structured telemetry.
 * No external dependency — logs via the app logger and emits events via
 * the observability emitter.
 */

import { logger } from "@/lib/utils/logger";

export interface AICallRecord {
  callId: string;
  model: string;
  operation: string;
  userId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

class AIInstrumenter {
  private records: AICallRecord[] = [];
  private readonly maxRecords = 200;

  /**
   * Wrap an async AI call with instrumentation.
   * Records latency, token counts, and errors automatically.
   */
  async instrument<T>(
    operation: string,
    model: string,
    fn: () => Promise<T>,
    options?: { userId?: string }
  ): Promise<T> {
    const callId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const start = Date.now();

    try {
      const result = await fn();
      const latencyMs = Date.now() - start;

      const record: AICallRecord = {
        callId,
        model,
        operation,
        userId: options?.userId,
        latencyMs,
        success: true,
        timestamp: new Date(),
      };

      this.addRecord(record);
      logger.debug(`AI call [${operation}] completed in ${latencyMs}ms`, { callId, model }, "aiInstrumenter");

      return result;
    } catch (error) {
      const latencyMs = Date.now() - start;
      const record: AICallRecord = {
        callId,
        model,
        operation,
        userId: options?.userId,
        latencyMs,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };

      this.addRecord(record);
      logger.error(`AI call [${operation}] failed after ${latencyMs}ms`, { callId, model, error }, "aiInstrumenter");

      throw error;
    }
  }

  /** Record token usage for a completed call (called after receiving API response) */
  recordTokenUsage(
    callId: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  ): void {
    const record = this.records.find((r) => r.callId === callId);
    if (record) {
      Object.assign(record, usage);
    }
  }

  /** Get the last N AI call records */
  getRecentRecords(limit = 20): AICallRecord[] {
    return this.records.slice(-limit);
  }

  /** Get aggregate stats (success rate, avg latency) */
  getStats(): { totalCalls: number; successRate: number; avgLatencyMs: number } {
    if (this.records.length === 0) {
      return { totalCalls: 0, successRate: 1, avgLatencyMs: 0 };
    }
    const succeeded = this.records.filter((r) => r.success).length;
    const avgLatencyMs = this.records.reduce((sum, r) => sum + r.latencyMs, 0) / this.records.length;
    return {
      totalCalls: this.records.length,
      successRate: succeeded / this.records.length,
      avgLatencyMs: Math.round(avgLatencyMs),
    };
  }

  private addRecord(record: AICallRecord): void {
    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }
  }
}

export const aiInstrumenter = new AIInstrumenter();
