/**
 * Zeina - Siri-like Voice Health Assistant
 *
 * A hands-free, always-listening voice assistant powered by OpenAI's Realtime API.
 * Just tap to activate, then speak naturally - Zeina will respond with voice.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Device from "expo-device";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import {
  realtimeAgentService,
  type ConnectionState,
  type RealtimeEventHandlers,
} from "@/lib/services/realtimeAgentService";
import healthContextService from "@/lib/services/healthContextService";
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
    FileSystem = require("expo-file-system");
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
  const { t } = useTranslation();
  const scrollViewRef = useRef<ScrollView>(null);

  // Connection state
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(true);

  // Audio streaming state
  const recordingRef = useRef<any>(null);
  const streamingIntervalRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const waveAnims = useRef([...Array(5)].map(() => new Animated.Value(0.3))).current;
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
    } else {
      breatheAnim.setValue(1);
    }
  }, [isActive, connectionState]);

  // Orbit animation
  useEffect(() => {
    const orbit = Animated.loop(
      Animated.timing(orbitAnim, {
        toValue: 1,
        duration: 10000,
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
        useNativeDriver: false,
      }).start();

      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
      Animated.timing(glowAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
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
    } else {
      waveAnims.forEach((anim) => anim.setValue(0.3));
    }
  }, [isSpeaking]);

  // Set up event handlers for the realtime service
  const setupEventHandlers = useCallback(() => {
    const handlers: RealtimeEventHandlers = {
      onConnectionStateChange: (state) => {
        setConnectionState(state);
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
        setIsListening(true);
        setCurrentTranscript("");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },

      onSpeechStopped: () => {
        setIsListening(false);
        setIsProcessing(true);
      },

      onTranscriptDelta: (delta, role) => {
        if (role === "user") {
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
        }
      },

      onAudioDelta: () => {
        setIsSpeaking(true);
        setIsProcessing(false);
      },

      onAudioDone: () => {
        setIsSpeaking(false);
        setIsProcessing(false);
        // Resume listening after Zeina finishes speaking
        if (isActive && connectionState === "connected") {
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

      onResponseDone: (response) => {
        // Extract assistant message from response if available
        if (response?.output) {
          const textOutput = response.output.find(
            (o: any) => o.type === "message" && o.content
          );
          if (textOutput?.content) {
            const textContent = textOutput.content.find(
              (c: any) => c.type === "text" || c.type === "audio"
            );
            if (textContent?.transcript || textContent?.text) {
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  role: "assistant",
                  content: textContent.transcript || textContent.text,
                  timestamp: new Date(),
                },
              ]);
            }
          }
        }
        setIsProcessing(false);
      },

      onError: (error) => {
        setIsProcessing(false);
        setIsListening(false);
        setIsSpeaking(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        if (error?.message?.includes("API key")) {
          Alert.alert(
            t("configurationError", "Configuration Error"),
            t("apiKeyMissing", "Please configure your OpenAI API key in the app settings.")
          );
        }
      },
    };

    realtimeAgentService.setEventHandlers(handlers);
  }, [t, isActive, connectionState]);

  // Execute health-related tools - routes to appropriate service
  const executeHealthTool = async (name: string, args: any = {}): Promise<any> => {
    // Ensure args is always an object
    const safeArgs = args || {};
    
    switch (name) {
      // ===== INFORMATION RETRIEVAL TOOLS =====
      case "get_health_summary":
        return await healthContextService.getHealthSummary();
      
      case "get_medications":
        return await healthContextService.getMedications(safeArgs.active_only ?? true);
      
      case "get_recent_vitals":
        return await healthContextService.getRecentVitals(safeArgs.vital_type, safeArgs.days);
      
      case "check_medication_interactions":
        return await healthContextService.checkMedicationInteractions(safeArgs.new_medication);
      
      case "emergency_contact":
        return await healthContextService.getEmergencyContacts(safeArgs.action);
      
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
        const metadata = safeArgs.systolic && safeArgs.diastolic 
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
        return await zeinaActionsService.markMedicationTaken(safeArgs.medication_name || "");
      
      case "navigate_to":
        return zeinaActionsService.getNavigationTarget(safeArgs.target || "home");
      
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
        return { error: "Unknown tool", message: `Tool "${name}" is not supported` };
    }
  };

  // Start continuous audio streaming for VAD
  const startContinuousListening = async () => {
    if (!Audio || !FileSystem || !isAudioAvailable || isStreamingRef.current) {
      return;
    }

    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        return;
      }

      // Set audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });

      isStreamingRef.current = true;

      // Start streaming audio in chunks
      const streamAudioChunk = async () => {
        if (!isStreamingRef.current || connectionState !== "connected") {
          return;
        }

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
              sampleRate: 24000,
              numberOfChannels: 1,
              bitRate: 384000,
            },
            ios: {
              extension: ".wav",
              ...(iosLinearPcmOutputFormat != null ? { outputFormat: iosLinearPcmOutputFormat } : {}),
              audioQuality: Audio.IOSAudioQuality?.HIGH || 127,
              sampleRate: 24000,
              numberOfChannels: 1,
              bitRate: 384000,
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

          if (uri && isStreamingRef.current) {
            // Read and send audio
            const base64Audio = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            // Basic sanity check: WAV files start with "RIFF" which base64-encodes to "UklG".
            // If we stream non-PCM audio while the session expects PCM16, VAD/transcription can appear stuck.
            if (base64Audio && base64Audio.startsWith("UklG")) {
              realtimeAgentService.sendAudioData(base64Audio);
            }

            // Clean up
            await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
          }
        } catch (error) {
          // Continue streaming despite errors
        }

        // Schedule next chunk if still streaming
        if (isStreamingRef.current && connectionState === "connected") {
          streamingIntervalRef.current = setTimeout(streamAudioChunk, 50);
        }
      };

      // Start the streaming loop
      streamAudioChunk();
    } catch (error) {
      isStreamingRef.current = false;
    }
  };

  // Stop continuous listening
  const stopContinuousListening = () => {
    isStreamingRef.current = false;
    if (streamingIntervalRef.current) {
      clearTimeout(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
  };

  // Activate Zeina (like saying "Hey Siri")
  const activateZeina = async () => {
    if (!isAudioAvailable) {
      if (!Device.isDevice) {
        Alert.alert(
          t("physicalDeviceRequired", "Physical Device Required"),
          t("simulatorNotSupported", "Voice features require a physical device.")
        );
      } else {
        Alert.alert(
          t("audioUnavailable", "Audio Unavailable"),
          audioLoadError || t("audioNotAvailable", "Audio is not available on this device.")
        );
      }
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isActive) {
      // Deactivate
      setIsActive(false);
      stopContinuousListening();
      realtimeAgentService.disconnect();
      setMessages([]);
      return;
    }

    // Activate
    setIsActive(true);

    try {
      setupEventHandlers();

      // Get health context
      const healthContext = await healthContextService.getContextualPrompt();
      const instructions = `${realtimeAgentService.getDefaultInstructions()}\n\n# User Health Context\n${healthContext}`;

      await realtimeAgentService.connect(instructions);
    } catch (error) {
      setIsActive(false);
      Alert.alert(
        t("connectionFailed", "Connection Failed"),
        error instanceof Error ? error.message : t("unableToConnect", "Unable to connect")
      );
    }
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
  useEffect(() => {
    return () => {
      stopContinuousListening();
      realtimeAgentService.disconnect();
    };
  }, []);

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
    if (connectionState === "connecting") return t("connecting", "Connecting...");
    if (isSpeaking) return ""; // Don't show text when Zeina is speaking
    if (isProcessing) return t("thinking", "Thinking...");
    if (isListening) return t("listening", "Listening...");
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
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          {/* Minimal header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t("zeina", "Zeina")}</Text>
            {isActive && (
              <TouchableOpacity
                onPress={() => setShowTranscript(!showTranscript)}
                style={styles.transcriptToggle}
              >
                <Ionicons
                  name={showTranscript ? "chatbubbles" : "chatbubbles-outline"}
                  size={22}
                  color="rgba(255,255,255,0.6)"
                />
              </TouchableOpacity>
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
              onPress={activateZeina}
              activeOpacity={0.9}
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
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.orbGradient}
                >
                  {connectionState === "connecting" ? (
                    <ActivityIndicator size="large" color="#fff" />
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
                        <Ionicons name="mic" size={56} color="#fff" />
                      )}
                    </View>
                  )}
                </LinearGradient>
              </Animated.View>
            </TouchableOpacity>

            {/* Status text */}
            <Text style={styles.statusText}>{getStatusMessage()}</Text>

            {/* Current transcript preview */}
            {currentTranscript && (
              <View style={styles.transcriptPreview}>
                <Text style={styles.transcriptPreviewText}>
                  "{currentTranscript}"
                </Text>
              </View>
            )}
          </View>

          {/* Conversation transcript */}
          {isActive && showTranscript && messages.length > 0 && (
            <View style={styles.transcriptContainer}>
              <ScrollView
                ref={scrollViewRef}
                style={styles.transcriptScroll}
                contentContainerStyle={styles.transcriptContent}
                showsVerticalScrollIndicator={false}
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
              <Text style={styles.tipsTitle}>{t("trySaying", "Try saying:")}</Text>
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
