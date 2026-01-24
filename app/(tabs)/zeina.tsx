/**
 * Zeina - Siri-like Voice Health Assistant
 *
 * A hands-free, always-listening voice assistant powered by OpenAI's Realtime API.
 * Just tap to activate, then speak naturally - Zeina will respond with voice.
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RevenueCatPaywall } from "@/components/RevenueCatPaywall";
import { useRevenueCat } from "@/hooks/useRevenueCat";
import healthContextService from "@/lib/services/healthContextService";
import {
  type ConnectionState,
  type RealtimeEventHandlers,
  realtimeAgentService,
} from "@/lib/services/realtimeAgentService";
import { voiceService } from "@/lib/services/voiceService";
import { zeinaActionsService } from "@/lib/services/zeinaActionsService";

// Audio imports
let Audio: any = null;
let FileSystem: any = null;
let isAudioAvailable = false;
let audioLoadError: string | null = null;

try {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    const expoAv = require("expo-av");
    Audio = expoAv.Audio;
    // Expo SDK 54+: prefer legacy import path to avoid deprecation warnings
    // (see https://docs.expo.dev/versions/v54.0.0/sdk/filesystem/)
    try {
      FileSystem = require("expo-file-system/legacy");
    } catch {
      FileSystem = require("expo-file-system");
    }
    isAudioAvailable = !!Audio && !!FileSystem;

    if (!Audio) {
      audioLoadError = "expo-av loaded but Audio module not found";
    } else if (!FileSystem) {
      audioLoadError = "expo-file-system not available";
    }
  } else {
    audioLoadError = `Platform ${Platform.OS} not supported for audio`;
  }
} catch (error) {
  isAudioAvailable = false;
  audioLoadError = error instanceof Error ? error.message : String(error);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Conversation message type
interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ZeinaScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const scrollViewRef = useRef<ScrollView>(null);
  const isWeb = Platform.OS === "web";
  const canUseVoice = !!(Audio && FileSystem && isAudioAvailable && !isWeb);
  const {
    isLoading: isSubscriptionLoading,
    hasActiveSubscription,
    refreshCustomerInfo,
  } = useRevenueCat();

  // Connection state
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [autoReconnectEnabled, setAutoReconnectEnabled] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const isActiveRef = useRef(false);
  const didAutoWelcomeRef = useRef(false);
  const isAutoWelcomingRef = useRef(false);
  const isCheckingPremiumRef = useRef(false);
  const isStartingZeinaRef = useRef(false);

  // Conversation state
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(true);

  // Audio streaming state
  const recordingRef = useRef<any>(null);
  const streamingIntervalRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);
  const isStartingStreamingRef = useRef(false);
  const isChunkInFlightRef = useRef(false);
  const invalidAudioChunkCountRef = useRef(0);
  const missingAudioChunkCountRef = useRef(0);
  const lastVadEventAtRef = useRef<number | null>(null);
  const isManualRecordingRef = useRef(false);
  const lastAutoCommitAtRef = useRef<number | null>(null);
  const didReceiveAssistantAudioRef = useRef(false);
  const listeningSinceAtRef = useRef<number | null>(null);
  const lastAudioAppendAtRef = useRef<number | null>(null);
  const speechWatchdogTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const setPlaybackAudioMode = useCallback(async () => {
    // On iOS, if the app is still in recording mode, TTS can be inaudible/cut off.
    if (!Audio) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });
    } catch {
      // ignore
    }
  }, []);

  // Ensure the stuck-listening timer works even if VAD events are flaky.
  useEffect(() => {
    if (isListening) {
      if (listeningSinceAtRef.current == null) {
        listeningSinceAtRef.current = Date.now();
      }
    } else {
      listeningSinceAtRef.current = null;
    }
  }, [isListening]);

  const clearSpeechWatchdog = useCallback(() => {
    if (speechWatchdogTimeoutRef.current != null) {
      clearTimeout(speechWatchdogTimeoutRef.current);
      speechWatchdogTimeoutRef.current = null;
    }
  }, []);

  const safeCommitAudioBuffer = useCallback(() => {
    if (!realtimeAgentService.isConnected()) {
      setLastError(t("disconnected", "Disconnected"));
      return;
    }

    const lastAppendAt = lastAudioAppendAtRef.current;
    if (lastAppendAt == null || Date.now() - lastAppendAt > 6000) {
      setLastError(t("noAudioCaptured", "No audio captured from microphone"));
      return;
    }

    didReceiveAssistantAudioRef.current = false;
    realtimeAgentService.commitAudioBuffer();
  }, [t]);

  const startSpeechWatchdog = useCallback(() => {
    clearSpeechWatchdog();
    // If VAD never emits "speech_stopped", don't let the UI look stuck forever.
    speechWatchdogTimeoutRef.current = setTimeout(() => {
      setIsListening(false);
      setIsProcessing(true);
      safeCommitAudioBuffer();
    }, 12_000) as unknown as number;
  }, [clearSpeechWatchdog, safeCommitAudioBuffer]);

  const ensurePremiumAccess = useCallback(() => {
    if (isSubscriptionLoading) {
      setLastError(
        t("checkingSubscription", "Checking subscription status...")
      );
      return false;
    }
    if (!hasActiveSubscription) {
      // Prevent showing paywall multiple times
      if (isCheckingPremiumRef.current || showPaywall) {
        return false;
      }
      isCheckingPremiumRef.current = true;
      setLastError(t("premiumRequired", "Premium plan required to use Zeina"));
      setShowPaywall(true);
      setIsActive(false);
      setConnectionState("disconnected");
      return false;
    }
    isCheckingPremiumRef.current = false;
    return true;
  }, [hasActiveSubscription, isSubscriptionLoading, t, showPaywall]);

  const isFatalConnectionError = useCallback((message: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("api key") ||
      normalized.includes("authentication") ||
      normalized.includes("unauthorized") ||
      normalized.includes("realtime api access") ||
      normalized.includes("websocket authentication failed") ||
      normalized.includes("websocket headers are not supported on web") ||
      normalized.includes("web platform doesn't support websocket headers")
    );
  }, []);

  const handleConnectionFailure = useCallback(
    (message: string) => {
      setLastError(message);
      setConnectionState("error");
      if (isFatalConnectionError(message)) {
        setAutoReconnectEnabled(false);
      }
    },
    [isFatalConnectionError]
  );

  // Stop continuous listening - must be declared before setupEventHandlers
  const stopContinuousListening = useCallback(
    (options?: { updateState?: boolean; clearInputBuffer?: boolean }) => {
      const shouldUpdateState = options?.updateState !== false;
      const shouldClearInputBuffer = options?.clearInputBuffer !== false;
      isStreamingRef.current = false;
      isStartingStreamingRef.current = false;
      isChunkInFlightRef.current = false;
      if (streamingIntervalRef.current) {
        clearTimeout(streamingIntervalRef.current);
        streamingIntervalRef.current = null;
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      invalidAudioChunkCountRef.current = 0;
      missingAudioChunkCountRef.current = 0;
      clearSpeechWatchdog();
      if (shouldClearInputBuffer) {
        realtimeAgentService.clearAudioBuffer();
      }
      if (shouldUpdateState) {
        setIsListening(false);
        setIsProcessing(false);
      }
    },
    [clearSpeechWatchdog]
  );

  // Start continuous audio streaming for VAD - must be declared before setupEventHandlers
  const startContinuousListening = useCallback(async () => {
    if (!(Audio && FileSystem && isAudioAvailable)) {
      return;
    }
    if (isManualRecordingRef.current) return;
    if (!realtimeAgentService.isConnected()) return;
    if (isStreamingRef.current || isStartingStreamingRef.current) return;

    isStartingStreamingRef.current = true;

    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          t("permissionDenied", "Permission Denied"),
          t("microphonePermissionRequired", "Microphone permission is required")
        );
        return;
      }

      // Set streaming immediately to prevent parallel starts (expo-av can throw "recorder is already prepared")
      isStreamingRef.current = true;
      isChunkInFlightRef.current = false;
      invalidAudioChunkCountRef.current = 0;
      missingAudioChunkCountRef.current = 0;

      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });

      // Start streaming audio in chunks
      const streamAudioChunk = async () => {
        if (!(isStreamingRef.current && realtimeAgentService.isConnected())) {
          return;
        }
        if (isChunkInFlightRef.current) return;
        isChunkInFlightRef.current = true;

        try {
          // Create a short recording
          const recording = new Audio.Recording();

          // expo-av supports different constant names across versions; pick the best available.
          const iosLinearPcmOutputFormat =
            Audio?.IOSOutputFormat?.LINEARPCM ??
            Audio?.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM ??
            null;

          await recording.prepareToRecordAsync({
            android: {
              extension: ".wav",
              outputFormat: Audio.AndroidOutputFormat?.DEFAULT || 0,
              audioEncoder: Audio.AndroidAudioEncoder?.DEFAULT || 0,
              sampleRate: 24_000,
              numberOfChannels: 1,
              bitRate: 384_000,
            },
            ios: {
              extension: ".wav",
              ...(iosLinearPcmOutputFormat != null
                ? { outputFormat: iosLinearPcmOutputFormat }
                : {}),
              audioQuality: Audio.IOSAudioQuality?.HIGH || 127,
              sampleRate: 24_000,
              numberOfChannels: 1,
              bitRate: 384_000,
              linearPCMBitDepth: 16,
              linearPCMIsBigEndian: false,
              linearPCMIsFloat: false,
            },
            web: {},
          });

          await recording.startAsync();

          // Record for 200ms chunks
          await new Promise((resolve) => setTimeout(resolve, 200));

          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();

          if (!uri) {
            missingAudioChunkCountRef.current += 1;
            if (missingAudioChunkCountRef.current >= 3) {
              stopContinuousListening();
              setIsListening(false);
              setIsProcessing(false);
              setIsSpeaking(false);
              Alert.alert(
                t("microphoneError", "Microphone Error"),
                t(
                  "microphoneErrorBody",
                  "Zeina couldn't capture audio from the microphone. Please check microphone permission and try again."
                )
              );
              return;
            }
          }

          if (uri && isStreamingRef.current) {
            // Read and send audio
            const base64Audio = await FileSystem.readAsStringAsync(uri, {
              // Some runtimes may not expose EncodingType; fall back to the string literal.
              encoding: FileSystem.EncodingType?.Base64 ?? "base64",
            });

            if (!base64Audio) {
              missingAudioChunkCountRef.current += 1;
              if (missingAudioChunkCountRef.current >= 3) {
                stopContinuousListening();
                setIsListening(false);
                setIsProcessing(false);
                setIsSpeaking(false);
                Alert.alert(
                  t("microphoneError", "Microphone Error"),
                  t(
                    "microphoneErrorBody",
                    "Zeina couldn't capture audio from the microphone. Please check microphone permission and try again."
                  )
                );
                return;
              }
            }

            // Basic sanity check: WAV files start with "RIFF" which base64-encodes to "UklG".
            // If we stream non-PCM audio while the session expects PCM16, VAD/transcription can appear stuck.
            if (base64Audio && base64Audio.startsWith("UklG")) {
              invalidAudioChunkCountRef.current = 0;
              missingAudioChunkCountRef.current = 0;
              realtimeAgentService.sendAudioData(base64Audio);
              lastAudioAppendAtRef.current = Date.now();
            } else if (base64Audio) {
              invalidAudioChunkCountRef.current += 1;
              if (invalidAudioChunkCountRef.current >= 3) {
                stopContinuousListening();
                setIsListening(false);
                setIsProcessing(false);
                setIsSpeaking(false);
                Alert.alert(
                  t("unsupportedAudioFormat", "Unsupported audio format"),
                  t(
                    "unsupportedAudioFormatBody",
                    "Zeina couldn't read the recording as a PCM WAV file. This can happen if the device records AAC/M4A instead of PCM. Try again on a physical iOS device, or use text input."
                  )
                );
                return;
              }
            }

            // Clean up
            await FileSystem.deleteAsync(uri, { idempotent: true }).catch(
              () => {}
            );
          }
        } catch (error) {
          // Continue streaming despite errors, but surface persistent failures
          const msg = error instanceof Error ? error.message : String(error);
          setLastError((prev) => prev ?? `Mic chunk error: ${msg}`);
        } finally {
          isChunkInFlightRef.current = false;
        }

        // Schedule next chunk if still streaming
        if (isStreamingRef.current && realtimeAgentService.isConnected()) {
          streamingIntervalRef.current = setTimeout(streamAudioChunk, 120);
        }
      };

      // Start the streaming loop
      streamAudioChunk();
    } catch (error) {
      isStreamingRef.current = false;
      const msg = error instanceof Error ? error.message : String(error);
      setLastError(`Mic streaming failed: ${msg}`);
    } finally {
      isStartingStreamingRef.current = false;
    }
  }, [t, stopContinuousListening]);

  // Extract assistant text from response - must be declared before setupEventHandlers
  const extractAssistantTextFromResponse = useCallback(
    (response: any): string | null => {
      try {
        if (!response) return null;
        if (
          typeof response.output_text === "string" &&
          response.output_text.trim()
        ) {
          return response.output_text.trim();
        }

        const output = response.output;
        if (!Array.isArray(output)) return null;

        for (const item of output) {
          // Common shape: { type: "message", content: [...] }
          if (item?.type === "message" && Array.isArray(item.content)) {
            for (const c of item.content) {
              const text = c?.text ?? c?.transcript;
              if (typeof text === "string" && text.trim()) return text.trim();
            }
          }

          // Alternate shapes
          const directText = item?.text ?? item?.transcript;
          if (typeof directText === "string" && directText.trim())
            return directText.trim();
        }
      } catch {
        // ignore
      }
      return null;
    },
    []
  );

  // Execute health-related tools - must be declared before setupEventHandlers
  const executeHealthTool = useCallback(
    async (name: string, args: any = {}): Promise<any> => {
      // Ensure args is always an object
      const safeArgs = args || {};

      switch (name) {
        // ===== INFORMATION RETRIEVAL TOOLS =====
        case "get_health_summary":
          return await healthContextService.getHealthSummary();

        case "get_medications":
          return await healthContextService.getMedications(
            safeArgs.active_only ?? true
          );

        case "get_recent_vitals":
          return await healthContextService.getRecentVitals(
            safeArgs.vital_type,
            safeArgs.days
          );

        case "check_medication_interactions":
          return await healthContextService.checkMedicationInteractions(
            safeArgs.new_medication
          );

        case "emergency_contact":
          return await healthContextService.getEmergencyContacts(
            safeArgs.action
          );

        // ===== AUTOMATED ACTION TOOLS (via ZeinaActionsService) =====
        case "log_symptom":
          return await zeinaActionsService.logSymptom(
            safeArgs.symptom_name || "unknown",
            safeArgs.severity,
            safeArgs.notes,
            safeArgs.body_part,
            safeArgs.duration
          );

        case "add_medication":
          return await zeinaActionsService.addMedication(
            safeArgs.name || "unknown",
            safeArgs.dosage,
            safeArgs.frequency,
            safeArgs.notes
          );

        case "log_vital_sign": {
          // Handle blood pressure specially (has systolic/diastolic)
          const metadata =
            safeArgs.systolic && safeArgs.diastolic
              ? { systolic: safeArgs.systolic, diastolic: safeArgs.diastolic }
              : undefined;
          return await zeinaActionsService.logVitalSign(
            safeArgs.vital_type || "unknown",
            safeArgs.value ?? 0,
            safeArgs.unit,
            metadata
          );
        }

        case "set_medication_reminder":
          return await zeinaActionsService.setMedicationReminder(
            safeArgs.medication_name || "unknown",
            safeArgs.time || "09:00",
            safeArgs.recurring ?? true
          );

        case "alert_family":
          return await zeinaActionsService.alertFamily(
            safeArgs.alert_type || "check_in",
            safeArgs.message
          );

        case "schedule_reminder":
          // For general reminders, create a check-in with the reason
          return await zeinaActionsService.requestCheckIn(
            `Reminder: ${safeArgs.title || "reminder"} at ${safeArgs.time || "later"}`
          );

        case "request_check_in":
          return await zeinaActionsService.requestCheckIn(safeArgs.reason);

        case "log_mood":
          return await zeinaActionsService.logMood(
            safeArgs.mood_type || "neutral",
            safeArgs.intensity,
            safeArgs.notes,
            safeArgs.activities
          );

        case "mark_medication_taken":
          return await zeinaActionsService.markMedicationTaken(
            safeArgs.medication_name || ""
          );

        case "navigate_to":
          return zeinaActionsService.getNavigationTarget(
            safeArgs.target || "home"
          );

        case "add_allergy":
          return await zeinaActionsService.addAllergy(
            safeArgs.allergen || "unknown",
            safeArgs.reaction,
            safeArgs.severity,
            safeArgs.allergy_type
          );

        case "add_medical_history":
          return await zeinaActionsService.addMedicalHistory(
            safeArgs.condition || "unknown",
            safeArgs.diagnosis_date,
            safeArgs.status,
            safeArgs.notes
          );

        default:
          return {
            error: "Unknown tool",
            message: `Tool "${name}" is not supported`,
          };
      }
    },
    []
  );

  // Set up event handlers for the realtime service - must be declared before startZeina
  const setupEventHandlers = useCallback(() => {
    const handlers: RealtimeEventHandlers = {
      onConnectionStateChange: (state) => {
        setConnectionState(state);
        if (state === "connected") {
          setLastError(null);
        }
        if (state === "connected") {
          // Auto-start listening when connected
          startContinuousListening();
        } else if (state === "disconnected" || state === "error") {
          stopContinuousListening();
        }
      },

      onSessionCreated: () => {
        // Haptic feedback on connection
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },

      onSpeechStarted: () => {
        lastVadEventAtRef.current = Date.now();
        if (listeningSinceAtRef.current == null) {
          listeningSinceAtRef.current = Date.now();
        }
        setIsListening(true);
        setCurrentTranscript("");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        startSpeechWatchdog();
      },

      onSpeechStopped: () => {
        lastVadEventAtRef.current = Date.now();
        listeningSinceAtRef.current = null;
        setIsListening(false);
        setIsProcessing(true);
        clearSpeechWatchdog();
      },

      onTranscriptDelta: (delta, role) => {
        if (role === "user") {
          lastVadEventAtRef.current = Date.now();
          setCurrentTranscript((prev) => prev + delta);
        }
      },

      onTranscriptDone: (transcript, role) => {
        if (role === "user" && transcript) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "user",
              content: transcript,
              timestamp: new Date(),
            },
          ]);
          setCurrentTranscript("");
          // Fallback: on some devices VAD may not reliably emit `speech_stopped`,
          // which would otherwise trigger a response. If we have a finalized user transcript,
          // explicitly end the turn and request a reply.
          setIsListening(false);
          setIsProcessing(true);
          didReceiveAssistantAudioRef.current = false;
          safeCommitAudioBuffer();
        }
      },

      onAudioDelta: () => {
        lastVadEventAtRef.current = Date.now();
        didReceiveAssistantAudioRef.current = true;
        listeningSinceAtRef.current = null;
        // Important on iOS: stop mic streaming while playing assistant audio.
        // Recording mode can interrupt playback and cause the voice to cut off.
        stopContinuousListening({ updateState: true, clearInputBuffer: false });
        setIsListening(false);
        setIsSpeaking(true);
        setIsProcessing(false);
        clearSpeechWatchdog();
      },

      onAudioDone: () => {
        lastVadEventAtRef.current = Date.now();
        listeningSinceAtRef.current = null;
        setIsSpeaking(false);
        setIsProcessing(false);
        clearSpeechWatchdog();
        // Resume listening after Zeina finishes speaking
        if (
          isActiveRef.current &&
          realtimeAgentService.isConnected() &&
          !isManualRecordingRef.current
        ) {
          startContinuousListening();
        }
      },

      onToolCall: async (toolCall) => {
        // Execute health tools silently
        try {
          // Safely parse arguments, defaulting to empty object
          let args = {};
          try {
            args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
          } catch (parseError) {
            console.warn("Failed to parse tool arguments:", parseError);
          }

          const result = await executeHealthTool(toolCall.name, args);
          realtimeAgentService.submitToolOutput(
            toolCall.call_id,
            JSON.stringify(result)
          );
        } catch (error) {
          console.error("Tool execution error:", error);
          realtimeAgentService.submitToolOutput(
            toolCall.call_id,
            JSON.stringify({ error: "Tool execution failed" })
          );
        }
      },

      onResponseDone: async (response) => {
        const assistantText = extractAssistantTextFromResponse(response);
        if (assistantText) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: assistantText,
              timestamp: new Date(),
            },
          ]);
        } else {
          setLastError(t("noAssistantText", "No assistant text returned"));
        }
        setIsProcessing(false);
        clearSpeechWatchdog();
        listeningSinceAtRef.current = null;

        // If we got a text reply but no audio chunks, speak it via device TTS.
        if (assistantText && !didReceiveAssistantAudioRef.current) {
          try {
            stopContinuousListening({
              updateState: true,
              clearInputBuffer: false,
            });
            setIsListening(false);
            setIsSpeaking(true);
            await setPlaybackAudioMode();

            const lang = (i18n.language || "en").startsWith("ar")
              ? "ar-SA"
              : "en-US";
            await voiceService.speak(assistantText, {
              language: lang,
              volume: 1.0,
            });
          } catch {
            setLastError(t("ttsFailed", "Text-to-speech failed"));
          } finally {
            setIsSpeaking(false);
            if (
              isActiveRef.current &&
              realtimeAgentService.isConnected() &&
              !isManualRecordingRef.current
            ) {
              startContinuousListening();
            }
          }
        }
      },

      onError: (error) => {
        setIsProcessing(false);
        setIsListening(false);
        setIsSpeaking(false);
        clearSpeechWatchdog();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        const msg =
          error instanceof Error
            ? error.message
            : error?.message
              ? String(error.message)
              : String(error);
        setLastError(msg);
        Alert.alert(t("error", "Error"), msg);
      },
    };

    realtimeAgentService.setEventHandlers(handlers);
  }, [
    t,
    isActive,
    connectionState,
    clearSpeechWatchdog,
    startSpeechWatchdog,
    startContinuousListening,
    stopContinuousListening,
    executeHealthTool,
    extractAssistantTextFromResponse,
    setPlaybackAudioMode,
    i18n.language,
  ]);

  const startZeina = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (isStartingZeinaRef.current) {
      return;
    }
    isStartingZeinaRef.current = true;

    try {
      if (isWeb) {
        const msg = t(
          "zeinaWebNotSupported",
          "Zeina voice is not available on web. Use AI Assistant or the mobile app."
        );
        handleConnectionFailure(msg);
        setAutoReconnectEnabled(false);
        setIsActive(false);
        Alert.alert(
          t("voiceNotAvailable", "Voice Not Available"),
          t(
            "zeinaWebNotSupportedBody",
            "Zeina uses a realtime voice connection that isn't supported on web. Open the AI Assistant instead, or use the iOS/Android app."
          ),
          [
            {
              text: t("openAiAssistant", "Open AI Assistant"),
              onPress: () => router.push("/ai-assistant"),
            },
            { text: t("ok", "OK"), style: "cancel" },
          ]
        );
        isStartingZeinaRef.current = false;
        return;
      }

      if (!ensurePremiumAccess()) {
        isStartingZeinaRef.current = false;
        return;
      }

      setAutoReconnectEnabled(true);

      if (!canUseVoice) {
        setLastError(
          audioLoadError ||
            t("audioNotAvailable", "Audio is not available on this device.")
        );
      }
      if (isActiveRef.current && realtimeAgentService.isConnected()) {
        isStartingZeinaRef.current = false;
        return;
      }

      setIsActive(true);
      setLastError(null);
      setConnectionState("connecting");
      try {
        setupEventHandlers();

        if (canUseVoice) {
          // Proactively request mic permission so auto-mode can actually start listening.
          const permission = await Audio.requestPermissionsAsync();
          if (permission.status !== "granted") {
            setIsActive(false);
            Alert.alert(
              t("permissionDenied", "Permission Denied"),
              t(
                "microphonePermissionRequired",
                "Microphone permission is required"
              )
            );
            return;
          }
        }

        const currentLanguage = i18n.language || "en";
        const languageInstruction = currentLanguage.startsWith("ar")
          ? "IMPORTANT: Always respond in Arabic (العربية). If you must use medical terms, you may include the English term in parentheses."
          : "IMPORTANT: Always respond in English.";
        const baseInstructions = `${realtimeAgentService.getDefaultInstructions()}\n\n${languageInstruction}\n\n# User Health Context\n(loading...)`;

        // Connect ASAP (don't block on Firestore/user context).
        await realtimeAgentService.connect(baseInstructions);
        // Reliability mode (iOS): request TEXT responses and speak them via device TTS.
        // This avoids flaky streamed audio playback cutting off or not arriving.
        realtimeAgentService.sendMessage({
          type: "session.update",
          session: {
            modalities: ["text"],
            // Make VAD much more sensitive so we actually detect speech on iOS.
            // Without this, we can be "streaming=1" forever while never emitting speech_started/stopped.
            turn_detection: {
              type: "server_vad",
              threshold: 0.15,
              prefix_padding_ms: 800,
              silence_duration_ms: 350,
            },
          },
        });

        // Load health context in the background and update session instructions when available.
        healthContextService
          .getContextualPrompt(undefined, currentLanguage)
          .then((healthContext) => {
            const instructions = `${realtimeAgentService.getDefaultInstructions()}\n\n${languageInstruction}\n\n# User Health Context\n${healthContext}`;
            realtimeAgentService.sendMessage({
              type: "session.update",
              session: {
                instructions,
              },
            });
          })
          .catch(() => {
            // ignore context load failures; connection should still work
          });
      } catch (error) {
        setIsActive(false);
        const msg =
          error instanceof Error
            ? error.message
            : t("unableToConnect", "Unable to connect");
        handleConnectionFailure(msg);
        Alert.alert(t("connectionFailed", "Connection Failed"), msg);
      }
    } finally {
      isStartingZeinaRef.current = false;
    }
  }, [
    audioLoadError,
    canUseVoice,
    ensurePremiumAccess,
    handleConnectionFailure,
    i18n.language,
    isWeb,
    router,
    setupEventHandlers,
    t,
  ]);

  // Auto-reconnect if the socket drops (keep Zeina usable without manual tapping).
  useEffect(() => {
    if (!isActive) return;
    if (realtimeAgentService.isConnected()) return;
    if (connectionState === "connecting") return;
    if (!autoReconnectEnabled) return;

    const timeoutId = setTimeout(() => {
      startZeina().catch(() => {});
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [autoReconnectEnabled, connectionState, isActive, startZeina]);

  // Auto-start once when the Zeina screen mounts (tab open). This avoids relying on focus timing.
  // Note: We skip this since useFocusEffect will handle it when the screen is focused
  // This prevents duplicate calls that could trigger the paywall twice
  // useEffect(() => {
  //   startZeina().catch(() => {});
  //   // Intentionally no cleanup here; Zeina is meant to stay automatic while the app is open.
  //   // Cleanup is handled in the unmount effect below.
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  const stopZeina = useCallback(() => {
    setIsActive(false);
    stopContinuousListening();
    realtimeAgentService.disconnect();
    setMessages([]);
    setCurrentTranscript("");
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);
  }, [stopContinuousListening]);

  const toggleZeina = useCallback(() => {
    if (isActive) {
      stopZeina();
      return;
    }
    startZeina().catch(() => {});
  }, [isActive, startZeina, stopZeina]);

  const speakWelcome = useCallback(async () => {
    if (isAutoWelcomingRef.current) return;
    if (didAutoWelcomeRef.current) return;
    if (!isAudioAvailable) return;

    isAutoWelcomingRef.current = true;
    didAutoWelcomeRef.current = true;

    try {
      // Pause mic streaming while speaking to avoid iOS audio session conflicts.
      stopContinuousListening({ updateState: true, clearInputBuffer: false });
      setIsListening(false);
      setIsProcessing(false);
      setIsSpeaking(true);
      await setPlaybackAudioMode();

      const isArabic = (i18n.language || "en").startsWith("ar");
      const welcomeText = isArabic
        ? "مرحباً! أنا زينة. كيف أقدر أساعدك اليوم؟"
        : "Hi! I'm Zeina. How can I help you today?";
      const lang = isArabic ? "ar-SA" : "en-US";

      await voiceService.speak(welcomeText, { language: lang, volume: 1.0 });
    } catch {
      setLastError(t("ttsFailed", "Text-to-speech failed"));
    } finally {
      setIsSpeaking(false);
      isAutoWelcomingRef.current = false;
      if (
        isActiveRef.current &&
        realtimeAgentService.isConnected() &&
        !isManualRecordingRef.current
      ) {
        startContinuousListening();
      }
    }
  }, [
    i18n.language,
    setPlaybackAudioMode,
    startContinuousListening,
    stopContinuousListening,
  ]);

  // Auto mode: when you open the Zeina tab, connect + listen automatically.
  // Note: we intentionally DO NOT auto-stop on blur to keep Zeina truly "automatic"
  // while the app is open. iOS still prevents always-on mic in the background.
  useFocusEffect(
    useCallback(() => {
      startZeina().catch(() => {});
      // Talk immediately when the user lands on the Zeina tab.
      speakWelcome().catch(() => {});
      return;
    }, [startZeina, speakWelcome])
  );

  // Keep mic streaming alive: if we're active + connected and not streaming, start streaming.
  // Include `connectionState` so this runs right after we transition to connected.
  useEffect(() => {
    if (!isActive) return;
    if (!realtimeAgentService.isConnected()) return;
    if (isSpeaking) return;
    if (isManualRecordingRef.current) return;

    if (!isStreamingRef.current) {
      startContinuousListening().catch(() => {});
    }
  }, [connectionState, isActive, isSpeaking, startContinuousListening]);

  // Auto end-of-turn: if the transcript stops changing for a short time,
  // commit the audio buffer so Zeina replies without needing "Force reply".
  useEffect(() => {
    if (!isActive) return;
    if (!realtimeAgentService.isConnected()) return;

    const intervalId = setInterval(() => {
      if (isManualRecordingRef.current) return;
      if (isSpeaking) return;
      if (isProcessing) return;

      const transcript = currentTranscript.trim();
      if (!transcript) return;

      const lastEventAt = lastVadEventAtRef.current;
      if (!lastEventAt) return;

      const now = Date.now();
      if (now - lastEventAt < 1200) return;

      const lastAutoCommitAt = lastAutoCommitAtRef.current;
      if (lastAutoCommitAt != null && now - lastAutoCommitAt < 2500) return;
      lastAutoCommitAtRef.current = now;

      setIsListening(false);
      setIsProcessing(true);
      clearSpeechWatchdog();
      didReceiveAssistantAudioRef.current = false;
      safeCommitAudioBuffer();
    }, 300);

    return () => clearInterval(intervalId);
  }, [
    clearSpeechWatchdog,
    connectionState,
    currentTranscript,
    isActive,
    isProcessing,
    isSpeaking,
  ]);

  // Hard fallback: if Zeina is stuck in "Listening..." too long, end the turn and request a reply.
  useEffect(() => {
    if (!isActive) return;
    if (!realtimeAgentService.isConnected()) return;

    const intervalId = setInterval(() => {
      if (!isListening) return;
      if (isSpeaking) return;
      if (isProcessing) return;
      if (isManualRecordingRef.current) return;

      const since = listeningSinceAtRef.current;
      if (since == null) return;

      const now = Date.now();
      if (now - since < 4500) return;

      listeningSinceAtRef.current = null;
      setIsListening(false);
      setIsProcessing(true);
      didReceiveAssistantAudioRef.current = false;
      safeCommitAudioBuffer();
    }, 400);

    return () => clearInterval(intervalId);
  }, [connectionState, isActive, isListening, isProcessing, isSpeaking]);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const waveAnims = useRef(
    [...Array(5)].map(() => new Animated.Value(0.3))
  ).current;
  const orbitAnim = useRef(new Animated.Value(0)).current;

  // Breathing animation (always on when active)
  useEffect(() => {
    if (isActive && connectionState === "connected") {
      const breathe = Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 1.05,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      breathe.start();
      return () => breathe.stop();
    }
    breatheAnim.setValue(1);
  }, [isActive, connectionState]);

  // Orbit animation
  useEffect(() => {
    const orbit = Animated.loop(
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: 10_000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    orbit.start();
    return () => orbit.stop();
  }, []);

  // Pulse animation when user is speaking
  useEffect(() => {
    if (isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      // Glow effect
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      return () => pulse.stop();
    }
    pulseAnim.setValue(1);
    Animated.timing(glowAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isListening]);

  // Wave animation when Zeina is speaking
  useEffect(() => {
    if (isSpeaking) {
      const animations = waveAnims.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.6 + Math.random() * 0.4,
              duration: 150 + index * 50,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 150 + index * 50,
              useNativeDriver: true,
            }),
          ])
        )
      );
      animations.forEach((a) => a.start());
      return () => animations.forEach((a) => a.stop());
    }
    waveAnims.forEach((anim) => anim.setValue(0.3));
  }, [isSpeaking]);

  const togglePushToTalk = useCallback(async () => {
    if (!canUseVoice) {
      Alert.alert(
        t("audioUnavailable", "Audio Unavailable"),
        audioLoadError ||
          t("audioNotAvailable", "Audio is not available on this device.")
      );
      return;
    }

    if (connectionState !== "connected") {
      Alert.alert(
        t("notConnected", "Not Connected"),
        t("connecting", "Connecting...")
      );
      return;
    }

    if (isManualRecordingRef.current) {
      // Stop + send
      try {
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          const uri = recordingRef.current.getURI();
          recordingRef.current = null;
          isManualRecordingRef.current = false;

          setIsListening(false);

          if (!uri) {
            Alert.alert(
              t("microphoneError", "Microphone Error"),
              t(
                "microphoneErrorBody",
                "Zeina couldn't capture audio from the microphone. Please check microphone permission and try again."
              )
            );
            return;
          }

          const base64Audio = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType?.Base64 ?? "base64",
          });

          // Clean up temp file
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(
            () => {}
          );

          if (!(base64Audio && base64Audio.startsWith("UklG"))) {
            Alert.alert(
              t("unsupportedAudioFormat", "Unsupported audio format"),
              t(
                "unsupportedAudioFormatBody",
                "Zeina couldn't read the recording as a PCM WAV file. This can happen if the device records AAC/M4A instead of PCM. Try again on a physical iOS device, or use text input."
              )
            );
            return;
          }

          realtimeAgentService.sendAudioData(base64Audio);
          lastAudioAppendAtRef.current = Date.now();
          safeCommitAudioBuffer();
          setIsProcessing(true);
        }
      } catch {
        isManualRecordingRef.current = false;
        recordingRef.current = null;
        setIsListening(false);
      }
      return;
    }

    // Start recording (pause continuous streaming to avoid conflicts)
    stopContinuousListening();

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          t("permissionDenied", "Permission Denied"),
          t("microphonePermissionRequired", "Microphone permission is required")
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();

      // expo-av supports different constant names across versions; pick the best available.
      const iosLinearPcmOutputFormat =
        Audio?.IOSOutputFormat?.LINEARPCM ??
        Audio?.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM ??
        null;

      await recording.prepareToRecordAsync({
        android: {
          extension: ".wav",
          outputFormat: Audio.AndroidOutputFormat?.DEFAULT || 0,
          audioEncoder: Audio.AndroidAudioEncoder?.DEFAULT || 0,
          sampleRate: 24_000,
          numberOfChannels: 1,
          bitRate: 384_000,
        },
        ios: {
          extension: ".wav",
          ...(iosLinearPcmOutputFormat != null
            ? { outputFormat: iosLinearPcmOutputFormat }
            : {}),
          audioQuality: Audio.IOSAudioQuality?.HIGH || 127,
          sampleRate: 24_000,
          numberOfChannels: 1,
          bitRate: 384_000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });

      await recording.startAsync();
      recordingRef.current = recording;
      isManualRecordingRef.current = true;
      setIsProcessing(false);
      setIsSpeaking(false);
      setIsListening(true);
      setCurrentTranscript("");
    } catch {
      isManualRecordingRef.current = false;
      recordingRef.current = null;
      setIsListening(false);
      Alert.alert(
        t("microphoneError", "Microphone Error"),
        t("recordingFailed", "Failed to start recording")
      );
    }
  }, [
    Audio,
    FileSystem,
    audioLoadError,
    canUseVoice,
    connectionState,
    safeCommitAudioBuffer,
    stopContinuousListening,
    t,
  ]);

  const forceReply = useCallback(() => {
    if (!realtimeAgentService.isConnected()) return;
    // End the turn and ask the model to respond even if VAD didn't fire.
    setIsListening(false);
    setIsProcessing(true);
    didReceiveAssistantAudioRef.current = false;
    safeCommitAudioBuffer();
  }, []);

  const sendTextMessage = useCallback(() => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    if (!realtimeAgentService.isConnected()) {
      Alert.alert(
        t("notConnected", "Not Connected"),
        t("connecting", "Connecting...")
      );
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      },
    ]);
    setTextInput("");
    setIsProcessing(true);
    realtimeAgentService.sendTextMessage(trimmed);
  }, [textInput, t]);

  // Manual toggle (auto mode also starts Zeina when this tab is focused)
  const activateZeina = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleZeina();
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      stopContinuousListening({ updateState: false });
      realtimeAgentService.disconnect();
    },
    []
  );

  const orbitRotate = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.6],
  });

  // Get status message
  const getStatusMessage = () => {
    if (!isActive) return t("tapToActivate", "Tap to activate Zeina");
    if (lastError) return `${t("error", "Error")}: ${lastError}`;
    if (connectionState === "disconnected")
      return t("disconnected", "Disconnected");
    if (connectionState === "error")
      return t("connectionError", "Connection error");
    if (connectionState === "connecting")
      return t("connecting", "Connecting...");
    if (isSpeaking) return ""; // Don't show text when Zeina is speaking
    if (isProcessing) return t("thinking", "Thinking...");
    if (isListening) return t("listening", "Listening...");
    if (!canUseVoice) return t("textMode", "Text mode ready - type below");
    return t("imListening", "I'm listening...");
  };

  // Get orb colors based on state
  const getOrbColors = (): [string, string, string] => {
    if (!isActive || connectionState !== "connected") {
      return ["#2d3436", "#636e72", "#2d3436"];
    }
    if (isListening) {
      return ["#ff6b6b", "#ee5a5a", "#ff8787"];
    }
    if (isSpeaking) {
      return ["#4ecdc4", "#44a08d", "#6ee7de"];
    }
    if (isProcessing) {
      return ["#a29bfe", "#6c5ce7", "#b8b5ff"];
    }
    return ["#667eea", "#764ba2", "#8b7fef"];
  };

  const orbColors = getOrbColors();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a0f", "#12121a", "#1a1a28"]}
        style={styles.gradient}
      >
        <SafeAreaView edges={["top"]} style={styles.safeArea}>
          {/* Minimal header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t("zeina", "Zeina")}</Text>
            {isActive && (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => setDebugEnabled((prev) => !prev)}
                  style={styles.transcriptToggle}
                >
                  <Ionicons
                    color="rgba(255,255,255,0.6)"
                    name={debugEnabled ? "bug" : "bug-outline"}
                    size={22}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowTranscript(!showTranscript)}
                  style={styles.transcriptToggle}
                >
                  <Ionicons
                    color="rgba(255,255,255,0.6)"
                    name={
                      showTranscript ? "chatbubbles" : "chatbubbles-outline"
                    }
                    size={22}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Main orb area */}
          <View style={styles.orbContainer}>
            {/* Outer orbit ring */}
            <Animated.View
              style={[
                styles.orbitRing,
                { transform: [{ rotate: orbitRotate }] },
              ]}
            >
              <View style={styles.orbitDot} />
            </Animated.View>

            {/* Glow effect */}
            <Animated.View
              style={[
                styles.glowEffect,
                {
                  opacity: glowOpacity,
                  backgroundColor: orbColors[0],
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />

            {/* Main orb */}
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={() => setDebugEnabled((prev) => !prev)}
              onPress={activateZeina}
              style={styles.orbTouchable}
            >
              <Animated.View
                style={[
                  styles.orb,
                  {
                    transform: [
                      { scale: Animated.multiply(breatheAnim, pulseAnim) },
                    ],
                  },
                ]}
              >
                <LinearGradient
                  colors={orbColors}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={styles.orbGradient}
                >
                  {connectionState === "connecting" ? (
                    <ActivityIndicator color="#fff" size="large" />
                  ) : isSpeaking ? (
                    // Sound wave visualization
                    <View style={styles.waveContainer}>
                      {waveAnims.map((anim, i) => (
                        <Animated.View
                          key={i}
                          style={[
                            styles.waveBar,
                            {
                              transform: [{ scaleY: anim }],
                              height: 40 + i * 8,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  ) : (
                    <View style={styles.orbIcon}>
                      {isActive ? (
                        <View style={styles.listeningIndicator}>
                          <View
                            style={[
                              styles.listeningDot,
                              isListening && styles.listeningDotActive,
                            ]}
                          />
                        </View>
                      ) : (
                        <Ionicons color="#fff" name="mic" size={56} />
                      )}
                    </View>
                  )}
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>

            {/* Status text */}
            <Text style={styles.statusText}>{getStatusMessage()}</Text>
            {!canUseVoice && (
              <Text style={styles.voiceUnavailableText}>
                {t(
                  "voiceUnavailableHint",
                  "Voice is unavailable on this device. You can still chat with Zeina by text."
                )}
              </Text>
            )}
            {!(isSubscriptionLoading || hasActiveSubscription) && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setShowPaywall(true)}
                style={styles.upgradeButton}
              >
                <Text style={styles.upgradeButtonText}>
                  {t("upgradeToUseZeina", "Upgrade to use Zeina")}
                </Text>
              </TouchableOpacity>
            )}
            {debugEnabled && (
              <Text style={styles.debugText}>
                {`state=${connectionState} active=${isActive ? "1" : "0"} streaming=${isStreamingRef.current ? "1" : "0"} listening=${isListening ? "1" : "0"} speaking=${isSpeaking ? "1" : "0"} processing=${isProcessing ? "1" : "0"} invalidWav=${invalidAudioChunkCountRef.current} missingAudio=${missingAudioChunkCountRef.current}`}
              </Text>
            )}
            {debugEnabled && isActive && connectionState === "connected" && (
              <View style={styles.controlsRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={togglePushToTalk}
                  style={[
                    styles.controlButton,
                    isManualRecordingRef.current && styles.controlButtonActive,
                  ]}
                >
                  <Ionicons
                    color="#fff"
                    name={isManualRecordingRef.current ? "stop" : "mic"}
                    size={18}
                  />
                  <Text style={styles.controlButtonText}>
                    {isManualRecordingRef.current
                      ? t("tapToSend", "Tap to send")
                      : t("tapToTalk", "Tap to talk")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={forceReply}
                  style={[styles.controlButton, styles.controlButtonSecondary]}
                >
                  <Ionicons color="#fff" name="send" size={18} />
                  <Text style={styles.controlButtonText}>
                    {t("forceReply", "Force reply")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Current transcript preview */}
            {currentTranscript && (
              <View style={styles.transcriptPreview}>
                <Text style={styles.transcriptPreviewText}>
                  "{currentTranscript}"
                </Text>
              </View>
            )}

            {!canUseVoice && (
              <View style={styles.textInputContainer}>
                <TextInput
                  autoCapitalize="sentences"
                  editable={connectionState === "connected"}
                  onChangeText={setTextInput}
                  onSubmitEditing={sendTextMessage}
                  placeholder={t("typeMessage", "Type a message...")}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  returnKeyType="send"
                  style={styles.textInput}
                  value={textInput}
                />
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={
                    connectionState !== "connected" || textInput.trim() === ""
                  }
                  onPress={sendTextMessage}
                  style={[
                    styles.sendButton,
                    (connectionState !== "connected" ||
                      textInput.trim() === "") &&
                      styles.sendButtonDisabled,
                  ]}
                >
                  <Ionicons color="#fff" name="send" size={18} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Conversation transcript */}
          {isActive && showTranscript && messages.length > 0 && (
            <View style={styles.transcriptContainer}>
              <ScrollView
                contentContainerStyle={styles.transcriptContent}
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                style={styles.transcriptScroll}
              >
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.messageBubble,
                      message.role === "user"
                        ? styles.userBubble
                        : styles.assistantBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        message.role === "user"
                          ? styles.userText
                          : styles.assistantText,
                      ]}
                    >
                      {message.content}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Quick tips when inactive */}
          {!isActive && (
            <View style={styles.tipsContainer}>
              <Text style={styles.tipsTitle}>
                {t("trySaying", "Try saying:")}
              </Text>
              <Text style={styles.tipText}>
                "{t("tipHeadache", "I have a headache")}"
              </Text>
              <Text style={styles.tipText}>
                "{t("tipBloodPressure", "My blood pressure is 120 over 80")}"
              </Text>
              <Text style={styles.tipText}>
                "{t("tipMoodFeeling", "I'm feeling stressed today")}"
              </Text>
              <Text style={styles.tipText}>
                "{t("tipTookMedication", "I took my aspirin")}"
              </Text>
            </View>
          )}

          <Modal
            animationType="slide"
            onRequestClose={() => setShowPaywall(false)}
            presentationStyle="pageSheet"
            visible={showPaywall}
          >
            <SafeAreaView style={styles.paywallContainer}>
              <View style={styles.paywallHeader}>
                <Text style={styles.paywallTitle}>
                  {t("upgradeToPremium", "Upgrade to Premium")}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowPaywall(false)}
                  style={styles.paywallClose}
                >
                  <Ionicons
                    color="rgba(255,255,255,0.8)"
                    name="close"
                    size={22}
                  />
                </TouchableOpacity>
              </View>
              <RevenueCatPaywall
                onDismiss={() => {
                  setShowPaywall(false);
                  isCheckingPremiumRef.current = false;
                }}
                onPurchaseComplete={async () => {
                  setShowPaywall(false);
                  isCheckingPremiumRef.current = false;
                  await refreshCustomerInfo();
                  startZeina().catch(() => {});
                }}
              />
            </SafeAreaView>
          </Modal>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    letterSpacing: 1,
  },
  transcriptToggle: {
    padding: 8,
  },
  orbContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  orbitRing: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: "rgba(102, 126, 234, 0.2)",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  orbitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#667eea",
    marginTop: -4,
  },
  glowEffect: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  orbTouchable: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  orb: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: "hidden",
    elevation: 20,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  orbGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  orbIcon: {
    alignItems: "center",
    justifyContent: "center",
  },
  listeningIndicator: {
    alignItems: "center",
    justifyContent: "center",
  },
  listeningDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  listeningDotActive: {
    backgroundColor: "#fff",
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 80,
    gap: 6,
  },
  waveBar: {
    width: 8,
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  statusText: {
    marginTop: 32,
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "500",
    textAlign: "center",
  },
  voiceUnavailableText: {
    marginTop: 10,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.55)",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  upgradeButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(102,126,234,0.95)",
  },
  upgradeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  paywallContainer: {
    flex: 1,
    backgroundColor: "rgba(10,10,15,1)",
  },
  paywallHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  paywallTitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 18,
    fontWeight: "700",
  },
  paywallClose: {
    padding: 6,
  },
  debugText: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.55)",
    textAlign: "center",
  },
  controlsRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  controlButtonSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  controlButtonActive: {
    backgroundColor: "rgba(255, 107, 107, 0.35)",
  },
  controlButtonText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  transcriptPreview: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    maxWidth: SCREEN_WIDTH - 60,
  },
  transcriptPreviewText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
  },
  textInputContainer: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    width: "100%",
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "rgba(255,255,255,0.92)",
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(102,126,234,0.95)",
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  transcriptContainer: {
    maxHeight: SCREEN_HEIGHT * 0.3,
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    overflow: "hidden",
  },
  transcriptScroll: {
    flex: 1,
  },
  transcriptContent: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: "85%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(102, 126, 234, 0.8)",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: "#fff",
  },
  assistantText: {
    color: "rgba(255, 255, 255, 0.9)",
  },
  tipsContainer: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    alignItems: "center",
  },
  tipsTitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    marginBottom: 16,
    fontWeight: "500",
  },
  tipText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.4)",
    marginBottom: 10,
    fontStyle: "italic",
  },
});
