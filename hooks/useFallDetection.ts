import { useEffect, useState } from 'react';
import { DeviceMotion } from 'expo-sensors';
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

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Fall detection not available on web
      return;
    }

    let subscription: any;

    if (isActive) {
      DeviceMotion.setUpdateInterval(100); // 10 readings per second
      
      subscription = DeviceMotion.addListener((data) => {
        if (data.acceleration) {
          const currentData: AccelerometerData = {
            x: data.acceleration.x || 0,
            y: data.acceleration.y || 0,
            z: data.acceleration.z || 0,
            timestamp: Date.now(),
          };

          // Simple fall detection algorithm
          const totalAcceleration = Math.sqrt(
            currentData.x ** 2 + currentData.y ** 2 + currentData.z ** 2
          );

          // Detect sudden acceleration changes that might indicate a fall
          if (totalAcceleration > 2.5 || totalAcceleration < 0.5) {
            if (lastData) {
              const timeDiff = currentData.timestamp - lastData.timestamp;
              if (timeDiff < 1000) { // Within 1 second
                onFallDetected();
              }
            }
          }

          setLastData(currentData);
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isActive, lastData, onFallDetected]);

  const startFallDetection = () => {
    setIsActive(true);
  };

  const stopFallDetection = () => {
    setIsActive(false);
  };

  return {
    isActive,
    startFallDetection,
    stopFallDetection,
  };
};