/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: This screen coordinates chat, voice, persistence, and settings flows in one component. */
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { Mic, MicOff, Settings, Volume2, VolumeX } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import aiConsentService from "@/lib/services/aiConsentService";
import { safeFormatDate } from "@/utils/dateFormat";
import { auth, db } from "../lib/firebase";
import healthContextService from "../lib/services/healthContextService";
import openaiService, {
  AI_MODELS,
  type ChatMessage as AIMessage,
} from "../lib/services/openaiService";
import { voiceService } from "../lib/services/voiceService";
import ChatMessage from "./components/ChatMessage";

export default function AIAssistant() {
  const router = useRouter();
  const _params = useLocalSearchParams<{ openSettings?: string }>();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.toLowerCase().startsWith("ar");
  const scrollViewRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: Initialization flow runs once on mount.
  useEffect(() => {
    initializeChat();
    checkVoiceAvailability();
    checkRecognitionAvailability();

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
  }, []);

  const checkRecognitionAvailability = async () => {
    try {
      const available = await voiceService.isRecognitionAvailable();
      setRecognitionAvailable(available);
    } catch (_error) {
      setRecognitionAvailable(false);
    }
  };

  const checkVoiceAvailability = async () => {
    try {
      const available = await voiceService.isAvailable();
      setVoiceEnabled(available);
    } catch (_error) {
      setVoiceEnabled(false);
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
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("failedToStartVoiceInput", "Failed to start voice input");
      setIsListening(false);
      Alert.alert(t("speechError", "Speech Error"), errorMessage);
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

  const toggleVoiceOutput = () => {
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

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Scrolling should track messages only.
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeChat = async () => {
    try {
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
      if (!isMountedRef.current) {
        return;
      }
      setIsLoading(true);
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
          "aiAssistantWelcome",
          "Hello! I'm your personal health AI assistant. I have access to your health profile, medications, symptoms, and family information. How can I help you today?"
        ),
        timestamp: new Date(),
      };

      setMessages([systemMessage, welcomeMessage]);

      // Create new chat session
      await createNewSession([systemMessage, welcomeMessage]);

      if (!isMountedRef.current) {
        return;
      }
      setIsLoading(false);
    } catch (_error) {
      // Silently handle error
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const createNewSession = async (initialMessages: AIMessage[]) => {
    if (!auth.currentUser) {
      return;
    }

    try {
      // Generate a title based on the conversation topic
      const firstUserMessage = initialMessages.find((m) => m.role === "user");
      let title = t("healthChat", "Health Chat");

      if (firstUserMessage) {
        // Create a short title from the first user message
        const words = firstUserMessage.content.split(" ").slice(0, 5);
        title = words.join(" ") + (words.length >= 5 ? "..." : "");
      } else {
        title = `${t("healthChat", "Health Chat")} ${safeFormatDate(new Date())}`;
      }

      const sessionData = {
        userId: auth.currentUser.uid,
        messages: initialMessages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
        createdAt: new Date(),
        updatedAt: new Date(),
        title,
      };

      const docRef = await addDoc(
        collection(db, "users", auth.currentUser.uid, "chatSessions"),
        sessionData
      );

      setCurrentSessionId(docRef.id);
      return docRef.id;
    } catch (_error) {
      // Silently handle error
      return null;
    }
  };

  const saveMessageToSession = async (message: AIMessage) => {
    if (!(auth.currentUser && currentSessionId)) {
      return;
    }

    try {
      const sessionRef = doc(
        db,
        "users",
        auth.currentUser.uid,
        "chatSessions",
        currentSessionId
      );
      const currentMessages = messages.filter((m) => m.role !== "system");

      const updates: {
        messages: Array<{
          role: AIMessage["role"];
          content: string;
          timestamp: Date;
        }>;
        updatedAt: Date;
        title?: string;
      } = {
        messages: [...currentMessages, message].map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        updatedAt: new Date(),
      };

      // Update title with first user message if it's still the default
      if (
        message.role === "user" &&
        currentMessages.filter((m) => m.role === "user").length === 0
      ) {
        const words = message.content.split(" ").slice(0, 5);
        updates.title = words.join(" ") + (words.length >= 5 ? "..." : "");
      }

      await updateDoc(sessionRef, updates);
    } catch (_error) {
      // Silently handle error
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

    const consent = await aiConsentService.getConsent();
    if (!consent.consented) {
      Alert.alert(
        isRTL ? "مشاركة بيانات الذكاء الاصطناعي" : "AI Data Sharing",
        isRTL
          ? "لتشغيل المساعد، يجب السماح بمشاركة البيانات مع مزوّد ذكاء اصطناعي خارجي (OpenAI)."
          : "To use the assistant, you must allow sharing data with a third-party AI provider (OpenAI).",
        [
          { text: t("cancel", "Cancel"), style: "cancel" },
          {
            text: isRTL ? "فتح الإعدادات" : "Open settings",
            onPress: () => router.push("/profile/ai-data-sharing"),
          },
        ]
      );
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

    let streamFinalized = false;
    let didTimeout = false;

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
      Alert.alert(
        t("error", "Error"),
        t(
          "assistantTimeoutMessage",
          "Response took too long. Please try sending your message again."
        )
      );
    }, 30_000);

    try {
      // Save user message
      await saveMessageToSession(userMessage);

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      let fullResponse = "";

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
          // Save assistant message
          await saveMessageToSession({
            ...assistantMessage,
            content: fullResponse,
          });

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

  const handleNewChat = async () => {
    await initializeChat();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons color="#333" name="arrow-back" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("aiAssistant", "AI Assistant")}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleNewChat}
            style={[styles.headerButton, styles.newChatHeaderButton]}
          >
            <Ionicons color="#007AFF" name="add-circle" size={28} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            style={styles.headerButton}
          >
            <Ionicons color="#666" name="settings-sharp" size={26} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
        style={styles.chatContainer}
      >
        <ScrollView
          contentContainerStyle={styles.messagesContent}
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          style={styles.messagesContainer}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#007AFF" size="large" />
              <Text style={styles.loadingText}>
                {t("loadingHealthContext", "Loading your health context...")}
              </Text>
            </View>
          ) : (
            messages
              .filter((m) => m.role !== "system")
              .map((message) => (
                <ChatMessage
                  content={message.content}
                  isStreaming={
                    isStreaming && message.id === messages.at(-1)?.id
                  }
                  key={message.id}
                  role={message.role as "user" | "assistant"}
                  timestamp={message.timestamp}
                />
              ))
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          {voiceEnabled ? (
            <TouchableOpacity
              onPress={toggleVoiceOutput}
              style={[
                styles.voiceButton,
                voiceOutputEnabled && styles.voiceButtonActive,
              ]}
            >
              {isSpeaking ? <VolumeX color="white" size={20} /> : null}
              {!isSpeaking && voiceOutputEnabled ? (
                <Volume2 color="white" size={20} />
              ) : null}
              {isSpeaking || voiceOutputEnabled ? null : (
                <VolumeX color="#666" size={20} />
              )}
            </TouchableOpacity>
          ) : null}
          {recognitionAvailable ? (
            <TouchableOpacity
              onPress={handleVoiceInput}
              style={[
                styles.voiceButton,
                isListening && styles.voiceButtonActive,
              ]}
            >
              {isListening ? (
                <MicOff color="white" size={20} />
              ) : (
                <Mic color="#666" size={20} />
              )}
            </TouchableOpacity>
          ) : null}
          <TextInput
            editable={!isStreaming}
            multiline
            onChangeText={setInputText}
            placeholder={t(
              "askZeina",
              "Ask Zeina about your health, medications, symptoms..."
            )}
            placeholderTextColor="#999"
            scrollEnabled
            style={styles.textInput}
            textAlignVertical="top"
            value={inputText}
          />
          <TouchableOpacity
            disabled={!inputText.trim() || isStreaming}
            onPress={handleSend}
            style={[
              styles.sendButton,
              (!inputText.trim() || isStreaming) && styles.sendButtonDisabled,
            ]}
          >
            {isStreaming ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons color="white" name="send" size={20} />
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.privacyTipText}>
          {isRTL
            ? "نصيحة خصوصية: تجنّب كتابة الاسم أو رقم الهاتف أو البريد الإلكتروني أو العنوان في الرسالة."
            : "Privacy tip: avoid typing names, phone numbers, emails, or addresses in your message."}
        </Text>
      </KeyboardAvoidingView>

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
            {voiceEnabled || recognitionAvailable ? (
              <>
                <Text style={[styles.modalLabel, { marginTop: 20 }]}>
                  {t("voiceSettings", "Voice Settings")}
                </Text>

                {voiceEnabled ? (
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
                ) : null}

                {recognitionAvailable ? (
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
                ) : null}

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
            ) : null}

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
                {t("quotaExceededHelpTitle", "⚠️ Quota Exceeded?")}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    marginStart: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 4,
    marginStart: 8,
  },
  newChatHeaderButton: {
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
  privacyTipText: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontSize: 12,
    lineHeight: 16,
    color: "#64748B",
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
  modalInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 20,
  },
  link: {
    color: "#007AFF",
    textDecorationLine: "underline",
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
