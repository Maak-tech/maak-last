import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { alertService } from "@/lib/services/alertService";

interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

// Fall detection configuration constants
const FALL_CONFIG = {
  // Update interval in milliseconds (100ms = 10 Hz for better accuracy)
  UPDATE_INTERVAL: 100,
  
  // Freefall detection: total acceleration drops significantly
  FREEFALL_THRESHOLD: 0.5, // G-force (normal is ~1.0)
  FREEFALL_MIN_DURATION: 200, // milliseconds
  FREEFALL_MAX_DURATION: 800, // milliseconds
  
  // Impact detection: sudden high acceleration after freefall
  IMPACT_THRESHOLD: 2.5, // G-force (2-3G is typical for falls)
  IMPACT_MAX_THRESHOLD: 8.0, // G-force (ignore extremely high values as sensor errors)
  
  // Post-impact: reduced movement after impact (person is still)
  POST_IMPACT_THRESHOLD: 0.3, // G-force variation
  POST_IMPACT_DURATION: 1000, // milliseconds to check for stillness
  
  // Cooldown to prevent duplicate detections
  ALERT_COOLDOWN: 30000, // 30 seconds between alerts
  
  // Data window size for pattern analysis
  WINDOW_SIZE: 20, // Keep last 20 readings (2 seconds at 10 Hz)
};

type FallPhase = "normal" | "freefall" | "impact" | "post_impact" | "cooldown";

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
  const dataWindowRef = useRef<AccelerometerData[]>([]);

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
    let initializationTimeout: NodeJS.Timeout | undefined;

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

            // Set update interval for better accuracy (10 Hz = 100ms)
            DeviceMotion.setUpdateInterval(FALL_CONFIG.UPDATE_INTERVAL);

            subscription = DeviceMotion.addListener((data: any) => {
              if (!(isSubscriptionActive && data)) return;

              try {
                if (data.acceleration) {
                  const currentData: AccelerometerData = {
                    x: data.acceleration.x || 0,
                    y: data.acceleration.y || 0,
                    z: data.acceleration.z || 0,
                    timestamp: Date.now(),
                  };

                  // Calculate total acceleration magnitude
                  const totalAcceleration = Math.sqrt(
                    currentData.x ** 2 + 
                    currentData.y ** 2 + 
                    currentData.z ** 2
                  );

                  // Add to sliding window
                  dataWindowRef.current.push(currentData);
                  if (dataWindowRef.current.length > FALL_CONFIG.WINDOW_SIZE) {
                    dataWindowRef.current.shift();
                  }

                  const now = currentData.timestamp;
                  const phase = phaseRef.current;

                  // Skip if in cooldown
                  if (phase === "cooldown") {
                    return;
                  }

                  // ===== PHASE 1: Detect Freefall =====
                  if (phase === "normal") {
                    if (totalAcceleration < FALL_CONFIG.FREEFALL_THRESHOLD) {
                      // Potential freefall detected
                      phaseRef.current = "freefall";
                      freefallStartRef.current = now;
                    }
                  }
                  
                  // ===== PHASE 2: Validate Freefall Duration & Detect Impact =====
                  else if (phase === "freefall") {
                    const freefallDuration = now - (freefallStartRef.current || now);
                    
                    // Check if freefall ended (acceleration returned)
                    if (totalAcceleration >= FALL_CONFIG.FREEFALL_THRESHOLD) {
                      // Freefall ended - check if it was valid duration
                      if (
                        freefallDuration >= FALL_CONFIG.FREEFALL_MIN_DURATION &&
                        freefallDuration <= FALL_CONFIG.FREEFALL_MAX_DURATION
                      ) {
                        // Valid freefall - now check for impact
                        if (
                          totalAcceleration >= FALL_CONFIG.IMPACT_THRESHOLD &&
                          totalAcceleration <= FALL_CONFIG.IMPACT_MAX_THRESHOLD
                        ) {
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
                    
                    if (postImpactDuration >= FALL_CONFIG.POST_IMPACT_DURATION) {
                      // Check if person remained relatively still
                      const recentData = dataWindowRef.current.slice(-10); // Last 1 second
                      if (recentData.length >= 5) {
                        const avgAcceleration = recentData.reduce((sum, d) => {
                          const mag = Math.sqrt(d.x ** 2 + d.y ** 2 + d.z ** 2);
                          return sum + mag;
                        }, 0) / recentData.length;
                        
                        const variance = recentData.reduce((sum, d) => {
                          const mag = Math.sqrt(d.x ** 2 + d.y ** 2 + d.z ** 2);
                          return sum + Math.abs(mag - avgAcceleration);
                        }, 0) / recentData.length;
                        
                        // Low variance = person is still (not just dropped phone)
                        if (variance < FALL_CONFIG.POST_IMPACT_THRESHOLD) {
                          // FALL DETECTED: Freefall → Impact → Stillness
                          handleFallDetected();
                        }
                      }
                      
                      // Reset either way
                      phaseRef.current = "normal";
                      freefallStartRef.current = null;
                      impactTimeRef.current = null;
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
  }, []);

  return {
    isActive: isActive && isInitialized,
    startFallDetection,
    stopFallDetection,
  };
};