import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';

interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export const useFallDetection = (onFallDetected: () => void) => {
  const [isActive, setIsActive] = useState(false);
  const [lastData, setLastData] = useState<AccelerometerData | null>(null);

  const handleFallDetected = useCallback(() => {
    try {
      onFallDetected();
    } catch (error) {
      console.error('Error in fall detection callback:', error);
    }
  }, [onFallDetected]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Fall detection not available on web
      return;
    }

    let subscription: any;
    let isSubscriptionActive = false;

    if (isActive) {
      try {
        // Dynamically import expo-sensors only on native platforms
        const initializeSensors = async () => {
          try {
            const { DeviceMotion } = await import('expo-sensors');
            
            // Check if DeviceMotion is available
            const isAvailable = await DeviceMotion.isAvailableAsync();
            if (!isAvailable) {
              console.warn('DeviceMotion is not available on this device');
              return;
            }

            DeviceMotion.setUpdateInterval(200); // Reduced frequency to prevent crashes
            
            subscription = DeviceMotion.addListener((data: any) => {
              if (!isSubscriptionActive) return;
              
              try {
                if (data.acceleration) {
                  const currentData: AccelerometerData = {
                    x: data.acceleration.x || 0,
                    y: data.acceleration.y || 0,
                    z: data.acceleration.z || 0,
                    timestamp: Date.now(),
                  };

                  // Simple fall detection algorithm with safety checks
                  const totalAcceleration = Math.sqrt(
                    currentData.x ** 2 + currentData.y ** 2 + currentData.z ** 2
                  );

                  // More conservative thresholds to prevent false positives
                  if (totalAcceleration > 3.0 || totalAcceleration < 0.3) {
                    if (lastData) {
                      const timeDiff = currentData.timestamp - lastData.timestamp;
                      if (timeDiff < 2000 && timeDiff > 100) { // Between 100ms and 2 seconds
                        handleFallDetected();
                      }
                    }
                  }

                  setLastData(currentData);
                }
              } catch (dataError) {
                console.warn('Error processing sensor data:', dataError);
              }
            });
            
            isSubscriptionActive = true;
          } catch (importError) {
            console.warn('Failed to initialize DeviceMotion:', importError);
          }
        };

        initializeSensors();
      } catch (error) {
        console.warn('DeviceMotion initialization error:', error);
      }
    }

    return () => {
      isSubscriptionActive = false;
      if (subscription) {
        try {
          subscription.remove();
        } catch (removeError) {
          console.warn('Error removing sensor subscription:', removeError);
        }
      }
    };
  }, [isActive, lastData, handleFallDetected]);

  const startFallDetection = useCallback(() => {
    if (Platform.OS !== 'web') {
      setIsActive(true);
    } else {
      console.warn('Fall detection is not available on web platform');
    }
  }, []);

  const stopFallDetection = useCallback(() => {
    setIsActive(false);
    setLastData(null);
  }, []);

  return {
    isActive,
    startFallDetection,
    stopFallDetection,
  };
};