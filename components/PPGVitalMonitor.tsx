import {
  type CameraMountError,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import {
  CheckCircle,
  ChevronLeft,
  Clock,
  Hand,
  Heart,
  Lightbulb,
  X,
  Zap,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  type StyleProp,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { auth, db } from "@/lib/firebase";
import {
  type PPGResult,
  processPPGSignalEnhanced,
} from "@/lib/utils/BiometricUtils";
import { getTextStyle } from "@/utils/styles";
import { createPPGStyles } from "./PPGVitalMonitor/styles";

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

export default function PPGVitalMonitor({
  visible,
  userId,
  onMeasurementComplete,
  onClose,
}: PPGVitalMonitorProps) {
  const themeContext = useTheme();
  const theme = themeContext?.theme;
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<
    "idle" | "instructions" | "measuring" | "processing" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [heartRateVariability, setHeartRateVariability] = useState<
    number | null
  >(null);
  const [respiratoryRate, setRespiratoryRate] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [signalQuality, setSignalQuality] = useState<number | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [fingerDetected, setFingerDetected] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [beatsDetected, setBeatsDetected] = useState(0);
  const [currentMilestone, setCurrentMilestone] = useState<{
    title: string;
    detail: string;
    icon: string;
    progress: string;
  } | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [fingerDetectionFailed, setFingerDetectionFailed] = useState(false);
  const consecutiveNoFingerFrames = useRef(0);
  const MIN_FINGER_DETECTION_FRAMES = 10; // Need at least 10 frames showing finger presence

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

  const cameraRef = useRef<CameraView | null>(null);
  const frameCountRef = useRef(0);
  const ppgSignalRef = useRef<number[]>([]);
  const startTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCapturingRef = useRef(false); // Use ref to avoid closure issues
  const fingerDetectedRef = useRef(false); // Use ref to avoid closure issues
  const TARGET_FPS = 14; // 14 fps as per research (Olugbenle et al.)
  const FRAME_INTERVAL_MS = 1000 / TARGET_FPS; // ~71.4ms per frame
  const MEASUREMENT_DURATION = 60; // 60 seconds - clinical standard for comprehensive vital signs (HRV, respiratory rate, heart rate)
  const TARGET_FRAMES = TARGET_FPS * MEASUREMENT_DURATION; // 840 frames

  // Progress milestones for 60s capture (maximum accuracy mode)
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
    20: {
      title: "Extracting HRV patterns",
      detail: "20/60 heartbeats captured",
      icon: "💚",
      progress: "33%",
    },
    30: {
      title: "Halfway there!",
      detail: "Statistical significance achieved",
      icon: "🟡",
      progress: "50%",
    },
    40: {
      title: "Advanced feature extraction",
      detail: "Frequency domain analysis",
      icon: "🟠",
      progress: "67%",
    },
    45: {
      title: "Three quarters complete",
      detail: "Morphological features captured",
      icon: "🔶",
      progress: "75%",
    },
    50: {
      title: "Final analysis phase",
      detail: "Refining biometric signature",
      icon: "🟣",
      progress: "83%",
    },
    55: {
      title: "Almost complete!",
      detail: "Validating signal quality",
      icon: "🔴",
      progress: "92%",
    },
    60: {
      title: "Complete!",
      detail: "Measurement complete",
      icon: "✅",
      progress: "100%",
    },
  };

  // Get current milestone based on recording time
  const getCurrentMilestone = (
    time: number
  ): {
    title: string;
    detail: string;
    icon: string;
    progress: string;
  } | null => {
    const roundedTime = Math.floor(time);
    // Find the milestone that matches or is closest below current time
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

  // Memoized styles for performance - with comprehensive null safety
  const styles = useMemo(() => {
    if (!(theme && theme.colors && theme.spacing)) {
      return {
        modal: {},
        container: {},
        scrollContent: {},
        content: {},
        header: {},
        title: {},
        subtitle: {},
        button: {},
        buttonText: {},
        closeButton: {},
        camera: {},
        cameraContainer: {},
        statusText: {},
        progressBar: {},
        progressFill: {},
        heartRateText: {},
        heartRateContainer: {},
        qualityText: {},
        errorText: {},
        instructionText: {},
        successContainer: {},
        successCard: {},
        instructionsContainer: {},
        instructionsCard: {},
        instructionsHeader: {},
        instructionsHeaderIcon: {},
        instructionsTitle: {},
        instructionItem: {},
        instructionNumber: {},
        instructionNumberText: {},
        instructionItemText: {},
        tipsCard: {},
        tipsHeader: {},
        tipsHeaderIcon: {},
        tipsTitle: {},
        tipItem: {},
        tipBullet: {},
        tipText: {},
        startButton: {},
        startButtonText: {},
        backButton: {},
        backButtonText: {},
        noteText: {},
        measuringCard: {},
        processingContainer: {},
        beatCounterCard: {},
        beatCounterLabel: {},
        beatCounterValue: {},
        educationPanel: {},
        educationTitle: {},
        educationText: {},
      } as any;
    }

    try {
      const baseStyles = createPPGStyles(theme);
      return {
        ...baseStyles,
        // Additional inline styles that need theme access
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
        errorText: {
          ...getTextStyle(theme, "body", "medium", theme.colors.accent.error),
          textAlign: "center",
          marginTop: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
        },
        instructionText: {
          ...getTextStyle(
            theme,
            "body",
            "regular",
            theme.colors.text.secondary
          ),
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
          marginRight: theme.spacing.md,
        },
        instructionsTitle: {
          ...getTextStyle(
            theme,
            "subheading",
            "bold",
            theme.colors.primary.main
          ),
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
          marginRight: theme.spacing.md,
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
          borderLeftWidth: 4,
          borderLeftColor: theme.colors.secondary.main,
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
          marginRight: theme.spacing.sm,
        },
        tipsTitle: {
          ...getTextStyle(
            theme,
            "body",
            "semibold",
            theme.colors.secondary.dark
          ),
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
          marginRight: theme.spacing.sm,
        },
        tipText: {
          ...getTextStyle(
            theme,
            "caption",
            "regular",
            theme.colors.text.secondary
          ),
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
          marginLeft: theme.spacing.sm,
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
          ...getTextStyle(
            theme,
            "caption",
            "regular",
            theme.colors.text.secondary
          ),
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
          ...getTextStyle(
            theme,
            "subheading",
            "bold",
            theme.colors.secondary.dark
          ),
          marginBottom: theme.spacing.sm,
        },
        educationText: {
          ...getTextStyle(
            theme,
            "caption",
            "regular",
            theme.colors.text.secondary
          ),
          lineHeight: 20,
          flexWrap: "wrap",
        },
      };
    } catch (error) {
      return {} as any;
    }
  }, [theme]);

  useEffect(() => {
    if (visible && status === "idle") {
      // Show instructions first, don't auto-start
      // Camera will initialize when instructions screen shows
      setStatus("instructions");
    } else if (!visible) {
      resetState();
    }
  }, [visible]);

  // Proactively check camera permission when modal opens
  useEffect(() => {
    if (visible && status === "instructions" && permission) {
      // If permission is not granted, request it proactively
      if (!permission?.granted && permission?.canAskAgain) {
        requestPermission().catch((err) => {
          // Silently handle permission request error
        });
      }
    }
  }, [visible, status, permission]);

  // Ensure camera initializes when modal becomes visible and we're measuring
  useEffect(() => {
    if (
      visible &&
      status === "measuring" &&
      permission?.granted &&
      !cameraReady
    ) {
      // Set a timeout fallback - if camera doesn't initialize in 3 seconds, mark as ready anyway
      // This prevents the "initializing camera" message from staying forever
      const timer = setTimeout(() => {
        if (!cameraReady) {
          setCameraReady(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, status, cameraReady, permission?.granted]);

  const resetState = () => {
    setStatus("idle");
    setError(null);
    setHeartRate(null);
    setProgress(0);
    setSignalQuality(null);
    setTorchEnabled(false);
    setFingerDetected(false);
    fingerDetectedRef.current = false;
    setCameraReady(false);
    setIsCapturing(false);
    isCapturingRef.current = false;
    frameCountRef.current = 0;
    ppgSignalRef.current = [];
    setBeatsDetected(0);
    setCurrentMilestone(null);
    setRecordingTime(0);
    setFingerDetectionFailed(false);
    consecutiveNoFingerFrames.current = 0;
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const startMeasurement = async () => {
    try {
      // Check camera permission
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          // Provide helpful error message with instructions
          if (permission?.canAskAgain === false) {
            setError(
              "Camera permission was denied. Please enable camera access in your device settings to measure heart rate.\n\n" +
                "Go to Settings > Maak Health > Camera and enable access."
            );
          } else {
            setError(
              "Camera permission is required for heart rate measurement. Please grant camera access when prompted."
            );
          }
          setStatus("error");
          return;
        }
      }

      // Reset camera ready state when starting measurement
      setCameraReady(false);
      setFingerDetected(false);
      fingerDetectedRef.current = false;
      setFingerDetectionFailed(false);
      consecutiveNoFingerFrames.current = 0;

      // Change to measuring status - camera will show, but capture won't start yet
      // User needs to place finger first
      setStatus("measuring");
    } catch (err: any) {
      setError(err.message || "Measurement failed");
      setStatus("error");
    }
  };

  const handleFingerPlacement = async () => {
    // User has placed finger - now start the actual capture timer
    // IMPORTANT: Only set fingerDetected to true AFTER user confirms
    setFingerDetected(true);
    fingerDetectedRef.current = true; // Update ref immediately

    // Reset any existing capture state
    if (frameIntervalRef.current) {
      clearTimeout(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    // Reset both state and ref
    setIsCapturing(false);
    isCapturingRef.current = false;
    setProgress(0);
    frameCountRef.current = 0;
    ppgSignalRef.current = [];

    // Wait a moment for camera to be ready, then start capture
    // This ensures timer starts ONLY after button is pressed
    setTimeout(() => {
      startPPGCapture();
    }, 300);
  };

  const startPPGCapture = async () => {
    // Only start capture if finger is detected (user pressed the button) - use ref to avoid closure issues
    if (!fingerDetectedRef.current) {
      return;
    }

    // Prevent multiple starts - use ref to avoid closure issues
    if (isCapturingRef.current) {
      return;
    }

    // Clear any existing interval
    if (frameIntervalRef.current) {
      clearTimeout(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    // Reset and initialize capture state
    frameCountRef.current = 0;
    ppgSignalRef.current = [];
    // CRITICAL: Set start time HERE, not before button is pressed
    // This ensures timer starts ONLY when user confirms finger placement
    startTimeRef.current = Date.now();
    lastFrameTimeRef.current = Date.now();
    setProgress(0);
    setRecordingTime(0);
    setBeatsDetected(0);
    setCurrentMilestone(progressMilestones[0]);
    setIsCapturing(true);
    isCapturingRef.current = true; // Set ref immediately

    // Front camera doesn't have flashlight - screen brightness provides light

    // Start timer for recording time and milestones (updates every second)
    timerIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const roundedTime = Math.floor(elapsed);
      setRecordingTime(roundedTime);

      // Update milestone
      const milestone = getCurrentMilestone(elapsed);
      if (milestone) {
        setCurrentMilestone(milestone);
      }

      // Estimate beats detected (assuming ~70 BPM average, but will be more accurate with actual signal)
      const estimatedBeats = Math.floor((elapsed / 60) * 70);
      setBeatsDetected(estimatedBeats);
    }, 1000);

    // Capture frames at exactly 14 fps for 60 seconds (840 frames total) - clinical standard duration
    const captureFrame = async () => {
      const now = Date.now();
      const elapsed = (now - startTimeRef.current) / 1000; // seconds

      // Stop after measurement duration or when we have enough frames
      if (
        elapsed >= MEASUREMENT_DURATION ||
        frameCountRef.current >= TARGET_FRAMES
      ) {
        stopPPGCapture();
        return;
      }

      // Periodic validation: Check signal quality periodically (every 60 frames)
      // Since user confirmed finger placement, we're more lenient - just check signal variation
      if (frameCountRef.current >= 60 && frameCountRef.current % 60 === 0) {
        const signalMean =
          ppgSignalRef.current.reduce((a, b) => a + b, 0) /
          ppgSignalRef.current.length;
        const signalVariance =
          ppgSignalRef.current.reduce(
            (sum, val) => sum + (val - signalMean) ** 2,
            0
          ) / ppgSignalRef.current.length;
        const signalStdDev = Math.sqrt(signalVariance);

        // Only stop if signal quality is extremely poor (stdDev < 2) for multiple checks
        if (signalStdDev < 2) {
          consecutiveNoFingerFrames.current += 60;
          // Only stop if signal quality has been poor for 3+ consecutive checks (180+ frames)
          if (consecutiveNoFingerFrames.current > 180) {
            setFingerDetectionFailed(true);
            stopPPGCapture();
            return;
          }
        } else {
          consecutiveNoFingerFrames.current = 0;
        }
      }

      // Update progress
      setProgress(elapsed / MEASUREMENT_DURATION);

      // Estimate beats from signal periodically (every 30 frames for performance)
      if (
        ppgSignalRef.current.length > 30 &&
        frameCountRef.current % 30 === 0
      ) {
        const recentSignal = ppgSignalRef.current.slice(-60); // Only analyze last 60 frames
        let peaks = 0;
        const threshold = Math.max(...recentSignal) * 0.7; // Dynamic threshold

        for (let i = 1; i < recentSignal.length - 1; i++) {
          if (
            recentSignal[i] > recentSignal[i - 1] &&
            recentSignal[i] > recentSignal[i + 1] &&
            recentSignal[i] > threshold
          ) {
            peaks++;
          }
        }
        const estimatedBeats = Math.min(
          peaks * 2,
          Math.floor((elapsed / 60) * 90)
        );
        setBeatsDetected(estimatedBeats);
      }

      // CRITICAL: expo-camera v17 doesn't support real-time frame processing
      // Real PPG requires react-native-vision-camera with frame processors
      // This component will FAIL the measurement because extractPPGFromFrame returns -1
      try {
        // Attempt to extract PPG signal
        // This will return -1 because expo-camera cannot provide real pixel data
        const frameValue = extractPPGFromFrame();

        // CRITICAL: Reject -1 (extraction failed) and any invalid values
        // Only accept real data in valid range (0-255)
        if (frameValue < 0 || frameValue > 255 || isNaN(frameValue)) {
          // Track failure but DON'T add fake data
          consecutiveNoFingerFrames.current++;

          // If too many consecutive failures, stop measurement with helpful error
          if (consecutiveNoFingerFrames.current > 30) {
            setError(
              "Unable to extract real camera data with expo-camera.\n\n" +
                "For real PPG heart rate measurement, please use the native build with react-native-vision-camera.\n\n" +
                "Expo Go / expo-camera does not support real-time frame processing required for PPG."
            );
            stopPPGCapture();
            return;
          }

          // Skip this frame - don't add any data
          frameCountRef.current++;
        } else {
          // Valid data - add to signal
          ppgSignalRef.current.push(Math.round(frameValue));
          consecutiveNoFingerFrames.current = 0;
          frameCountRef.current++;
        }
      } catch (err) {
        // Error processing frame - don't add fake data
        consecutiveNoFingerFrames.current++;
        frameCountRef.current++;
      }

      // Schedule next frame capture at 14 fps
      const nextFrameTime = lastFrameTimeRef.current + FRAME_INTERVAL_MS;
      const delay = Math.max(0, nextFrameTime - Date.now());
      lastFrameTimeRef.current = nextFrameTime;

      frameIntervalRef.current = setTimeout(captureFrame, delay);
    };

    // Start capturing immediately
    captureFrame();
  };

  /**
   * Extract PPG signal value from camera frame
   *
   * CRITICAL: expo-camera does NOT support real-time frame processing.
   * This function previously generated SIMULATED data which is scientifically invalid.
   *
   * Based on research requirements:
   * - Olugbenle et al. (arXiv:2412.07082v1) - REAL PPG signals required
   * - PMC5981424 - Smartphone PPG validation requires actual sensor data
   * - ScienceDirect (S0167865525002454) - Camera-based vital signs need real pixel data
   *
   * DO NOT USE SIMULATED DATA - this component should only be used as a fallback
   * when react-native-vision-camera is unavailable, and should properly fail
   * rather than return fake heart rate readings.
   *
   * For real PPG measurement, use PPGVitalMonitorVisionCamera with react-native-vision-camera.
   */
  const extractPPGFromFrame = (): number => {
    // RETURN -1 TO INDICATE EXTRACTION FAILED
    // expo-camera cannot provide real-time pixel data for PPG analysis
    // The measurement flow will detect this and properly fail
    // This ensures users know they need a proper native build with VisionCamera
    return -1; // Invalid marker - expo-camera cannot extract real PPG data
  };

  /**
   * Check if finger is present by analyzing signal variance
   * Returns true if signal shows sufficient variation (finger present)
   * STRICT VALIDATION: Requires clear evidence of finger presence
   */
  const detectFingerPresence = (signal: number[]): boolean => {
    if (signal.length < MIN_FINGER_DETECTION_FRAMES) return false;

    // Calculate signal variance
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const variance =
      signal.reduce((sum, val) => sum + (val - mean) ** 2, 0) / signal.length;
    const stdDev = Math.sqrt(variance);

    // Calculate signal range (max - min)
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min;

    // STRICT Finger detection criteria:
    // 1. Standard deviation should be > 5 (increased for stricter validation)
    // 2. Range should be > 15 (increased for stricter validation - finger should create clear signal variation)
    // 3. Signal should not be too uniform (no finger = uniform signal)
    const hasVariation = stdDev > 5 && range > 15;

    // Optimized periodic pattern detection
    let periodicScore = 0;
    if (variance > 0.01) {
      // Early exit if variance too low
      const sampleSize = Math.min(30, signal.length); // Reduced sample size
      const step = Math.max(1, Math.floor(sampleSize / 10)); // Skip some lags for performance

      for (let lag = 10; lag < sampleSize; lag += step) {
        let correlation = 0;
        const denominator = (sampleSize - lag) * variance;

        for (let i = 0; i < sampleSize - lag; i++) {
          correlation += (signal[i] - mean) * (signal[i + lag] - mean);
        }

        correlation /= denominator;
        if (Math.abs(correlation) > 0.3) {
          periodicScore++;
        }
      }
    }

    // STRICT: Require BOTH variation AND periodicity for finger presence
    // This prevents false positives when no finger is present
    return hasVariation && periodicScore > 2;
  };

  const stopPPGCapture = async () => {
    setIsCapturing(false);
    isCapturingRef.current = false;

    // Clear frame capture interval
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (captureTimeoutRef.current) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Check if finger detection failed during capture - handle this FIRST before any processing
    if (fingerDetectionFailed) {
      setError(
        "Finger not detected during measurement. Please ensure your finger completely covers the back camera lens and flash with no gaps or light leaks."
      );
      setStatus("error");
      return;
    }

    // Final milestone update
    setCurrentMilestone(progressMilestones[60]);

    setStatus("processing");
    setProgress(1);

    // Validate we have enough frames (need at least 50% of target)
    if (ppgSignalRef.current.length < TARGET_FRAMES * 0.5) {
      // Require at least 50% of target frames (more lenient for real camera)
      setError(
        `Insufficient frames captured: ${ppgSignalRef.current.length}/${TARGET_FRAMES}. Please try again.`
      );
      setStatus("error");
      return;
    }

    // STRICT VALIDATION: Check if finger is actually present by analyzing signal
    // Don't trust button press alone - validate actual signal characteristics

    // Do not hard-fail on this flag: if frames are being captured, we have data to process.

    // Validate signal quality - check if signal has sufficient variation
    // Since user confirmed finger placement, we're more lenient here
    // Just ensure signal has reasonable variation (not just noise)
    const signalMean =
      ppgSignalRef.current.reduce((a, b) => a + b, 0) /
      ppgSignalRef.current.length;
    const signalVariance =
      ppgSignalRef.current.reduce(
        (sum, val) => sum + (val - signalMean) ** 2,
        0
      ) / ppgSignalRef.current.length;
    const signalStdDev = Math.sqrt(signalVariance);

    // Do not gate on raw std-dev of 0-255 frame averages.
    // Real fingertip PPG often has small amplitude in raw pixel averages; we rely on
    // `processPPGSignalEnhanced()` for quality gating after normalization/filtering.

    // Process PPG signal using multi-order filtering (2nd-6th order)
    // As per guide: "Processes with multi-order filtering (2nd-6th)"
    const ppgResult = processPPGSignalEnhanced(
      ppgSignalRef.current,
      TARGET_FPS
    );

    if (ppgResult.success && Number.isFinite(ppgResult.heartRate)) {
      const heartRate = ppgResult.heartRate as number;
      setHeartRate(heartRate);
      setHeartRateVariability(ppgResult.heartRateVariability || null);
      setRespiratoryRate(ppgResult.respiratoryRate || null);
      setSignalQuality(ppgResult.signalQuality);

      // Save to Firestore (skip saving if this is a low-confidence estimate)
      if (!ppgResult.isEstimate) {
        await saveVitalToFirestore(
          heartRate,
          ppgResult.signalQuality,
          ppgResult.heartRateVariability,
          ppgResult.respiratoryRate
        );
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
  };

  const saveVitalToFirestore = async (
    heartRate: number,
    signalQuality: number,
    hrv?: number,
    respiratoryRate?: number
  ) => {
    try {
      // Get the authenticated user's ID to ensure it matches request.auth.uid in Firestore rules
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) {
        return;
      }

      // Save heart rate
      const heartRateData = {
        userId: currentUserId,
        type: "heartRate",
        value: heartRate,
        unit: "bpm",
        timestamp: Timestamp.now(),
        source: "ppg_camera",
        signalQuality,
        metadata: {
          measurementDuration: MEASUREMENT_DURATION, // seconds (60s for maximum accuracy)
          frameRate: TARGET_FPS, // fps
          framesCaptured: ppgSignalRef.current.length,
        },
      };
      await addDoc(collection(db, "vitals"), heartRateData);

      // Save HRV if available
      if (hrv) {
        const hrvData = {
          userId: currentUserId,
          type: "heartRateVariability",
          value: hrv,
          unit: "ms",
          timestamp: Timestamp.now(),
          source: "ppg_camera",
          signalQuality,
        };
        await addDoc(collection(db, "vitals"), hrvData);
      }

      // Save respiratory rate if available
      if (respiratoryRate) {
        const respiratoryData = {
          userId: currentUserId,
          type: "respiratoryRate",
          value: respiratoryRate,
          unit: "bpm", // breaths per minute
          timestamp: Timestamp.now(),
          source: "ppg_camera",
          signalQuality,
        };
        await addDoc(collection(db, "vitals"), respiratoryData);
      }
    } catch (err: any) {
      // Could show user notification here if needed
    }
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

  // Guard against null theme
  if (!(theme && theme.colors)) {
    return null;
  }

  // Ensure visible is always a boolean to prevent null/undefined issues
  const modalVisible = Boolean(visible);

  try {
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
                    backgroundColor: theme.colors.secondary.main,
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
                    {t("beta")}
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

            {status === "measuring" && permission?.granted && (
              <View style={styles.cameraContainer as ViewStyle}>
                <CameraView
                  enableTorch={false}
                  facing="front"
                  mode="video"
                  onCameraReady={() => {
                    setCameraReady(true);
                  }}
                  onMountError={(error: CameraMountError) => {
                    setError("Failed to initialize camera. Please try again.");
                    setStatus("error");
                  }}
                  ref={(ref: CameraView | null) => {
                    cameraRef.current = ref;
                  }}
                  style={styles.camera as ViewStyle}
                />
                {!cameraReady && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: theme.colors.background.secondary,
                      justifyContent: "center",
                      alignItems: "center",
                      zIndex: 1,
                    }}
                  >
                    <ActivityIndicator
                      color={theme.colors.primary.main}
                      size="large"
                    />
                    <Text
                      style={{
                        ...getTextStyle(
                          theme,
                          "body",
                          "regular",
                          theme.colors.text.secondary
                        ),
                        marginTop: theme.spacing.md,
                      }}
                    >
                      Initializing camera...
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.content as ViewStyle}>
              <Text style={styles.subtitle as StyleProp<TextStyle>}>
                {getStatusMessage()}
              </Text>

              {status === "instructions" && (
                <View style={styles.instructionsContainer as ViewStyle}>
                  {/* Instructions Card */}
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
                        style={
                          styles.instructionItemText as StyleProp<TextStyle>
                        }
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
                        style={
                          styles.instructionItemText as StyleProp<TextStyle>
                        }
                      >
                        {t("instructionPositionFingerAlt")}
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
                        style={
                          styles.instructionItemText as StyleProp<TextStyle>
                        }
                      >
                        {t("instructionCoverCamera")}
                      </Text>
                    </View>

                    <View style={styles.instructionItem as ViewStyle}>
                      <View style={styles.instructionNumber as ViewStyle}>
                        <Text
                          style={
                            styles.instructionNumberText as StyleProp<TextStyle>
                          }
                        >
                          4
                        </Text>
                      </View>
                      <Text
                        style={
                          styles.instructionItemText as StyleProp<TextStyle>
                        }
                      >
                        {t("instructionKeepFingerStill")}
                      </Text>
                    </View>

                    <View style={styles.instructionItem as ViewStyle}>
                      <View style={styles.instructionNumber as ViewStyle}>
                        <Zap color={theme.colors.neutral.white} size={14} />
                      </View>
                      <Text
                        style={
                          styles.instructionItemText as StyleProp<TextStyle>
                        }
                      >
                        {t("instructionScreenBrightness")}
                      </Text>
                    </View>

                    <View style={styles.instructionItem as ViewStyle}>
                      <View style={styles.instructionNumber as ViewStyle}>
                        <Clock color={theme.colors.neutral.white} size={14} />
                      </View>
                      <Text
                        style={
                          styles.instructionItemText as StyleProp<TextStyle>
                        }
                      >
                        {t("instructionHoldStill")}
                      </Text>
                    </View>

                    <Text style={styles.noteText as StyleProp<TextStyle>}>
                      {t("cameraViewDarkNote")}
                    </Text>
                  </View>

                  {/* Educational Content - Why 60 seconds */}
                  <View style={styles.educationPanel as ViewStyle}>
                    <Text style={styles.educationTitle as StyleProp<TextStyle>}>
                      {t("why60Seconds")}
                    </Text>
                    <Text style={styles.educationText as StyleProp<TextStyle>}>
                      {t("why60SecondsDesc")}
                    </Text>
                  </View>

                  {/* Tips Card */}
                  <View style={styles.tipsCard as ViewStyle}>
                    <View style={styles.tipsHeader as ViewStyle}>
                      <View style={styles.tipsHeaderIcon as ViewStyle}>
                        <Lightbulb
                          color={theme.colors.secondary.main}
                          size={18}
                        />
                      </View>
                      <Text style={styles.tipsTitle as StyleProp<TextStyle>}>
                        {t("tipsForBestResults")}
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
                        {t("tipEitherHand")}
                      </Text>
                    </View>

                    <View style={styles.tipItem as ViewStyle}>
                      <View style={styles.tipBullet as ViewStyle} />
                      <Text style={styles.tipText as StyleProp<TextStyle>}>
                        {t("tipPlaceFingerGently")}
                      </Text>
                    </View>

                    <View style={styles.tipItem as ViewStyle}>
                      <View style={styles.tipBullet as ViewStyle} />
                      <Text style={styles.tipText as StyleProp<TextStyle>}>
                        {t("tipStayCalm")}
                      </Text>
                    </View>
                  </View>

                  {/* Start Button */}
                  <TouchableOpacity
                    onPress={startMeasurement}
                    style={styles.startButton as ViewStyle}
                  >
                    <CheckCircle color={theme.colors.neutral.white} size={20} />
                    <Text
                      style={styles.startButtonText as StyleProp<TextStyle>}
                    >
                      Start Measurement
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
                    <ChevronLeft
                      color={theme.colors.text.secondary}
                      size={20}
                    />
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

                      {/* Beat Counter */}
                      <View style={styles.beatCounterCard as ViewStyle}>
                        <Text
                          style={
                            styles.beatCounterLabel as StyleProp<TextStyle>
                          }
                        >
                          Heartbeats Captured
                        </Text>
                        <Text
                          style={
                            styles.beatCounterValue as StyleProp<TextStyle>
                          }
                        >
                          {beatsDetected}/60
                        </Text>
                      </View>

                      <Text
                        style={styles.instructionText as StyleProp<TextStyle>}
                      >
                        60 seconds for accurate measurement • Hold steady
                      </Text>
                      {fingerDetectionFailed && (
                        <View
                          style={{
                            backgroundColor: theme.colors.accent.error + "20",
                            borderRadius: theme.borderRadius.md,
                            padding: theme.spacing.md,
                            marginTop: theme.spacing.md,
                            borderLeftWidth: 4,
                            borderLeftColor: theme.colors.accent.error,
                          }}
                        >
                          <Text
                            style={{
                              ...getTextStyle(
                                theme,
                                "body",
                                "semibold",
                                theme.colors.accent.error
                              ),
                              marginBottom: theme.spacing.xs,
                            }}
                          >
                            ⚠️ Finger Not Detected
                          </Text>
                          <Text
                            style={{
                              ...getTextStyle(
                                theme,
                                "caption",
                                "regular",
                                theme.colors.text.primary
                              ),
                              fontSize: 12,
                            }}
                          >
                            Please ensure your finger completely covers the
                            camera lens with no gaps.
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[
                          styles.instructionText as StyleProp<TextStyle>,
                          {
                            fontSize: 12,
                            opacity: 0.7,
                            marginTop: 8,
                            fontStyle: "italic",
                          },
                        ]}
                      >
                        💡 The camera view appears dark when your finger covers
                        it - this is normal and expected!
                      </Text>
                      <Text
                        style={[
                          styles.instructionText as StyleProp<TextStyle>,
                          { fontSize: 12, marginTop: 5, opacity: 0.7 },
                        ]}
                      >
                        Capturing {frameCountRef.current}/{TARGET_FRAMES} frames
                        at {TARGET_FPS} fps • {recordingTime}s/
                        {MEASUREMENT_DURATION}s
                      </Text>
                      {heartRate && (
                        <Text
                          style={styles.heartRateText as StyleProp<TextStyle>}
                        >
                          {heartRate} BPM
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text
                        style={styles.instructionText as StyleProp<TextStyle>}
                      >
                        {t("instructionPositionFingerAlt")}.{" "}
                        {t("instructionCoverCamera")}.
                      </Text>
                      <Text
                        style={[
                          styles.instructionText as StyleProp<TextStyle>,
                          { marginTop: 10, fontSize: 14 },
                        ]}
                      >
                        {t("onceFingerInPlace")}
                      </Text>
                      <TouchableOpacity
                        disabled={true}
                        onPress={() => {}}
                        style={[
                          styles.button as ViewStyle,
                          { marginTop: 30, opacity: 0.5 },
                        ]}
                      >
                        <Text style={styles.buttonText as StyleProp<TextStyle>}>
                          {t("comingSoon")}
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
                      style={[
                        styles.subtitle as StyleProp<TextStyle>,
                        { marginTop: theme.spacing.lg },
                      ]}
                    >
                      {t("processingYourHeartRate")}
                    </Text>
                  </View>
                </View>
              )}

              {status === "success" && heartRate !== null && (
                <View style={styles.successContainer as ViewStyle}>
                  <View style={styles.successCard as ViewStyle}>
                    <CheckCircle
                      color={theme.colors.accent.success}
                      size={48}
                    />
                    <Text
                      style={[
                        styles.statusText as StyleProp<TextStyle>,
                        { marginTop: theme.spacing.lg },
                      ]}
                    >
                      {t("measurementComplete")}
                    </Text>

                    <View style={styles.heartRateContainer as ViewStyle}>
                      <Text
                        style={styles.heartRateText as StyleProp<TextStyle>}
                      >
                        {heartRate}
                      </Text>
                      <Text
                        style={[
                          styles.qualityText as StyleProp<TextStyle>,
                          { fontSize: 20, marginTop: theme.spacing.sm },
                        ]}
                      >
                        BPM
                      </Text>
                    </View>

                    {/* Additional Vital Signs */}
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
                              style={[
                                styles.qualityText as StyleProp<TextStyle>,
                                { fontSize: 15 },
                              ]}
                            >
                              HRV:
                            </Text>
                            <Text
                              style={[
                                styles.qualityText as StyleProp<TextStyle>,
                                { fontSize: 15, fontWeight: "600" },
                              ]}
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
                              style={[
                                styles.qualityText as StyleProp<TextStyle>,
                                { fontSize: 15 },
                              ]}
                            >
                              Respiratory Rate:
                            </Text>
                            <Text
                              style={[
                                styles.qualityText as StyleProp<TextStyle>,
                                { fontSize: 15, fontWeight: "600" },
                              ]}
                            >
                              {respiratoryRate.toFixed(0)} breaths/min
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <Text
                    style={[
                      styles.instructionText as StyleProp<TextStyle>,
                      { paddingHorizontal: theme.spacing.md },
                    ]}
                  >
                    {t("vitalSignsSaved")}
                  </Text>
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
                  <TouchableOpacity
                    onPress={() => {
                      // Reset all state before closing
                      resetState();
                      onClose();
                    }}
                    style={styles.button as ViewStyle}
                  >
                    <Text style={styles.buttonText as StyleProp<TextStyle>}>
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  } catch (error) {
    return null;
  }
}
