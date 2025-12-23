/**
 * HealthKit Debug Utility
 * Tracks when and where HealthKit is being loaded
 */

let loadAttempts: Array<{ timestamp: number; stack: string; source: string }> = [];

export const logHealthKitLoadAttempt = (source: string) => {
  const stack = new Error().stack || "No stack trace";
  loadAttempts.push({
    timestamp: Date.now(),
    stack,
    source,
  });
  console.log(`[HealthKit Debug] Load attempt from: ${source}`);
  console.log(`[HealthKit Debug] Stack:`, stack);
};

export const getLoadAttempts = () => loadAttempts;

export const clearLoadAttempts = () => {
  loadAttempts = [];
};

