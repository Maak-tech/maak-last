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
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { useFallDetection } from "@/hooks/useFallDetection";
import { auth } from "@/lib/firebase";
import { alertService } from "@/lib/services/alertService";
import { logFallDetectionDiagnostics } from "@/lib/utils/fallDetectionDiagnostics";
import { useAuth } from "./AuthContext";

type FallDetectionContextType = {
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
};

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
  const { t } = useTranslation();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastAlert, setLastAlert] = useState<{
    alertId: string;
    timestamp: Date;
  } | null>(null);

  // Handle fall detection events
  const handleFallDetected = useCallback(
    (alertId: string) => {
      // Update last alert
      setLastAlert({
        alertId,
        timestamp: new Date(),
      });

      // Show alert to user
      const isLocalAlert =
        alertId === "demo-alert" || alertId === "error-alert";
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: User-facing error mapping is intentionally explicit.
      const handleResolveAlert = async () => {
        try {
          if (user?.id && !isLocalAlert) {
            await alertService.resolveAlert(alertId, user.id);
            Alert.alert(t("alertResolved"), t("alertResolvedSuccessfully"), [
              { text: t("ok") },
            ]);
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          let displayMessage = t("failedToResolveAlert");

          if (
            errorMessage.includes("permission-denied") ||
            errorMessage.includes("permission")
          ) {
            displayMessage = t("noPermissionToResolveAlert");
          } else if (
            errorMessage.includes("does not exist") ||
            errorMessage.includes("not found")
          ) {
            displayMessage = t("alertNotFound");
          } else {
            displayMessage = `${t("failedToResolveAlert")}: ${errorMessage}`;
          }

          Alert.alert(t("error"), displayMessage, [{ text: t("ok") }]);
        }
      };

      Alert.alert(t("fallDetected"), t("fallDetectedMessage"), [
        {
          text: t("imOk"),
          onPress: handleResolveAlert,
        },
        {
          text: t("needHelp"),
          style: "destructive",
          onPress: () => {
            // Keep alert active - family members will be notified
          },
        },
      ]);
    },
    [user?.id, t]
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
      } catch (_error) {
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
      } catch (_error) {
        // Silently handle error
      }
    },
    [user?.id, startFallDetection, stopFallDetection]
  );

  // Test fall detection
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Test flow handles auth fallback and permission fallback paths.
  const testFallDetection = useCallback(async () => {
    try {
      if (!user?.id) {
        Alert.alert(t("error"), t("userNotLoggedIn"));
        return;
      }

      const authUserId = auth.currentUser?.uid;
      if (!authUserId || authUserId !== user.id) {
        // Fall back to local-only alert if Firestore auth is missing/mismatched
        handleFallDetected("demo-alert");
        return;
      }

      try {
        const alertId = await alertService.createFallAlert(user.id);
        handleFallDetected(alertId);
        return;
      } catch (error) {
        const errorCode =
          typeof error === "object" && error && "code" in error
            ? String((error as { code?: unknown }).code)
            : undefined;
        if (errorCode === "permission-denied") {
          handleFallDetected("demo-alert");
          return;
        }
        throw error;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const isDev = process.env.NODE_ENV !== "production";
      if (isDev) {
        Alert.alert(
          t("error"),
          `${t("failedToTestFallDetection")}: ${errorMessage}`
        );
      } else {
        Alert.alert(t("error"), t("failedToTestFallDetection"));
      }
    }
  }, [user?.id, handleFallDetected, t]);

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
