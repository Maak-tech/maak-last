/**
 * PPG Vital Monitor with Real Camera Processing
 * Uses react-native-vision-camera for actual PPG measurements
 *
 * Based on research:
 * - Olugbenle et al. (arXiv:2412.07082v1) - Low frame-rate PPG heart rate measurement
 * - Dynamic FPS (14-60) based on camera capabilities, preferring higher for better accuracy
 * - 60 second measurement for HRV and respiratory rate
 */

// Note: TextImpl patching is handled globally in app/_layout.tsx
// No need to import reanimated setup here - it's already loaded at app startup

import * as Brightness from "expo-brightness";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import {
  CheckCircle,
  ChevronLeft,
  Clock,
  Hand,
  Heart,
  Lightbulb,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  type StyleProp,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from "react-native-vision-camera";
import { useRunOnJS, useSharedValue } from "react-native-worklets-core";
import { useTheme } from "@/contexts/ThemeContext";
import { auth, db } from "@/lib/firebase";
import {
  type PPGResult,
  processPPGSignalWithML,
} from "@/lib/utils/BiometricUtils";
import { extractRedChannelAverage } from "@/lib/utils/PPGPixelExtractor";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

interface PPGVitalMonitorProps {
  visible: boolean;
  userId: string;
  onMeasurementComplete?: (result: PPGResult & { heartRate: number }) => void;
  onClose: () => void;
}

export interface ExtendedPPGResult extends PPGResult {
  heartRate: number;
  heartRateVariability?: number;
  respiratoryRate?: number;
}

export default function PPGVitalMonitorVisionCamera({
  visible,
  userId,
  onMeasurementComplete,
  onClose,
}: PPGVitalMonitorProps) {
  // Reanimated patching is handled in app/_layout.tsx
  // No need to call it here

  const { theme } = useTheme();
  const { t } = useTranslation();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back"); // Back camera has flash for PPG illumination

  // Select camera format with optimal frame rate for PPG
  // Research shows higher fps (30-60) improves peak detection and HRV accuracy
  // We prefer 30 fps as it balances accuracy with battery life
  const PREFERRED_FPS = 30;
  const MIN_ACCEPTABLE_FPS = 14; // Minimum from Olugbenle et al. research

  const format = useCameraFormat(device, [
    { fps: PREFERRED_FPS }, // Use preferred FPS (format will fallback to closest available)
    { videoResolution: { width: 640, height: 480 } }, // Lower resolution is fine for PPG (faster processing)
  ]);

  const [status, setStatus] = useState<
    "idle" | "instructions" | "measuring" | "processing" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [heartRateVariability, setHeartRateVariability] = useState<
    number | null
  >(null);
  const [respiratoryRate, setRespiratoryRate] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [signalQuality, setSignalQuality] = useState<number | null>(null);
  const [fingerDetected, setFingerDetected] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [framesCaptured, setFramesCaptured] = useState(0);
  const [frameProcessorCalled, setFrameProcessorCalled] = useState(false);
  const [frameMeta, setFrameMeta] = useState<string | null>(null);
  const [beatsDetected, setBeatsDetected] = useState(0);
  const [currentMilestone, setCurrentMilestone] = useState<{
    title: string;
    detail: string;
    icon: string;
    progress: string;
  } | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [fingerDetectionFailed, setFingerDetectionFailed] = useState(false);
  const [frameProcessingErrors, setFrameProcessingErrors] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [originalBrightness, setOriginalBrightness] = useState<number | null>(
    null
  );

  const getPPGErrorMessage = (message?: string | null): string => {
    if (!message) return t("ppgFailedToProcess");

    switch (message) {
      case "Signal quality too low":
        return t("ppgSignalQualityTooLow");
      case "Insufficient signal data":
        return t("ppgErrorInsufficientSignalData");
      case "Too many invalid signal values":
        return t("ppgErrorTooManyInvalidSignalValues");
      case "Signal variation too low":
        return t("ppgErrorSignalVariationTooLow");
      case "Heart rate out of normal range":
        return t("ppgErrorHeartRateOutOfNormalRange");
      case "PPG processing error":
        return t("ppgErrorProcessingError");
      default:
        return message;
    }
  };

  // NOTE: Do not use React refs inside VisionCamera frame processor worklets.
  // Worklets run on a separate runtime and cannot safely read/write React refs.
  const frameCountRef = useRef(0);
  const ppgSignalRef = useRef<number[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCapturingRef = useRef(false);
  const fingerDetectedRef = useRef(false);
  const consecutiveNoFingerFrames = useRef(0);
  const consecutiveFrameFailures = useRef(0); // Track consecutive frame extraction failures
  const totalFrameFailures = useRef(0); // Track total failures
  const hasLoggedFrameProcessor = useRef(false); // Track if we've logged frame processor status

  // Worklet-safe state for the frame processor.
  const isCapturingSV = useSharedValue(false);
  const lastFrameTimeSV = useSharedValue(0);
  const frameCountSV = useSharedValue(0);
  const frameProcessorInitializedSV = useSharedValue(false);

  // Debug flags - set to false in production to reduce console spam
  const DEBUG_FRAME_PROCESSOR = __DEV__; // Only debug in development mode
  const DEBUG_PPG = __DEV__; // Control PPG signal quality logging

  // Frame rate optimization following research guidance
  // Higher frame rates (30-60 fps) improve:
  // - Peak detection accuracy for heart rate
  // - HRV calculation precision (better R-R interval resolution)
  // - Signal quality assessment
  // We use the camera's actual supported fps, preferring 30 fps when available
  const actualFps = format?.maxFps ?? PREFERRED_FPS;
  const TARGET_FPS = Math.max(MIN_ACCEPTABLE_FPS, Math.min(actualFps, 60)); // Clamp between 14-60 fps
  const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
  const MEASUREMENT_DURATION = 60; // 60 seconds - clinical standard for comprehensive vitals
  const TARGET_FRAMES = TARGET_FPS * MEASUREMENT_DURATION;

  // Progress milestones for 60s capture
  const progressMilestones: Record<
    number,
    { title: string; detail: string; icon: string; progress: string }
  > = {
    0: {
      title: "Starting capture...",
      detail: "Initializing sensors",
      icon: "🔵",
      progress: "0%",
    },
    5: {
      title: "Detecting heartbeats",
      detail: "5/60 heartbeats captured",
      icon: "💙",
      progress: "8%",
    },
    10: {
      title: "Analyzing cardiac rhythm",
      detail: "10/60 heartbeats captured",
      icon: "❤️",
      progress: "17%",
    },
    15: {
      title: "Quarter complete",
      detail: "Building waveform template",
      icon: "🟢",
      progress: "25%",
    },
    30: {
      title: "Halfway there!",
      detail: "Statistical significance achieved",
      icon: "🟡",
      progress: "50%",
    },
    45: {
      title: "Three quarters complete",
      detail: "Morphological features captured",
      icon: "🔶",
      progress: "75%",
    },
    60: {
      title: "Complete!",
      detail: "Medical-grade accuracy achieved",
      icon: "✅",
      progress: "100%",
    },
  };

  const getCurrentMilestone = (
    time: number
  ): {
    title: string;
    detail: string;
    icon: string;
    progress: string;
  } | null => {
    const roundedTime = Math.floor(time);
    const milestoneKeys = Object.keys(progressMilestones)
      .map(Number)
      .sort((a, b) => b - a);
    for (const key of milestoneKeys) {
      if (roundedTime >= key) {
        return progressMilestones[key];
      }
    }
    return progressMilestones[0];
  };

  const styles = createThemedStyles((theme) => ({
    modal: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      padding: theme.spacing.lg,
      paddingTop: theme.spacing.xl + 40,
      paddingBottom: theme.spacing.xl,
    },
    cameraContainer: {
      width: "100%",
      height: 280,
      borderRadius: theme.borderRadius.lg,
      overflow: "hidden",
      marginBottom: theme.spacing.xl,
      backgroundColor: theme.colors.background.secondary,
      ...theme.shadows.md,
    },
    camera: {
      flex: 1,
    },
    content: {
      alignItems: "center",
      width: "100%",
    },
    header: {
      width: "100%",
      alignItems: "center",
      marginBottom: theme.spacing.xl,
    },
    title: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.text.primary),
      fontSize: 28,
      marginBottom: theme.spacing.sm,
      textAlign: "center",
    },
    subtitle: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      textAlign: "center",
      marginBottom: theme.spacing.lg,
      flexWrap: "wrap",
      paddingHorizontal: theme.spacing.sm,
    },
    statusText: {
      ...getTextStyle(
        theme,
        "subheading",
        "semibold",
        theme.colors.primary.main
      ),
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    progressBar: {
      width: "100%",
      height: 8,
      backgroundColor: theme.colors.border.light,
      borderRadius: theme.borderRadius.md,
      overflow: "hidden",
      marginVertical: theme.spacing.lg,
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.borderRadius.md,
    },
    heartRateText: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.accent.error),
      fontSize: 56,
      lineHeight: 64,
      marginVertical: theme.spacing.lg,
      letterSpacing: -1,
      textAlign: "center",
      includeFontPadding: false,
    },
    heartRateContainer: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      marginVertical: theme.spacing.lg,
      alignItems: "center",
      width: "100%",
      ...theme.shadows.md,
    },
    qualityText: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.secondary),
      marginTop: 10,
    },
    button: {
      backgroundColor: theme.colors.primary.main,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.base,
      borderRadius: theme.borderRadius.lg,
      marginTop: theme.spacing.lg,
      minWidth: 200,
      alignItems: "center",
      ...theme.shadows.md,
    },
    buttonText: {
      ...getTextStyle(theme, "button", "bold", theme.colors.neutral.white),
    },
    closeButton: {
      position: "absolute",
      top: theme.spacing.lg,
      right: theme.spacing.lg,
      zIndex: 10_001,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.full,
      padding: theme.spacing.sm,
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
      ...theme.shadows.md,
      elevation: 10,
    },
    errorText: {
      ...getTextStyle(theme, "body", "medium", theme.colors.accent.error),
      textAlign: "center",
      marginTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    instructionText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      textAlign: "center",
      marginTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      lineHeight: 22,
      flexWrap: "wrap",
    },
    successContainer: {
      alignItems: "center",
      marginTop: theme.spacing.xl,
      width: "100%",
    },
    successCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      width: "100%",
      alignItems: "center",
      marginBottom: theme.spacing.lg,
      ...theme.shadows.md,
    },
    instructionsContainer: {
      width: "100%",
    },
    instructionsCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      ...theme.shadows.md,
    },
    instructionsHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.lg,
    },
    instructionsHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary[50],
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginEnd: theme.spacing.md,
    },
    instructionsTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.primary.main),
      flex: 1,
    },
    instructionItem: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      marginBottom: theme.spacing.md,
    },
    instructionNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.primary.main,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginEnd: theme.spacing.md,
      marginTop: 2,
    },
    instructionNumberText: {
      ...getTextStyle(theme, "caption", "bold", theme.colors.neutral.white),
      fontSize: 12,
    },
    instructionItemText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      flex: 1,
      lineHeight: 22,
      flexWrap: "wrap",
    },
    tipsCard: {
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      borderStartWidth: 4,
      borderStartColor: theme.colors.secondary.main,
    },
    tipsHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.md,
    },
    tipsHeaderIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.secondary.main + "20",
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginEnd: theme.spacing.sm,
    },
    tipsTitle: {
      ...getTextStyle(theme, "body", "semibold", theme.colors.secondary.dark),
    },
    tipItem: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      marginBottom: theme.spacing.sm,
    },
    tipBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.secondary.main,
      marginTop: 8,
      marginEnd: theme.spacing.sm,
    },
    tipText: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      flex: 1,
      lineHeight: 20,
      flexWrap: "wrap",
    },
    startButton: {
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.xl,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      flexDirection: "row" as const,
      ...theme.shadows.md,
    },
    startButtonText: {
      ...getTextStyle(theme, "button", "bold", theme.colors.neutral.white),
      marginStart: theme.spacing.sm,
    },
    backButton: {
      backgroundColor: "transparent",
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.xl,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      flexDirection: "row" as const,
      marginTop: theme.spacing.md,
      gap: theme.spacing.xs,
    },
    backButtonText: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.secondary),
    },
    noteText: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      fontStyle: "italic" as const,
      marginTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      textAlign: "center",
    },
    measuringCard: {
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      width: "100%",
      marginTop: theme.spacing.lg,
      ...theme.shadows.md,
    },
    processingContainer: {
      alignItems: "center",
      marginTop: theme.spacing.xl,
      padding: theme.spacing.xl,
    },
    beatCounterCard: {
      backgroundColor: theme.colors.primary[50],
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
    },
    beatCounterLabel: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.secondary),
    },
    beatCounterValue: {
      ...getTextStyle(theme, "heading", "bold", theme.colors.primary.main),
      fontSize: 20,
    },
    educationPanel: {
      backgroundColor: theme.colors.secondary[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    educationTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.secondary.dark),
      marginBottom: theme.spacing.sm,
    },
    educationText: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      lineHeight: 20,
      flexWrap: "wrap",
    },
  }))(theme);

  useEffect(() => {
    if (visible && status === "idle") {
      // Show instructions first - don't auto-start camera
      // User needs to explicitly start measurement after reviewing instructions
      setStatus("instructions");
    } else if (!visible) {
      resetState();
    }
  }, [visible]);

  // Proactively check camera permission when modal opens
  useEffect(() => {
    if (visible && status === "instructions" && hasPermission !== undefined) {
      // Reset permission denied state when modal opens
      setPermissionDenied(false);

      // Don't auto-request permission - let user do it explicitly
      // Just track the state
      if (!hasPermission) {
        setPermissionDenied(true);
      }
    }
  }, [visible, status, hasPermission, requestPermission]);

  // Recheck permission when app comes back from settings and handle backgrounding
  useEffect(() => {
    if (!visible) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && !hasPermission) {
        // Recheck permission when app becomes active
        requestPermission()
          .then((granted) => {
            if (granted) {
              setPermissionDenied(false);
            }
          })
          .catch(() => {
            // Silently handle error
          });
      } else if (nextAppState === "background" || nextAppState === "inactive") {
        // If app goes to background during measurement, stop it
        if (status === "measuring" && isCapturingRef.current) {
          isCapturingRef.current = false;
          setIsCapturing(false);
          isCapturingSV.value = false;
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          // Restore brightness
          if (originalBrightness !== null) {
            Brightness.setSystemBrightnessAsync(originalBrightness).catch(
              () => {}
            );
          }
          setError(t("measurementInterrupted"));
          setStatus("error");
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
  }, [visible, hasPermission, requestPermission, status, originalBrightness]);

  const resetState = () => {
    // Reset all state variables to initial values
    // This ensures no stale data persists when the modal is closed and reopened
    setStatus("idle");
    setError(null);
    setHeartRate(null);
    setHeartRateVariability(null); // Reset HRV state
    setRespiratoryRate(null); // Reset respiratory rate state
    setProgress(0);
    setSignalQuality(null);
    setFingerDetected(false);
    fingerDetectedRef.current = false;
    setIsCapturing(false);
    isCapturingRef.current = false;
    isCapturingSV.value = false;
    frameCountRef.current = 0;
    frameCountSV.value = 0;
    ppgSignalRef.current = [];
    setFramesCaptured(0);
    setFrameProcessorCalled(false);
    setBeatsDetected(0);
    setCurrentMilestone(null);
    setRecordingTime(0);
    setFingerDetectionFailed(false);
    setFrameProcessingErrors(0);
    setSaveFailed(false);
    setPermissionDenied(false);
    consecutiveNoFingerFrames.current = 0;
    consecutiveFrameFailures.current = 0;
    totalFrameFailures.current = 0;
    lastFrameTimeSV.value = 0;
    frameProcessorInitializedSV.value = false;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Restore original brightness if it was changed
    if (originalBrightness !== null) {
      Brightness.setSystemBrightnessAsync(originalBrightness).catch(() => {
        // Silently handle error
      });
      setOriginalBrightness(null);
    }
  };

  const requestCameraPermission = async (
    showExplanation = false
  ): Promise<boolean> => {
    try {
      // Show explanation dialog first if requested
      if (showExplanation) {
        return new Promise((resolve) => {
          Alert.alert(
            t("cameraPermissionRequiredTitle"),
            t("cameraPermissionRequiredMessage"),
            [
              {
                text: t("cancel"),
                style: "cancel",
                onPress: () => resolve(false),
              },
              {
                text: t("grantPermission"),
                onPress: async () => {
                  const result = await requestPermission();
                  if (result) {
                    setPermissionDenied(false);
                    resolve(true);
                  } else {
                    setPermissionDenied(true);
                    resolve(false);
                  }
                },
              },
            ]
          );
        });
      }

      // Direct permission request
      const result = await requestPermission();
      if (result) {
        setPermissionDenied(false);
        return true;
      }
      setPermissionDenied(true);
      return false;
    } catch (err) {
      setPermissionDenied(true);
      return false;
    }
  };

  const openSettings = async () => {
    try {
      if (Platform.OS === "ios") {
        await Linking.openURL("app-settings:");
      } else {
        await Linking.openSettings();
      }
    } catch (err) {
      Alert.alert(
        t("openSettings"),
        t(
          "openSettingsManually",
          "Please manually open Settings > Maak Health > Camera and enable camera access."
        )
      );
    }
  };

  const startMeasurement = async () => {
    try {
      // Request permission if not granted
      if (!hasPermission) {
        const granted = await requestCameraPermission(true);
        if (!granted) {
          // Permission denied - show error with option to try again or open settings
          Alert.alert(
            t("cameraPermissionDenied"),
            t("cameraPermissionDeniedMessage"),
            [
              {
                text: t("cancel"),
                style: "cancel",
              },
              {
                text: t("tryAgain"),
                onPress: async () => {
                  const result = await requestCameraPermission(false);
                  if (result) {
                    // Permission granted, continue with measurement
                    startMeasurement();
                  }
                },
              },
              {
                text: t("openSettings"),
                onPress: openSettings,
              },
            ]
          );
          setPermissionDenied(true);
          setError(
            t(
              "cameraPermissionRequiredForMeasurement",
              "Camera permission is required for heart rate measurement.\n\nPlease grant camera access to continue."
            )
          );
          setStatus("error");
          return;
        }
      }

      if (!device) {
        setError(t("backCameraNotAvailable"));
        setStatus("error");
        return;
      }

      setFingerDetected(false);
      fingerDetectedRef.current = false;
      setFingerDetectionFailed(false);

      // Set maximum brightness and save original brightness
      try {
        const currentBrightness = await Brightness.getSystemBrightnessAsync();
        setOriginalBrightness(currentBrightness);
        await Brightness.setSystemBrightnessAsync(1.0); // Set to maximum brightness
      } catch (brightnessError) {
        // Continue even if brightness control fails
      }

      setStatus("measuring");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Measurement failed";
      setError(errorMessage);
      setStatus("error");
      setPermissionDenied(true);
    }
  };

  const handleFingerPlacement = async () => {
    setFingerDetected(true);
    fingerDetectedRef.current = true;
    setIsCapturing(false);
    isCapturingRef.current = false;
    setProgress(0);
    frameCountRef.current = 0;
    ppgSignalRef.current = [];

    setTimeout(() => {
      startPPGCapture();
    }, 300);
  };

  const startPPGCapture = async () => {
    if (!fingerDetectedRef.current || isCapturingRef.current) {
      return;
    }

    frameCountRef.current = 0;
    frameCountSV.value = 0;
    ppgSignalRef.current = [];
    startTimeRef.current = Date.now();
    lastFrameTimeSV.value = Date.now();
    setProgress(0);
    setRecordingTime(0);
    setBeatsDetected(0);
    setCurrentMilestone(progressMilestones[0]);
    setIsCapturing(true);
    isCapturingRef.current = true;
    isCapturingSV.value = true;
    setFramesCaptured(0);

    // Start timer for recording time and milestones
    timerIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const roundedTime = Math.floor(elapsed);
      setRecordingTime(roundedTime);

      const milestone = getCurrentMilestone(elapsed);
      if (milestone) {
        setCurrentMilestone(milestone);
      }

      const estimatedBeats = Math.floor((elapsed / 60) * 70);
      setBeatsDetected(estimatedBeats);

      // Check if measurement is complete
      if (elapsed >= MEASUREMENT_DURATION) {
        stopPPGCapture();
      }
    }, 1000);
  };

  // Define stopPPGCapture first since handleFrameProcessingError needs it
  const stopPPGCapture = useCallback(async () => {
    setIsCapturing(false);
    isCapturingRef.current = false;
    isCapturingSV.value = false;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (fingerDetectionFailed) {
      setError(t("fingerNotDetected"));
      setStatus("error");
      return;
    }

    setCurrentMilestone(progressMilestones[60]);
    setStatus("processing");
    setProgress(1);

    // Validate we have enough frames
    if (ppgSignalRef.current.length < TARGET_FRAMES * 0.5) {
      setError(
        t("insufficientFramesCaptured", {
          captured: ppgSignalRef.current.length,
          target: TARGET_FRAMES,
        })
      );
      setStatus("error");
      return;
    }

    // Do not hard-fail on this flag: if frames are being captured, we have data to process.

    // Validate signal quality with enhanced checks
    const signalMean =
      ppgSignalRef.current.reduce((a, b) => a + b, 0) /
      ppgSignalRef.current.length;
    const signalVariance =
      ppgSignalRef.current.reduce(
        (sum, val) => sum + (val - signalMean) ** 2,
        0
      ) / ppgSignalRef.current.length;
    const signalStdDev = Math.sqrt(signalVariance);

    // Check for NaN or invalid values in signal
    const invalidValues = ppgSignalRef.current.filter(
      (val) => isNaN(val) || val < 0 || val > 255
    );
    if (invalidValues.length > ppgSignalRef.current.length * 0.1) {
      setError(t("signalContainsInvalidValues"));
      setStatus("error");
      return;
    }

    // Do not gate on raw std-dev of 0-255 frame averages.
    // Real fingertip PPG often has small amplitude in raw pixel averages; we rely on
    // `processPPGSignalEnhanced()` for quality gating after normalization/filtering.

    // CRITICAL: Check for excessive frame processing errors
    // If more than 15% of frames failed, we don't have enough real camera data
    // This is stricter because we must ensure only REAL data is used
    const totalAttempts =
      ppgSignalRef.current.length + totalFrameFailures.current;
    const failureRate =
      totalAttempts > 0 ? totalFrameFailures.current / totalAttempts : 1;
    if (failureRate > 0.15) {
      setError(
        t("unableToExtractCameraData", {
          rate: Math.round((1 - failureRate) * 100),
          captured: ppgSignalRef.current.length,
          attempts: totalAttempts,
        })
      );
      setStatus("error");
      return;
    }

    // Also check if we have enough real frames (at least 50% of target)
    const realFramesRatio = ppgSignalRef.current.length / TARGET_FRAMES;
    if (realFramesRatio < 0.5) {
      setError(
        t("insufficientRealCameraData", {
          captured: ppgSignalRef.current.length,
          target: TARGET_FRAMES,
        })
      );
      setStatus("error");
      return;
    }

    // Process PPG signal using ML models (PaPaGei) with fallback to traditional processing
    // ML processing provides better accuracy and robustness, especially for noisy signals
    const ppgResult = await processPPGSignalWithML(
      ppgSignalRef.current,
      TARGET_FPS,
      true, // Use ML processing
      userId
    );

    if (ppgResult.success && Number.isFinite(ppgResult.heartRate)) {
      const heartRate = ppgResult.heartRate as number;
      setHeartRate(heartRate);
      setHeartRateVariability(ppgResult.heartRateVariability || null);
      setRespiratoryRate(ppgResult.respiratoryRate || null);
      setSignalQuality(ppgResult.signalQuality);

      const shouldSave = !ppgResult.isEstimate;
      const saveSuccess = shouldSave
        ? await saveVitalToFirestore(
            heartRate,
            ppgResult.signalQuality,
            ppgResult.heartRateVariability,
            ppgResult.respiratoryRate
          )
        : true;

      if (ppgResult.isEstimate) {
        setSaveFailed(true);
        setError(t("ppgEstimateWarning"));
      } else if (!saveSuccess) {
        // Measurement succeeded but save failed - show warning but still show success
        setSaveFailed(true);
        setError(t("measurementCompletedButSaveFailed"));
        // Still show success status since measurement itself was successful
      }

      setStatus("success");
      onMeasurementComplete?.({
        ...ppgResult,
        heartRate: ppgResult.heartRate,
      } as ExtendedPPGResult);
    } else {
      setError(getPPGErrorMessage(ppgResult.error));
      setStatus("error");
    }
  }, [fingerDetectionFailed, frameProcessingErrors, onMeasurementComplete]);

  const handleFrameProcessingError = useCallback(
    (frameIndex: number) => {
      // Increment error counters for quality monitoring
      setFrameProcessingErrors((prev) => prev + 1);
      consecutiveFrameFailures.current += 1;
      totalFrameFailures.current += 1;

      // If too many consecutive failures, stop measurement early
      // This prevents continuing with insufficient real data
      if (consecutiveFrameFailures.current > 30) {
        // More than 30 consecutive failures (~1-2 seconds depending on fps) - stop measurement
        setError(t("unableToExtractCameraDataShort"));
        stopPPGCapture();
      }
    },
    [stopPPGCapture]
  );

  const resetFrameFailureCounter = useCallback(() => {
    // Reset consecutive failures on successful frame extraction
    consecutiveFrameFailures.current = 0;
  }, []);

  const markFrameProcessorCalled = useCallback(() => {
    setFrameProcessorCalled(true);
  }, []);

  const setFrameMetaFromWorklet = useCallback((meta: string) => {
    // capture once so we don't spam re-renders
    setFrameMeta((prev) => prev ?? meta);
  }, []);

  const processPPGFrameData = useCallback(
    (redAverage: number, frameIndex: number) => {
      if (!isCapturingRef.current) {
        return;
      }

      // CRITICAL: Validate that we have REAL data from the camera
      // Reject -1 (extraction failed) and any invalid values
      // This ensures we ONLY use actual camera pixel data, never simulated
      if (redAverage < 0 || redAverage > 255 || isNaN(redAverage)) {
        // Invalid data (including -1 which indicates extraction failure)
        // Don't add to signal, track as failure
        handleFrameProcessingError(frameIndex);
        return;
      }

      // Only add REAL valid data from camera to signal
      // Do not clamp to hide errors - if value is out of range, it's rejected above
      const validValue = Math.round(redAverage);
      ppgSignalRef.current.push(validValue);
      frameCountRef.current = frameIndex + 1;

      // Update UI counter at ~1Hz to avoid re-rendering at 30fps
      if (frameIndex % Math.max(1, Math.round(TARGET_FPS)) === 0) {
        setFramesCaptured(ppgSignalRef.current.length);
      }

      // Update progress
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setProgress(Math.min(1, elapsed / MEASUREMENT_DURATION));

      // Enhanced real-time signal quality validation following research guidance
      if (
        ppgSignalRef.current.length >= 30 &&
        ppgSignalRef.current.length % 30 === 0
      ) {
        const recentSignal = ppgSignalRef.current.slice(-(TARGET_FPS * 5)); // Use last 5 seconds for quality assessment

        // Calculate comprehensive signal quality metrics
        // Simple signal quality calculation based on variance and mean
        const calculateRealTimeSignalQuality = (signal: number[]): number => {
          if (signal.length < 30) return 0;
          const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
          const variance =
            signal.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
            signal.length;
          const stdDev = Math.sqrt(variance);
          // Normalize quality score (0-1) based on signal variation
          // Higher variation (relative to mean) indicates better signal quality for PPG
          const quality = Math.min(stdDev / (mean || 1), 1);
          return Math.max(0, Math.min(1, quality));
        };
        const signalQuality = calculateRealTimeSignalQuality(recentSignal);

        // Update signal quality state
        setSignalQuality(signalQuality);

        // Do not stop the measurement early based on real-time quality heuristics.
        // Real signals can be low-amplitude but still recoverable after filtering; early-stop was
        // preventing users from ever reaching a score.
        if (signalQuality < 0.3) {
          consecutiveNoFingerFrames.current += 30;
        } else {
          consecutiveNoFingerFrames.current = 0;
        }
      }

      // Optimized beat detection with time-based calculation
      if (ppgSignalRef.current.length > 30) {
        const signal = ppgSignalRef.current;
        const timeElapsed = (Date.now() - startTimeRef.current) / 1000;

        // Use time-based beat rate calculation instead of scaling peaks
        if (timeElapsed > 10) {
          // Only calculate after 10 seconds for stability
          const recentSignal = signal.slice(
            -Math.min(signal.length, TARGET_FPS * 10)
          ); // Last 10 seconds
          let peaks = 0;

          for (let i = 1; i < recentSignal.length - 1; i++) {
            if (
              recentSignal[i] > recentSignal[i - 1] &&
              recentSignal[i] > recentSignal[i + 1]
            ) {
              peaks++;
            }
          }

          // Calculate beats per minute from actual time window
          const timeWindow = Math.min(10, timeElapsed);
          const beatsPerMinute = (peaks / timeWindow) * 60;
          const estimatedBeats = Math.floor(
            (timeElapsed / 60) * Math.min(beatsPerMinute, 120)
          );
          setBeatsDetected(
            Math.min(estimatedBeats, Math.floor(timeElapsed * 1.5))
          );
        }
      }
    },
    [stopPPGCapture, handleFrameProcessingError]
  );

  // Create worklet-safe "hop back to JS" wrappers AFTER the callbacks exist.
  const markFrameProcessorCalledOnJS = useRunOnJS(markFrameProcessorCalled, [
    markFrameProcessorCalled,
  ]);
  const handleFrameProcessingErrorOnJS = useRunOnJS(
    handleFrameProcessingError,
    [handleFrameProcessingError]
  );
  const resetFrameFailureCounterOnJS = useRunOnJS(resetFrameFailureCounter, [
    resetFrameFailureCounter,
  ]);
  const processPPGFrameDataOnJS = useRunOnJS(processPPGFrameData, [
    processPPGFrameData,
  ]);
  const setFrameMetaOnJS = useRunOnJS(setFrameMetaFromWorklet, [
    setFrameMetaFromWorklet,
  ]);

  // Frame processor for real-time PPG signal extraction
  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";

      // Log first frame processor call for debugging
      if (!frameProcessorInitializedSV.value) {
        frameProcessorInitializedSV.value = true;
        markFrameProcessorCalledOnJS();
        setFrameMetaOnJS(
          `isValid=${String(frame.isValid)} ${frame.width}x${frame.height} ${String(frame.pixelFormat)} bytesPerRow=${String(frame.bytesPerRow)}`
        );
      }

      // Only process frames if we're capturing
      if (!isCapturingSV.value) {
        return;
      }

      const now = Date.now();

      // Throttle to TARGET_FPS (dynamically set based on camera capabilities)
      if (now - lastFrameTimeSV.value < FRAME_INTERVAL_MS) {
        return;
      }

      lastFrameTimeSV.value = now;

      try {
        // Validate frame dimensions
        if (
          !(frame.width && frame.height) ||
          frame.width <= 0 ||
          frame.height <= 0
        ) {
          // Invalid frame - track failure and skip (don't add fake data)
          handleFrameProcessingErrorOnJS(frameCountSV.value);
          return; // Skip this frame - don't add any data
        }

        // Extract red channel average from center of frame using pixel extractor
        // CRITICAL: extractRedChannelAverage returns -1 if extraction fails
        const redAverage = extractRedChannelAverage(frame);

        // Validate extracted value - must be valid real data (0-255 range)
        // -1 indicates extraction failure - DO NOT treat as valid data
        if (redAverage < 0 || redAverage > 255 || isNaN(redAverage)) {
          // Invalid value - track failure and skip (don't add fake data)
          // This includes -1 (extraction failed) and any out-of-range values
          handleFrameProcessingErrorOnJS(frameCountSV.value);
          return; // Skip this frame - don't add any data
        }

        // Only process if we have REAL valid data from the camera
        // Reset failure counter on success
        resetFrameFailureCounterOnJS();

        // Call JS function to process the frame data
        processPPGFrameDataOnJS(redAverage, frameCountSV.value);
        frameCountSV.value = frameCountSV.value + 1;
      } catch (error) {
        // Handle frame processing errors - track failure but don't add fake data
        handleFrameProcessingErrorOnJS(frameCountSV.value);
        // Don't add any data - skip this frame entirely
        return;
      }
    },
    [
      FRAME_INTERVAL_MS,
      handleFrameProcessingErrorOnJS,
      markFrameProcessorCalledOnJS,
      processPPGFrameDataOnJS,
      resetFrameFailureCounterOnJS,
      setFrameMetaOnJS, // IMPORTANT: Included to prevent stale closures when setFrameMetaFromWorklet changes
    ]
  );

  const saveVitalToFirestore = async (
    heartRate: number,
    signalQuality: number,
    hrv?: number,
    respiratoryRate?: number
  ): Promise<boolean> => {
    try {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) {
        return false;
      }

      const heartRateData = {
        userId: currentUserId,
        type: "heartRate",
        value: heartRate,
        unit: "bpm",
        timestamp: Timestamp.now(),
        source: "ppg_camera_real",
        signalQuality,
        metadata: {
          measurementDuration: MEASUREMENT_DURATION,
          frameRate: TARGET_FPS,
          framesCaptured: ppgSignalRef.current.length,
          method: "vision-camera-ppg",
        },
      };
      await addDoc(collection(db, "vitals"), heartRateData);

      if (hrv) {
        const hrvData = {
          userId: currentUserId,
          type: "heartRateVariability",
          value: hrv,
          unit: "ms",
          timestamp: Timestamp.now(),
          source: "ppg_camera_real",
          signalQuality,
        };
        await addDoc(collection(db, "vitals"), hrvData);
      }

      if (respiratoryRate) {
        const respiratoryData = {
          userId: currentUserId,
          type: "respiratoryRate",
          value: respiratoryRate,
          unit: "bpm",
          timestamp: Timestamp.now(),
          source: "ppg_camera_real",
          signalQuality,
        };
        await addDoc(collection(db, "vitals"), respiratoryData);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save vital signs data";

      // Return false to indicate save failure - caller will handle user notification
      return false;
    }

    return true;
  };

  const getStatusMessage = () => {
    switch (status) {
      case "instructions":
        return t("howToMeasureHeartRate");
      case "measuring":
        return t("keepFingerStill", { seconds: MEASUREMENT_DURATION });
      case "processing":
        return t("processingHeartRate");
      case "success":
        return t("measurementComplete");
      case "error":
        return error || "An error occurred";
      default:
        return t("readyToMeasureHeartRate");
    }
  };

  // Early return with null check to prevent Modal from accessing null
  if (!visible) {
    return null;
  }

  // Ensure visible is a boolean to prevent null/undefined issues
  const modalVisible = visible === true;

  // Check if we're on web - vision camera doesn't work on web
  if (Platform.OS === "web") {
    return (
      <Modal
        animationType="slide"
        onRequestClose={onClose}
        transparent={false}
        visible={modalVisible}
      >
        <SafeAreaView style={styles.modal as ViewStyle}>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            onPress={() => {
              resetState();
              onClose();
            }}
            style={[
              styles.closeButton as ViewStyle,
              { zIndex: 10_001, elevation: 20 },
            ]}
          >
            <X color={theme.colors.text.primary} size={20} />
          </TouchableOpacity>
          <View style={styles.container as ViewStyle}>
            <View style={styles.content as ViewStyle}>
              <Text style={styles.title as StyleProp<TextStyle>}>
                {t("notAvailableOnWeb")}
              </Text>
              <Text style={styles.errorText as StyleProp<TextStyle>}>
                {t("notAvailableOnWebMessage")}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Check if device is available - if not, show error
  // Note: react-native-vision-camera doesn't support web platform
  if (!device) {
    return (
      <Modal
        animationType="slide"
        onRequestClose={onClose}
        transparent={false}
        visible={modalVisible}
      >
        <SafeAreaView style={styles.modal as ViewStyle}>
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            onPress={() => {
              resetState();
              onClose();
            }}
            style={[
              styles.closeButton as ViewStyle,
              { zIndex: 10_001, elevation: 20 },
            ]}
          >
            <X color={theme.colors.text.primary} size={20} />
          </TouchableOpacity>
          <View style={styles.container as ViewStyle}>
            <View style={styles.content as ViewStyle}>
              <Text style={styles.title as StyleProp<TextStyle>}>
                {t("cameraNotAvailable")}
              </Text>
              <Text style={styles.errorText as StyleProp<TextStyle>}>
                {t("cameraNotAvailableMessage")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  resetState();
                  onClose();
                }}
                style={styles.button as ViewStyle}
              >
                <Text style={styles.buttonText as StyleProp<TextStyle>}>
                  {t("close")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}
      visible={modalVisible}
    >
      <SafeAreaView style={styles.modal as ViewStyle}>
        <TouchableOpacity
          activeOpacity={0.7}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          onPress={() => {
            resetState();
            onClose();
          }}
          style={[
            styles.closeButton as ViewStyle,
            { zIndex: 10_001, elevation: 20 },
          ]}
        >
          <X color={theme.colors.text.primary} size={20} />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent as ViewStyle}
          contentInsetAdjustmentBehavior="automatic"
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={styles.container as ViewStyle}
        >
          <View style={styles.header as ViewStyle}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.sm,
              }}
            >
              <Text style={styles.title as StyleProp<TextStyle>}>
                {t("vitalsMonitor")}
              </Text>
              <View
                style={{
                  backgroundColor: theme.colors.accent.success,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: 2,
                  borderRadius: theme.borderRadius.md,
                }}
              >
                <Text
                  style={{
                    ...getTextStyle(
                      theme,
                      "caption",
                      "bold",
                      theme.colors.neutral.white
                    ),
                    fontSize: 10,
                    letterSpacing: 0.5,
                  }}
                >
                  {t("realPPG")}
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.subtitle as StyleProp<TextStyle>,
                { fontSize: 14 },
              ]}
            >
              {t("vitalSignsMonitorDescription")}
            </Text>
          </View>

          {status === "measuring" && device && hasPermission && (
            <View style={styles.cameraContainer as ViewStyle}>
              {/* Camera preview container - flash provides illumination for PPG */}
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "#FFFFFF",
                }}
              />
              <Camera
                device={device}
                format={format}
                fps={TARGET_FPS}
                frameProcessor={frameProcessor}
                isActive={status === "measuring"}
                onError={(error) => {
                  console.error("Camera error:", error);
                  setError(`Camera error: ${error.message}`);
                  setStatus("error");
                }}
                pixelFormat="rgb"
                style={styles.camera as ViewStyle}
                torch={status === "measuring" ? "on" : "off"}
              />
            </View>
          )}

          <View style={styles.content as ViewStyle}>
            <Text style={styles.subtitle as StyleProp<TextStyle>}>
              {getStatusMessage()}
            </Text>

            {status === "instructions" && (
              <View style={styles.instructionsContainer as ViewStyle}>
                <View style={styles.instructionsCard as ViewStyle}>
                  <View style={styles.instructionsHeader as ViewStyle}>
                    <View style={styles.instructionsHeaderIcon as ViewStyle}>
                      <Hand color={theme.colors.primary.main} size={20} />
                    </View>
                    <Text
                      style={styles.instructionsTitle as StyleProp<TextStyle>}
                    >
                      {t("howToMeasure")}
                    </Text>
                  </View>

                  <View style={styles.instructionItem as ViewStyle}>
                    <View style={styles.instructionNumber as ViewStyle}>
                      <Text
                        style={
                          styles.instructionNumberText as StyleProp<TextStyle>
                        }
                      >
                        1
                      </Text>
                    </View>
                    <Text
                      style={styles.instructionItemText as StyleProp<TextStyle>}
                    >
                      {t("instructionFindComfortablePlace")}
                    </Text>
                  </View>

                  <View style={styles.instructionItem as ViewStyle}>
                    <View style={styles.instructionNumber as ViewStyle}>
                      <Text
                        style={
                          styles.instructionNumberText as StyleProp<TextStyle>
                        }
                      >
                        2
                      </Text>
                    </View>
                    <Text
                      style={styles.instructionItemText as StyleProp<TextStyle>}
                    >
                      {t("instructionPositionFinger")}
                    </Text>
                  </View>

                  <View style={styles.instructionItem as ViewStyle}>
                    <View style={styles.instructionNumber as ViewStyle}>
                      <Text
                        style={
                          styles.instructionNumberText as StyleProp<TextStyle>
                        }
                      >
                        3
                      </Text>
                    </View>
                    <Text
                      style={styles.instructionItemText as StyleProp<TextStyle>}
                    >
                      {t("instructionCoverCamera")}
                    </Text>
                  </View>

                  <View style={styles.instructionItem as ViewStyle}>
                    <View style={styles.instructionNumber as ViewStyle}>
                      <Clock color={theme.colors.neutral.white} size={14} />
                    </View>
                    <Text
                      style={styles.instructionItemText as StyleProp<TextStyle>}
                    >
                      {t("instructionHoldStill")}
                    </Text>
                  </View>
                </View>

                <View style={styles.educationPanel as ViewStyle}>
                  <Text style={styles.educationTitle as StyleProp<TextStyle>}>
                    {t("realPPGTechnology")}
                  </Text>
                  <Text style={styles.educationText as StyleProp<TextStyle>}>
                    {t("realPPGTechnologyDesc")}
                  </Text>
                </View>

                <View style={styles.tipsCard as ViewStyle}>
                  <View style={styles.tipsHeader as ViewStyle}>
                    <View style={styles.tipsHeaderIcon as ViewStyle}>
                      <Lightbulb
                        color={theme.colors.secondary.main}
                        size={18}
                      />
                    </View>
                    <Text style={styles.tipsTitle as StyleProp<TextStyle>}>
                      {t("researchBasedTips")}
                    </Text>
                  </View>

                  <View style={styles.tipItem as ViewStyle}>
                    <View style={styles.tipBullet as ViewStyle} />
                    <Text style={styles.tipText as StyleProp<TextStyle>}>
                      {t("tipKeepHandSteady")}
                    </Text>
                  </View>

                  <View style={styles.tipItem as ViewStyle}>
                    <View style={styles.tipBullet as ViewStyle} />
                    <Text style={styles.tipText as StyleProp<TextStyle>}>
                      {t("tipDontPressHard")}
                    </Text>
                  </View>

                  <View style={styles.tipItem as ViewStyle}>
                    <View style={styles.tipBullet as ViewStyle} />
                    <Text style={styles.tipText as StyleProp<TextStyle>}>
                      {t("tipFingerWarm")}
                    </Text>
                  </View>

                  <View style={styles.tipItem as ViewStyle}>
                    <View style={styles.tipBullet as ViewStyle} />
                    <Text style={styles.tipText as StyleProp<TextStyle>}>
                      {t("tipBreatheCalmly")}
                    </Text>
                  </View>
                </View>

                {permissionDenied && !hasPermission && (
                  <View
                    style={{
                      backgroundColor: theme.colors.primary[50],
                      borderRadius: theme.borderRadius.md,
                      padding: theme.spacing.md,
                      marginBottom: theme.spacing.lg,
                      borderLeftWidth: 4,
                      borderLeftColor: theme.colors.primary.main,
                    }}
                  >
                    <Text
                      style={[
                        styles.instructionsTitle as StyleProp<TextStyle>,
                        { marginBottom: theme.spacing.sm },
                      ]}
                    >
                      {t("cameraPermissionRequired")}
                    </Text>
                    <Text
                      style={[
                        styles.instructionText as StyleProp<TextStyle>,
                        { fontSize: 13, marginBottom: theme.spacing.md },
                      ]}
                    >
                      {t("cameraPermissionExplanation")}
                    </Text>
                    <TouchableOpacity
                      onPress={async () => {
                        const granted = await requestCameraPermission(true);
                        if (!granted) {
                          // Show option to open settings if permission still denied
                          Alert.alert(
                            t("permissionDenied"),
                            t("permissionDeniedMessage"),
                            [
                              { text: t("cancel"), style: "cancel" },
                              {
                                text: t("openSettings"),
                                onPress: openSettings,
                              },
                            ]
                          );
                        }
                      }}
                      style={[
                        styles.startButton as ViewStyle,
                        {
                          backgroundColor: theme.colors.primary.main,
                          marginTop: theme.spacing.sm,
                        },
                      ]}
                    >
                      <CheckCircle
                        color={theme.colors.neutral.white}
                        size={20}
                      />
                      <Text
                        style={styles.startButtonText as StyleProp<TextStyle>}
                      >
                        {t("grantCameraPermission")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  disabled={permissionDenied}
                  onPress={startMeasurement}
                  style={styles.startButton as ViewStyle}
                >
                  <CheckCircle color={theme.colors.neutral.white} size={20} />
                  <Text style={styles.startButtonText as StyleProp<TextStyle>}>
                    {t("startMeasurement")}
                  </Text>
                </TouchableOpacity>

                {/* Back Button */}
                <TouchableOpacity
                  onPress={() => {
                    resetState();
                    onClose();
                  }}
                  style={styles.backButton as ViewStyle}
                >
                  <ChevronLeft color={theme.colors.text.secondary} size={20} />
                  <Text style={styles.backButtonText as StyleProp<TextStyle>}>
                    {t("back")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {status === "measuring" && (
              <>
                {fingerDetected ? (
                  <>
                    <View style={styles.progressBar as ViewStyle}>
                      <View
                        style={[
                          styles.progressFill as ViewStyle,
                          { width: `${progress * 100}%` },
                        ]}
                      />
                    </View>

                    <View style={styles.beatCounterCard as ViewStyle}>
                      <Text
                        style={styles.beatCounterLabel as StyleProp<TextStyle>}
                      >
                        {t("heartbeatsCaptured")}
                      </Text>
                      <Text
                        style={styles.beatCounterValue as StyleProp<TextStyle>}
                      >
                        {beatsDetected}/60
                      </Text>
                    </View>

                    <Text
                      style={styles.instructionText as StyleProp<TextStyle>}
                    >
                      {t("sixtySecondsAccuracy")}
                    </Text>
                    <Text
                      style={
                        [
                          styles.instructionText as StyleProp<TextStyle>,
                          { fontSize: 12, marginTop: 5, opacity: 0.7 },
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {t("capturingFrames", {
                        captured: framesCaptured,
                        target: TARGET_FRAMES,
                        fps: TARGET_FPS,
                        time: recordingTime,
                        duration: MEASUREMENT_DURATION,
                      })}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      style={styles.instructionText as StyleProp<TextStyle>}
                    >
                      {t("instructionPositionFinger")}.{" "}
                      {t("instructionCoverCamera")}.
                    </Text>
                    <Text
                      style={
                        [
                          styles.instructionText as StyleProp<TextStyle>,
                          { marginTop: 10, fontSize: 14 },
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {t("onceFingerInPlace")}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setFingerDetected(true);
                        fingerDetectedRef.current = true;
                        handleFingerPlacement();
                      }}
                      style={[styles.button as ViewStyle, { marginTop: 30 }]}
                    >
                      <Text style={styles.buttonText as StyleProp<TextStyle>}>
                        {t("startMeasurement")}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {status === "processing" && (
              <View style={styles.processingContainer as ViewStyle}>
                <View style={styles.heartRateContainer as ViewStyle}>
                  <Heart color={theme.colors.accent.error} size={64} />
                  <ActivityIndicator
                    color={theme.colors.primary.main}
                    size="large"
                    style={{ marginTop: theme.spacing.xl }}
                  />
                  <Text
                    style={
                      [
                        styles.subtitle as StyleProp<TextStyle>,
                        { marginTop: theme.spacing.lg },
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {t("processingYourHeartRate")}
                  </Text>
                </View>
              </View>
            )}

            {status === "success" && heartRate !== null && (
              <View style={styles.successContainer as ViewStyle}>
                <View style={styles.successCard as ViewStyle}>
                  <CheckCircle color={theme.colors.accent.success} size={48} />
                  <Text
                    style={
                      [
                        styles.statusText as StyleProp<TextStyle>,
                        { marginTop: theme.spacing.lg },
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {t("measurementComplete")}
                  </Text>

                  <View style={styles.heartRateContainer as ViewStyle}>
                    <Text style={styles.heartRateText as StyleProp<TextStyle>}>
                      {heartRate}
                    </Text>
                    <Text
                      style={
                        [
                          styles.qualityText as StyleProp<TextStyle>,
                          { fontSize: 20, marginTop: theme.spacing.sm },
                        ] as StyleProp<TextStyle>
                      }
                    >
                      {t("bpm")}
                    </Text>
                  </View>

                  {(heartRateVariability !== null ||
                    respiratoryRate !== null) && (
                    <View
                      style={{
                        marginTop: theme.spacing.lg,
                        width: "100%",
                        alignItems: "center",
                        gap: theme.spacing.sm,
                        paddingHorizontal: theme.spacing.md,
                      }}
                    >
                      {heartRateVariability !== null && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: theme.spacing.sm,
                            flexWrap: "wrap",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={
                              [
                                styles.qualityText as StyleProp<TextStyle>,
                                { fontSize: 15 },
                              ] as StyleProp<TextStyle>
                            }
                          >
                            {t("hrv")}
                          </Text>
                          <Text
                            style={
                              [
                                styles.qualityText as StyleProp<TextStyle>,
                                { fontSize: 15, fontWeight: "600" },
                              ] as StyleProp<TextStyle>
                            }
                          >
                            {heartRateVariability.toFixed(0)} ms
                          </Text>
                        </View>
                      )}
                      {respiratoryRate !== null && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: theme.spacing.sm,
                            flexWrap: "wrap",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={
                              [
                                styles.qualityText as StyleProp<TextStyle>,
                                { fontSize: 15 },
                              ] as StyleProp<TextStyle>
                            }
                          >
                            {t("respiratoryRate")}:
                          </Text>
                          <Text
                            style={
                              [
                                styles.qualityText as StyleProp<TextStyle>,
                                { fontSize: 15, fontWeight: "600" },
                              ] as StyleProp<TextStyle>
                            }
                          >
                            {respiratoryRate.toFixed(0)} {t("breathsPerMin")}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {saveFailed && error && (
                  <View
                    style={{
                      backgroundColor: theme.colors.accent.warning + "20",
                      borderRadius: theme.borderRadius.md,
                      padding: theme.spacing.md,
                      marginTop: theme.spacing.lg,
                      marginHorizontal: theme.spacing.md,
                      borderLeftWidth: 4,
                      borderLeftColor: theme.colors.accent.warning,
                    }}
                  >
                    <Text
                      style={[
                        styles.errorText as StyleProp<TextStyle>,
                        { color: theme.colors.accent.warning },
                      ]}
                    >
                      {error}
                    </Text>
                  </View>
                )}

                {!saveFailed && (
                  <Text
                    style={
                      [
                        styles.instructionText as StyleProp<TextStyle>,
                        { paddingHorizontal: theme.spacing.md },
                      ] as StyleProp<TextStyle>
                    }
                  >
                    {t("vitalSignsSaved")}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.button as ViewStyle}
                >
                  <Text style={styles.buttonText as StyleProp<TextStyle>}>
                    {t("done")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {status === "error" && (
              <View style={styles.measuringCard as ViewStyle}>
                <Text style={styles.errorText as StyleProp<TextStyle>}>
                  {error}
                </Text>
                {permissionDenied && (
                  <>
                    <TouchableOpacity
                      onPress={async () => {
                        const granted = await requestCameraPermission(true);
                        if (granted) {
                          // Permission granted, reset error state
                          setError(null);
                          setStatus("instructions");
                        } else {
                          // Show option to open settings if permission still denied
                          Alert.alert(
                            t("permissionDenied"),
                            t("permissionDeniedMessage"),
                            [
                              { text: t("cancel"), style: "cancel" },
                              {
                                text: t("openSettings"),
                                onPress: openSettings,
                              },
                            ]
                          );
                        }
                      }}
                      style={[
                        styles.button as ViewStyle,
                        {
                          backgroundColor: theme.colors.primary.main,
                          marginTop: theme.spacing.md,
                        },
                      ]}
                    >
                      <Text style={styles.buttonText as StyleProp<TextStyle>}>
                        {t("grantCameraPermissionButton")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={openSettings}
                      style={[
                        styles.button as ViewStyle,
                        {
                          backgroundColor: theme.colors.secondary.main,
                          marginTop: theme.spacing.sm,
                        },
                      ]}
                    >
                      <Text style={styles.buttonText as StyleProp<TextStyle>}>
                        {t("openSettings")}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity
                  onPress={() => {
                    resetState();
                    onClose();
                  }}
                  style={[
                    styles.button as ViewStyle,
                    { marginTop: permissionDenied ? theme.spacing.sm : 0 },
                  ]}
                >
                  <Text style={styles.buttonText as StyleProp<TextStyle>}>
                    {t("close")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
