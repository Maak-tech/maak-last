/**
 * Centralized logging utility for the application
 * Replaces console statements with a configurable logging system
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: Date;
  source?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs in memory
  private enabled: boolean;
  private logLevel: LogLevel;

  constructor() {
    // Enable logging in development, disable in production
    this.enabled = __DEV__;
    // Set log level based on environment
    this.logLevel = __DEV__ ? "debug" : "error";
  }

  /**
   * Set whether logging is enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.enabled) {
      return false;
    }

    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Add a log entry
   */
  private addLog(level: LogLevel, message: string, data?: unknown, source?: string): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date(),
      source,
    };

    // Keep only the last maxLogs entries
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output to console in development
    if (__DEV__) {
      const prefix = source ? `[${source}]` : "";
      const timestamp = entry.timestamp.toISOString();
      
      switch (level) {
        case "debug":
          console.debug(`${timestamp} ${prefix} ${message}`, data || "");
          break;
        case "info":
          console.info(`${timestamp} ${prefix} ${message}`, data || "");
          break;
        case "warn":
          console.warn(`${timestamp} ${prefix} ${message}`, data || "");
          break;
        case "error":
          console.error(`${timestamp} ${prefix} ${message}`, data || "");
          break;
      }
    }

    // In production, you could send errors to a logging service
    // For example: Sentry, LogRocket, etc.
    if (!__DEV__ && level === "error") {
      // TODO: Send to error tracking service
      // Example: Sentry.captureException(new Error(message), { extra: data });
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: unknown, source?: string): void {
    this.addLog("debug", message, data, source);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: unknown, source?: string): void {
    this.addLog("info", message, data, source);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown, source?: string): void {
    this.addLog("warn", message, data, source);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: unknown, source?: string): void {
    // Extract error information
    let errorData: unknown = error;
    let errorMessage = message;

    if (error instanceof Error) {
      errorMessage = `${message}: ${error.message}`;
      errorData = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error as unknown as Record<string, unknown>),
      };
    } else if (typeof error === "object" && error !== null) {
      errorData = error;
    }

    this.addLog("error", errorMessage, errorData, source);
  }

  /**
   * Get recent logs (useful for debugging)
   */
  getLogs(level?: LogLevel, limit = 50): LogEntry[] {
    let filtered = this.logs;
    
    if (level) {
      filtered = this.logs.filter((log) => log.level === level);
    }

    return filtered.slice(-limit);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export convenience functions for easier usage
export const logDebug = (message: string, data?: unknown, source?: string) =>
  logger.debug(message, data, source);
export const logInfo = (message: string, data?: unknown, source?: string) =>
  logger.info(message, data, source);
export const logWarn = (message: string, data?: unknown, source?: string) =>
  logger.warn(message, data, source);
export const logError = (message: string, error?: unknown, source?: string) =>
  logger.error(message, error, source);

