import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { useAuth } from './AuthContext';
import { useFallDetection } from '@/hooks/useFallDetection';
import { alertService } from '@/lib/services/alertService';

interface FallDetectionContextType {
  isEnabled: boolean;
  isActive: boolean;
  isInitialized: boolean;
  toggleFallDetection: (enabled: boolean) => Promise<void>;
  startFallDetection: () => void;
  stopFallDetection: () => void;
  testFallDetection: () => Promise<void>;
  lastAlert: {
    alertId: string;
    timestamp: Date;
  } | null;
}

const FallDetectionContext = createContext<
  FallDetectionContextType | undefined
>(undefined);

export const useFallDetectionContext = () => {
  const context = useContext(FallDetectionContext);
  if (!context) {
    throw new Error(
      'useFallDetectionContext must be used within a FallDetectionProvider'
    );
  }
  return context;
};

export const FallDetectionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastAlert, setLastAlert] = useState<{
    alertId: string;
    timestamp: Date;
  } | null>(null);

  // Handle fall detection events
  const handleFallDetected = useCallback(
    async (alertId: string) => {
      console.log('🚨 Fall detected! Alert ID:', alertId);
      console.log('👤 User:', user?.name, 'Family ID:', user?.familyId);

      // Update last alert
      setLastAlert({
        alertId,
        timestamp: new Date(),
      });

      // Show alert to user
      Alert.alert(
        '🚨 Fall Detected',
        'A fall has been detected. Emergency notifications have been sent to your family members.',
        [
          {
            text: "I'm OK",
            onPress: async () => {
              try {
                if (user?.id) {
                  await alertService.resolveAlert(alertId, user.id);
                }
              } catch (error) {
                console.error('Error resolving alert:', error);
              }
            },
          },
          {
            text: 'Need Help',
            style: 'destructive',
            onPress: () => {
              // Keep alert active - family members will be notified
              console.log('User needs help - alert remains active');
            },
          },
        ]
      );
    },
    [user?.id]
  );

  // Initialize fall detection hook
  const fallDetection = useFallDetection(user?.id || null, handleFallDetected);

  // Load fall detection setting from storage
  useEffect(() => {
    const loadFallDetectionSetting = async () => {
      try {
        const enabled = await AsyncStorage.getItem('fall_detection_enabled');
        if (enabled !== null) {
          const isEnabledValue = JSON.parse(enabled);
          setIsEnabled(isEnabledValue);

          // Auto-start fall detection if enabled
          if (isEnabledValue && user?.id) {
            fallDetection.startFallDetection();
          }
        }
        setIsInitialized(true);
      } catch (error) {
        console.error('Error loading fall detection setting:', error);
        setIsInitialized(true);
      }
    };

    loadFallDetectionSetting();
  }, [user?.id]);

  // Toggle fall detection setting
  const toggleFallDetection = useCallback(
    async (enabled: boolean) => {
      try {
        setIsEnabled(enabled);
        await AsyncStorage.setItem(
          'fall_detection_enabled',
          JSON.stringify(enabled)
        );

        if (enabled && user?.id) {
          fallDetection.startFallDetection();
        } else {
          fallDetection.stopFallDetection();
        }
      } catch (error) {
        console.error('Error toggling fall detection:', error);
      }
    },
    [user?.id, fallDetection]
  );

  // Test fall detection
  const testFallDetection = useCallback(async () => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'User not logged in');
        return;
      }

      // Create a test alert
      const alertId = await alertService.createFallAlert(user.id);

      // Simulate fall detection
      await handleFallDetected(alertId);

      console.log('🧪 Test fall detection completed');
    } catch (error) {
      console.error('Error testing fall detection:', error);
      Alert.alert('Error', 'Failed to test fall detection');
    }
  }, [user?.id, handleFallDetected]);

  const value: FallDetectionContextType = {
    isEnabled,
    isActive: fallDetection.isActive,
    isInitialized,
    toggleFallDetection,
    startFallDetection: fallDetection.startFallDetection,
    stopFallDetection: fallDetection.stopFallDetection,
    testFallDetection,
    lastAlert,
  };

  return (
    <FallDetectionContext.Provider value={value}>
      {children}
    </FallDetectionContext.Provider>
  );
};
