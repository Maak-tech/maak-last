import AsyncStorage from "@react-native-async-storage/async-storage";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert } from "react-native";
import { useFallDetection } from "@/hooks/useFallDetection";
import { alertService } from "@/lib/services/alertService";
import { logFallDetectionDiagnostics } from "@/lib/utils/fallDetectionDiagnostics";
import { useAuth } from "./AuthContext";

interface FallDetectionContextType {
  isEnabled: boolean;
  isActive: boolean;
  isInitialized: boolean;
  toggleFallDetection: (enabled: boolean) => Promise<void>;
  startFallDetection: () => void;
  stopFallDetection: () => void;
  testFallDetection: () => Promise<void>;
  runDiagnostics: () => Promise<void>;
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
      "useFallDetectionContext must be used within a FallDetectionProvider"
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
      // Update last alert
      setLastAlert({
        alertId,
        timestamp: new Date(),
      });

      // Show alert to user
      Alert.alert(
        "🚨 Fall Detected",
        "A fall has been detected. Emergency notifications have been sent to your family members.",
        [
          {
            text: "I'm OK",
            onPress: async () => {
              try {
                if (user?.id) {
                  await alertService.resolveAlert(alertId, user.id);
                }
              } catch (error) {
                // Silently handle alert resolution error
              }
            },
          },
          {
            text: "Need Help",
            style: "destructive",
            onPress: () => {
              // Keep alert active - family members will be notified
            },
          },
        ]
      );
    },
    [user?.id]
  );

  // Initialize fall detection hook
  const fallDetection = useFallDetection(user?.id || null, handleFallDetected);

  // Extract stable functions from fallDetection to avoid dependency issues with object identity
  // These functions are memoized with useCallback in the hook, so they're stable
  const { startFallDetection, stopFallDetection } = useMemo(
    () => ({
      startFallDetection: fallDetection.startFallDetection,
      stopFallDetection: fallDetection.stopFallDetection,
    }),
    [fallDetection.startFallDetection, fallDetection.stopFallDetection]
  );

  // Extract isActive into state to avoid dependency issues with object identity
  const [isActive, setIsActive] = useState(false);

  // Update isActive state when fallDetection.isActive changes
  useEffect(() => {
    setIsActive(fallDetection.isActive);
  }, [fallDetection.isActive]);

  // Load fall detection setting from storage (only on mount or when user changes)
  useEffect(() => {
    const loadFallDetectionSetting = async () => {
      try {
        const enabled = await AsyncStorage.getItem("fall_detection_enabled");
        if (enabled !== null) {
          const isEnabledValue = JSON.parse(enabled);
          setIsEnabled(isEnabledValue);
        }
        setIsInitialized(true);
      } catch (error) {
        setIsInitialized(true);
      }
    };

    loadFallDetectionSetting();
  }, []); // Only run on mount

  // Auto-start fall detection when user becomes available and setting is enabled
  useEffect(() => {
    if (isInitialized && isEnabled && user?.id && !isActive) {
      startFallDetection();
    }
  }, [isInitialized, isEnabled, user?.id, isActive, startFallDetection]);

  // Toggle fall detection setting
  const toggleFallDetection = useCallback(
    async (enabled: boolean) => {
      try {
        setIsEnabled(enabled);
        await AsyncStorage.setItem(
          "fall_detection_enabled",
          JSON.stringify(enabled)
        );

        if (enabled && user?.id) {
          startFallDetection();
        } else {
          stopFallDetection();
        }
      } catch (error) {
        // Silently handle error
      }
    },
    [user?.id, startFallDetection, stopFallDetection]
  );

  // Test fall detection
  const testFallDetection = useCallback(async () => {
    try {
      if (!user?.id) {
        Alert.alert("Error", "User not logged in");
        return;
      }

      // Create a test alert
      const alertId = await alertService.createFallAlert(user.id);

      // Simulate fall detection
      await handleFallDetected(alertId);
    } catch (error) {
      Alert.alert("Error", "Failed to test fall detection");
    }
  }, [user?.id, handleFallDetected]);

  // Run diagnostics
  const runDiagnostics = useCallback(async () => {
    await logFallDetectionDiagnostics(
      isEnabled,
      fallDetection.isActive,
      isInitialized,
      lastAlert?.timestamp || null
    );
  }, [isEnabled, fallDetection.isActive, isInitialized, lastAlert]);

  const value: FallDetectionContextType = useMemo(
    () => ({
      isEnabled,
      isActive,
      isInitialized,
      toggleFallDetection,
      startFallDetection,
      stopFallDetection,
      testFallDetection,
      runDiagnostics,
      lastAlert,
    }),
    [
      isEnabled,
      isActive,
      isInitialized,
      toggleFallDetection,
      startFallDetection,
      stopFallDetection,
      testFallDetection,
      runDiagnostics,
      lastAlert,
    ]
  );

  return (
    <FallDetectionContext.Provider value={value}>
      {children}
    </FallDetectionContext.Provider>
  );
};
