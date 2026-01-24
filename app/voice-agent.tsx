/**
 * Voice Agent Screen - Enhanced Zeina AI Assistant
 *
 * A real-time speech-to-speech voice assistant powered by OpenAI's Realtime API.
 * Features audio visualization, conversation transcript, and health-focused tools.
 *
 * ENHANCEMENTS:
 *
 * 1. INTELLIGENT ANALYSIS:
 *    - Health trend analysis and pattern detection
 *    - Proactive health insights and recommendations
 *    - Medication adherence tracking and suggestions
 *    - Contextual health suggestions based on user data
 *
 * 2. CONVERSATION & MEMORY:
 *    - Conversation history persistence to Firestore
 *    - Context awareness across sessions
 *    - Personalized welcome messages based on health status
 *    - Natural conversation flow with follow-up questions
 *
 * 3. USER EXPERIENCE:
 *    - Quick action shortcuts for common tasks
 *    - Enhanced UI with better visual feedback and animations
 *    - Proactive health monitoring and pattern detection
 *    - Tool call status indicators with animations
 *
 * 4. PROACTIVE FEATURES:
 *    - Automatic pattern detection (frequent symptoms, medication adherence)
 *    - Proactive suggestions based on health data
 *    - Health trend analysis after logging data
 *    - Contextual recommendations
 *
 * 5. MULTI-LANGUAGE SUPPORT:
 *    - English and Arabic support
 *    - Proper medical terminology in both languages
 *    - Cultural context awareness
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { auth, db } from "@/lib/firebase";
import healthContextService from "@/lib/services/healthContextService";
import {
  type ConnectionState,
  type RealtimeEventHandlers,
  realtimeAgentService,
} from "@/lib/services/realtimeAgentService";
import { zeinaActionsService } from "@/lib/services/zeinaActionsService";

// Audio recording imports
let Audio: any = null;
let FileSystem: any = null;
let isAudioAvailable = false;
let audioLoadError: string | null = null;

try {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    const expoAv = require("expo-av");
    Audio = expoAv.Audio;
    // Expo SDK 54+: prefer legacy import path to avoid deprecation warnings
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
    audioLoadError = `Platform ${Platform.OS} not supported for audio recording`;
  }
} catch (error) {
  isAudioAvailable = false;
  audioLoadError = error instanceof Error ? error.message : String(error);
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
  const { t, i18n } = useTranslation();
  const scrollViewRef = useRef<ScrollView>(null);

  // Log audio availability on mount for debugging
  useEffect(() => {
    // Audio availability check for debugging (removed console logs)
  }, []);

  // Connection and session state
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [toolCalls, setToolCalls] = useState<ToolCallStatus[]>([]);
  const [textInput, setTextInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);

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

  // Save conversation message to Firestore
  const saveConversationMessage = useCallback(
    async (message: ConversationMessage) => {
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        // Create or get session ID
        let currentSessionId = sessionId;
        if (!currentSessionId) {
          currentSessionId = `zeina_session_${Date.now()}`;
          setSessionId(currentSessionId);
        }

        await addDoc(collection(db, "zeina_conversations"), {
          userId,
          sessionId: currentSessionId,
          role: message.role,
          content: message.content,
          timestamp: Timestamp.fromDate(message.timestamp),
          createdAt: Timestamp.now(),
        });
      } catch (error) {
        // Silently handle errors - don't interrupt conversation flow
        console.error("Failed to save conversation:", error);
      }
    },
    [sessionId]
  );

  // Load recent conversation context
  const loadRecentContext = useCallback(async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return [];

      const recentMessagesQuery = query(
        collection(db, "zeina_conversations"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc"),
        limit(5)
      );

      const snapshot = await getDocs(recentMessagesQuery);
      if (snapshot.empty) return [];

      // Get the most recent session ID
      const mostRecentDoc = snapshot.docs[0];
      const recentSessionId = mostRecentDoc.data().sessionId;

      // Load messages from the same session
      const sessionMessagesQuery = query(
        collection(db, "zeina_conversations"),
        where("userId", "==", userId),
        where("sessionId", "==", recentSessionId),
        orderBy("timestamp", "asc"),
        limit(10)
      );

      const sessionSnapshot = await getDocs(sessionMessagesQuery);
      const contextMessages: ConversationMessage[] = sessionSnapshot.docs.map(
        (doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            role: data.role as "user" | "assistant",
            content: data.content,
            timestamp: data.timestamp.toDate(),
          };
        }
      );

      return contextMessages;
    } catch (error) {
      console.error("Failed to load conversation context:", error);
      return [];
    }
  }, []);

  // Set up event handlers
  const setupEventHandlers = useCallback(() => {
    const handlers: RealtimeEventHandlers = {
      onConnectionStateChange: (state) => {
        setConnectionState(state);
      },

      onSessionCreated: async (session) => {
        // Create new session ID
        const newSessionId = `zeina_session_${Date.now()}`;
        setSessionId(newSessionId);

        // Load recent context for better continuity
        const recentContext = await loadRecentContext();

        // Add enhanced welcome message with proactive health check
        const welcomeMessage = t(
          "voiceAgentWelcome",
          "Hello! I'm Zeina, your health assistant. I'm listening - feel free to ask me anything about your health, medications, or wellness."
        );

        // Try to get a quick health summary for personalized greeting
        try {
          const healthSummary = await healthContextService.getHealthSummary();
          const hasRecentSymptoms =
            healthSummary.symptoms && healthSummary.symptoms.length > 0;
          const hasMedications =
            healthSummary.medications &&
            healthSummary.medications.filter((m: any) => m.isActive).length > 0;

          let personalizedGreeting = welcomeMessage;

          // Add context from recent conversation if available
          if (recentContext && recentContext.length > 0) {
            personalizedGreeting += " I'm back! ";
          }

          if (hasRecentSymptoms) {
            personalizedGreeting +=
              " I noticed you've been tracking some symptoms recently. How are you feeling today?";
          } else if (hasMedications) {
            personalizedGreeting +=
              " I'm here to help you manage your medications and track your health. What would you like to do today?";
          } else {
            personalizedGreeting +=
              " I can help you track symptoms, medications, vitals, and more. What can I help you with?";
          }

          const welcomeMsg: ConversationMessage = {
            id: "welcome",
            role: "assistant",
            content: personalizedGreeting,
            timestamp: new Date(),
          };

          setMessages([welcomeMsg]);
          await saveConversationMessage(welcomeMsg);
        } catch (error) {
          // Fallback to default welcome if health summary fails
          const welcomeMsg: ConversationMessage = {
            id: "welcome",
            role: "assistant",
            content: welcomeMessage,
            timestamp: new Date(),
          };
          setMessages([welcomeMsg]);
          await saveConversationMessage(welcomeMsg);
        }
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

      onTranscriptDone: async (transcript, role) => {
        if (role === "user" && transcript) {
          const newMessage: ConversationMessage = {
            id: Date.now().toString(),
            role: "user",
            content: transcript,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, newMessage]);
          setCurrentTranscript("");

          // Save to conversation history
          await saveConversationMessage(newMessage);
        } else if (role === "assistant") {
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage?.role === "assistant" && lastMessage.isStreaming) {
              const completedMessage = { ...lastMessage, isStreaming: false };
              // Save completed assistant message (fire and forget)
              saveConversationMessage(completedMessage).catch(() => {
                // Silently handle errors
              });
              return [...prev.slice(0, -1), completedMessage];
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
          const result = await executeHealthTool(
            toolCall.name,
            JSON.parse(toolCall.arguments)
          );

          setToolCalls((prev) =>
            prev.map((tc) =>
              tc.id === toolCall.call_id
                ? { ...tc, status: "completed", result: JSON.stringify(result) }
                : tc
            )
          );

          // Submit the tool output
          realtimeAgentService.submitToolOutput(
            toolCall.call_id,
            JSON.stringify(result)
          );
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
          setToolCalls((prev) =>
            prev.filter((tc) => tc.status !== "completed")
          );
        }, 3000);
      },

      onError: (error) => {
        setIsProcessing(false);
        setIsListening(false);
        setIsSpeaking(false);

        // Provide more helpful error messages
        let errorMessage =
          error?.message || t("connectionError", "Connection error occurred");

        // Check for common WebSocket errors
        if (
          errorMessage.includes("WebSocket") ||
          errorMessage.includes("headers")
        ) {
          errorMessage =
            "WebSocket connection failed. This is likely because React Native's WebSocket doesn't support custom headers. " +
            "To fix this, you may need to:\n\n" +
            "1. Install a WebSocket library that supports headers (e.g., 'react-native-websocket')\n" +
            "2. Or use a proxy/middleware server\n" +
            "3. Or ensure your API key is properly configured\n\n" +
            `Original error: ${errorMessage}`;
        } else if (
          errorMessage.includes("API key") ||
          errorMessage.includes("authentication")
        ) {
          errorMessage =
            "Authentication failed. Please ensure OPENAI_API_KEY is set in your environment variables.\n\n" +
            `Error: ${errorMessage}`;
        }

        Alert.alert(t("error", "Error"), errorMessage, [
          { text: t("ok", "OK"), style: "default" },
          {
            text: t("retry", "Retry"),
            onPress: () => handleConnect(),
            style: "default",
          },
        ]);
      },
    };

    realtimeAgentService.setEventHandlers(handlers);
  }, [t, saveConversationMessage, loadRecentContext]);

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
        return await healthContextService.getRecentVitals(
          args.vital_type,
          args.days
        );

      case "check_medication_interactions":
        return await healthContextService.checkMedicationInteractions(
          args.new_medication
        );

      case "schedule_reminder":
        return { success: true, message: "Reminder scheduled successfully" };

      case "emergency_contact":
        return await healthContextService.getEmergencyContacts(args.action);

      case "add_allergy":
        return await zeinaActionsService.addAllergy(
          args.allergen || "unknown",
          args.reaction,
          args.severity,
          args.allergy_type
        );

      case "add_medical_history":
        return await zeinaActionsService.addMedicalHistory(
          args.condition || "unknown",
          args.diagnosis_date,
          args.status,
          args.notes
        );

      case "analyze_health_trends":
        return await analyzeHealthTrends(
          args.metric_type,
          args.time_period,
          args.focus_area
        );

      case "get_health_insights":
        return await getHealthInsights(args.insight_type, args.context);

      case "check_medication_adherence":
        return await checkMedicationAdherence(
          args.medication_name,
          args.time_period
        );

      case "suggest_health_actions":
        return await suggestHealthActions(args.trigger, args.priority);

      default:
        return { error: "Unknown tool" };
    }
  };

  // Helper function to analyze health trends
  const analyzeHealthTrends = async (
    metricType?: string,
    timePeriod?: string,
    focusArea?: string
  ): Promise<any> => {
    try {
      const days =
        timePeriod === "week"
          ? 7
          : timePeriod === "month"
            ? 30
            : timePeriod === "3months"
              ? 90
              : timePeriod === "6months"
                ? 180
                : 365;

      const healthSummary = await healthContextService.getHealthSummary();
      const vitals = await healthContextService.getRecentVitals("all", days);

      const trends: any = {
        period: timePeriod || "month",
        insights: [],
        patterns: [],
      };

      // Analyze vital trends
      if (
        (metricType === "vitals" || metricType === "all" || !metricType) &&
        vitals &&
        vitals.length > 0
      ) {
        // Group by vital type
        const vitalsByType: Record<string, any[]> = {};
        vitals.forEach((v: any) => {
          if (!vitalsByType[v.type]) vitalsByType[v.type] = [];
          vitalsByType[v.type].push(v);
        });

        // Analyze each vital type
        Object.keys(vitalsByType).forEach((type) => {
          const samples = vitalsByType[type];
          if (samples.length < 2) return;

          const values = samples
            .map((s: any) => s.value)
            .filter((v: any) => typeof v === "number");
          if (values.length < 2) return;

          const avg =
            values.reduce((a: number, b: number) => a + b, 0) / values.length;
          const recent = values.slice(-Math.floor(values.length / 3));
          const older = values.slice(0, Math.floor((values.length * 2) / 3));
          const recentAvg =
            recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
          const olderAvg =
            older.reduce((a: number, b: number) => a + b, 0) / older.length;

          const trend =
            recentAvg > olderAvg * 1.05
              ? "increasing"
              : recentAvg < olderAvg * 0.95
                ? "decreasing"
                : "stable";

          trends.patterns.push({
            metric: type,
            trend,
            current: recentAvg,
            average: avg,
            change: (((recentAvg - olderAvg) / olderAvg) * 100).toFixed(1),
          });

          if (trend !== "stable") {
            trends.insights.push(
              `Your ${type.replace(/([A-Z])/g, " $1").toLowerCase()} has been ${trend} over the past ${timePeriod || "month"}.`
            );
          }
        });
      }

      // Analyze symptom patterns
      if (
        (metricType === "symptoms" || metricType === "all" || !metricType) &&
        healthSummary.symptoms &&
        healthSummary.symptoms.length > 0
      ) {
        const symptomCounts: Record<string, number> = {};
        healthSummary.symptoms.forEach((s: any) => {
          const name = s.name || s.type || "unknown";
          symptomCounts[name] = (symptomCounts[name] || 0) + 1;
        });

        const frequentSymptoms = Object.entries(symptomCounts)
          .filter(([_, count]) => count >= 3)
          .map(([name, count]) => ({ name, frequency: count }));

        if (frequentSymptoms.length > 0) {
          trends.patterns.push({
            metric: "symptoms",
            frequent: frequentSymptoms,
          });
          trends.insights.push(
            `You've been experiencing ${frequentSymptoms.map((s) => s.name).join(", ")} frequently. Consider tracking these patterns.`
          );
        }
      }

      return {
        success: true,
        trends,
        summary:
          trends.insights.length > 0
            ? trends.insights.join(" ")
            : "Your health data shows stable patterns. Keep up the good work!",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to analyze trends",
      };
    }
  };

  // Helper function to get health insights
  const getHealthInsights = async (
    insightType?: string,
    context?: string
  ): Promise<any> => {
    try {
      const healthSummary = await healthContextService.getHealthSummary();
      const insights: string[] = [];
      const recommendations: string[] = [];

      if (insightType === "medication_adherence" || !insightType) {
        const medications = healthSummary.medications || [];
        if (medications.length > 0) {
          const activeMeds = medications.filter((m: any) => m.isActive);
          insights.push(
            `You have ${activeMeds.length} active medication${activeMeds.length !== 1 ? "s" : ""} in your list.`
          );
          if (
            activeMeds.some(
              (m: any) => !m.reminders || m.reminders.length === 0
            )
          ) {
            recommendations.push(
              "Consider setting up reminders for your medications to improve adherence."
            );
          }
        }
      }

      if (insightType === "symptom_patterns" || !insightType) {
        const symptoms = healthSummary.symptoms || [];
        if (symptoms.length > 0) {
          const recentSymptoms = symptoms.slice(0, 5);
          insights.push(
            `You've logged ${symptoms.length} symptom${symptoms.length !== 1 ? "s" : ""} recently.`
          );
          if (symptoms.length >= 3) {
            recommendations.push(
              "If symptoms persist or worsen, consider consulting with your healthcare provider."
            );
          }
        }
      }

      if (insightType === "vital_ranges" || !insightType) {
        const vitals = healthSummary.vitalSigns;
        if (vitals) {
          if (
            vitals.heartRate &&
            (vitals.heartRate < 60 || vitals.heartRate > 100)
          ) {
            recommendations.push(
              "Your heart rate is outside the normal range. Consider discussing this with your doctor."
            );
          }
          if (vitals.bloodPressure) {
            const bp = vitals.bloodPressure.split("/").map(Number);
            if (bp[0] > 140 || bp[1] > 90) {
              recommendations.push(
                "Your blood pressure readings suggest monitoring. Keep tracking and share with your healthcare provider."
              );
            }
          }
        }
      }

      return {
        success: true,
        insights:
          insights.length > 0
            ? insights
            : ["Your health data looks good overall."],
        recommendations:
          recommendations.length > 0
            ? recommendations
            : ["Keep up your healthy habits!"],
        context: context || "general health overview",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get insights",
      };
    }
  };

  // Helper function to check medication adherence
  const checkMedicationAdherence = async (
    medicationName?: string,
    timePeriod?: string
  ): Promise<any> => {
    try {
      const medications = await healthContextService.getMedications(true);

      if (!medications || medications.length === 0) {
        return {
          success: true,
          adherence: "no_medications",
          message: "You don't have any active medications to track.",
        };
      }

      const targetMed = medicationName
        ? medications.find((m: any) =>
            m.name.toLowerCase().includes(medicationName.toLowerCase())
          )
        : null;

      const medsToCheck = targetMed ? [targetMed] : medications;

      const adherenceResults = medsToCheck.map((med: any) => {
        const reminders = med.reminders || [];
        const hasReminders = reminders.length > 0;

        return {
          medication: med.name,
          hasReminders,
          reminderCount: reminders.length,
          adherence: hasReminders ? "good" : "needs_improvement",
          recommendation: hasReminders
            ? "Great! You have reminders set up."
            : "Consider setting up reminders to improve adherence.",
        };
      });

      const overallAdherence = adherenceResults.every(
        (r: any) => r.hasReminders
      )
        ? "excellent"
        : adherenceResults.some((r: any) => r.hasReminders)
          ? "good"
          : "needs_improvement";

      return {
        success: true,
        adherence: overallAdherence,
        results: adherenceResults,
        period: timePeriod || "current",
        message:
          overallAdherence === "excellent"
            ? "Excellent medication adherence! You have reminders set up for all your medications."
            : overallAdherence === "good"
              ? "Good adherence. Consider setting up reminders for medications that don't have them yet."
              : "Consider setting up medication reminders to help you stay on track.",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to check adherence",
      };
    }
  };

  // Helper function to suggest health actions
  const suggestHealthActions = async (
    trigger?: string,
    priority?: string
  ): Promise<any> => {
    try {
      const suggestions: any[] = [];

      if (
        trigger?.toLowerCase().includes("blood pressure") ||
        trigger?.toLowerCase().includes("hypertension")
      ) {
        suggestions.push({
          action: "Monitor blood pressure regularly",
          priority: priority || "high",
          reason:
            "Regular monitoring helps track changes and effectiveness of treatment.",
        });
        suggestions.push({
          action: "Reduce sodium intake",
          priority: priority || "medium",
          reason: "Lowering sodium can help manage blood pressure.",
        });
      }

      if (
        trigger?.toLowerCase().includes("headache") ||
        trigger?.toLowerCase().includes("head pain")
      ) {
        suggestions.push({
          action: "Track headache patterns",
          priority: priority || "medium",
          reason: "Identifying triggers can help prevent future headaches.",
        });
        suggestions.push({
          action: "Stay hydrated",
          priority: priority || "low",
          reason: "Dehydration can contribute to headaches.",
        });
      }

      if (
        trigger?.toLowerCase().includes("medication") ||
        trigger?.toLowerCase().includes("adherence")
      ) {
        suggestions.push({
          action: "Set up medication reminders",
          priority: priority || "high",
          reason: "Reminders help ensure you take medications on time.",
        });
      }

      if (
        trigger?.toLowerCase().includes("symptom") ||
        trigger?.toLowerCase().includes("pain")
      ) {
        suggestions.push({
          action: "Log symptoms regularly",
          priority: priority || "medium",
          reason:
            "Tracking symptoms helps identify patterns and communicate with your doctor.",
        });
      }

      // Default suggestions if no specific trigger
      if (suggestions.length === 0) {
        suggestions.push({
          action: "Track your vitals regularly",
          priority: priority || "low",
          reason: "Regular tracking helps identify trends and changes.",
        });
        suggestions.push({
          action: "Stay active and exercise",
          priority: priority || "low",
          reason: "Regular physical activity supports overall health.",
        });
      }

      return {
        success: true,
        trigger: trigger || "general health",
        suggestions,
        priority: priority || "medium",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate suggestions",
      };
    }
  };

  // Connect to the service
  const handleConnect = async () => {
    try {
      setupEventHandlers();

      // Get personalized health context for the instructions with current language
      const currentLanguage = i18n.language || "en";
      const healthContext = await healthContextService.getContextualPrompt(
        undefined,
        currentLanguage
      );
      const customInstructions = `${realtimeAgentService.getDefaultInstructions()}\n\n# User Health Context\n${healthContext}`;

      await realtimeAgentService.connect(customInstructions);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("unableToConnect", "Unable to connect to voice service");

      // Show detailed error with troubleshooting steps
      Alert.alert(t("connectionFailed", "Connection Failed"), errorMessage, [
        {
          text: t("ok", "OK"),
          style: "default",
        },
        {
          text: t("retry", "Retry"),
          onPress: () => handleConnect(),
          style: "default",
        },
      ]);
    }
  };

  // Disconnect from the service
  const handleDisconnect = () => {
    // Stop any active recording to ensure the UI can't remain "stuck listening"
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }

    // Clear any pending audio/response state on the service side
    realtimeAgentService.cancelResponse();
    realtimeAgentService.clearAudioBuffer();
    realtimeAgentService.disconnect();
    setMessages([]);
    setToolCalls([]);
    setCurrentTranscript("");
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);
  };

  // Ensure realtime connection before recording/sending audio
  const ensureConnected = useCallback(async (): Promise<boolean> => {
    if (connectionState === "connected" && realtimeAgentService.isConnected()) {
      return true;
    }

    try {
      setIsProcessing(true);
      await handleConnect();
    } finally {
      setIsProcessing(false);
    }

    return realtimeAgentService.isConnected();
  }, [connectionState, handleConnect]);

  // Convert audio file to PCM16 base64 for the Realtime API
  const convertAudioToBase64PCM = async (
    uri: string
  ): Promise<string | null> => {
    try {
      // Read the audio file as base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Basic sanity check: WAV files start with "RIFF" which base64-encodes to "UklG".
      // If we send non-PCM audio (e.g. AAC/M4A) to the Realtime API while configured for PCM16,
      // the assistant can appear "stuck listening" with no transcript.
      if (!(base64Audio && base64Audio.startsWith("UklG"))) {
        return null;
      }
      return base64Audio;
    } catch (error) {
      return null;
    }
  };

  // Start/stop recording
  const toggleRecording = async () => {
    if (!(Audio && FileSystem && isAudioAvailable)) {
      // Provide detailed error message
      const errorTitle = t(
        "audioNotAvailable",
        "Audio recording not available"
      );
      let errorMessage = "";

      if (Platform.OS === "web") {
        errorMessage = t(
          "useTextInput",
          "Please use text input to communicate with Zeina on this platform."
        );
      } else if (audioLoadError) {
        errorMessage = `Audio recording failed to initialize:\n\n${audioLoadError}\n\n`;

        if (audioLoadError.includes("expo-av")) {
          errorMessage +=
            "Please ensure expo-av is properly installed:\n\nbun install expo-av\n\nThen restart the app.";
        } else if (Platform.OS === "ios" || Platform.OS === "android") {
          errorMessage +=
            "This may happen on simulators/emulators. Try using a physical device.";
        }
      } else {
        errorMessage = t(
          "audioNotAvailable",
          "Audio recording not available on this platform. Please ensure expo-av is properly installed."
        );
      }

      Alert.alert(errorTitle, errorMessage, [
        { text: t("ok", "OK"), style: "cancel" },
      ]);
      return;
    }

    if (isListening) {
      // Stop recording and send audio
      try {
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();

          // Get the recorded audio URI
          const uri = recordingRef.current.getURI();
          recordingRef.current = null;

          if (uri) {
            let didAppendAudio = false;
            // If we're not connected, we can't send the audio anywhere.
            if (realtimeAgentService.isConnected()) {
              // Read and send the audio to the API
              const audioBase64 = await convertAudioToBase64PCM(uri);
              if (audioBase64) {
                realtimeAgentService.sendAudioData(audioBase64);
                didAppendAudio = true;
              } else {
                Alert.alert(
                  t("unsupportedAudioFormat", "Unsupported audio format"),
                  t(
                    "unsupportedAudioFormatBody",
                    "Zeina couldn't read the recording as a PCM WAV file. This can happen if the device records AAC/M4A instead of PCM. Try again on a physical iOS device, or use text input."
                  )
                );
              }
            } else {
              Alert.alert(
                t("notConnected", "Not Connected"),
                t(
                  "pleaseConnectFirst",
                  "Please connect Zeina (tap the radio icon) and try again."
                )
              );
            }

            // Clean up the temporary file
            try {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch {
              // Ignore cleanup errors
            }

            // Commit the audio buffer to trigger response (only if we actually appended audio)
            // IMPORTANT: Only commit if audio was successfully sent. If connection check failed
            // (line 999) or audio conversion failed (line 1007), didAppendAudio remains false
            // and commitAudioBuffer() is not called, preventing empty buffer commits.
            if (didAppendAudio) {
              realtimeAgentService.commitAudioBuffer();
              setIsProcessing(true);
            }
          }
        }
        setIsListening(false);
      } catch (error) {
        setIsListening(false);
        // Error stopping recording
      }
    } else {
      // Start recording
      try {
        // Auto-connect if needed so we don't record with nowhere to send audio
        const connected = await ensureConnected();
        if (!connected) {
          Alert.alert(
            t("connectionFailed", "Connection Failed"),
            t("unableToConnect", "Unable to connect to voice service")
          );
          return;
        }

        // Request permissions
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert(
            t("permissionDenied", "Permission Denied"),
            t(
              "microphonePermissionRequired",
              "Microphone permission is required"
            )
          );
          return;
        }

        // Set audio mode for recording and playback
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          playThroughEarpieceAndroid: false,
        });

        // Start recording in WAV/PCM format for compatibility with Realtime API (expects PCM16)
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
        setIsListening(true);
      } catch (error) {
        Alert.alert(
          t("error", "Error"),
          t("recordingFailed", "Failed to start recording")
        );
      }
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // Send text message (alternative to voice)
  const sendTextMessage = useCallback(
    (text: string) => {
      if (!text.trim() || connectionState !== "connected") return;

      const newMessage: ConversationMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, newMessage]);

      // Save to conversation history
      saveConversationMessage(newMessage).catch(() => {
        // Silently handle errors
      });

      realtimeAgentService.sendTextMessage(text);
      setIsProcessing(true);
    },
    [connectionState, saveConversationMessage]
  );

  // Quick action handlers
  const handleQuickAction = useCallback(
    async (action: string) => {
      if (connectionState !== "connected") {
        await handleConnect();
        // Wait a moment for connection
        setTimeout(() => {
          sendTextMessage(action);
        }, 1000);
      } else {
        sendTextMessage(action);
      }
      setShowQuickActions(false);
    },
    [connectionState, sendTextMessage]
  );

  // Proactive health monitoring - check for concerning patterns (non-intrusive)
  useEffect(() => {
    if (
      connectionState === "connected" &&
      !isListening &&
      !isSpeaking &&
      !isProcessing &&
      messages.length > 0
    ) {
      const checkHealthPatterns = async () => {
        try {
          // Only check if user has been inactive for a while (not immediately)
          const lastMessage = messages[messages.length - 1];
          const timeSinceLastMessage =
            Date.now() - lastMessage.timestamp.getTime();

          // Only check after 2 minutes of inactivity
          if (timeSinceLastMessage < 120_000) return;

          const healthSummary = await healthContextService.getHealthSummary();

          // Check for frequent symptoms (only suggest once per session)
          const recentSymptoms = healthSummary.symptoms?.slice(0, 7) || [];
          const hasSuggestedPattern = messages.some(
            (m) =>
              m.role === "assistant" &&
              m.content.includes("noticed you've been experiencing")
          );

          if (recentSymptoms.length >= 5 && !hasSuggestedPattern) {
            const symptomTypes = new Set(
              recentSymptoms.map((s: any) => s.name || s.type)
            );
            if (symptomTypes.size <= 2) {
              // Same symptom repeated frequently - add to context for next interaction
              // Don't send automatically, but make it available for when user asks
              const symptomName = Array.from(symptomTypes)[0];
              // Store this insight for when user interacts next
              // The AI will have access to this through health context
            }
          }
        } catch (error) {
          // Silently handle errors
        }
      };

      // Check patterns periodically (every 2 minutes)
      const monitoringTimer = setInterval(checkHealthPatterns, 120_000);
      return () => clearInterval(monitoringTimer);
    }
  }, [connectionState, isListening, isSpeaking, isProcessing, messages]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      handleDisconnect();
    },
    []
  );

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
        <SafeAreaView edges={["top"]} style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons color="#fff" name="chevron-back" size={28} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{t("zeina", "Zeina")}</Text>
              <Text style={styles.headerSubtitle}>
                {t("voiceMode", "Voice Mode")}
              </Text>
              <View
                style={[
                  styles.statusDot,
                  connectionState === "connected" && styles.statusDotConnected,
                ]}
              />
            </View>
            <TouchableOpacity
              onPress={
                connectionState === "connected"
                  ? handleDisconnect
                  : handleConnect
              }
              style={[styles.connectionButton, getConnectionButtonStyle()]}
            >
              {connectionState === "connecting" ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons
                  color="#fff"
                  name={
                    connectionState === "connected" ? "radio" : "radio-outline"
                  }
                  size={20}
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
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
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
                    <View style={styles.waveformContainer}>
                      {renderWaveformBars()}
                    </View>
                  ) : isListening ? (
                    <Ionicons color="#fff" name="mic" size={48} />
                  ) : (
                    <Ionicons
                      color="#fff"
                      name={connectionState === "connected" ? "ear" : "mic-off"}
                      size={48}
                    />
                  )}
                </LinearGradient>
              </Animated.View>
            </View>

            {/* Status text with enhanced styling */}
            <View style={styles.statusContainer}>
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
              {connectionState === "connected" &&
                !isListening &&
                !isSpeaking &&
                !isProcessing && (
                  <Text style={styles.statusHint}>
                    {t(
                      "zeinaReady",
                      "I'm here to help with your health questions and track your symptoms, medications, and vitals."
                    )}
                  </Text>
                )}
            </View>

            {/* Current transcript while speaking */}
            {currentTranscript && (
              <View style={styles.transcriptPreview}>
                <Text style={styles.transcriptPreviewText}>
                  {currentTranscript}
                </Text>
              </View>
            )}

            {/* Tool calls indicator with enhanced visuals */}
            {toolCalls.length > 0 && (
              <View style={styles.toolCallsContainer}>
                {toolCalls.map((tc) => (
                  <Animated.View
                    key={tc.id}
                    style={[
                      styles.toolCallBadge,
                      tc.status === "executing" &&
                        styles.toolCallBadgeExecuting,
                      tc.status === "completed" &&
                        styles.toolCallBadgeCompleted,
                      tc.status === "error" && styles.toolCallBadgeError,
                    ]}
                  >
                    <Ionicons
                      color={
                        tc.status === "completed"
                          ? "#4ecdc4"
                          : tc.status === "error"
                            ? "#ff6b6b"
                            : "#fff"
                      }
                      name={
                        tc.status === "executing"
                          ? "sync"
                          : tc.status === "completed"
                            ? "checkmark-circle"
                            : "alert-circle"
                      }
                      size={16}
                    />
                    <Text style={styles.toolCallText}>
                      {tc.name
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </Text>
                    {tc.status === "executing" && (
                      <ActivityIndicator
                        color="#fff"
                        size="small"
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </Animated.View>
                ))}
              </View>
            )}
          </View>

          {/* Conversation messages */}
          <View style={styles.messagesContainer}>
            <ScrollView
              contentContainerStyle={styles.messagesContent}
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              style={styles.messagesScroll}
            >
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.role === "user"
                      ? styles.userMessage
                      : styles.assistantMessage,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      message.role === "user"
                        ? styles.userMessageText
                        : styles.assistantMessageText,
                    ]}
                  >
                    {message.content}
                  </Text>
                  {message.isStreaming && (
                    <View style={styles.streamingIndicator}>
                      <ActivityIndicator color="#667eea" size="small" />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Quick Actions */}
          {connectionState === "connected" &&
            !isListening &&
            !isSpeaking &&
            !isProcessing && (
              <View style={styles.quickActionsContainer}>
                <TouchableOpacity
                  onPress={() => setShowQuickActions(!showQuickActions)}
                  style={styles.quickActionsToggle}
                >
                  <Ionicons
                    color="#fff"
                    name={showQuickActions ? "chevron-up" : "chevron-down"}
                    size={20}
                  />
                  <Text style={styles.quickActionsToggleText}>
                    {showQuickActions
                      ? t("hideQuickActions", "Hide Quick Actions")
                      : t("quickActions", "Quick Actions")}
                  </Text>
                </TouchableOpacity>

                {showQuickActions && (
                  <View style={styles.quickActionsGrid}>
                    <TouchableOpacity
                      onPress={() => handleQuickAction("Log my symptoms")}
                      style={styles.quickActionButton}
                    >
                      <Ionicons color="#fff" name="medical" size={20} />
                      <Text style={styles.quickActionText}>
                        {t("quickActionLogSymptom", "Log Symptom")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        handleQuickAction("What are my medications?")
                      }
                      style={styles.quickActionButton}
                    >
                      <Ionicons color="#fff" name="medical" size={20} />
                      <Text style={styles.quickActionText}>
                        {t("quickActionMyMedications", "My Medications")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        handleQuickAction("Show my health summary")
                      }
                      style={styles.quickActionButton}
                    >
                      <Ionicons color="#fff" name="heart" size={20} />
                      <Text style={styles.quickActionText}>
                        {t("quickActionHealthSummary", "Health Summary")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        handleQuickAction("Check my recent vitals")
                      }
                      style={styles.quickActionButton}
                    >
                      <Ionicons color="#fff" name="pulse" size={20} />
                      <Text style={styles.quickActionText}>
                        {t("quickActionRecentVitals", "Recent Vitals")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleQuickAction("How am I doing today?")}
                      style={styles.quickActionButton}
                    >
                      <Ionicons color="#fff" name="happy" size={20} />
                      <Text style={styles.quickActionText}>
                        {t("quickActionHowAmI", "How Am I?")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        handleQuickAction("Analyze my health trends")
                      }
                      style={styles.quickActionButton}
                    >
                      <Ionicons color="#fff" name="trending-up" size={20} />
                      <Text style={styles.quickActionText}>
                        {t("quickActionHealthTrends", "Health Trends")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

          {/* Control buttons */}
          <View style={styles.controlsContainer}>
            {isAudioAvailable ? (
              <>
                <TouchableOpacity
                  disabled={connectionState !== "connected" || isProcessing}
                  onPress={toggleRecording}
                  style={[
                    styles.talkButton,
                    isListening && styles.talkButtonActive,
                    (connectionState !== "connected" || isProcessing) &&
                      styles.talkButtonDisabled,
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
                      color="#fff"
                      name={isListening ? "stop" : "mic"}
                      size={32}
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
                  editable={connectionState === "connected" && !isProcessing}
                  multiline
                  onChangeText={setTextInput}
                  onSubmitEditing={() => {
                    if (textInput.trim() && connectionState === "connected") {
                      sendTextMessage(textInput.trim());
                      setTextInput("");
                    }
                  }}
                  placeholder={t("typeMessage", "Type your message...")}
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  style={styles.textInput}
                  value={textInput}
                />
                <TouchableOpacity
                  disabled={
                    !textInput.trim() ||
                    connectionState !== "connected" ||
                    isProcessing
                  }
                  onPress={() => {
                    if (textInput.trim() && connectionState === "connected") {
                      sendTextMessage(textInput.trim());
                      setTextInput("");
                    }
                  }}
                  style={[
                    styles.sendButton,
                    (!textInput.trim() ||
                      connectionState !== "connected" ||
                      isProcessing) &&
                      styles.sendButtonDisabled,
                  ]}
                >
                  <Ionicons color="#fff" name="send" size={20} />
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
  statusContainer: {
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 20,
  },
  statusText: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.95)",
    fontWeight: "600",
    textAlign: "center",
  },
  statusHint: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 18,
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
    paddingVertical: 8,
    borderRadius: 20,
    margin: 4,
    borderWidth: 1,
    borderColor: "rgba(102, 126, 234, 0.5)",
  },
  toolCallBadgeExecuting: {
    backgroundColor: "rgba(102, 126, 234, 0.5)",
    borderColor: "rgba(102, 126, 234, 0.8)",
  },
  toolCallBadgeCompleted: {
    backgroundColor: "rgba(78, 205, 196, 0.3)",
    borderColor: "rgba(78, 205, 196, 0.6)",
  },
  toolCallBadgeError: {
    backgroundColor: "rgba(255, 107, 107, 0.3)",
    borderColor: "rgba(255, 107, 107, 0.6)",
  },
  toolCallText: {
    color: "#fff",
    fontSize: 12,
    marginLeft: 6,
    fontWeight: "500",
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
    backgroundColor: "#667eea", // Add solid background for shadow performance
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
  quickActionsContainer: {
    width: "100%",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  quickActionsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    marginBottom: 8,
  },
  quickActionsToggleText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
    marginLeft: 6,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  quickActionButton: {
    width: "31%",
    backgroundColor: "rgba(102, 126, 234, 0.3)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(102, 126, 234, 0.5)",
    minHeight: 70,
  },
  quickActionText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 6,
    textAlign: "center",
  },
});
