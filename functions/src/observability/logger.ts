/**
 * Structured JSON logger
 * Format: {level, msg, traceId, uid?, patientId?, alertId?, fn}
 * Never logs PHI: no names, emails, notes, raw vitals arrays
 */
import { getTraceId } from "./correlation";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  traceId?: string;
  uid?: string;
  patientId?: string;
  caregiverId?: string;
  familyId?: string;
  alertId?: string;
  vitalId?: string;
  medicationId?: string;
  fn?: string;
  [key: string]: unknown; // Allow additional metadata fields
};

export type LogEntry = {
  level: LogLevel;
  msg: string;
  traceId: string;
  uid?: string;
  patientId?: string;
  caregiverId?: string;
  familyId?: string;
  alertId?: string;
  vitalId?: string;
  medicationId?: string;
  fn?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};

class Logger {
  private defaultContext: LogContext = {};

  /**
   * Set default context for all logs
   */
  setDefaultContext(context: LogContext): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  /**
   * Create a log entry
   */
  private createEntry(
    level: LogLevel,
    msg: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      msg,
      traceId: context?.traceId || this.defaultContext.traceId || getTraceId(),
    };

    // Merge contexts
    const merged = { ...this.defaultContext, ...context };

    // Only add defined fields (IDs only, no PHI)
    if (merged.uid) {
      entry.uid = merged.uid;
    }
    if (merged.patientId) {
      entry.patientId = merged.patientId;
    }
    if (merged.caregiverId) {
      entry.caregiverId = merged.caregiverId;
    }
    if (merged.familyId) {
      entry.familyId = merged.familyId;
    }
    if (merged.alertId) {
      entry.alertId = merged.alertId;
    }
    if (merged.vitalId) {
      entry.vitalId = merged.vitalId;
    }
    if (merged.medicationId) {
      entry.medicationId = merged.medicationId;
    }
    if (merged.fn) {
      entry.fn = merged.fn;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  /**
   * Write log entry to console
   */
  private write(entry: LogEntry): void {
    const json = JSON.stringify(entry);

    switch (entry.level) {
      case "debug":
        console.debug(json);
        break;
      case "info":
        console.info(json);
        break;
      case "warn":
        console.warn(json);
        break;
      case "error":
        console.error(json);
        break;
      default:
        console.info(json);
        break;
    }
  }

  /**
   * Log debug message
   */
  debug(msg: string, context?: LogContext): void {
    this.write(this.createEntry("debug", msg, context));
  }

  /**
   * Log info message
   */
  info(msg: string, context?: LogContext): void {
    this.write(this.createEntry("info", msg, context));
  }

  /**
   * Log warning message
   */
  warn(
    msg: string,
    errorOrContext?: Error | LogContext,
    context?: LogContext
  ): void {
    // Handle overloaded parameters
    if (errorOrContext instanceof Error) {
      this.write(this.createEntry("warn", msg, context, errorOrContext));
    } else {
      this.write(this.createEntry("warn", msg, errorOrContext));
    }
  }

  /**
   * Log error message
   */
  error(msg: string, error?: Error, context?: LogContext): void {
    this.write(this.createEntry("error", msg, context, error));
  }

  /**
   * Create child logger with inherited context
   */
  child(context: LogContext): Logger {
    const child = new Logger();
    child.setDefaultContext({ ...this.defaultContext, ...context });
    return child;
  }
}

// Singleton instance
export const logger = new Logger();
