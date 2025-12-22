import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { alertService } from "@/lib/services/alertService";

interface MotionData {
  acceleration: {
    x: number;
    y: number;
    z: number;
  };
  rotation?: {
    alpha?: number;
    beta?: number;
    gamma?: number;
  };
  timestamp: number;
}

interface FilteredData {
  acceleration: number; // Magnitude
  jerk: number; // Rate of change of acceleration
  orientation: number; // Orientation angle
  fallDirection?: "forward" | "backward" | "sideways" | "unknown"; // Fall direction
  timestamp: number;
}

interface BaselineMetrics {
  avgAcceleration: number;
  avgActivity: number;
  baselineOrientation: number;
  sampleCount: number;
}

// Enhanced fall detection configuration constants
const FALL_CONFIG = {
  // Update interval in milliseconds (50ms = 20 Hz for better accuracy)
  UPDATE_INTERVAL: 50,
  
  // Moving average filter window size (smooths sensor noise)
  FILTER_WINDOW_SIZE: 5,
  
  // Freefall detection: total acceleration drops significantly
  FREEFALL_THRESHOLD: 0.4, // G-force (normal is ~1.0, lowered for better sensitivity)
  FREEFALL_MIN_DURATION: 150, // milliseconds (reduced for faster detection)
  FREEFALL_MAX_DURATION: 1000, // milliseconds (increased to catch slower falls)
  
  // Impact detection: sudden high acceleration after freefall
  IMPACT_THRESHOLD: 2.0, // G-force (lowered for better sensitivity)
  IMPACT_MAX_THRESHOLD: 15.0, // G-force (increased to handle harder impacts)
  
  // Jerk (rate of change of acceleration) for impact detection
  JERK_THRESHOLD: 5.0, // m/s³ (sudden change indicates impact)
  
  // Orientation change detection (device rotation during fall)
  ORIENTATION_CHANGE_THRESHOLD: 45, // degrees (significant rotation indicates fall)
  
  // Post-impact: reduced movement after impact (person is still)
  POST_IMPACT_THRESHOLD: 0.25, // G-force variation (lowered for better detection)
  POST_IMPACT_DURATION: 800, // milliseconds (reduced for faster response)
  POST_IMPACT_MIN_DURATION: 400, // Minimum stillness duration
  
  // Activity level detection (to reduce false positives)
  ACTIVITY_THRESHOLD: 1.5, // G-force (high activity = likely not a fall)
  ACTIVITY_WINDOW: 10, // Number of readings to check activity
  
  // Cooldown to prevent duplicate detections
  ALERT_COOLDOWN: 30000, // 30 seconds between alerts
  
  // Data window size for pattern analysis
  WINDOW_SIZE: 40, // Keep last 40 readings (2 seconds at 20 Hz)
  
  // Minimum confidence score for fall detection (0-1)
  MIN_CONFIDENCE: 0.7, // Require 70% confidence
  
  // Adaptive threshold adjustment
  BASELINE_SAMPLES: 100, // Number of samples to establish baseline (5 seconds at 20 Hz)
  ADAPTIVE_THRESHOLD_FACTOR: 0.15, // 15% adjustment based on baseline
  
  // Exponential moving average for better filtering
  EMA_ALPHA: 0.3, // Smoothing factor (0-1, lower = more smoothing)
  
  // Outlier detection
  OUTLIER_THRESHOLD: 3.0, // Standard deviations from mean
  MAX_OUTLIER_COUNT: 3, // Max consecutive outliers before resetting
  
  // Improved activity calculation
  RMS_WINDOW: 15, // Window size for RMS calculation
};

type FallPhase = "normal" | "freefall" | "impact" | "post_impact" | "cooldown";

// Helper functions for signal processing
const calculateMagnitude = (x: number, y: number, z: number): number => {
  return Math.sqrt(x * x + y * y + z * z);
};

const calculateJerk = (
  prevAccel: number,
  currAccel: number,
  timeDelta: number
): number => {
  if (timeDelta === 0) return 0;
  return Math.abs(currAccel - prevAccel) / (timeDelta / 1000); // Convert to m/s³
};

const calculateOrientation = (x: number, y: number, z: number): number => {
  // Calculate pitch angle (rotation around X axis)
  return Math.atan2(y, Math.sqrt(x * x + z * z)) * (180 / Math.PI);
};

const movingAverage = (values: number[], windowSize: number): number => {
  if (values.length === 0) return 0;
  const window = values.slice(-windowSize);
  return window.reduce((sum, val) => sum + val, 0) / window.length;
};

const calculateVariance = (values: number[]): number => {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  return Math.sqrt(variance); // Standard deviation
};

// Calculate Root Mean Square (RMS) for better activity level detection
const calculateRMS = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sumSquares = values.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(sumSquares / values.length);
};

// Exponential Moving Average (EMA) for better signal filtering
const exponentialMovingAverage = (
  current: number,
  previous: number,
  alpha: number
): number => {
  return alpha * current + (1 - alpha) * previous;
};

// Detect fall direction based on acceleration components
const detectFallDirection = (
  x: number,
  y: number,
  z: number,
  prevX: number,
  prevY: number,
  prevZ: number
): "forward" | "backward" | "sideways" | "unknown" => {
  const dx = x - prevX;
  const dy = y - prevY;
  const dz = z - prevZ;
  
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const absDz = Math.abs(dz);
  
  const maxChange = Math.max(absDx, absDy, absDz);
  
  // Forward fall: negative Y (device tilts forward)
  if (absDy === maxChange && dy < -0.5) {
    return "forward";
  }
  // Backward fall: positive Y (device tilts backward)
  if (absDy === maxChange && dy > 0.5) {
    return "backward";
  }
  // Sideways fall: significant X or Z change
  if (absDx === maxChange || absDz === maxChange) {
    return "sideways";
  }
  
  return "unknown";
};

// Detect outliers using statistical methods
const isOutlier = (value: number, mean: number, stdDev: number): boolean => {
  if (stdDev === 0) return false;
  const zScore = Math.abs(value - mean) / stdDev;
  return zScore > FALL_CONFIG.OUTLIER_THRESHOLD;
};

export const useFallDetection = (
  userId: string | null,
  onFallDetected: (alertId: string) => void
) => {
  const [isActive, setIsActive] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Use refs to avoid stale closures in the sensor callback
  const phaseRef = useRef<FallPhase>("normal");
  const freefallStartRef = useRef<number | null>(null);
  const impactTimeRef = useRef<number | null>(null);
  const lastAlertRef = useRef<number>(0);
  const dataWindowRef = useRef<MotionData[]>([]);
  const filteredDataRef = useRef<FilteredData[]>([]);
  const previousAccelRef = useRef<number>(1.0); // Start with normal gravity
  const previousOrientationRef = useRef<number>(0);
  const baselineRef = useRef<BaselineMetrics>({
    avgAcceleration: 1.0,
    avgActivity: 0.5,
    baselineOrientation: 0,
    sampleCount: 0,
  });
  const emaAccelRef = useRef<number>(1.0); // Exponential moving average
  const outlierCountRef = useRef<number>(0);
  const previousAccelComponentsRef = useRef<{ x: number; y: number; z: number }>({
    x: 0,
    y: 0,
    z: 0,
  });

  const handleFallDetected = useCallback(async () => {
    const now = Date.now();
    
    // Check cooldown period
    if (now - lastAlertRef.current < FALL_CONFIG.ALERT_COOLDOWN) {
      return; // Too soon since last alert
    }
    
    lastAlertRef.current = now;
    phaseRef.current = "cooldown";
    
    // Reset to normal after cooldown
    setTimeout(() => {
      phaseRef.current = "normal";
      freefallStartRef.current = null;
      impactTimeRef.current = null;
    }, FALL_CONFIG.ALERT_COOLDOWN);

    try {
      if (userId) {
        // Create alert in Firebase
        const alertId = await alertService.createFallAlert(userId);
        onFallDetected(alertId);
      } else {
        onFallDetected("demo-alert");
      }
    } catch (error) {
      onFallDetected("error-alert");
    }
  }, [userId, onFallDetected]);

  useEffect(() => {
    if (Platform.OS === "web") {
      // Fall detection not available on web
      return;
    }

    let subscription: any;
    let isSubscriptionActive = false;
    let initializationTimeout: ReturnType<typeof setTimeout> | undefined;

    if (isActive && !isInitialized) {
      try {
        // Add timeout to prevent hanging initialization
        initializationTimeout = setTimeout(() => {
          setIsInitialized(false);
        }, 5000);

        // Dynamically import expo-sensors only on native platforms with better error handling
        const initializeSensors = async () => {
          try {
            // Add delay to ensure React Native bridge is ready
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const { DeviceMotion } = await import("expo-sensors");

            // Clear timeout if initialization succeeds
            if (initializationTimeout) {
              clearTimeout(initializationTimeout);
            }

            // Check if DeviceMotion is available with timeout
            const availabilityPromise = DeviceMotion.isAvailableAsync();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), 3000)
            );

            const isAvailable = (await Promise.race([
              availabilityPromise,
              timeoutPromise,
            ])) as boolean;

            if (!isAvailable) {
              setIsInitialized(false);
              return;
            }

            // Set update interval for better accuracy (20 Hz = 50ms)
            DeviceMotion.setUpdateInterval(FALL_CONFIG.UPDATE_INTERVAL);

            subscription = DeviceMotion.addListener((data: any) => {
              if (!(isSubscriptionActive && data)) return;

              try {
                if (data.acceleration) {
                  const now = Date.now();
                  const currentData: MotionData = {
                    acceleration: {
                      x: data.acceleration.x || 0,
                      y: data.acceleration.y || 0,
                      z: data.acceleration.z || 0,
                    },
                    rotation: data.rotation
                      ? {
                          alpha: data.rotation.alpha,
                          beta: data.rotation.beta,
                          gamma: data.rotation.gamma,
                        }
                      : undefined,
                    timestamp: now,
                  };

                  // Calculate raw acceleration magnitude
                  const rawAccel = calculateMagnitude(
                    currentData.acceleration.x,
                    currentData.acceleration.y,
                    currentData.acceleration.z
                  );

                  // Calculate orientation (needed for baseline)
                  const currentOrientation = calculateOrientation(
                    currentData.acceleration.x,
                    currentData.acceleration.y,
                    currentData.acceleration.z
                  );

                  // Update baseline metrics for adaptive thresholds
                  const baseline = baselineRef.current;
                  if (baseline.sampleCount < FALL_CONFIG.BASELINE_SAMPLES) {
                    baseline.avgAcceleration =
                      (baseline.avgAcceleration * baseline.sampleCount + rawAccel) /
                      (baseline.sampleCount + 1);
                    baseline.sampleCount++;
                    baseline.baselineOrientation =
                      (baseline.baselineOrientation * (baseline.sampleCount - 1) +
                        currentOrientation) /
                      baseline.sampleCount;
                  }

                  // Check for outliers and filter them
                  if (baseline.sampleCount >= 10) {
                    const recentAccels = filteredDataRef.current
                      .slice(-20)
                      .map((d) => d.acceleration);
                    if (recentAccels.length > 0) {
                      const mean = movingAverage(recentAccels, recentAccels.length);
                      const stdDev = calculateVariance(recentAccels);
                      if (isOutlier(rawAccel, mean, stdDev)) {
                        outlierCountRef.current++;
                        if (outlierCountRef.current > FALL_CONFIG.MAX_OUTLIER_COUNT) {
                          // Too many outliers, use previous value
                          return;
                        }
                      } else {
                        outlierCountRef.current = 0;
                      }
                    }
                  }

                  // Apply exponential moving average for better filtering
                  emaAccelRef.current = exponentialMovingAverage(
                    rawAccel,
                    emaAccelRef.current,
                    FALL_CONFIG.EMA_ALPHA
                  );

                  // Also apply moving average filter as secondary smoothing
                  const recentAccels = filteredDataRef.current
                    .slice(-FALL_CONFIG.FILTER_WINDOW_SIZE)
                    .map((d) => d.acceleration);
                  recentAccels.push(emaAccelRef.current);
                  const filteredAccel = movingAverage(
                    recentAccels,
                    FALL_CONFIG.FILTER_WINDOW_SIZE
                  );

                  // Calculate jerk (rate of change of acceleration)
                  const timeDelta = filteredDataRef.current.length > 0
                    ? now - filteredDataRef.current[filteredDataRef.current.length - 1].timestamp
                    : FALL_CONFIG.UPDATE_INTERVAL;
                  const jerk = calculateJerk(
                    previousAccelRef.current,
                    filteredAccel,
                    timeDelta
                  );

                  // Calculate orientation change (orientation already calculated above)
                  const orientationChange = Math.abs(
                    currentOrientation - previousOrientationRef.current
                  );

                  // Detect fall direction
                  const fallDirection = detectFallDirection(
                    currentData.acceleration.x,
                    currentData.acceleration.y,
                    currentData.acceleration.z,
                    previousAccelComponentsRef.current.x,
                    previousAccelComponentsRef.current.y,
                    previousAccelComponentsRef.current.z
                  );

                  // Update previous acceleration components
                  previousAccelComponentsRef.current = {
                    x: currentData.acceleration.x,
                    y: currentData.acceleration.y,
                    z: currentData.acceleration.z,
                  };

                  // Store filtered data
                  const filteredData: FilteredData = {
                    acceleration: filteredAccel,
                    jerk,
                    orientation: currentOrientation,
                    fallDirection,
                    timestamp: now,
                  };

                  filteredDataRef.current.push(filteredData);
                  if (filteredDataRef.current.length > FALL_CONFIG.WINDOW_SIZE) {
                    filteredDataRef.current.shift();
                  }

                  // Add to raw data window
                  dataWindowRef.current.push(currentData);
                  if (dataWindowRef.current.length > FALL_CONFIG.WINDOW_SIZE) {
                    dataWindowRef.current.shift();
                  }

                  // Update previous values
                  previousAccelRef.current = filteredAccel;
                  previousOrientationRef.current = currentOrientation;

                  const phase = phaseRef.current;

                  // Skip if in cooldown
                  if (phase === "cooldown") {
                    return;
                  }

                  // Calculate activity level using RMS (Root Mean Square) for better accuracy
                  const recentAccelerations = filteredDataRef.current
                    .slice(-FALL_CONFIG.RMS_WINDOW)
                    .map((d) => d.acceleration);
                  const rmsActivity = calculateRMS(recentAccelerations);
                  const avgActivity = movingAverage(
                    recentAccelerations,
                    FALL_CONFIG.ACTIVITY_WINDOW
                  );
                  
                  // Use RMS for activity check (more sensitive to variations)
                  const activityLevel = Math.max(rmsActivity, avgActivity);
                  
                  // Update baseline activity level
                  if (baseline.sampleCount >= FALL_CONFIG.BASELINE_SAMPLES) {
                    baseline.avgActivity =
                      (baseline.avgActivity * 0.95 + activityLevel * 0.05); // Slow adaptation
                  }

                  // Adaptive threshold adjustment based on baseline
                  const adaptiveFreefallThreshold =
                    baseline.sampleCount >= FALL_CONFIG.BASELINE_SAMPLES
                      ? FALL_CONFIG.FREEFALL_THRESHOLD *
                        (1 -
                          FALL_CONFIG.ADAPTIVE_THRESHOLD_FACTOR *
                            (baseline.avgAcceleration - 1.0))
                      : FALL_CONFIG.FREEFALL_THRESHOLD;
                  
                  const adaptiveActivityThreshold =
                    baseline.sampleCount >= FALL_CONFIG.BASELINE_SAMPLES
                      ? FALL_CONFIG.ACTIVITY_THRESHOLD *
                        (1 +
                          FALL_CONFIG.ADAPTIVE_THRESHOLD_FACTOR *
                            (baseline.avgActivity - 0.5))
                      : FALL_CONFIG.ACTIVITY_THRESHOLD;

                  // ===== PHASE 1: Detect Freefall =====
                  if (phase === "normal") {
                    // Check for freefall: low acceleration AND not high activity
                    // Use adaptive thresholds if baseline is established
                    if (
                      filteredAccel < adaptiveFreefallThreshold &&
                      activityLevel < adaptiveActivityThreshold
                    ) {
                      // Potential freefall detected
                      phaseRef.current = "freefall";
                      freefallStartRef.current = now;
                    }
                  }

                  // ===== PHASE 2: Validate Freefall Duration & Detect Impact =====
                  else if (phase === "freefall") {
                    const freefallDuration = now - (freefallStartRef.current || now);

                    // Check if freefall ended (acceleration returned)
                    if (filteredAccel >= FALL_CONFIG.FREEFALL_THRESHOLD) {
                      // Freefall ended - check if it was valid duration
                      if (
                        freefallDuration >= FALL_CONFIG.FREEFALL_MIN_DURATION &&
                        freefallDuration <= FALL_CONFIG.FREEFALL_MAX_DURATION
                      ) {
                        // Valid freefall - now check for impact using both acceleration and jerk
                        const hasImpact =
                          filteredAccel >= FALL_CONFIG.IMPACT_THRESHOLD &&
                          filteredAccel <= FALL_CONFIG.IMPACT_MAX_THRESHOLD;
                        const hasJerk = jerk >= FALL_CONFIG.JERK_THRESHOLD;

                        if (hasImpact || hasJerk) {
                          // Impact detected after valid freefall!
                          phaseRef.current = "impact";
                          impactTimeRef.current = now;
                        } else {
                          // No significant impact, reset
                          phaseRef.current = "normal";
                          freefallStartRef.current = null;
                        }
                      } else {
                        // Freefall duration invalid, reset
                        phaseRef.current = "normal";
                        freefallStartRef.current = null;
                      }
                    }
                    // Freefall too long, probably not a fall
                    else if (freefallDuration > FALL_CONFIG.FREEFALL_MAX_DURATION) {
                      phaseRef.current = "normal";
                      freefallStartRef.current = null;
                    }
                  }

                  // ===== PHASE 3: Check for Post-Impact Stillness =====
                  else if (phase === "impact") {
                    const postImpactDuration = now - (impactTimeRef.current || now);

                    if (postImpactDuration >= FALL_CONFIG.POST_IMPACT_MIN_DURATION) {
                      // Check if person remained relatively still
                      const recentFilteredData = filteredDataRef.current.slice(-20); // Last ~1 second
                      if (recentFilteredData.length >= 10) {
                        const accelerations = recentFilteredData.map((d) => d.acceleration);
                        const variance = calculateVariance(accelerations);

                        // Calculate confidence score based on multiple factors
                        let confidence = 0;

                        // Factor 1: Low variance (stillness) - 40% weight
                        if (variance < FALL_CONFIG.POST_IMPACT_THRESHOLD) {
                          confidence += 0.4;
                        } else if (variance < FALL_CONFIG.POST_IMPACT_THRESHOLD * 1.5) {
                          confidence += 0.2;
                        }

                        // Factor 2: Orientation change (device rotated) - 30% weight
                        const orientationChanges = recentFilteredData
                          .slice(-10)
                          .map((d) => d.orientation);
                        if (orientationChanges.length >= 5) {
                          const maxOrientationChange = Math.max(
                            ...orientationChanges.map((o, i) =>
                              i > 0 ? Math.abs(o - orientationChanges[i - 1]) : 0
                            )
                          );
                          if (maxOrientationChange >= FALL_CONFIG.ORIENTATION_CHANGE_THRESHOLD) {
                            confidence += 0.3;
                          } else if (maxOrientationChange >= FALL_CONFIG.ORIENTATION_CHANGE_THRESHOLD * 0.5) {
                            confidence += 0.15;
                          }
                        }

                        // Factor 3: Post-impact duration - 20% weight
                        if (postImpactDuration >= FALL_CONFIG.POST_IMPACT_DURATION) {
                          confidence += 0.2;
                        } else {
                          confidence += (postImpactDuration / FALL_CONFIG.POST_IMPACT_DURATION) * 0.2;
                        }

                        // Factor 4: Low activity after impact - 10% weight
                        const activityThreshold = baseline.sampleCount >= FALL_CONFIG.BASELINE_SAMPLES
                          ? adaptiveActivityThreshold
                          : FALL_CONFIG.ACTIVITY_THRESHOLD;
                        if (activityLevel < activityThreshold * 0.7) {
                          confidence += 0.1;
                        }
                        
                        // Factor 5: Fall direction detection - 5% weight (bonus)
                        const recentDirections = filteredDataRef.current
                          .slice(-10)
                          .map((d) => d.fallDirection)
                          .filter((d) => d && d !== "unknown");
                        if (recentDirections.length > 0) {
                          // If we detected a clear fall direction, increase confidence
                          confidence += 0.05;
                        }

                        // FALL DETECTED if confidence is high enough
                        if (confidence >= FALL_CONFIG.MIN_CONFIDENCE) {
                          handleFallDetected();
                        }
                      }

                      // Reset after checking (even if not confident)
                      if (postImpactDuration >= FALL_CONFIG.POST_IMPACT_DURATION) {
                        phaseRef.current = "normal";
                        freefallStartRef.current = null;
                        impactTimeRef.current = null;
                      }
                    }
                  }
                }
              } catch (dataError) {
                // Stop subscription on repeated errors to prevent crashes
                isSubscriptionActive = false;
              }
            });

            isSubscriptionActive = true;
            setIsInitialized(true);
          } catch (importError) {
            setIsInitialized(false);
            if (initializationTimeout) {
              clearTimeout(initializationTimeout);
            }
          }
        };

        initializeSensors();
      } catch (error) {
        setIsInitialized(false);
        if (initializationTimeout) {
          clearTimeout(initializationTimeout);
        }
      }
    }

    return () => {
      isSubscriptionActive = false;
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
      }
      if (subscription) {
        try {
          subscription.remove();
        } catch (removeError) {
          // Silently handle subscription removal error
        }
      }
    };
  }, [isActive, isInitialized, handleFallDetected]);

  const startFallDetection = useCallback(() => {
    if (Platform.OS !== "web") {
      setIsActive(true);
    }
  }, []);

  const stopFallDetection = useCallback(() => {
    setIsActive(false);
    setIsInitialized(false);
    
    // Reset all detection state
    phaseRef.current = "normal";
    freefallStartRef.current = null;
    impactTimeRef.current = null;
    dataWindowRef.current = [];
    filteredDataRef.current = [];
    previousAccelRef.current = 1.0;
    previousOrientationRef.current = 0;
    baselineRef.current = {
      avgAcceleration: 1.0,
      avgActivity: 0.5,
      baselineOrientation: 0,
      sampleCount: 0,
    };
    emaAccelRef.current = 1.0;
    outlierCountRef.current = 0;
    previousAccelComponentsRef.current = { x: 0, y: 0, z: 0 };
  }, []);

  return {
    isActive: isActive && isInitialized,
    startFallDetection,
    stopFallDetection,
  };
};
