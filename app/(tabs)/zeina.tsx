/**
 * Zeina - AI Health Assistant Chat
 *
 * A text-based chat interface for health assistance powered by OpenAI.
 */

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";
import {
  Info,
  Mic,
  MicOff,
  Settings,
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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import healthContextService from "../../lib/services/healthContextService";
import openaiService, {
  AI_MODELS,
  type ChatMessage as AIMessage,
} from "../../lib/services/openaiService";
import { voiceService } from "../../lib/services/voiceService";
import { autoLogHealthSignalsFromText } from "../../lib/services/zeinaChatAutoLogService";
import ChatMessage from "../components/ChatMessage";
import CoachMark from "../components/CoachMark";

export default function ZeinaScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tour?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const inputFieldRef = useRef<View>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-3.5-turbo");
  const [tempModel, setTempModel] = useState("gpt-3.5-turbo");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognitionAvailable, setRecognitionAvailable] = useState(false);
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState("en-US");
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    if (params.tour === "1") {
      setShowHowTo(true);
    }
  }, [params.tour]);

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
      } catch (error) {
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
      setRecognitionAvailable(available);
    } catch (error) {
      setRecognitionAvailable(false);
    }
  };

  const checkVoiceAvailability = async () => {
    try {
      const available = await voiceService.isAvailable();
      setVoiceEnabled(available);
    } catch (error) {
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
          if (result.text && result.text.trim()) {
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
    } catch (error: any) {
      setIsListening(false);
      Alert.alert(
        t("speechError", "Speech Error"),
        error.message ||
          t("failedToStartVoiceInput", "Failed to start voice input")
      );
    }
  };

  const handleVoiceOutput = async (text: string) => {
    if (!(voiceEnabled && voiceOutputEnabled)) return;

    try {
      setIsSpeaking(true);
      await voiceService.speak(text, {
        language: voiceLanguage,
        rate: 0.9,
        pitch: 1.0,
        volume: 1.0,
      });
    } catch (error) {
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeChat = async () => {
    try {
      setIsLoading(true);
      // Initialize OpenAI service (uses env key)
      await openaiService.initialize();
      const model = await openaiService.getModel();
      setSelectedModel(model);
      setTempModel(model);

      // Load health context
      const prompt = await healthContextService.getContextualPrompt();
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

      setIsLoading(false);
    } catch (error) {
      // Silently handle error
      setIsLoading(false);
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
    if (!textToSend.trim() || isStreaming) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsStreaming(true);

    void autoLogHealthSignalsFromText(userMessage.content);

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
        setIsStreaming(false);

        // Speak the response if voice is enabled and auto-speak is on
        if (voiceOutputEnabled && autoSpeak) {
          await handleVoiceOutput(fullResponse);
        }
      },
      (error) => {
        setIsStreaming(false);
        // Silently handle error

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
    } catch (error) {
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
    <SafeAreaView
      edges={["top"]}
      pointerEvents="box-none"
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("zeina", "Zeina")}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleNewChat}
            style={[styles.headerButton, styles.newChatHeaderButton]}
          >
            <Ionicons color="#007AFF" name="add-circle" size={28} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowHowTo(true)}
            style={[styles.headerButton, styles.helpHeaderButton]}
          >
            <Info color="#007AFF" size={22} />
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
                    isStreaming &&
                    message.id === messages[messages.length - 1].id
                  }
                  key={message.id}
                  role={message.role as "user" | "assistant"}
                  timestamp={message.timestamp}
                />
              ))
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          {voiceEnabled && (
            <TouchableOpacity
              onPress={toggleVoiceOutput}
              style={[
                styles.voiceButton,
                voiceOutputEnabled && styles.voiceButtonActive,
              ]}
            >
              {isSpeaking ? (
                <VolumeX color="white" size={20} />
              ) : voiceOutputEnabled ? (
                <Volume2 color="white" size={20} />
              ) : (
                <VolumeX color="#666" size={20} />
              )}
            </TouchableOpacity>
          )}
          {recognitionAvailable && (
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
          )}
          <View collapsable={false} ref={inputFieldRef} style={{ flex: 1 }}>
            <TextInput
              editable={!isStreaming}
              multiline
              onChangeText={setInputText}
              placeholder={t(
                "askZeina",
                "Ask Zeina about your health, medications, symptoms..."
              )}
              placeholderTextColor="#999"
              ref={inputRef}
              scrollEnabled
              style={styles.textInput}
              textAlignVertical="top"
              value={inputText}
            />
          </View>
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
            {(voiceEnabled || recognitionAvailable) && (
              <>
                <Text style={[styles.modalLabel, { marginTop: 20 }]}>
                  {t("voiceSettings", "Voice Settings")}
                </Text>

                {voiceEnabled && (
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

                {recognitionAvailable && (
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
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
