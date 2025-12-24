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
  
  // Enhanced gyroscope analysis
  GYROSCOPE_ROTATION_THRESHOLD: 2.0, // rad/s (rapid rotation during fall)
  GYROSCOPE_VARIANCE_THRESHOLD: 0.5, // rad/s (rotation variance)
  
  // Impact magnitude analysis
  IMPACT_SEVERITY_LOW: 2.0,    // G-force (gentle fall)
  IMPACT_SEVERITY_MEDIUM: 4.0, // G-force (moderate fall)
  IMPACT_SEVERITY_HIGH: 8.0,   // G-force (severe fall)
  IMPACT_PATTERN_WINDOW: 200,  // ms (analyze impact pattern)
  
  // Pre-fall activity pattern
  PRE_FALL_WINDOW: 1000,        // ms (analyze 1 second before)
  PRE_FALL_ACTIVITY_THRESHOLD: 1.2, // G-force (normal walking)
  PRE_FALL_STABILITY_CHECK: true,   // Check for stable activity
  
  // Multiple impact detection
  MULTIPLE_IMPACT_WINDOW: 500,  // ms (window for multiple impacts)
  MAX_IMPACT_COUNT: 3,          // Maximum impacts to consider
  
  // Recovery detection
  RECOVERY_WINDOW: 2000,        // ms (window to detect recovery)
  RECOVERY_ACTIVITY_THRESHOLD: 0.8, // G-force (recovery movement)
  
  // Enhanced fall direction
  DIRECTION_CONFIDENCE_THRESHOLD: 0.8, // Confidence in direction
  FALL_ANGLE_THRESHOLD: 30,            // degrees (fall angle)
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
  const impactHistoryRef = useRef<Array<{ timestamp: number; magnitude: number }>>([]);
  const preFallActivityRef = useRef<number[]>([]); // Store pre-fall activity

  const handleFallDetected = useCallback(async () => {
    const now = Date.now();
    
    // Check cooldown period
    if (now - lastAlertRef.current < FALL_CONFIG.ALERT_COOLDOWN) {
      console.log("[FallDetection] ⏸️ Fall detected but in cooldown period. Time remaining:", 
        Math.round((FALL_CONFIG.ALERT_COOLDOWN - (now - lastAlertRef.current)) / 1000), "seconds");
      return; // Too soon since last alert
    }
    
    console.log("[FallDetection] 🚨 FALL DETECTED! Creating alert...");
    lastAlertRef.current = now;
    phaseRef.current = "cooldown";
    
    // Reset to normal after cooldown
    setTimeout(() => {
      phaseRef.current = "normal";
      freefallStartRef.current = null;
      impactTimeRef.current = null;
      console.log("[FallDetection] ✅ Cooldown period ended. Ready for new detections.");
    }, FALL_CONFIG.ALERT_COOLDOWN);

    try {
      if (userId) {
        // Create alert in Firebase
        const alertId = await alertService.createFallAlert(userId);
        console.log("[FallDetection] ✅ Alert created successfully. Alert ID:", alertId);
        onFallDetected(alertId);
      } else {
        console.log("[FallDetection] ⚠️ No userId, creating demo alert");
        onFallDetected("demo-alert");
      }
    } catch (error) {
      console.error("[FallDetection] ❌ Error creating fall alert:", error);
      onFallDetected("error-alert");
    }
  }, [userId, onFallDetected]);

  useEffect(() => {
    if (Platform.OS === "web") {
      console.log("[FallDetection] ⚠️ Fall detection not available on web platform");
      return;
    }

    let subscription: any;
    let isSubscriptionActive = false;
    let initializationTimeout: ReturnType<typeof setTimeout> | undefined;
    let dataSampleCount = 0; // Track data samples for periodic logging

    if (isActive && !isInitialized) {
      console.log("[FallDetection] 🔄 Starting sensor initialization...");
      try {
        // Add timeout to prevent hanging initialization
        initializationTimeout = setTimeout(() => {
          console.error("[FallDetection] ❌ Initialization timeout after 5 seconds");
          setIsInitialized(false);
        }, 5000);

        // Dynamically import expo-sensors only on native platforms with better error handling
        const initializeSensors = async () => {
          try {
            // Check motion permissions first
            console.log("[FallDetection] 🔐 Checking motion permissions before initialization...");
            try {
              const { motionPermissionService } = await import("@/lib/services/motionPermissionService");
              const hasPermission = await motionPermissionService.hasMotionPermission();
              const status = await motionPermissionService.checkMotionAvailability();
              
              console.log("[FallDetection] 📋 Permission check results:", {
                hasStoredPermission: hasPermission,
                sensorsAvailable: status.available,
                permissionGranted: status.granted,
                reason: status.reason,
              });
              
              if (!status.available) {
                console.error("[FallDetection] ❌ Cannot initialize: Motion sensors not available -", status.reason);
                setIsInitialized(false);
                return;
              }
              
              if (!hasPermission && !status.granted) {
                console.warn("[FallDetection] ⚠️ Motion permissions not granted. Attempting to request...");
                const requested = await motionPermissionService.requestMotionPermission();
                if (!requested) {
                  console.error("[FallDetection] ❌ Failed to request motion permission");
                  setIsInitialized(false);
                  return;
                }
                console.log("[FallDetection] ✅ Motion permission requested successfully");
              }
            } catch (permError: any) {
              console.warn("[FallDetection] ⚠️ Error checking permissions (continuing anyway):", permError?.message);
            }

            console.log("[FallDetection] ⏳ Waiting for React Native bridge (1s delay)...");
            // Add delay to ensure React Native bridge is ready
            await new Promise((resolve) => setTimeout(resolve, 1000));

            console.log("[FallDetection] 📦 Importing expo-sensors...");
            const { DeviceMotion } = await import("expo-sensors");
            console.log("[FallDetection] ✅ expo-sensors imported successfully");

            // Clear timeout if initialization succeeds
            if (initializationTimeout) {
              clearTimeout(initializationTimeout);
            }

            // Check if DeviceMotion is available with timeout
            console.log("[FallDetection] 🔍 Checking DeviceMotion availability...");
            const availabilityPromise = DeviceMotion.isAvailableAsync();
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), 3000)
            );

            const isAvailable = (await Promise.race([
              availabilityPromise,
              timeoutPromise,
            ])) as boolean;

            if (!isAvailable) {
              console.error("[FallDetection] ❌ DeviceMotion is not available on this device");
              setIsInitialized(false);
              return;
            }

            console.log("[FallDetection] ✅ DeviceMotion is available");
            console.log("[FallDetection] ⚙️ Setting update interval to", FALL_CONFIG.UPDATE_INTERVAL, "ms (", 
              Math.round(1000 / FALL_CONFIG.UPDATE_INTERVAL), "Hz)");

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

                  // Log first sample and every 100th sample (every ~5 seconds at 20Hz)
                  if (dataSampleCount === 1) {
                    console.log("[FallDetection] 📊 First sensor data received:", {
                      acceleration: currentData.acceleration,
                      rotation: currentData.rotation,
                    });
                  } else if (dataSampleCount % 100 === 0) {
                    console.log("[FallDetection] 📊 Sensor data sample #" + dataSampleCount + ":", {
                      acceleration: currentData.acceleration,
                      samplesReceived: dataSampleCount,
                    });
                  }

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
                    
                    // Log baseline progress
                    if (baseline.sampleCount === 1) {
                      console.log("[FallDetection] 📈 Starting baseline calibration...");
                    } else if (baseline.sampleCount === FALL_CONFIG.BASELINE_SAMPLES) {
                      console.log("[FallDetection] ✅ Baseline calibration complete:", {
                        avgAcceleration: baseline.avgAcceleration.toFixed(3),
                        baselineOrientation: baseline.baselineOrientation.toFixed(1),
                        samples: baseline.sampleCount,
                      });
                    } else if (baseline.sampleCount % 20 === 0) {
                      console.log("[FallDetection] 📈 Baseline progress:", 
                        baseline.sampleCount + "/" + FALL_CONFIG.BASELINE_SAMPLES,
                        "samples");
                    }
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

                  // Calculate gyroscope rotation rate if available
                  let rotationRate = 0;
                  if (currentData.rotation) {
                    const rotationMagnitude = currentData.rotation.alpha && 
                      currentData.rotation.beta && 
                      currentData.rotation.gamma
                      ? Math.sqrt(
                          Math.pow(currentData.rotation.alpha, 2) +
                          Math.pow(currentData.rotation.beta, 2) +
                          Math.pow(currentData.rotation.gamma, 2)
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
                  let impactSeverity: "low" | "medium" | "high" | undefined = undefined;
                  if (filteredAccel >= FALL_CONFIG.IMPACT_SEVERITY_LOW) {
                    if (filteredAccel >= FALL_CONFIG.IMPACT_SEVERITY_HIGH) {
                      impactSeverity = "high";
                    } else if (filteredAccel >= FALL_CONFIG.IMPACT_SEVERITY_MEDIUM) {
                      impactSeverity = "medium";
                    } else {
                      impactSeverity = "low";
                    }
                  }

                  // Track pre-fall activity pattern
                  if (phaseRef.current === "normal") {
                    preFallActivityRef.current.push(filteredAccel);
                    // Keep only last PRE_FALL_WINDOW samples
                    const maxSamples = FALL_CONFIG.PRE_FALL_WINDOW / FALL_CONFIG.UPDATE_INTERVAL;
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

                  // Store filtered data
                  const filteredData: FilteredData = {
                    acceleration: filteredAccel,
                    jerk,
                    orientation: currentOrientation,
                    fallDirection,
                    timestamp: now,
                    rotationRate: rotationRate || undefined,
                    impactSeverity,
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
                    // Enhanced pre-fall activity check
                    let preFallStable = true;
                    if (FALL_CONFIG.PRE_FALL_STABILITY_CHECK && preFallActivityRef.current.length >= 10) {
                      const preFallAvg = movingAverage(preFallActivityRef.current, preFallActivityRef.current.length);
                      const preFallVariance = calculateVariance(preFallActivityRef.current);
                      // Check if pre-fall activity was stable (not intentional movement)
                      preFallStable = preFallAvg < FALL_CONFIG.PRE_FALL_ACTIVITY_THRESHOLD && 
                                     preFallVariance < 0.3;
                      
                      if (!preFallStable) {
                        console.log("[FallDetection] ⚠️ Pre-fall activity suggests intentional movement. Skipping.");
                      }
                    }

                    // Check for freefall: low acceleration AND not high activity AND stable pre-fall
                    // Use adaptive thresholds if baseline is established
                    if (
                      filteredAccel < adaptiveFreefallThreshold &&
                      activityLevel < adaptiveActivityThreshold &&
                      preFallStable
                    ) {
                      // Potential freefall detected
                      console.log("[FallDetection] ⬇️ Freefall phase started:", {
                        acceleration: filteredAccel.toFixed(3),
                        threshold: adaptiveFreefallThreshold.toFixed(3),
                        activityLevel: activityLevel.toFixed(3),
                        baselineEstablished: baseline.sampleCount >= FALL_CONFIG.BASELINE_SAMPLES,
                        preFallStable,
                        rotationRate: rotationRate.toFixed(3),
                      });
                      phaseRef.current = "freefall";
                      freefallStartRef.current = now;
                      // Clear pre-fall activity tracking
                      preFallActivityRef.current = [];
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

                        console.log("[FallDetection] 💥 Freefall ended. Checking impact:", {
                          duration: freefallDuration + "ms",
                          acceleration: filteredAccel.toFixed(3),
                          jerk: jerk.toFixed(3),
                          hasImpact,
                          hasJerk,
                        });

                        // Enhanced impact detection with gyroscope
                        const hasGyroscopeRotation = rotationRate >= FALL_CONFIG.GYROSCOPE_ROTATION_THRESHOLD;
                        
                        if (hasImpact || hasJerk || hasGyroscopeRotation) {
                          // Impact detected after valid freefall!
                          // Track impact in history
                          impactHistoryRef.current.push({
                            timestamp: now,
                            magnitude: filteredAccel,
                          });
                          // Keep only recent impacts
                          const cutoffTime = now - FALL_CONFIG.MULTIPLE_IMPACT_WINDOW;
                          impactHistoryRef.current = impactHistoryRef.current.filter(
                            imp => imp.timestamp > cutoffTime
                          );
                          
                          console.log("[FallDetection] 💥 Impact phase started!", {
                            impactCount: impactHistoryRef.current.length,
                            severity: impactSeverity,
                            hasGyroscopeRotation,
                            rotationRate: rotationRate.toFixed(3),
                          });
                          phaseRef.current = "impact";
                          impactTimeRef.current = now;
                        } else {
                          // No significant impact, reset
                          console.log("[FallDetection] ⚠️ No impact detected. Resetting to normal.");
                          phaseRef.current = "normal";
                          freefallStartRef.current = null;
                        }
                      } else {
                        // Freefall duration invalid, reset
                        console.log("[FallDetection] ⚠️ Freefall duration invalid:", 
                          freefallDuration + "ms (required: " + FALL_CONFIG.FREEFALL_MIN_DURATION + 
                          "-" + FALL_CONFIG.FREEFALL_MAX_DURATION + "ms). Resetting.");
                        phaseRef.current = "normal";
                        freefallStartRef.current = null;
                      }
                    }
                    // Freefall too long, probably not a fall
                    else if (freefallDuration > FALL_CONFIG.FREEFALL_MAX_DURATION) {
                      console.log("[FallDetection] ⚠️ Freefall too long (" + freefallDuration + 
                        "ms). Probably not a fall. Resetting.");
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

                        // Enhanced Factor 2b: Gyroscope rotation analysis - additional 5% weight
                        const rotationRates = recentFilteredData
                          .slice(-10)
                          .map((d) => d.rotationRate || 0)
                          .filter((r) => r > 0);
                        if (rotationRates.length >= 3) {
                          const avgRotationRate = movingAverage(rotationRates, rotationRates.length);
                          const rotationVariance = calculateVariance(rotationRates);
                          if (avgRotationRate >= FALL_CONFIG.GYROSCOPE_ROTATION_THRESHOLD * 0.5 &&
                              rotationVariance >= FALL_CONFIG.GYROSCOPE_VARIANCE_THRESHOLD) {
                            confidence += 0.05; // Additional confidence from gyroscope
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
                        
                        // Factor 5: Enhanced fall direction detection - 10% weight (increased)
                        const recentDirections = filteredDataRef.current
                          .slice(-10)
                          .map((d) => d.fallDirection)
                          .filter((d) => d && d !== "unknown");
                        if (recentDirections.length >= 3) {
                          // Check direction consistency
                          const directionCounts: Record<string, number> = {};
                          recentDirections.forEach(dir => {
                            directionCounts[dir] = (directionCounts[dir] || 0) + 1;
                          });
                          const maxCount = Math.max(...Object.values(directionCounts));
                          const directionConfidence = maxCount / recentDirections.length;
                          
                          if (directionConfidence >= FALL_CONFIG.DIRECTION_CONFIDENCE_THRESHOLD) {
                            confidence += 0.1; // Increased weight for consistent direction
                            console.log("[FallDetection] 📍 Clear fall direction detected:", {
                              direction: Object.keys(directionCounts).find(k => directionCounts[k] === maxCount),
                              confidence: (directionConfidence * 100).toFixed(1) + "%",
                            });
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
                          const hasHighSeverity = impactSeverities.some(s => s === "high");
                          const hasMediumSeverity = impactSeverities.some(s => s === "medium");
                          if (hasHighSeverity) {
                            confidence += 0.05; // High severity impact
                          } else if (hasMediumSeverity) {
                            confidence += 0.03; // Medium severity impact
                          }
                        }

                        // Factor 7: Multiple impacts - 5% weight
                        if (impactHistoryRef.current.length >= 2) {
                          confidence += 0.05; // Multiple impacts suggest real fall
                          console.log("[FallDetection] 🔄 Multiple impacts detected:", impactHistoryRef.current.length);
                        }

                        // Factor 8: Recovery detection - reduces confidence if recovery detected
                        if (postImpactDuration >= FALL_CONFIG.RECOVERY_WINDOW) {
                          const recoveryActivity = recentAccelerations.slice(-20);
                          if (recoveryActivity.length >= 10) {
                            const recoveryAvg = movingAverage(recoveryActivity, recoveryActivity.length);
                            if (recoveryAvg >= FALL_CONFIG.RECOVERY_ACTIVITY_THRESHOLD) {
                              confidence -= 0.1; // Recovery detected - might be false positive
                              console.log("[FallDetection] ✅ Recovery detected - reducing confidence");
                            }
                          }
                        }

                        // FALL DETECTED if confidence is high enough
                        if (confidence >= FALL_CONFIG.MIN_CONFIDENCE) {
                          console.log("[FallDetection] 🎯 Confidence threshold met! Confidence:", 
                            (confidence * 100).toFixed(1) + "%", 
                            "(required: " + (FALL_CONFIG.MIN_CONFIDENCE * 100) + "%)");
                          handleFallDetected();
                        } else if (dataSampleCount % 50 === 0) {
                          // Log confidence periodically during post-impact phase
                          console.log("[FallDetection] 📊 Post-impact analysis:", {
                            confidence: (confidence * 100).toFixed(1) + "%",
                            variance: variance.toFixed(4),
                            postImpactDuration: postImpactDuration + "ms",
                            activityLevel: activityLevel.toFixed(3),
                          });
                        }
                      }

                      // Reset after checking (even if not confident)
                      if (postImpactDuration >= FALL_CONFIG.POST_IMPACT_DURATION) {
                        if (confidence < FALL_CONFIG.MIN_CONFIDENCE) {
                          console.log("[FallDetection] ⚠️ Post-impact phase ended. Confidence too low:", 
                            (confidence * 100).toFixed(1) + "%", ". Resetting.");
                        }
                        phaseRef.current = "normal";
                        freefallStartRef.current = null;
                        impactTimeRef.current = null;
                      }
                    }
                  }
                } else {
                  if (dataSampleCount === 1) {
                    console.warn("[FallDetection] ⚠️ Sensor data received but no acceleration data");
                  }
                }
              } catch (dataError) {
                console.error("[FallDetection] ❌ Error processing sensor data:", dataError);
                // Stop subscription on repeated errors to prevent crashes
                isSubscriptionActive = false;
              }
            });

            isSubscriptionActive = true;
            setIsInitialized(true);
            console.log("[FallDetection] ✅ Sensor initialization complete! Listening for motion data...");
          } catch (importError: any) {
            console.error("[FallDetection] ❌ Sensor initialization failed:", importError?.message || importError);
            setIsInitialized(false);
            if (initializationTimeout) {
              clearTimeout(initializationTimeout);
            }
          }
        };

        initializeSensors();
      } catch (error: any) {
        console.error("[FallDetection] ❌ Error starting sensor initialization:", error?.message || error);
        setIsInitialized(false);
        if (initializationTimeout) {
          clearTimeout(initializationTimeout);
        }
      }
    } else if (!isActive) {
      console.log("[FallDetection] ⏸️ Fall detection is inactive");
    } else if (isInitialized) {
      console.log("[FallDetection] ✅ Fall detection is already initialized and active");
    }

    return () => {
      console.log("[FallDetection] 🛑 Cleaning up sensor subscription...");
      isSubscriptionActive = false;
      if (initializationTimeout) {
        clearTimeout(initializationTimeout);
      }
      if (subscription) {
        try {
          subscription.remove();
          console.log("[FallDetection] ✅ Sensor subscription removed");
        } catch (removeError) {
          console.error("[FallDetection] ❌ Error removing subscription:", removeError);
        }
      }
    };
  }, [isActive, isInitialized, handleFallDetected]);

  const startFallDetection = useCallback(() => {
    if (Platform.OS !== "web") {
      console.log("[FallDetection] ▶️ Starting fall detection...");
      setIsActive(true);
    } else {
      console.log("[FallDetection] ⚠️ Cannot start fall detection on web platform");
    }
  }, []);

  const stopFallDetection = useCallback(() => {
    console.log("[FallDetection] ⏹️ Stopping fall detection and resetting state...");
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
    console.log("[FallDetection] ✅ Fall detection stopped and state reset");
  }, []);

  return {
    isActive: isActive && isInitialized,
    startFallDetection,
    stopFallDetection,
  };
};
