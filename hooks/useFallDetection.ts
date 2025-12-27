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
  rotationRate?: number; // Gyroscope rotation rate (rad/s)
  impactSeverity?: "low" | "medium" | "high"; // Impact severity classification
}

interface BaselineMetrics {
  avgAcceleration: number;
  avgActivity: number;
  baselineOrientation: number;
  sampleCount: number;
}

// Enhanced fall detection configuration constants
// Extract frequently-used window size to module level for performance
const DATA_WINDOW_SIZE = 30; // Keep last 30 readings (1.5 seconds at 20 Hz)

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
  ALERT_COOLDOWN: 30_000, // 30 seconds between alerts

  // Data window size for pattern analysis (reduced for memory optimization)
  WINDOW_SIZE: DATA_WINDOW_SIZE,

  // Minimum confidence score for fall detection (0-1)
  MIN_CONFIDENCE: 0.7, // Require 70% confidence

  // Adaptive threshold adjustment
  BASELINE_SAMPLES: 80, // Reduced from 100 for faster baseline establishment
  ADAPTIVE_THRESHOLD_FACTOR: 0.15, // 15% adjustment based on baseline

  // Exponential moving average for better filtering
  EMA_ALPHA: 0.3, // Smoothing factor (0-1, lower = more smoothing)

  // Outlier detection
  OUTLIER_THRESHOLD: 3.0, // Standard deviations from mean
  MAX_OUTLIER_COUNT: 3, // Max consecutive outliers before resetting

  // Improved activity calculation
  RMS_WINDOW: 12, // Reduced window size for RMS calculation

  // Enhanced gyroscope analysis
  GYROSCOPE_ROTATION_THRESHOLD: 2.0, // rad/s (rapid rotation during fall)
  GYROSCOPE_VARIANCE_THRESHOLD: 0.5, // rad/s (rotation variance)

  // Impact magnitude analysis
  IMPACT_SEVERITY_LOW: 2.0, // G-force (gentle fall)
  IMPACT_SEVERITY_MEDIUM: 4.0, // G-force (moderate fall)
  IMPACT_SEVERITY_HIGH: 8.0, // G-force (severe fall)
  IMPACT_PATTERN_WINDOW: 200, // ms (analyze impact pattern)

  // Pre-fall activity pattern
  PRE_FALL_WINDOW: 1000, // ms (analyze 1 second before)
  PRE_FALL_ACTIVITY_THRESHOLD: 1.2, // G-force (normal walking)
  PRE_FALL_STABILITY_CHECK: true, // Check for stable activity

  // Multiple impact detection
  MULTIPLE_IMPACT_WINDOW: 500, // ms (window for multiple impacts)
  MAX_IMPACT_COUNT: 3, // Maximum impacts to consider

  // Recovery detection
  RECOVERY_WINDOW: 2000, // ms (window to detect recovery)
  RECOVERY_ACTIVITY_THRESHOLD: 0.8, // G-force (recovery movement)

  // Enhanced fall direction
  DIRECTION_CONFIDENCE_THRESHOLD: 0.8, // Confidence in direction
  FALL_ANGLE_THRESHOLD: 30, // degrees (fall angle)
} as const;

type FallPhase = "normal" | "freefall" | "impact" | "post_impact" | "cooldown";

// Optimized helper functions for signal processing
const calculateMagnitude = (x: number, y: number, z: number): number => {
  // Use Math.hypot for better precision and performance
  return Math.hypot(x, y, z);
};

const calculateJerk = (
  prevAccel: number,
  currAccel: number,
  timeDelta: number
): number => {
  if (timeDelta <= 0) return 0;
  return Math.abs(currAccel - prevAccel) / (timeDelta * 0.001); // Optimized conversion
};

const calculateOrientation = (x: number, y: number, z: number): number => {
  // Calculate pitch angle (rotation around X axis) with bounds checking
  const denominator = Math.hypot(x, z);
  return denominator > 0 ? Math.atan2(y, denominator) * 57.29577951308232 : 0; // 180/π precomputed
};

// Optimized moving average with early return - avoids creating intermediate arrays
const movingAverage = (values: number[], windowSize: number): number => {
  const len = values.length;
  if (len === 0) return 0;
  
  // Calculate start index without creating a new array
  const startIndex = Math.max(0, len - windowSize);
  const actualWindowSize = len - startIndex;
  let sum = 0;
  for (let i = startIndex; i < len; i++) {
    sum += values[i];
  }
  return sum / actualWindowSize;
};

// Optimized variance calculation
const calculateVariance = (values: number[]): number => {
  const len = values.length;
  if (len === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += values[i];
  }
  const mean = sum / len;
  
  let variance = 0;
  for (let i = 0; i < len; i++) {
    const diff = values[i] - mean;
    variance += diff * diff;
  }
  return Math.sqrt(variance / len); // Standard deviation
};

// Optimized RMS calculation
const calculateRMS = (values: number[]): number => {
  const len = values.length;
  if (len === 0) return 0;
  
  let sumSquares = 0;
  for (let i = 0; i < len; i++) {
    sumSquares += values[i] * values[i];
  }
  return Math.sqrt(sumSquares / len);
};

// Optimized data cleanup function
const cleanupDataArrays = (
  dataWindow: MotionData[],
  filteredData: FilteredData[],
  maxSize: number
) => {
  // Use splice to remove elements from the beginning in-place (more efficient than slice + push)
  if (dataWindow.length > maxSize) {
    dataWindow.splice(0, dataWindow.length - maxSize);
  }
  if (filteredData.length > maxSize) {
    filteredData.splice(0, filteredData.length - maxSize);
  }
};

// Exponential Moving Average (EMA) for better signal filtering
const exponentialMovingAverage = (
  current: number,
  previous: number,
  alpha: number
): number => alpha * current + (1 - alpha) * previous;

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

// Helper function to find maximum without spread operator
// Optimized: early return and type checking
const findMaxValue = (values: number[]): number => {
  const len = values.length;
  if (len === 0) return 0;
  if (len === 1) return values[0];
  
  let max = values[0];
  for (let i = 1; i < len; i++) {
    const val = values[i];
    if (val > max) max = val;
  }
  return max;
};

// Helper function to calculate maximum orientation change
const calculateMaxOrientationChange = (orientationChanges: number[]): number => {
  if (orientationChanges.length < 2) return 0;
  const changes: number[] = [];
  for (let i = 1; i < orientationChanges.length; i++) {
    changes.push(Math.abs(orientationChanges[i] - orientationChanges[i - 1]));
  }
  return findMaxValue(changes);
};

// Helper function to calculate orientation confidence score
// Validates input to prevent invalid calculations
const calculateOrientationConfidence = (
  maxOrientationChange: number
): number => {
  // Validate input: ensure it's a finite number and within reasonable bounds
  if (
    typeof maxOrientationChange !== "number" ||
    !isFinite(maxOrientationChange) ||
    maxOrientationChange < 0 ||
    maxOrientationChange > 360 // Maximum possible orientation change
  ) {
    return 0;
  }
  
  const threshold = FALL_CONFIG.ORIENTATION_CHANGE_THRESHOLD;
  if (maxOrientationChange >= threshold) {
    return 0.3;
  } else if (maxOrientationChange >= threshold * 0.5) {
    return 0.15;
  }
  return 0;
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
  const previousAccelComponentsRef = useRef<{
    x: number;
    y: number;
    z: number;
  }>({
    x: 0,
    y: 0,
    z: 0,
  });
  const impactHistoryRef = useRef<
    Array<{ timestamp: number; magnitude: number }>
  >([]);
  const preFallActivityRef = useRef<number[]>([]); // Store pre-fall activity

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
      console.error("[FallDetection] ❌ Error creating fall alert:", error);
      onFallDetected("error-alert");
    }
  }, [userId, onFallDetected]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let subscription: any;
    let isSubscriptionActive = false;
    let initializationTimeout: ReturnType<typeof setTimeout> | undefined;
    let dataSampleCount = 0; // Track data samples for periodic logging

    if (isActive && !isInitialized) {
      try {
        // Add timeout to prevent hanging initialization
        initializationTimeout = setTimeout(() => {
          console.error(
            "[FallDetection] ❌ Initialization timeout after 5 seconds"
          );
          setIsInitialized(false);
        }, 5000);

        // Dynamically import expo-sensors only on native platforms with better error handling
        const initializeSensors = async () => {
          try {
            // Check motion permissions first
            try {
              const { motionPermissionService } = await import(
                "@/lib/services/motionPermissionService"
              );
              const hasPermission =
                await motionPermissionService.hasMotionPermission();
              const status =
                await motionPermissionService.checkMotionAvailability();

              if (!status.available) {
                console.error(
                  "[FallDetection] ❌ Cannot initialize: Motion sensors not available -",
                  String(status.reason || "").replace(/[\r\n]/g, "")
                );
                setIsInitialized(false);
                return;
              }

              if (!(hasPermission || status.granted)) {
                const requested =
                  await motionPermissionService.requestMotionPermission();
                if (!requested) {
                  console.error(
                    "[FallDetection] ❌ Failed to request motion permission"
                  );
                  setIsInitialized(false);
                  return;
                }
              }
            } catch (permError: any) {
              // Silently handle permission check errors
            }

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
              console.error(
                "[FallDetection] ❌ DeviceMotion is not available on this device"
              );
              setIsInitialized(false);
              return;
            }

            // Set update interval for better accuracy (20 Hz = 50ms)
            DeviceMotion.setUpdateInterval(FALL_CONFIG.UPDATE_INTERVAL);

            subscription = DeviceMotion.addListener((data: any) => {
              if (!(isSubscriptionActive && data)) return;

              try {
                if (data.acceleration) {
                  dataSampleCount++;
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
                    try {
                      // Validate inputs before calculation with comprehensive checks
                      if (
                        typeof rawAccel !== "number" ||
                        typeof currentOrientation !== "number" ||
                        !isFinite(rawAccel) ||
                        !isFinite(currentOrientation) ||
                        rawAccel < 0 ||
                        rawAccel > 100 || // Reasonable upper bound
                        baseline.sampleCount < 0 ||
                        baseline.sampleCount >= FALL_CONFIG.BASELINE_SAMPLES
                      ) {
                        return;
                      }

                      // Safe calculation with overflow protection
                      const newSampleCount = baseline.sampleCount + 1;
                      if (newSampleCount > FALL_CONFIG.BASELINE_SAMPLES) {
                        return; // Prevent exceeding max samples
                      }

                      baseline.avgAcceleration =
                        (baseline.avgAcceleration * baseline.sampleCount +
                          rawAccel) /
                        newSampleCount;
                      baseline.sampleCount = newSampleCount;
                      
                      // Ensure we don't divide by zero and handle orientation safely
                      if (baseline.sampleCount > 0 && isFinite(currentOrientation)) {
                        baseline.baselineOrientation =
                          (baseline.baselineOrientation *
                            (baseline.sampleCount - 1) +
                            currentOrientation) /
                          baseline.sampleCount;
                        
                        // Validate result
                        if (!isFinite(baseline.baselineOrientation)) {
                          baseline.baselineOrientation = 0;
                        }
                      }
                    } catch (baselineError) {
                      const errorMessage = baselineError instanceof Error 
                        ? baselineError.message 
                        : String(baselineError);
                      console.error(
                        "[FallDetection] ❌ Error updating baseline:",
                        errorMessage.replace(/[\r\n]/g, "") // Sanitize error message
                      );
                      // Reset baseline on error to prevent corrupted state
                      baseline.sampleCount = 0;
                      baseline.avgAcceleration = 1.0;
                      baseline.baselineOrientation = 0;
                      baseline.avgActivity = 0.5;
                    }

                  }

                  // Check for outliers and filter them
                  if (baseline.sampleCount >= 10) {
                    try {
                      const recentAccels = filteredDataRef.current
                        .slice(-20)
                        .map((d) => {
                          const accel = d.acceleration;
                          // Validate acceleration values
                          return typeof accel === "number" && isFinite(accel) && accel >= 0 && accel < 100
                            ? accel
                            : 1.0; // Default safe value
                        });
                      
                      if (recentAccels.length > 0) {
                        const mean = movingAverage(
                          recentAccels,
                          recentAccels.length
                        );
                        
                        // Validate mean before calculating variance
                        if (isFinite(mean) && mean >= 0) {
                          const stdDev = calculateVariance(recentAccels);
                          
                          // Validate stdDev before outlier check
                          if (isFinite(stdDev) && stdDev >= 0) {
                            if (isOutlier(rawAccel, mean, stdDev)) {
                              outlierCountRef.current++;
                            if (
                              outlierCountRef.current >
                              FALL_CONFIG.MAX_OUTLIER_COUNT
                            ) {
                              // Skip processing this outlier value
                              return;
                            }
                            } else {
                              outlierCountRef.current = 0;
                            }
                          }
                        }
                      }
                    } catch (outlierError) {
                      // Continue processing even if outlier detection fails
                    }
                  }

                  // Apply exponential moving average for better filtering
                  emaAccelRef.current = exponentialMovingAverage(
                    rawAccel,
                    emaAccelRef.current,
                    FALL_CONFIG.EMA_ALPHA
                  );

                  // Also apply moving average filter as secondary smoothing
                  // Optimized: extract accelerations directly without intermediate arrays
                  const windowStart = Math.max(
                    0,
                    filteredDataRef.current.length - FALL_CONFIG.FILTER_WINDOW_SIZE
                  );
                  const smoothingAccels: number[] = [];
                  for (let i = windowStart; i < filteredDataRef.current.length; i++) {
                    smoothingAccels.push(filteredDataRef.current[i].acceleration);
                  }
                  smoothingAccels.push(emaAccelRef.current);
                  const filteredAccel = movingAverage(
                    smoothingAccels,
                    smoothingAccels.length
                  );

                  // Calculate jerk (rate of change of acceleration)
                  const timeDelta =
                    filteredDataRef.current.length > 0
                      ? now -
                        filteredDataRef.current[
                          filteredDataRef.current.length - 1
                        ].timestamp
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

                  // Calculate gyroscope rotation rate if available
                  let rotationRate = 0;
                  if (currentData.rotation) {
                    const rotationMagnitude =
                      currentData.rotation.alpha &&
                      currentData.rotation.beta &&
                      currentData.rotation.gamma
                        ? Math.sqrt(
                            currentData.rotation.alpha ** 2 +
                              currentData.rotation.beta ** 2 +
                              currentData.rotation.gamma ** 2
                          )
                        : 0;
                    rotationRate = rotationMagnitude * (Math.PI / 180); // Convert to rad/s
                  }

                  // Detect fall direction with enhanced analysis
                  const fallDirection = detectFallDirection(
                    currentData.acceleration.x,
                    currentData.acceleration.y,
                    currentData.acceleration.z,
                    previousAccelComponentsRef.current.x,
                    previousAccelComponentsRef.current.y,
                    previousAccelComponentsRef.current.z
                  );

                  // Classify impact severity
                  let impactSeverity: "low" | "medium" | "high" | undefined;
                  if (filteredAccel >= FALL_CONFIG.IMPACT_SEVERITY_LOW) {
                    if (filteredAccel >= FALL_CONFIG.IMPACT_SEVERITY_HIGH) {
                      impactSeverity = "high";
                    } else if (
                      filteredAccel >= FALL_CONFIG.IMPACT_SEVERITY_MEDIUM
                    ) {
                      impactSeverity = "medium";
                    } else {
                      impactSeverity = "low";
                    }
                  }

                  // Track pre-fall activity pattern
                  if (phaseRef.current === "normal") {
                    preFallActivityRef.current.push(filteredAccel);
                    // Keep only last PRE_FALL_WINDOW samples
                    const maxSamples =
                      FALL_CONFIG.PRE_FALL_WINDOW / FALL_CONFIG.UPDATE_INTERVAL;
                    if (preFallActivityRef.current.length > maxSamples) {
                      preFallActivityRef.current.shift();
                    }
                  }

                  // Update previous acceleration components
                  previousAccelComponentsRef.current = {
                    x: currentData.acceleration.x,
                    y: currentData.acceleration.y,
                    z: currentData.acceleration.z,
                  };

                  // Store filtered data - validate values before creating object
                  // This prevents creating objects with invalid data
                  const safeFilteredAccel = isFinite(filteredAccel) && filteredAccel >= 0 
                    ? filteredAccel 
                    : previousAccelRef.current;
                  const safeJerk = isFinite(jerk) && jerk >= 0 ? jerk : 0;
                  const safeOrientation = isFinite(currentOrientation) ? currentOrientation : previousOrientationRef.current;
                  const safeRotationRate = isFinite(rotationRate) && rotationRate >= 0 ? rotationRate : undefined;
                  
                  const filteredData: FilteredData = {
                    acceleration: safeFilteredAccel,
                    jerk: safeJerk,
                    orientation: safeOrientation,
                    fallDirection,
                    timestamp: now,
                    rotationRate: safeRotationRate,
                    impactSeverity,
                  };

                  // Add to raw data window and clean up efficiently
                  dataWindowRef.current.push(currentData);
                  filteredDataRef.current.push(filteredData);
                  
                  // Use efficient cleanup - only when arrays exceed threshold (reduces unnecessary operations)
                  if (
                    dataWindowRef.current.length > DATA_WINDOW_SIZE ||
                    filteredDataRef.current.length > DATA_WINDOW_SIZE
                  ) {
                    cleanupDataArrays(
                      dataWindowRef.current,
                      filteredDataRef.current,
                      DATA_WINDOW_SIZE
                    );
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
                  // Optimized: extract accelerations in a single pass without intermediate arrays
                  const rmsStart = Math.max(
                    0,
                    filteredDataRef.current.length - FALL_CONFIG.RMS_WINDOW
                  );
                  const recentAccelerations: number[] = [];
                  for (let i = rmsStart; i < filteredDataRef.current.length; i++) {
                    recentAccelerations.push(filteredDataRef.current[i].acceleration);
                  }
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
                      baseline.avgActivity * 0.95 + activityLevel * 0.05; // Slow adaptation
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
                    // Enhanced pre-fall activity check
                    let preFallStable = true;
                    if (
                      FALL_CONFIG.PRE_FALL_STABILITY_CHECK &&
                      preFallActivityRef.current.length >= 10
                    ) {
                      const preFallAvg = movingAverage(
                        preFallActivityRef.current,
                        preFallActivityRef.current.length
                      );
                      const preFallVariance = calculateVariance(
                        preFallActivityRef.current
                      );
                      // Check if pre-fall activity was stable (not intentional movement)
                      preFallStable =
                        preFallAvg < FALL_CONFIG.PRE_FALL_ACTIVITY_THRESHOLD &&
                        preFallVariance < 0.3;
                    }

                    // Check for freefall: low acceleration AND not high activity AND stable pre-fall
                    // Use adaptive thresholds if baseline is established
                    if (
                      filteredAccel < adaptiveFreefallThreshold &&
                      activityLevel < adaptiveActivityThreshold &&
                      preFallStable
                    ) {
                      // Potential freefall detected
                      phaseRef.current = "freefall";
                      freefallStartRef.current = now;
                      // Clear pre-fall activity tracking
                      preFallActivityRef.current = [];
                    }
                  }

                  // ===== PHASE 2: Validate Freefall Duration & Detect Impact =====
                  else if (phase === "freefall") {
                    const freefallDuration =
                      now - (freefallStartRef.current || now);

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

                        // Enhanced impact detection with gyroscope
                        const hasGyroscopeRotation =
                          rotationRate >=
                          FALL_CONFIG.GYROSCOPE_ROTATION_THRESHOLD;

                        if (hasImpact || hasJerk || hasGyroscopeRotation) {
                          // Impact detected after valid freefall!
                          // Track impact in history
                          impactHistoryRef.current.push({
                            timestamp: now,
                            magnitude: filteredAccel,
                          });
                          // Keep only recent impacts
                          const cutoffTime =
                            now - FALL_CONFIG.MULTIPLE_IMPACT_WINDOW;
                          impactHistoryRef.current =
                            impactHistoryRef.current.filter(
                              (imp) => imp.timestamp > cutoffTime
                            );

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
                    else if (
                      freefallDuration > FALL_CONFIG.FREEFALL_MAX_DURATION
                    ) {
                      phaseRef.current = "normal";
                      freefallStartRef.current = null;
                    }
                  }

                  // ===== PHASE 3: Check for Post-Impact Stillness =====
                  else if (phase === "impact") {
                    const postImpactDuration =
                      now - (impactTimeRef.current || now);

                    if (
                      postImpactDuration >= FALL_CONFIG.POST_IMPACT_MIN_DURATION
                    ) {
                      // Check if person remained relatively still
                      const recentFilteredData =
                        filteredDataRef.current.slice(-20); // Last ~1 second
                      let confidence = 0; // Declare confidence outside inner if block
                      if (recentFilteredData.length >= 10) {
                        const accelerations = recentFilteredData.map(
                          (d) => d.acceleration
                        );
                        const variance = calculateVariance(accelerations);

                        // Calculate confidence score based on multiple factors
                        confidence = 0;

                        // Factor 1: Low variance (stillness) - 40% weight
                        if (variance < FALL_CONFIG.POST_IMPACT_THRESHOLD) {
                          confidence += 0.4;
                        } else if (
                          variance <
                          FALL_CONFIG.POST_IMPACT_THRESHOLD * 1.5
                        ) {
                          confidence += 0.2;
                        }

                        // Factor 2: Orientation change (device rotated) - 30% weight
                        const orientationChanges = recentFilteredData
                          .slice(-10)
                          .map((d) => d.orientation);
                        
                        if (orientationChanges.length >= 5) {
                          const maxOrientationChange = calculateMaxOrientationChange(
                            orientationChanges
                          );
                          const orientationConfidence = calculateOrientationConfidence(
                            maxOrientationChange
                          );
                          confidence += orientationConfidence;
                        }

                        // Enhanced Factor 2b: Gyroscope rotation analysis - additional 5% weight
                        // Extract and validate rotation rates with proper error handling
                        const rotationRates: number[] = [];
                        try {
                          const recentData = recentFilteredData.slice(-10);
                          for (const d of recentData) {
                            const rate = d.rotationRate;
                            if (typeof rate === "number" && isFinite(rate) && rate > 0 && rate < 100) {
                              rotationRates.push(rate);
                            }
                          }
                        } catch (rotationError) {
                          // Silently handle rotation rate extraction errors
                        }
                        
                        if (rotationRates.length >= 3) {
                          const avgRotationRate = movingAverage(
                            rotationRates,
                            rotationRates.length
                          );
                          const rotationVariance =
                            calculateVariance(rotationRates);
                          if (
                            avgRotationRate >=
                              FALL_CONFIG.GYROSCOPE_ROTATION_THRESHOLD * 0.5 &&
                            rotationVariance >=
                              FALL_CONFIG.GYROSCOPE_VARIANCE_THRESHOLD
                          ) {
                            confidence += 0.05; // Additional confidence from gyroscope
                          }
                        }

                        // Factor 3: Post-impact duration - 20% weight
                        if (
                          postImpactDuration >= FALL_CONFIG.POST_IMPACT_DURATION
                        ) {
                          confidence += 0.2;
                        } else {
                          confidence +=
                            (postImpactDuration /
                              FALL_CONFIG.POST_IMPACT_DURATION) *
                            0.2;
                        }

                        // Factor 4: Low activity after impact - 10% weight
                        const activityThreshold =
                          baseline.sampleCount >= FALL_CONFIG.BASELINE_SAMPLES
                            ? adaptiveActivityThreshold
                            : FALL_CONFIG.ACTIVITY_THRESHOLD;
                        if (activityLevel < activityThreshold * 0.7) {
                          confidence += 0.1;
                        }

                        // Factor 5: Enhanced fall direction detection - 10% weight (increased)
                        // Helper function to simplify type predicate
                        const isValidDirection = (
                          direction: string | undefined
                        ): direction is "forward" | "backward" | "sideways" => {
                          return (
                            direction !== undefined &&
                            direction !== null &&
                            direction !== "unknown" &&
                            ["forward", "backward", "sideways"].includes(direction)
                          );
                        };

                        const recentDirections = filteredDataRef.current
                          .slice(-10)
                          .map((d) => d.fallDirection)
                          .filter(isValidDirection);
                        if (recentDirections.length >= 3) {
                          // Check direction consistency
                          const directionCounts: Record<string, number> = {};
                          recentDirections.forEach((dir) => {
                            directionCounts[dir] =
                              (directionCounts[dir] || 0) + 1;
                          });
                          const maxCount = Math.max(
                            ...Object.values(directionCounts)
                          );
                          const directionConfidence =
                            maxCount / recentDirections.length;

                          if (
                            directionConfidence >=
                            FALL_CONFIG.DIRECTION_CONFIDENCE_THRESHOLD
                          ) {
                            confidence += 0.1; // Increased weight for consistent direction
                          } else {
                            confidence += 0.05; // Partial credit for direction detection
                          }
                        }

                        // Factor 6: Impact severity analysis - 5% weight
                        const impactSeverities = recentFilteredData
                          .slice(-10)
                          .map((d) => d.impactSeverity)
                          .filter((s) => s !== undefined);
                        if (impactSeverities.length > 0) {
                          const hasHighSeverity = impactSeverities.some(
                            (s) => s === "high"
                          );
                          const hasMediumSeverity = impactSeverities.some(
                            (s) => s === "medium"
                          );
                          if (hasHighSeverity) {
                            confidence += 0.05; // High severity impact
                          } else if (hasMediumSeverity) {
                            confidence += 0.03; // Medium severity impact
                          }
                        }

                        // Factor 7: Multiple impacts - 5% weight
                        if (impactHistoryRef.current.length >= 2) {
                          confidence += 0.05; // Multiple impacts suggest real fall
                        }

                        // Factor 8: Recovery detection - reduces confidence if recovery detected
                        if (postImpactDuration >= FALL_CONFIG.RECOVERY_WINDOW) {
                          const recoveryActivity =
                            recentAccelerations.slice(-20);
                          if (recoveryActivity.length >= 10) {
                            const recoveryAvg = movingAverage(
                              recoveryActivity,
                              recoveryActivity.length
                            );
                            if (
                              recoveryAvg >=
                              FALL_CONFIG.RECOVERY_ACTIVITY_THRESHOLD
                            ) {
                              confidence -= 0.1; // Recovery detected - might be false positive
                            }
                          }
                        }

                        // FALL DETECTED if confidence is high enough
                        if (confidence >= FALL_CONFIG.MIN_CONFIDENCE) {
                          handleFallDetected();
                        }
                      }

                      // Reset after checking (even if not confident)
                      if (
                        postImpactDuration >= FALL_CONFIG.POST_IMPACT_DURATION
                      ) {
                        phaseRef.current = "normal";
                        freefallStartRef.current = null;
                        impactTimeRef.current = null;
                      }
                    }
                  }
                }
              } catch (dataError) {
                console.error(
                  "[FallDetection] ❌ Error processing sensor data:",
                  dataError
                );
                // Stop subscription on repeated errors to prevent crashes
                isSubscriptionActive = false;
              }
            });

            isSubscriptionActive = true;
            setIsInitialized(true);
          } catch (importError: any) {
            console.error(
              "[FallDetection] ❌ Sensor initialization failed:",
              importError?.message || importError
            );
            setIsInitialized(false);
            if (initializationTimeout) {
              clearTimeout(initializationTimeout);
            }
          }
        };

        initializeSensors();
      } catch (error: any) {
        console.error(
          "[FallDetection] ❌ Error starting sensor initialization:",
          error?.message || error
        );
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
          console.error(
            "[FallDetection] ❌ Error removing subscription:",
            removeError
          );
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
    impactHistoryRef.current = [];
    preFallActivityRef.current = [];
  }, []);

  return {
    isActive: isActive && isInitialized,
    startFallDetection,
    stopFallDetection,
  };
};
