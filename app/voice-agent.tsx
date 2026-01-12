/**
 * Voice Agent Screen
 *
 * A real-time speech-to-speech voice assistant powered by OpenAI's Realtime API.
 * Features audio visualization, conversation transcript, and health-focused tools.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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
  TextInput,
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

// Audio recording imports
let Audio: any = null;
let isAudioAvailable = false;
let audioLoadError: string | null = null;

try {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    const expoAv = require("expo-av");
    Audio = expoAv.Audio;
    isAudioAvailable = !!Audio;
    
    if (!Audio) {
      audioLoadError = "expo-av loaded but Audio module not found";
    }
  } else {
    audioLoadError = `Platform ${Platform.OS} not supported for audio recording`;
  }
} catch (error) {
  isAudioAvailable = false;
  audioLoadError = error instanceof Error ? error.message : String(error);
  console.warn("Failed to load expo-av:", audioLoadError);
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Conversation message type
interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// Tool call status type
interface ToolCallStatus {
  id: string;
  name: string;
  status: "pending" | "executing" | "completed" | "error";
  result?: string;
}

export default function VoiceAgentScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Log audio availability on mount for debugging
  useEffect(() => {
    console.log("Voice Agent - Audio availability check:");
    console.log("  Platform:", Platform.OS);
    console.log("  isAudioAvailable:", isAudioAvailable);
    console.log("  Audio module:", !!Audio);
    if (audioLoadError) {
      console.log("  Error:", audioLoadError);
    }
  }, []);

  // Connection and session state
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [toolCalls, setToolCalls] = useState<ToolCallStatus[]>([]);
  const [textInput, setTextInput] = useState("");

  // Audio recording state
  const recordingRef = useRef<any>(null);
  const audioContextRef = useRef<any>(null);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Initialize animations
  useEffect(() => {
    // Continuous rotation for the outer ring
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Pulse animation when listening
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    }
  }, [isListening]);

  // Wave animation when assistant is speaking
  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      waveAnim.setValue(0);
    }
  }, [isSpeaking]);

  // Set up event handlers
  const setupEventHandlers = useCallback(() => {
    const handlers: RealtimeEventHandlers = {
      onConnectionStateChange: (state) => {
        setConnectionState(state);
      },

      onSessionCreated: (session) => {
        // Add welcome message
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: t("voiceAgentWelcome", "Hello! I'm Zeina, your health assistant. I'm listening - feel free to ask me anything about your health, medications, or wellness."),
            timestamp: new Date(),
          },
        ]);
      },

      onSpeechStarted: () => {
        setIsListening(true);
        setCurrentTranscript("");
      },

      onSpeechStopped: () => {
        setIsListening(false);
        setIsProcessing(true);
      },

      onTranscriptDelta: (delta, role) => {
        if (role === "user") {
          setCurrentTranscript((prev) => prev + delta);
        } else {
          // Update the last assistant message
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.role === "assistant" && lastMessage.isStreaming) {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, content: lastMessage.content + delta },
              ];
            }
            return prev;
          });
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
        } else if (role === "assistant") {
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.role === "assistant" && lastMessage.isStreaming) {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, isStreaming: false },
              ];
            }
            return prev;
          });
        }
      },

      onAudioDelta: () => {
        setIsSpeaking(true);
        // If there's no streaming assistant message, create one
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.role !== "assistant" || !lastMessage.isStreaming) {
            return [
              ...prev,
              {
                id: Date.now().toString(),
                role: "assistant",
                content: "",
                timestamp: new Date(),
                isStreaming: true,
              },
            ];
          }
          return prev;
        });
      },

      onAudioDone: () => {
        setIsSpeaking(false);
        setIsProcessing(false);
      },

      onToolCall: async (toolCall) => {
        setToolCalls((prev) => [
          ...prev,
          {
            id: toolCall.call_id,
            name: toolCall.name,
            status: "executing",
          },
        ]);

        // Execute the tool
        try {
          const result = await executeHealthTool(toolCall.name, JSON.parse(toolCall.arguments));
          
          setToolCalls((prev) =>
            prev.map((tc) =>
              tc.id === toolCall.call_id
                ? { ...tc, status: "completed", result: JSON.stringify(result) }
                : tc
            )
          );

          // Submit the tool output
          realtimeAgentService.submitToolOutput(toolCall.call_id, JSON.stringify(result));
        } catch (error) {
          setToolCalls((prev) =>
            prev.map((tc) =>
              tc.id === toolCall.call_id
                ? { ...tc, status: "error", result: String(error) }
                : tc
            )
          );

          realtimeAgentService.submitToolOutput(
            toolCall.call_id,
            JSON.stringify({ error: "Tool execution failed" })
          );
        }
      },

      onResponseDone: () => {
        setIsProcessing(false);
        // Clear completed tool calls after a delay
        setTimeout(() => {
          setToolCalls((prev) => prev.filter((tc) => tc.status !== "completed"));
        }, 3000);
      },

      onError: (error) => {
        setIsProcessing(false);
        setIsListening(false);
        setIsSpeaking(false);

        // Provide more helpful error messages
        let errorMessage = error?.message || t("connectionError", "Connection error occurred");
        
        // Check for common WebSocket errors
        if (errorMessage.includes("WebSocket") || errorMessage.includes("headers")) {
          errorMessage = 
            "WebSocket connection failed. This is likely because React Native's WebSocket doesn't support custom headers. " +
            "To fix this, you may need to:\n\n" +
            "1. Install a WebSocket library that supports headers (e.g., 'react-native-websocket')\n" +
            "2. Or use a proxy/middleware server\n" +
            "3. Or ensure your API key is properly configured\n\n" +
            `Original error: ${errorMessage}`;
        } else if (errorMessage.includes("API key") || errorMessage.includes("authentication")) {
          errorMessage = 
            "Authentication failed. Please ensure OPENAI_API_KEY is set in your environment variables.\n\n" +
            `Error: ${errorMessage}`;
        }

        Alert.alert(
          t("error", "Error"),
          errorMessage,
          [
            { text: t("ok", "OK"), style: "default" },
            { 
              text: t("retry", "Retry"), 
              onPress: () => handleConnect(),
              style: "default"
            }
          ]
        );
      },
    };

    realtimeAgentService.setEventHandlers(handlers);
  }, [t]);

  // Execute health-related tools
  const executeHealthTool = async (name: string, args: any): Promise<any> => {
    switch (name) {
      case "get_health_summary":
        return await healthContextService.getHealthSummary();

      case "get_medications":
        return await healthContextService.getMedications(args.active_only);

      case "log_symptom":
        return await healthContextService.logSymptom(
          args.symptom_name,
          args.severity,
          args.notes
        );

      case "get_recent_vitals":
        return await healthContextService.getRecentVitals(args.vital_type, args.days);

      case "check_medication_interactions":
        return await healthContextService.checkMedicationInteractions(args.new_medication);

      case "schedule_reminder":
        return { success: true, message: "Reminder scheduled successfully" };

      case "emergency_contact":
        return await healthContextService.getEmergencyContacts(args.action);

      default:
        return { error: "Unknown tool" };
    }
  };

  // Connect to the service
  const handleConnect = async () => {
    try {
      setupEventHandlers();

      // Get personalized health context for the instructions
      const healthContext = await healthContextService.getContextualPrompt();
      const customInstructions = `${realtimeAgentService.getDefaultInstructions()}\n\n# User Health Context\n${healthContext}`;

      await realtimeAgentService.connect(customInstructions);
    } catch (error) {
      Alert.alert(
        t("connectionFailed", "Connection Failed"),
        error instanceof Error ? error.message : t("unableToConnect", "Unable to connect to voice service")
      );
    }
  };

  // Disconnect from the service
  const handleDisconnect = () => {
    realtimeAgentService.disconnect();
    setMessages([]);
    setToolCalls([]);
    setCurrentTranscript("");
  };

  // Start/stop recording
  const toggleRecording = async () => {
    if (!Audio || !isAudioAvailable) {
      // Provide detailed error message
      let errorTitle = t("audioNotAvailable", "Audio recording not available");
      let errorMessage = "";
      
      if (Platform.OS === "web") {
        errorMessage = t("useTextInput", "Please use text input to communicate with Zeina on this platform.");
      } else if (audioLoadError) {
        errorMessage = `Audio recording failed to initialize:\n\n${audioLoadError}\n\n`;
        
        if (audioLoadError.includes("expo-av")) {
          errorMessage += "Please ensure expo-av is properly installed:\n\nbun install expo-av\n\nThen restart the app.";
        } else if (Platform.OS === "ios" || Platform.OS === "android") {
          errorMessage += "This may happen on simulators/emulators. Try using a physical device.";
        }
      } else {
        errorMessage = t("audioNotAvailable", "Audio recording not available on this platform. Please ensure expo-av is properly installed.");
      }
      
      Alert.alert(errorTitle, errorMessage, [
        { text: t("ok", "OK"), style: "cancel" },
      ]);
      return;
    }

    if (isListening) {
      // Stop recording
      try {
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          recordingRef.current = null;
        }
        realtimeAgentService.commitAudioBuffer();
      } catch (error) {
        // Error stopping recording
      }
    } else {
      // Start recording
      try {
        // Request permissions
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert(t("permissionDenied", "Permission Denied"), t("microphonePermissionRequired", "Microphone permission is required"));
          return;
        }

        // Set audio mode
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });

        // Start recording
        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          android: {
            extension: ".m4a",
            outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
            audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
            sampleRate: 24000,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: ".m4a",
            audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
            sampleRate: 24000,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {},
        });

        // Set up status updates to stream audio
        recording.setOnRecordingStatusUpdate(async (status: any) => {
          if (status.isRecording && status.metersCount) {
            // Audio is being recorded
            setIsListening(true);
          }
        });

        await recording.startAsync();
        recordingRef.current = recording;
        setIsListening(true);
      } catch (error) {
        Alert.alert(t("error", "Error"), t("recordingFailed", "Failed to start recording"));
      }
    }
  };

  // Send text message (alternative to voice)
  const sendTextMessage = (text: string) => {
    if (!text.trim() || connectionState !== "connected") return;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: text,
        timestamp: new Date(),
      },
    ]);

    realtimeAgentService.sendTextMessage(text);
    setIsProcessing(true);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handleDisconnect();
    };
  }, []);

  // Connection button styles
  const getConnectionButtonStyle = () => {
    switch (connectionState) {
      case "connected":
        return styles.connectedButton;
      case "connecting":
        return styles.connectingButton;
      case "error":
        return styles.errorButton;
      default:
        return styles.disconnectedButton;
    }
  };

  // Render waveform bars
  const renderWaveformBars = () => {
    const bars = [];
    for (let i = 0; i < 5; i++) {
      const delay = i * 100;
      bars.push(
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              transform: [
                {
                  scaleY: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1 + Math.random() * 0.5],
                  }),
                },
              ],
            },
          ]}
        />
      );
    }
    return bars;
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const glowInterpolate = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0, 122, 255, 0.1)", "rgba(0, 122, 255, 0.4)"],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0a0a1a", "#1a1a2e", "#16213e"]}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{t("zeina", "Zeina")}</Text>
              <Text style={styles.headerSubtitle}>{t("voiceMode", "Voice Mode")}</Text>
              <View style={[styles.statusDot, connectionState === "connected" && styles.statusDotConnected]} />
            </View>
            <TouchableOpacity
              onPress={connectionState === "connected" ? handleDisconnect : handleConnect}
              style={[styles.connectionButton, getConnectionButtonStyle()]}
            >
              {connectionState === "connecting" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={connectionState === "connected" ? "radio" : "radio-outline"}
                  size={20}
                  color="#fff"
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Main content area */}
          <View style={styles.content}>
            {/* Audio visualization */}
            <View style={styles.visualizationContainer}>
              <Animated.View
                style={[
                  styles.outerRing,
                  {
                    transform: [{ rotate: rotateInterpolate }],
                  },
                ]}
              >
                <LinearGradient
                  colors={["#667eea", "#764ba2", "#f093fb"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ringGradient}
                />
              </Animated.View>

              <Animated.View
                style={[
                  styles.glowCircle,
                  {
                    backgroundColor: glowInterpolate,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />

              <Animated.View
                style={[
                  styles.mainCircle,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <LinearGradient
                  colors={
                    isListening
                      ? ["#ff6b6b", "#ee5a5a"]
                      : isSpeaking
                      ? ["#4ecdc4", "#44a08d"]
                      : connectionState === "connected"
                      ? ["#667eea", "#764ba2"]
                      : ["#2d3436", "#636e72"]
                  }
                  style={styles.circleGradient}
                >
                  {isSpeaking ? (
                    <View style={styles.waveformContainer}>{renderWaveformBars()}</View>
                  ) : isListening ? (
                    <Ionicons name="mic" size={48} color="#fff" />
                  ) : (
                    <Ionicons
                      name={connectionState === "connected" ? "ear" : "mic-off"}
                      size={48}
                      color="#fff"
                    />
                  )}
                </LinearGradient>
              </Animated.View>
            </View>

            {/* Status text */}
            <Text style={styles.statusText}>
              {isListening
                ? t("listening", "Listening...")
                : isSpeaking
                ? t("zeinaSpeaking", "Zeina is speaking...")
                : isProcessing
                ? t("processing", "Processing...")
                : connectionState === "connected"
                ? t("tapToSpeak", "Tap the button to speak")
                : t("connectToStart", "Connect to start")}
            </Text>

            {/* Current transcript while speaking */}
            {currentTranscript && (
              <View style={styles.transcriptPreview}>
                <Text style={styles.transcriptPreviewText}>{currentTranscript}</Text>
              </View>
            )}

            {/* Tool calls indicator */}
            {toolCalls.length > 0 && (
              <View style={styles.toolCallsContainer}>
                {toolCalls.map((tc) => (
                  <View key={tc.id} style={styles.toolCallBadge}>
                    <Ionicons
                      name={tc.status === "executing" ? "sync" : tc.status === "completed" ? "checkmark-circle" : "alert-circle"}
                      size={14}
                      color={tc.status === "completed" ? "#4ecdc4" : tc.status === "error" ? "#ff6b6b" : "#fff"}
                    />
                    <Text style={styles.toolCallText}>{tc.name.replace(/_/g, " ")}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Conversation messages */}
          <View style={styles.messagesContainer}>
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesScroll}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.role === "user" ? styles.userMessage : styles.assistantMessage,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      message.role === "user" ? styles.userMessageText : styles.assistantMessageText,
                    ]}
                  >
                    {message.content}
                  </Text>
                  {message.isStreaming && (
                    <View style={styles.streamingIndicator}>
                      <ActivityIndicator size="small" color="#667eea" />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Control buttons */}
          <View style={styles.controlsContainer}>
            {isAudioAvailable ? (
              <>
                <TouchableOpacity
                  onPress={toggleRecording}
                  disabled={connectionState !== "connected" || isProcessing}
                  style={[
                    styles.talkButton,
                    isListening && styles.talkButtonActive,
                    (connectionState !== "connected" || isProcessing) && styles.talkButtonDisabled,
                  ]}
                >
                  <LinearGradient
                    colors={
                      isListening
                        ? ["#ff6b6b", "#ee5a5a"]
                        : connectionState === "connected"
                        ? ["#667eea", "#764ba2"]
                        : ["#636e72", "#2d3436"]
                    }
                    style={styles.talkButtonGradient}
                  >
                    <Ionicons
                      name={isListening ? "stop" : "mic"}
                      size={32}
                      color="#fff"
                    />
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.controlHint}>
                  {connectionState !== "connected"
                    ? t("pressConnectFirst", "Press connect first")
                    : isListening
                    ? t("releaseToSend", "Tap to stop")
                    : t("holdToTalk", "Tap to talk")}
                </Text>
              </>
            ) : (
              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder={t("typeMessage", "Type your message...")}
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={textInput}
                  onChangeText={setTextInput}
                  multiline
                  editable={connectionState === "connected" && !isProcessing}
                  onSubmitEditing={() => {
                    if (textInput.trim() && connectionState === "connected") {
                      sendTextMessage(textInput.trim());
                      setTextInput("");
                    }
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (textInput.trim() && connectionState === "connected") {
                      sendTextMessage(textInput.trim());
                      setTextInput("");
                    }
                  }}
                  disabled={!textInput.trim() || connectionState !== "connected" || isProcessing}
                  style={[
                    styles.sendButton,
                    (!textInput.trim() || connectionState !== "connected" || isProcessing) && styles.sendButtonDisabled,
                  ]}
                >
                  <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
    marginLeft: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#636e72",
    marginLeft: 8,
  },
  statusDotConnected: {
    backgroundColor: "#4ecdc4",
  },
  connectionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  disconnectedButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  connectingButton: {
    backgroundColor: "#667eea",
  },
  connectedButton: {
    backgroundColor: "#4ecdc4",
  },
  errorButton: {
    backgroundColor: "#ff6b6b",
  },
  content: {
    alignItems: "center",
    paddingVertical: 20,
  },
  visualizationContainer: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  outerRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    padding: 3,
  },
  ringGradient: {
    flex: 1,
    borderRadius: 100,
    opacity: 0.3,
  },
  glowCircle: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  mainCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
  },
  circleGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
  },
  waveBar: {
    width: 6,
    height: 30,
    backgroundColor: "#fff",
    marginHorizontal: 3,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 20,
    fontWeight: "500",
  },
  transcriptPreview: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    maxWidth: SCREEN_WIDTH - 60,
  },
  transcriptPreviewText: {
    color: "#fff",
    fontSize: 14,
    fontStyle: "italic",
  },
  toolCallsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 12,
    paddingHorizontal: 20,
  },
  toolCallBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(102, 126, 234, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    margin: 4,
  },
  toolCallText: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 6,
    textTransform: "capitalize",
  },
  messagesContainer: {
    flex: 1,
    marginTop: 10,
    paddingHorizontal: 16,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingBottom: 20,
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    marginVertical: 4,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#667eea",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#fff",
  },
  assistantMessageText: {
    color: "rgba(255, 255, 255, 0.95)",
  },
  streamingIndicator: {
    marginTop: 8,
    alignItems: "flex-start",
  },
  controlsContainer: {
    alignItems: "center",
    paddingVertical: 24,
    paddingBottom: 32,
  },
  talkButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  talkButtonActive: {
    shadowColor: "#ff6b6b",
  },
  talkButtonDisabled: {
    opacity: 0.5,
  },
  talkButtonGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  controlHint: {
    marginTop: 12,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
  },
  textInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 16,
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
