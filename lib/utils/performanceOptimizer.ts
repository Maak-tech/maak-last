/**
 * Performance Optimization Utilities
 * 
 * Collection of utilities to optimize React Native app performance
 */

import React, { useCallback, useMemo, useRef } from 'react';

/**
 * Debounce hook for expensive operations
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay) as ReturnType<typeof setTimeout>;
    }) as T,
    [callback, delay]
  );
}

/**
 * Throttle hook for high-frequency operations
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastCallRef.current >= delay) {
        lastCallRef.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(...args);
        }, delay - (now - lastCallRef.current)) as ReturnType<typeof setTimeout>;
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Memoized calculation hook
 */
export function useMemoizedCalculation<T>(
  calculation: () => T,
  dependencies: React.DependencyList
): T {
  return useMemo(calculation, dependencies);
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static measurements: Map<string, number> = new Map();

  static startMeasurement(label: string): void {
    this.measurements.set(label, Date.now());
  }

  static endMeasurement(label: string): number {
    const startTime = this.measurements.get(label);
    if (!startTime) {
      return 0;
    }

    const duration = Date.now() - startTime;
    this.measurements.delete(label);

    return duration;
  }

  static measureAsync<T>(label: string, asyncFn: () => Promise<T>): Promise<T> {
    this.startMeasurement(label);
    return asyncFn().finally(() => {
      this.endMeasurement(label);
    });
  }
}

/**
 * Memory optimization utilities
 */
export class MemoryOptimizer {
  /**
   * Clean up large arrays by keeping only recent items
   */
  static trimArray<T>(array: T[], maxSize: number): T[] {
    if (array.length <= maxSize) {
      return array;
    }
    return array.slice(-maxSize);
  }

  /**
   * Batch process large datasets to avoid blocking the main thread
   */
  static async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => R,
    batchSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = batch.map(processor);
      results.push(...batchResults);
      
      // Yield control back to the main thread
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return results;
  }
}

/**
 * Frame rate optimization for animations
 */
export class FrameRateOptimizer {
  private static targetFPS = 60;
  private static frameInterval = 1000 / FrameRateOptimizer.targetFPS;
  private static lastFrameTime = 0;

  static shouldSkipFrame(): boolean {
    const now = Date.now();
    if (now - this.lastFrameTime < this.frameInterval) {
      return true;
    }
    this.lastFrameTime = now;
    return false;
  }

  static setTargetFPS(fps: number): void {
    this.targetFPS = fps;
    this.frameInterval = 1000 / fps;
  }
}

/**
 * Component optimization helpers
 */
export const OptimizationHelpers = {
  /**
   * Create a memoized component with shallow comparison
   */
  memoComponent: <P extends object>(
    Component: React.ComponentType<P>
  ): React.ComponentType<P> => {
    return React.memo(Component, (prevProps, nextProps) => {
      const prevKeys = Object.keys(prevProps);
      const nextKeys = Object.keys(nextProps);
      
      if (prevKeys.length !== nextKeys.length) {
        return false;
      }
      
      return prevKeys.every(key => 
        prevProps[key as keyof P] === nextProps[key as keyof P]
      );
    });
  },

  /**
   * Optimize re-renders by memoizing style objects
   */
  memoStyles: <T extends Record<string, any>>(
    styleFactory: () => T,
    dependencies: React.DependencyList
  ): T => {
    return useMemo(styleFactory, dependencies);
  }
};

/**
 * Network request optimization
 */
export class NetworkOptimizer {
  private static requestCache = new Map<string, { data: any; timestamp: number }>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  static async cachedRequest<T>(
    key: string,
    requestFn: () => Promise<T>,
    cacheTime: number = this.cacheTimeout
  ): Promise<T> {
    const cached = this.requestCache.get(key);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < cacheTime) {
      return cached.data;
    }
    
    const data = await requestFn();
    this.requestCache.set(key, { data, timestamp: now });
    
    return data;
  }

  static clearCache(): void {
    this.requestCache.clear();
  }
}

/**
 * Bundle size optimization helpers
 */
export const BundleOptimizer = {
  /**
   * Lazy load components to reduce initial bundle size
   */
  lazyComponent: <P extends object>(
    importFn: () => Promise<{ default: React.ComponentType<P> }>
  ): React.ComponentType<P> => {
    return React.lazy(importFn);
  },

  /**
   * Code splitting utility for large modules
   */
  dynamicImport: async <T>(
    importFn: () => Promise<T>
  ): Promise<T> => {
    try {
      return await importFn();
    } catch (error) {
      throw error;
    }
  }
};