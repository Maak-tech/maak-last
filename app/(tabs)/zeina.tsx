/**
 * Zeina - AI Health Assistant Chat
 *
 * A text-based chat interface for health assistance powered by OpenAI.
 */

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useLocalSearchParams } from "expo-router";
import {
  AlertTriangle,
  Mic,
  MicOff,
  Send,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useTheme } from "@/contexts/ThemeContext";
import { safeFormatTime } from "@/utils/dateFormat";
import healthContextService from "../../lib/services/healthContextService";
import openaiService, {
  AI_MODELS,
  type ChatMessage as AIMessage,
} from "../../lib/services/openaiService";
import { voiceService } from "../../lib/services/voiceService";
import { autoLogHealthSignalsFromText } from "../../lib/services/zeinaChatAutoLogService";
import CoachMark from "../components/CoachMark";

/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Screen orchestrates chat, voice IO, onboarding tips, and settings in one component. */
export default function ZeinaScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ tour?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const inputFieldRef = useRef<View>(null);
  const isMountedRef = useRef(true);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [_selectedModel, setSelectedModel] = useState("gpt-3.5-turbo");
  const [tempModel, setTempModel] = useState("gpt-3.5-turbo");
  const [_systemPrompt, setSystemPrompt] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [autoSpeak, _setAutoSpeak] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognitionAvailable, setRecognitionAvailable] = useState(false);
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState("en-US");
  const [showHowTo, setShowHowTo] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width, height } = useWindowDimensions();
  const isIphone16Pro =
    Math.round(Math.min(width, height)) === 393 &&
    Math.round(Math.max(width, height)) === 852;
  const contentPadding = isIphone16Pro ? 24 : theme.spacing.lg;
  const headerPadding = isIphone16Pro ? 28 : theme.spacing.xl;
  const isRTL = i18n.language.toLowerCase().startsWith("ar");
  const quickActions = isRTL
    ? [
        { label: "تذكيرات الدواء", prompt: "تذكيرات الدواء" },
        { label: "ملخص الصحة الأسبوعي", prompt: "ملخص الصحة الأسبوعي" },
        { label: "جدولة موعد", prompt: "جدولة موعد" },
        { label: "جهات اتصال الطوارئ", prompt: "جهات اتصال الطوارئ" },
      ]
    : [
        { label: "Medication reminders", prompt: "Medication reminders" },
        { label: "Weekly health summary", prompt: "Weekly health summary" },
        { label: "Schedule appointment", prompt: "Schedule appointment" },
        { label: "Emergency contacts", prompt: "Emergency contacts" },
      ];

  const formatMessageTime = (timestamp?: Date) => {
    if (!timestamp) {
      return "";
    }
    return safeFormatTime(timestamp) ?? "";
  };

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    if (params.tour === "1") {
      setShowHowTo(true);
    }
  }, [params.tour]);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: Initialization side effects are intended to run once on mount. */
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      initializeChat();
      checkVoiceAvailability();
      checkRecognitionAvailability();
    });

    // Initialize voice settings from local storage
    const loadVoiceSettings = async () => {
      try {
        const savedVoiceOutput = await AsyncStorage.getItem(
          "voice_output_enabled"
        );
        const savedVoiceInput = await AsyncStorage.getItem(
          "voice_input_enabled"
        );
        const savedVoiceLanguage = await AsyncStorage.getItem("voice_language");

        if (savedVoiceOutput !== null) {
          setVoiceOutputEnabled(JSON.parse(savedVoiceOutput));
        }
        if (savedVoiceInput !== null) {
          setVoiceInputEnabled(JSON.parse(savedVoiceInput));
        }
        if (savedVoiceLanguage) {
          setVoiceLanguage(savedVoiceLanguage);
        }
      } catch (_error) {
        // Use defaults
      }
    };

    loadVoiceSettings();

    return () => {
      task.cancel?.();
    };
  }, []);

  const checkRecognitionAvailability = async () => {
    try {
      const available = await voiceService.isRecognitionAvailable();
      if (isMountedRef.current) {
        setRecognitionAvailable(available);
      }
    } catch (_error) {
      if (isMountedRef.current) {
        setRecognitionAvailable(false);
      }
    }
  };

  const checkVoiceAvailability = async () => {
    try {
      const available = await voiceService.isAvailable();
      if (isMountedRef.current) {
        setVoiceEnabled(available);
      }
    } catch (_error) {
      if (isMountedRef.current) {
        setVoiceEnabled(false);
      }
    }
  };

  const handleVoiceInput = async () => {
    if (isListening) {
      await voiceService.stopListening();
      setIsListening(false);
      return;
    }

    if (!recognitionAvailable) {
      Alert.alert(
        t("speechError", "Speech Error"),
        t(
          "voiceInputNotAvailable",
          "Voice input is not available on this device"
        )
      );
      return;
    }

    try {
      setIsListening(true);
      await voiceService.startListening(
        async (result) => {
          setIsListening(false);
          if (result.text?.trim()) {
            setInputText(result.text);
            // Automatically send the voice input
            await handleSend(result.text);
          }
        },
        (error) => {
          setIsListening(false);
          Alert.alert(
            t("speechError", "Speech Error"),
            error.message ||
              t("failedToRecognizeSpeech", "Failed to recognize speech")
          );
        },
        voiceLanguage
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : t("failedToStartVoiceInput", "Failed to start voice input");
      setIsListening(false);
      Alert.alert(t("speechError", "Speech Error"), message);
    }
  };

  const handleVoiceOutput = async (text: string) => {
    if (!(voiceEnabled && voiceOutputEnabled)) {
      return;
    }

    try {
      setIsSpeaking(true);
      await voiceService.speak(text, {
        language: voiceLanguage,
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0,
      });
    } catch (_error) {
      // Silently fail if TTS is not available
    } finally {
      setIsSpeaking(false);
    }
  };

  const _toggleVoiceOutput = () => {
    if (!voiceEnabled) {
      Alert.alert(
        t("voiceNotAvailable", "Voice Not Available"),
        t(
          "voiceOutputNotSupported",
          "Voice output is not supported on this device"
        )
      );
      return;
    }
    setVoiceOutputEnabled(!voiceOutputEnabled);
  };

  /* biome-ignore lint/correctness/useExhaustiveDependencies: Scroll should happen when messages update. */
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeChat = async () => {
    try {
      if (isMountedRef.current) {
        setIsLoading(true);
      }
      // Initialize OpenAI service (uses env key)
      await openaiService.initialize();
      if (!isMountedRef.current) {
        return;
      }
      const model = await openaiService.getModel();
      if (!isMountedRef.current) {
        return;
      }
      setSelectedModel(model);
      setTempModel(model);

      // Load health context
      const prompt = await healthContextService.getContextualPrompt();
      if (!isMountedRef.current) {
        return;
      }
      setSystemPrompt(prompt);

      // Add system message
      const systemMessage: AIMessage = {
        id: Date.now().toString(),
        role: "system",
        content: prompt,
        timestamp: new Date(),
      };

      // Add welcome message
      const welcomeMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: t(
          "zeinaWelcome",
          "Hello! I'm Zeina, your personal health AI assistant. I have access to your health profile, medications, symptoms, and family information. How can I help you today?"
        ),
        timestamp: new Date(),
      };

      setMessages([systemMessage, welcomeMessage]);

      if (isMountedRef.current) {
        setIsLoading(false);
      }
    } catch (_error) {
      // Silently handle error
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const scrollToBottom = () => {
    // Use requestAnimationFrame for smoother scrolling
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleSend = async (textOverride?: string | unknown) => {
    const textToSend =
      typeof textOverride === "string" ? textOverride : inputText;
    if (!textToSend.trim() || isStreaming) {
      return;
    }
    try {
      const access = await openaiService.getAccessStatus();
      if (!access.configured) {
        const message = t(
          "zeinaConfigurationError",
          "AI service is not configured. Please set Firebase Functions secret OPENAI_API_KEY and redeploy functions."
        );
        Alert.alert(t("error", "Error"), message);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: t(
              "zeinaConfigurationHelp",
              "I'm not fully configured on this build yet. Please ask an admin to configure the server AI key and try again."
            ),
            timestamp: new Date(),
          },
        ]);
        return;
      }
      if (!access.hasAccess) {
        const message = t(
          "zeinaSubscriptionRequired",
          "Zeina is available only for active Family Plan subscribers."
        );
        Alert.alert(t("subscription", "Subscription"), message);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: t(
              "zeinaSubscriptionHelp",
              "Please upgrade to the Family Plan to use Zeina."
            ),
            timestamp: new Date(),
          },
        ]);
        return;
      }
    } catch (error) {
      Alert.alert(
        t("error", "Error"),
        error instanceof Error ? error.message : String(error)
      );
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: t(
            "zeinaConfigurationHelp",
            "I'm not fully configured on this build yet. Please ask an admin to configure the server AI key and try again."
          ),
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsStreaming(true);

    autoLogHealthSignalsFromText(userMessage.content).catch(() => {
      // Non-blocking side effect; chat flow continues even if autolog fails.
    });

    const assistantMessage: AIMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    let fullResponse = "";
    let streamFinalized = false;
    let didTimeout = false;
    const setAssistantFallbackMessage = (content: string) => {
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex >= 0 && prev[lastIndex].id === assistantMessage.id) {
          const newMessages = [...prev];
          newMessages[lastIndex] = {
            ...prev[lastIndex],
            content,
          };
          return newMessages;
        }
        return prev;
      });
    };

    const finalizeStream = () => {
      if (streamFinalized) {
        return;
      }
      streamFinalized = true;
      setIsStreaming(false);
    };

    const streamTimeout = setTimeout(() => {
      if (streamFinalized) {
        return;
      }
      didTimeout = true;
      finalizeStream();
      if (!fullResponse.trim()) {
        setAssistantFallbackMessage(
          t(
            "zeinaTimeoutFallback",
            "I'm taking too long to respond right now. Please try again in a moment."
          )
        );
      }
      Alert.alert(
        t("error", "Error"),
        t(
          "zeinaTimeoutMessage",
          "Response took too long. Please try sending your message again."
        )
      );
    }, 30_000);

    try {
      await openaiService.createChatCompletionStream(
        messages.concat(userMessage),
        (chunk) => {
          fullResponse += chunk;
          // Batch state updates using functional update to avoid stale closures
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (lastIndex >= 0 && prev[lastIndex].id === assistantMessage.id) {
              // Update existing message
              const newMessages = [...prev];
              newMessages[lastIndex] = {
                ...prev[lastIndex],
                content: fullResponse,
              };
              return newMessages;
            }
            return prev;
          });
          // Throttle scroll updates for better performance
          scrollToBottom();
        },
        async () => {
          finalizeStream();

          // Speak the response if voice is enabled and auto-speak is on
          if (voiceOutputEnabled && autoSpeak) {
            await handleVoiceOutput(fullResponse);
          }
        },
        (error) => {
          finalizeStream();

          if (didTimeout) {
            return;
          }

          if (!fullResponse.trim()) {
            setAssistantFallbackMessage(
              t(
                "zeinaErrorFallback",
                "I couldn't complete your request right now. Please try again."
              )
            );
          }

          // More user-friendly error messages
          if (error.message.includes("quota exceeded")) {
            Alert.alert(
              t("quotaExceeded", "Quota Exceeded"),
              t(
                "openAIQuotaExceededMessage",
                "Your OpenAI account has exceeded its usage quota.\n\nOptions:\n1. Add billing to your OpenAI account\n2. Switch to GPT-3.5 Turbo (cheaper)\n3. Wait for your quota to reset\n\nVisit platform.openai.com to manage billing."
              )
            );
          } else {
            Alert.alert(
              t("error", "Error"),
              error.message ||
                t(
                  "failedToGetResponse",
                  "Failed to get response. Please try again."
                )
            );
          }
        }
      );
    } finally {
      clearTimeout(streamTimeout);
      finalizeStream();
    }
  };

  const handleSaveSettings = async () => {
    await openaiService.setModel(tempModel);

    // Save voice settings
    try {
      await AsyncStorage.setItem(
        "voice_output_enabled",
        JSON.stringify(voiceOutputEnabled)
      );
      await AsyncStorage.setItem(
        "voice_input_enabled",
        JSON.stringify(voiceInputEnabled)
      );
      await AsyncStorage.setItem("voice_language", voiceLanguage);
    } catch (_error) {
      // Silently handle storage error
    }

    setSelectedModel(tempModel);
    setShowSettings(false);
    Alert.alert(
      t("success", "Success"),
      t("settingsSavedSuccessfully", "Settings saved successfully!")
    );
  };

  const _handleNewChat = async () => {
    await initializeChat();
  };

  const _getVoiceOutputIcon = () => {
    if (isSpeaking) {
      return <VolumeX color="white" size={20} />;
    }

    if (voiceOutputEnabled) {
      return <Volume2 color="white" size={20} />;
    }

    return <VolumeX color="#666" size={20} />;
  };

  return (
    <GradientScreen edges={["top"]} style={styles.container}>
      <View style={styles.figmaOrbTop} />
      <View style={styles.figmaOrbBottom} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
        style={styles.figmaChatContainer}
      >
        <ScrollView
          contentContainerStyle={styles.figmaMessagesContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          style={styles.figmaMessagesContainer}
        >
          <View
            style={[
              styles.headerWrapper,
              {
                marginHorizontal: -contentPadding,
                marginTop: -theme.spacing.base,
                marginBottom: -40,
              },
            ]}
          >
            <WavyBackground curve="home" height={240} variant="teal">
              <View
                style={[
                  styles.figmaHeaderContent,
                  {
                    paddingHorizontal: headerPadding,
                    paddingTop: headerPadding,
                    paddingBottom: headerPadding,
                    minHeight: 230,
                  },
                ]}
              >
                <View style={styles.figmaHeaderRow}>
                  <View style={styles.figmaHeaderIcon}>
                    <Sparkles color="#FFFFFF" size={20} />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.figmaHeaderTitle,
                        { color: theme.colors.neutral.white },
                      ]}
                    >
                      {isRTL ? "زينة الذكية" : "Zeina AI"}
                    </Text>
                    <Text
                      style={[
                        styles.figmaHeaderSubtitle,
                        { color: "rgba(255, 255, 255, 0.85)" },
                      ]}
                    >
                      {isRTL
                        ? "مساعدك الصحي"
                        : t("zeinaSubtitle", "Your health assistant")}
                    </Text>
                  </View>
                </View>
              </View>
            </WavyBackground>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#007AFF" size="large" />
              <Text style={styles.loadingText}>
                {t("loadingHealthContext", "Loading your health context...")}
              </Text>
            </View>
          ) : (
            <>
              {messages
                .filter((m) => m.role !== "system")
                .map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <View
                      key={message.id}
                      style={[
                        styles.figmaMessageRow,
                        isUser && styles.figmaMessageRowUser,
                      ]}
                    >
                      <View
                        style={[
                          styles.figmaMessageBubble,
                          isUser
                            ? styles.figmaMessageBubbleUser
                            : styles.figmaMessageBubbleAssistant,
                        ]}
                      >
                        {!isUser && (
                          <View style={styles.figmaMessageHeader}>
                            <Sparkles color="#EB9C0C" size={14} />
                            <Text style={styles.figmaMessageSender}>
                              {isRTL ? "زينة" : "Zeina"}
                            </Text>
                          </View>
                        )}
                        <Text
                          style={[
                            styles.figmaMessageText,
                            isUser
                              ? styles.figmaMessageTextUser
                              : styles.figmaMessageTextAssistant,
                          ]}
                        >
                          {message.content}
                        </Text>
                        <Text
                          style={[
                            styles.figmaMessageTime,
                            isUser
                              ? styles.figmaMessageTimeUser
                              : styles.figmaMessageTimeAssistant,
                          ]}
                        >
                          {formatMessageTime(message.timestamp)}
                        </Text>
                      </View>
                    </View>
                  );
                })}

              <View style={styles.figmaQuickActionsSection}>
                <Text style={styles.figmaQuickActionsTitle}>
                  {isRTL ? "إجراءات سريعة" : "Quick actions"}
                </Text>
                <View style={styles.figmaQuickActionsGrid}>
                  {quickActions.map((action) => (
                    <TouchableOpacity
                      key={action.prompt}
                      onPress={() => handleSend(action.prompt)}
                      style={styles.figmaQuickActionCard}
                    >
                      <Text style={styles.figmaQuickActionText}>
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.figmaDisclaimer}>
          <AlertTriangle color="#F59E0B" size={14} />
          <Text style={styles.figmaDisclaimerText}>
            {isRTL
              ? "تقدم زينة إرشادات صحية عامة ولا تُعد بديلاً عن الاستشارة الطبية المتخصصة."
              : t(
                  "zeina.disclaimer",
                  "Zeina provides general wellness guidance and is not a substitute for professional medical advice."
                )}
          </Text>
        </View>

        <View
          style={[
            styles.figmaInputContainer,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              marginBottom: tabBarHeight,
            },
          ]}
        >
          <View style={styles.figmaInputRow}>
            <View
              collapsable={false}
              ref={inputFieldRef}
              style={styles.figmaInputField}
            >
              <TextInput
                editable={!isStreaming}
                multiline
                onChangeText={setInputText}
                placeholder={
                  isRTL
                    ? "اسأل زينة عن صحتك..."
                    : t(
                        "zeina.ask.placeholder",
                        "Ask Zeina about your health..."
                      )
                }
                placeholderTextColor="#999"
                ref={inputRef}
                scrollEnabled
                style={styles.figmaTextInput}
                textAlign={isRTL ? "right" : "left"}
                textAlignVertical="top"
                value={inputText}
              />
            </View>
            {Boolean(recognitionAvailable) && (
              <TouchableOpacity
                onPress={handleVoiceInput}
                style={styles.figmaIconButton}
              >
                {isListening ? (
                  <MicOff color="#FFFFFF" size={18} />
                ) : (
                  <Mic color="#4E5661" size={18} />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              disabled={!inputText.trim() || isStreaming}
              onPress={handleSend}
              style={[
                styles.figmaSendButton,
                (!inputText.trim() || isStreaming) &&
                  styles.figmaSendButtonDisabled,
              ]}
            >
              {isStreaming ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Send color="#FFFFFF" size={18} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <CoachMark
        body={t(
          "zeinaHowToBody",
          "Tap here to ask Zeina questions about your health."
        )}
        onClose={() => setShowHowTo(false)}
        onPrimaryAction={() => inputRef.current?.focus()}
        primaryActionLabel={t("startChat", "Start chat")}
        secondaryActionLabel={t("gotIt", "Got it")}
        targetRef={inputFieldRef}
        title={t("zeinaHowToTitle", "Use Zeina")}
        visible={showHowTo}
      />

      <Modal
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
        transparent={true}
        visible={showSettings}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("settings", "Settings")}</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons color="#333" name="close" size={24} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>{t("aiModel", "AI Model")}</Text>
            <View style={styles.modelSelector}>
              {Object.entries(AI_MODELS).map(([modelKey, modelName]) => (
                <TouchableOpacity
                  key={modelKey}
                  onPress={() => setTempModel(modelKey)}
                  style={[
                    styles.modelOption,
                    tempModel === modelKey && styles.modelOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.modelOptionText,
                      tempModel === modelKey && styles.modelOptionTextSelected,
                    ]}
                  >
                    {modelName}
                  </Text>
                  {modelKey === "gpt-3.5-turbo" && (
                    <Text style={styles.recommendedBadge}>
                      {t("recommended", "Recommended")}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalHint}>
              {t(
                "aiModelRecommendationHint",
                "GPT-3.5 Turbo is recommended for best cost/performance balance"
              )}
            </Text>

            {/* Voice Settings */}
            {Boolean(voiceEnabled || recognitionAvailable) && (
              <>
                <Text style={[styles.modalLabel, { marginTop: 20 }]}>
                  {t("voiceSettings", "Voice Settings")}
                </Text>

                {Boolean(voiceEnabled) && (
                  <View style={styles.voiceSetting}>
                    <View style={styles.voiceSettingInfo}>
                      <Volume2 color="#007AFF" size={20} />
                      <View style={{ marginStart: 12, flex: 1 }}>
                        <Text style={styles.voiceSettingTitle}>
                          {t("voiceOutput", "Voice Output")}
                        </Text>
                        <Text style={styles.voiceSettingDescription}>
                          {t(
                            "voiceOutputDescription",
                            "Enable text-to-speech for AI responses"
                          )}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
                      style={[
                        styles.voiceToggle,
                        voiceOutputEnabled && styles.voiceToggleActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.voiceToggleKnob,
                          voiceOutputEnabled && styles.voiceToggleKnobActive,
                        ]}
                      />
                    </TouchableOpacity>
                  </View>
                )}

                {Boolean(recognitionAvailable) && (
                  <View style={styles.voiceSetting}>
                    <View style={styles.voiceSettingInfo}>
                      <Mic color="#007AFF" size={20} />
                      <View style={{ marginStart: 12, flex: 1 }}>
                        <Text style={styles.voiceSettingTitle}>
                          {t("voiceInput", "Voice Input")}
                        </Text>
                        <Text style={styles.voiceSettingDescription}>
                          {t(
                            "voiceInputDescription",
                            "Enable speech-to-text for voice commands"
                          )}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => setVoiceInputEnabled(!voiceInputEnabled)}
                      style={[
                        styles.voiceToggle,
                        voiceInputEnabled && styles.voiceToggleActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.voiceToggleKnob,
                          voiceInputEnabled && styles.voiceToggleKnobActive,
                        ]}
                      />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.voiceSetting}>
                  <View style={styles.voiceSettingInfo}>
                    <Settings color="#007AFF" size={20} />
                    <View style={{ marginStart: 12, flex: 1 }}>
                      <Text style={styles.voiceSettingTitle}>
                        {t("voiceLanguage", "Voice Language")}
                      </Text>
                      <Text style={styles.voiceSettingDescription}>
                        {t(
                          "voiceLanguageDescription",
                          "Language for voice input/output"
                        )}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      // Cycle through available languages
                      const languages = ["en-US", "ar-SA"];
                      const currentIndex = languages.indexOf(voiceLanguage);
                      const nextIndex = (currentIndex + 1) % languages.length;
                      setVoiceLanguage(languages[nextIndex]);
                    }}
                    style={styles.languageButton}
                  >
                    <Text style={styles.languageButtonText}>
                      {voiceLanguage === "en-US"
                        ? t("english", "English")
                        : t("arabic", "العربية")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity
              onPress={handleSaveSettings}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>
                {t("saveSettings", "Save Settings")}
              </Text>
            </TouchableOpacity>

            <View style={styles.helpSection}>
              <Text style={styles.helpTitle}>
                {t("quotaExceededHelpTitle", "Quota Exceeded?")}
              </Text>
              <Text style={styles.helpText}>
                {t(
                  "quotaExceededHelpSteps",
                  "1. Visit platform.openai.com\n2. Add payment method ($5 minimum)\n3. Or use GPT-3.5 Turbo (cheapest option)"
                )}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  figmaOrbTop: {
    position: "absolute",
    top: -120,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(0, 53, 67, 0.08)",
  },
  figmaOrbBottom: {
    position: "absolute",
    bottom: -140,
    left: -140,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(235, 156, 12, 0.08)",
  },
  figmaHeaderContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  figmaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  figmaHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EB9C0C",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaHeaderTitle: {
    fontSize: 28,
    fontFamily: "Inter-Bold",
    color: "#003543",
  },
  figmaHeaderSubtitle: {
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
    color: "rgba(0, 53, 67, 0.7)",
    marginTop: 2,
  },
  figmaChatContainer: {
    flex: 1,
  },
  figmaMessagesContainer: {
    flex: 1,
  },
  figmaMessagesContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
  figmaMessageRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 16,
  },
  figmaMessageRowUser: {
    justifyContent: "flex-end",
  },
  figmaMessageBubble: {
    maxWidth: "80%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  figmaMessageBubbleUser: {
    backgroundColor: "#003543",
    borderBottomRightRadius: 6,
  },
  figmaMessageBubbleAssistant: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderBottomLeftRadius: 6,
  },
  figmaMessageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  figmaMessageSender: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#6C7280",
  },
  figmaMessageText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    lineHeight: 20,
  },
  figmaMessageTextUser: {
    color: "#FFFFFF",
  },
  figmaMessageTextAssistant: {
    color: "#1A1D1F",
  },
  figmaMessageTime: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    marginTop: 6,
  },
  figmaMessageTimeUser: {
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "right",
  },
  figmaMessageTimeAssistant: {
    color: "#9CA3AF",
  },
  figmaQuickActionsSection: {
    paddingTop: 8,
  },
  figmaQuickActionsTitle: {
    fontSize: 12,
    fontFamily: "Inter-Medium",
    color: "#9CA3AF",
    marginBottom: 8,
  },
  figmaQuickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  figmaQuickActionCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  figmaQuickActionText: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: "#1A1D1F",
  },
  figmaDisclaimer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#FEF3C7",
    borderTopWidth: 1,
    borderTopColor: "rgba(245, 158, 11, 0.2)",
  },
  figmaDisclaimerText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: "#92400E",
    lineHeight: 16,
  },
  figmaInputContainer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  figmaInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  figmaInputField: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  figmaTextInput: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: "#1A1D1F",
    minHeight: 24,
  },
  figmaIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaSendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EB9C0C",
    alignItems: "center",
    justifyContent: "center",
  },
  figmaSendButtonDisabled: {
    opacity: 0.5,
  },
  headerWrapper: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 6,
    marginStart: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  newChatHeaderButton: {
    marginStart: 0,
  },
  helpHeaderButton: {
    marginStart: 0,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    alignItems: "flex-end",
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginEnd: 8,
    fontSize: 16,
    maxHeight: 100,
    color: "#333",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#B0B0B0",
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
    marginEnd: 8,
  },
  voiceButtonActive: {
    backgroundColor: "#007AFF",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 20,
  },
  modelSelector: {
    marginBottom: 8,
  },
  modelOption: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  modelOptionSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#F0F8FF",
  },
  modelOptionText: {
    fontSize: 14,
    color: "#333",
  },
  modelOptionTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
  recommendedBadge: {
    fontSize: 10,
    color: "#10B981",
    fontWeight: "600",
    marginTop: 4,
  },
  helpSection: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#FFF3CD",
    borderRadius: 8,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#856404",
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: "#856404",
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 16,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  voiceSetting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    marginBottom: 8,
  },
  voiceSettingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  voiceSettingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  voiceSettingDescription: {
    fontSize: 14,
    color: "#666",
  },
  voiceToggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  voiceToggleActive: {
    backgroundColor: "#007AFF",
  },
  voiceToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "white",
    transform: [{ translateX: 0 }],
  },
  voiceToggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  languageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#007AFF",
    borderRadius: 16,
  },
  languageButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});
