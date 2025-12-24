import AsyncStorage from "@react-native-async-storage/async-storage";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";
import { useFallDetection } from "@/hooks/useFallDetection";
import { alertService } from "@/lib/services/alertService";
import { useAuth } from "./AuthContext";
import { logFallDetectionDiagnostics } from "@/lib/utils/fallDetectionDiagnostics";

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

  // Load fall detection setting from storage
  useEffect(() => {
    const loadFallDetectionSetting = async () => {
      try {
        console.log("[FallDetectionContext] 📂 Loading fall detection setting from storage...");
        const enabled = await AsyncStorage.getItem("fall_detection_enabled");
        if (enabled !== null) {
          const isEnabledValue = JSON.parse(enabled);
          console.log("[FallDetectionContext] 📂 Loaded setting: enabled =", isEnabledValue);
          setIsEnabled(isEnabledValue);

          // Auto-start fall detection if enabled
          if (isEnabledValue && user?.id) {
            console.log("[FallDetectionContext] ▶️ Auto-starting fall detection (was previously enabled)");
            fallDetection.startFallDetection();
          } else if (isEnabledValue && !user?.id) {
            console.log("[FallDetectionContext] ⚠️ Fall detection enabled but no user ID. Waiting for user...");
          }
        } else {
          console.log("[FallDetectionContext] 📂 No saved setting found. Fall detection will be disabled by default.");
        }
        setIsInitialized(true);
      } catch (error) {
        console.error("[FallDetectionContext] ❌ Error loading fall detection setting:", error);
        setIsInitialized(true);
      }
    };

    loadFallDetectionSetting();
  }, [user?.id, fallDetection]);

  // Toggle fall detection setting
  const toggleFallDetection = useCallback(
    async (enabled: boolean) => {
      try {
        console.log("[FallDetectionContext] 🔄 Toggling fall detection:", enabled ? "ON" : "OFF");
        setIsEnabled(enabled);
        await AsyncStorage.setItem(
          "fall_detection_enabled",
          JSON.stringify(enabled)
        );
        console.log("[FallDetectionContext] 💾 Setting saved to storage");

        if (enabled && user?.id) {
          console.log("[FallDetectionContext] ▶️ Starting fall detection...");
          fallDetection.startFallDetection();
        } else if (enabled && !user?.id) {
          console.log("[FallDetectionContext] ⚠️ Cannot start: user not logged in");
        } else {
          console.log("[FallDetectionContext] ⏹️ Stopping fall detection...");
          fallDetection.stopFallDetection();
        }
      } catch (error) {
        console.error("[FallDetectionContext] ❌ Error toggling fall detection:", error);
      }
    },
    [user?.id, fallDetection]
  );

  // Test fall detection
  const testFallDetection = useCallback(async () => {
    try {
      console.log("[FallDetectionContext] 🧪 Testing fall detection...");
      if (!user?.id) {
        console.error("[FallDetectionContext] ❌ Test failed: User not logged in");
        Alert.alert("Error", "User not logged in");
        return;
      }

      // Create a test alert
      console.log("[FallDetectionContext] 📝 Creating test alert...");
      const alertId = await alertService.createFallAlert(user.id);
      console.log("[FallDetectionContext] ✅ Test alert created:", alertId);

      // Simulate fall detection
      console.log("[FallDetectionContext] 🚨 Simulating fall detection event...");
      await handleFallDetected(alertId);
      console.log("[FallDetectionContext] ✅ Test fall detection completed");

    } catch (error) {
      console.error("[FallDetectionContext] ❌ Test fall detection failed:", error);
      Alert.alert("Error", "Failed to test fall detection");
    }
  }, [user?.id, handleFallDetected]);

  // Run diagnostics
  const runDiagnostics = useCallback(async () => {
    console.log("[FallDetectionContext] 🔍 Running diagnostics...");
    await logFallDetectionDiagnostics(
      isEnabled,
      fallDetection.isActive,
      isInitialized,
      lastAlert?.timestamp || null
    );
  }, [isEnabled, fallDetection.isActive, isInitialized, lastAlert]);

  const value: FallDetectionContextType = {
    isEnabled,
    isActive: fallDetection.isActive,
    isInitialized,
    toggleFallDetection,
    startFallDetection: fallDetection.startFallDetection,
    stopFallDetection: fallDetection.stopFallDetection,
    testFallDetection,
    runDiagnostics,
    lastAlert,
  };

  return (
    <FallDetectionContext.Provider value={value}>
      {children}
    </FallDetectionContext.Provider>
  );
};
