import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { alertService } from "@/lib/services/alertService";

interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export const useFallDetection = (
  userId: string | null,
  onFallDetected: (alertId: string) => void
) => {
  const [isActive, setIsActive] = useState(false);
  const [lastData, setLastData] = useState<AccelerometerData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const handleFallDetected = useCallback(async () => {
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
          console.warn("Fall detection initialization timeout");
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
              console.warn("DeviceMotion is not available on this device");
              setIsInitialized(false);
              return;
            }

            // Set conservative update interval to prevent crashes
            DeviceMotion.setUpdateInterval(1000); // Increased to 1 second

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

                  // More conservative fall detection algorithm
                  const totalAcceleration = Math.sqrt(
                    currentData.x ** 2 + currentData.y ** 2 + currentData.z ** 2
                  );

                  // Very conservative thresholds to prevent false positives and crashes
                  if (
                    (totalAcceleration > 4.0 || totalAcceleration < 0.2) &&
                    lastData
                  ) {
                    const timeDiff = currentData.timestamp - lastData.timestamp;
                    if (timeDiff < 3000 && timeDiff > 500) {
                      // Between 500ms and 3 seconds
                      handleFallDetected();
                    }
                  }

                  setLastData(currentData);
                }
              } catch (dataError) {
                console.warn("Error processing sensor data:", dataError);
                // Stop subscription on repeated errors to prevent crashes
                isSubscriptionActive = false;
              }
            });

            isSubscriptionActive = true;
            setIsInitialized(true);
          } catch (importError) {
            console.warn("Failed to initialize DeviceMotion:", importError);
            setIsInitialized(false);
            if (initializationTimeout) {
              clearTimeout(initializationTimeout);
            }
          }
        };

        initializeSensors();
      } catch (error) {
        console.warn("DeviceMotion initialization error:", error);
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
          console.warn("Error removing sensor subscription:", removeError);
        }
      }
    };
  }, [isActive, isInitialized, handleFallDetected]);

  const startFallDetection = useCallback(() => {
    if (Platform.OS !== "web") {
      setIsActive(true);
    } else {
      console.warn("Fall detection is not available on web platform");
    }
  }, []);

  const stopFallDetection = useCallback(() => {
    setIsActive(false);
    setIsInitialized(false);
    setLastData(null);
  }, []);

  return {
    isActive: isActive && isInitialized,
    startFallDetection,
    stopFallDetection,
  };
};
