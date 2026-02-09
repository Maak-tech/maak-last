/**
 * HealthKit Debug Utility
 * Tracks when and where HealthKit is being loaded
 */

let loadAttempts: Array<{ timestamp: number; stack: string; source: string }> =
  [];

export const logHealthKitLoadAttempt = (source: string) => {
  const stack =
    new Error("HealthKit load attempt trace").stack || "No stack trace";
  loadAttempts.push({
    timestamp: Date.now(),
    stack,
    source,
  });
  // Debug logging disabled for production
};

export const getLoadAttempts = () => loadAttempts;

export const clearLoadAttempts = () => {
  loadAttempts = [];
};
