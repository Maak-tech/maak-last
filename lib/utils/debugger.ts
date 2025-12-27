/**
 * Debugging and Diagnostics Utilities
 * 
 * Comprehensive debugging tools for React Native app
 */

import React from 'react';
import { Platform } from 'react-native';
import { logger } from './logger';

/**
 * Debug levels
 */
export enum DebugLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4
}

/**
 * Debug configuration
 */
interface DebugConfig {
  level: DebugLevel;
  enableConsoleOutput: boolean;
  enableFileLogging: boolean;
  enablePerformanceTracking: boolean;
  enableMemoryTracking: boolean;
}

/**
 * Main debugger class
 */
export class AppDebugger {
  private static config: DebugConfig = {
    level: __DEV__ ? DebugLevel.DEBUG : DebugLevel.ERROR,
    enableConsoleOutput: __DEV__,
    enableFileLogging: true,
    enablePerformanceTracking: __DEV__,
    enableMemoryTracking: __DEV__
  };

  private static performanceMarks: Map<string, number> = new Map();
  private static memorySnapshots: Array<{ timestamp: number; usage: any }> = [];

  /**
   * Configure debugger settings
   */
  static configure(config: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Log with different levels
   */
  static log(level: DebugLevel, message: string, data?: any, context?: string): void {
    if (level > this.config.level) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: DebugLevel[level],
      message,
      data,
      context,
      platform: Platform.OS
    };

    if (this.config.enableConsoleOutput) {
      this.outputToConsole(level, logEntry);
    }

    if (this.config.enableFileLogging) {
      logger.info(`[${DebugLevel[level]}] ${message}`, data, context);
    }
  }

  private static outputToConsole(level: DebugLevel, entry: any): void {
    const prefix = `[${entry.timestamp}] [${entry.level}]`;
    const message = entry.context ? `${prefix} [${entry.context}] ${entry.message}` : `${prefix} ${entry.message}`;

    switch (level) {
      case DebugLevel.ERROR:
        console.error(message, entry.data);
        break;
      case DebugLevel.WARN:
        console.warn(message, entry.data);
        break;
      case DebugLevel.INFO:
        console.info(message, entry.data);
        break;
      case DebugLevel.DEBUG:
      case DebugLevel.VERBOSE:
        console.log(message, entry.data);
        break;
    }
  }

  /**
   * Convenience methods for different log levels
   */
  static error(message: string, data?: any, context?: string): void {
    this.log(DebugLevel.ERROR, message, data, context);
  }

  static warn(message: string, data?: any, context?: string): void {
    this.log(DebugLevel.WARN, message, data, context);
  }

  static info(message: string, data?: any, context?: string): void {
    this.log(DebugLevel.INFO, message, data, context);
  }

  static debug(message: string, data?: any, context?: string): void {
    this.log(DebugLevel.DEBUG, message, data, context);
  }

  static verbose(message: string, data?: any, context?: string): void {
    this.log(DebugLevel.VERBOSE, message, data, context);
  }

  /**
   * Performance tracking
   */
  static startPerformanceTracking(label: string): void {
    if (!this.config.enablePerformanceTracking) return;
    
    this.performanceMarks.set(label, Date.now());
    this.debug(`Performance tracking started: ${label}`, null, 'Performance');
  }

  static endPerformanceTracking(label: string): number {
    if (!this.config.enablePerformanceTracking) return 0;
    
    const startTime = this.performanceMarks.get(label);
    if (!startTime) {
      this.warn(`No performance mark found for: ${label}`, null, 'Performance');
      return 0;
    }

    const duration = Date.now() - startTime;
    this.performanceMarks.delete(label);
    
    this.info(`Performance: ${label} completed in ${duration}ms`, { duration }, 'Performance');
    return duration;
  }

  /**
   * Memory tracking
   */
  static trackMemoryUsage(label?: string): void {
    if (!this.config.enableMemoryTracking) return;

    try {
      // Note: Memory tracking is limited in React Native
      // This is a placeholder for when memory APIs become available
      const memoryInfo = {
        timestamp: Date.now(),
        label: label || 'Memory Snapshot',
        // Add actual memory tracking when APIs are available
        jsHeapSizeUsed: 0,
        jsHeapSizeTotal: 0,
        jsHeapSizeLimit: 0
      };

      this.memorySnapshots.push(memoryInfo);
      
      // Keep only last 100 snapshots
      if (this.memorySnapshots.length > 100) {
        this.memorySnapshots = this.memorySnapshots.slice(-100);
      }

      this.debug(`Memory tracked: ${label}`, memoryInfo, 'Memory');
    } catch (error) {
      this.warn('Memory tracking failed', error, 'Memory');
    }
  }

  /**
   * Network request debugging
   */
  static logNetworkRequest(url: string, method: string, data?: any): void {
    this.debug(`Network Request: ${method} ${url}`, data, 'Network');
  }

  static logNetworkResponse(url: string, status: number, data?: any, duration?: number): void {
    const level = status >= 400 ? DebugLevel.ERROR : DebugLevel.DEBUG;
    this.log(level, `Network Response: ${status} ${url}`, { data, duration }, 'Network');
  }

  /**
   * Component lifecycle debugging
   */
  static logComponentMount(componentName: string, props?: any): void {
    this.debug(`Component mounted: ${componentName}`, props, 'Component');
  }

  static logComponentUnmount(componentName: string): void {
    this.debug(`Component unmounted: ${componentName}`, null, 'Component');
  }

  static logComponentUpdate(componentName: string, prevProps?: any, nextProps?: any): void {
    this.verbose(`Component updated: ${componentName}`, { prevProps, nextProps }, 'Component');
  }

  /**
   * Error boundary debugging
   */
  static logError(error: Error, errorInfo?: any, context?: string): void {
    this.error('Application Error', {
      message: error.message,
      stack: error.stack,
      errorInfo,
      context
    }, 'ErrorBoundary');
  }

  /**
   * State debugging
   */
  static logStateChange(stateName: string, prevState: any, nextState: any, context?: string): void {
    this.verbose(`State changed: ${stateName}`, {
      previous: prevState,
      current: nextState
    }, context || 'State');
  }

  /**
   * Navigation debugging
   */
  static logNavigation(action: string, route?: string, params?: any): void {
    this.debug(`Navigation: ${action}`, { route, params }, 'Navigation');
  }

  /**
   * Firebase debugging
   */
  static logFirebaseOperation(operation: string, collection?: string, data?: any): void {
    this.debug(`Firebase: ${operation}`, { collection, data }, 'Firebase');
  }

  static logFirebaseError(operation: string, error: any, context?: string): void {
    this.error(`Firebase Error: ${operation}`, error, context || 'Firebase');
  }

  /**
   * Health data debugging
   */
  static logHealthDataOperation(operation: string, dataType?: string, value?: any): void {
    this.debug(`Health Data: ${operation}`, { dataType, value }, 'HealthData');
  }

  /**
   * PPG debugging
   */
  static logPPGFrame(frameIndex: number, redValue: number, signalQuality?: number): void {
    if (frameIndex % 30 === 0) { // Log every 30th frame to avoid spam
      this.verbose(`PPG Frame ${frameIndex}`, { redValue, signalQuality }, 'PPG');
    }
  }

  static logPPGResult(result: any): void {
    this.info('PPG Measurement Complete', result, 'PPG');
  }

  /**
   * Get debug report
   */
  static getDebugReport(): any {
    return {
      config: this.config,
      platform: Platform.OS,
      performanceMarks: Array.from(this.performanceMarks.entries()),
      memorySnapshots: this.memorySnapshots.slice(-10), // Last 10 snapshots
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear debug data
   */
  static clearDebugData(): void {
    this.performanceMarks.clear();
    this.memorySnapshots = [];
    this.info('Debug data cleared', null, 'Debugger');
  }
}

/**
 * React Hook for component debugging
 */
export function useComponentDebugger(componentName: string, props?: any) {
  React.useEffect(() => {
    AppDebugger.logComponentMount(componentName, props);
    return () => {
      AppDebugger.logComponentUnmount(componentName);
    };
  }, [componentName]);

  React.useEffect(() => {
    AppDebugger.logComponentUpdate(componentName, undefined, props);
  }, [componentName, props]);
}

/**
 * Error boundary with debugging
 */
export class DebugErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<any> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    AppDebugger.logError(error, errorInfo, 'ErrorBoundary');
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback;
      if (FallbackComponent) {
        return React.createElement(FallbackComponent, { error: this.state.error });
      }
      
      return React.createElement('div', {
        style: { padding: 20, textAlign: 'center' }
      }, 'Something went wrong. Please refresh the app.');
    }

    return this.props.children;
  }
}

/**
 * Network interceptor for debugging
 */
export class NetworkDebugger {
  static interceptFetch(): void {
    if (!__DEV__) return;

    const originalFetch = global.fetch;
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      
      AppDebugger.logNetworkRequest(url, method, init?.body);
      
      const startTime = Date.now();
      try {
        const response = await originalFetch(input, init);
        const duration = Date.now() - startTime;
        
        AppDebugger.logNetworkResponse(url, response.status, null, duration);
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        AppDebugger.logNetworkResponse(url, 0, error, duration);
        throw error;
      }
    };
  }
}

// Initialize network debugging in development
if (__DEV__) {
  NetworkDebugger.interceptFetch();
}

export default AppDebugger;