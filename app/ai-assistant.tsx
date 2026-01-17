import { Ionicons } from "@expo/vector-icons";
import { Mic, MicOff, Volume2, VolumeX, Settings } from "lucide-react-native";
import { useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../lib/firebase";
import healthContextService from "../lib/services/healthContextService";
import { voiceService } from "../lib/services/voiceService";
import openaiService, {
  AI_MODELS,
  type ChatMessage as AIMessage,
} from "../lib/services/openaiService";
import ChatMessage from "./components/ChatMessage";

interface ChatSession {
  id: string;
  messages: AIMessage[];
  createdAt: Date;
  updatedAt: Date;
  title: string;
}

interface SavedSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  preview: string;
}

export default function AIAssistant() {
  const router = useRouter();
  const { t } = useTranslation();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [tempApiKey, setTempApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-3.5-turbo");
  const [tempModel, setTempModel] = useState("gpt-3.5-turbo");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<SavedSession[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognitionAvailable, setRecognitionAvailable] = useState(false);
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState("en-US");

  useEffect(() => {
    initializeChat();
    loadChatHistory();
    checkVoiceAvailability();
    checkRecognitionAvailability();

    // Initialize voice settings from local storage
    const loadVoiceSettings = async () => {
      try {
        const savedVoiceOutput = await AsyncStorage.getItem("voice_output_enabled");
        const savedVoiceInput = await AsyncStorage.getItem("voice_input_enabled");
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
        t("voiceInputNotAvailable", "Voice input is not available on this device")
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
            error.message || t("failedToRecognizeSpeech", "Failed to recognize speech")
          );
        },
        voiceLanguage
      );
    } catch (error: any) {
      setIsListening(false);
      Alert.alert(
        t("speechError", "Speech Error"),
        error.message || t("failedToStartVoiceInput", "Failed to start voice input")
      );
    }
  };

  const handleVoiceOutput = async (text: string) => {
    if (!voiceEnabled || !voiceOutputEnabled) return;

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
        t("voiceOutputNotSupported", "Voice output is not supported on this device")
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
      // Initialize OpenAI service
      await openaiService.initialize();
      const key = await openaiService.getApiKey();
      const model = await openaiService.getModel();

      if (key) {
        // Mask API key for security - only store masked version in state
        const maskedKey = key ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}` : "";
        setApiKey(maskedKey);
        setSelectedModel(model);
        setTempModel(model);
      } else {
        Alert.alert(
          t("setupRequired", "Setup Required"),
          t(
            "aiAssistantApiKeyRequiredMessage",
            "Please configure your OpenAI API key to use the AI assistant.\n\nYou can get an API key from platform.openai.com"
          ),
          [
            { text: t("cancel", "Cancel"), style: "cancel" },
            { text: t("configure", "Configure"), onPress: () => setShowSettings(true) },
          ]
        );
      }

      // Load health context
      setIsLoading(true);
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
        content:
          t(
            "aiAssistantWelcome",
            "Hello! I'm your personal health AI assistant. I have access to your health profile, medications, symptoms, and family information. How can I help you today?"
          ),
        timestamp: new Date(),
      };

      setMessages([systemMessage, welcomeMessage]);

      // Create new chat session
      await createNewSession([systemMessage, welcomeMessage]);

      setIsLoading(false);
    } catch (error) {
      // Silently handle error
      setIsLoading(false);
    }
  };

  const createNewSession = async (initialMessages: AIMessage[]) => {
    if (!auth.currentUser) return;

    try {
      // Generate a title based on the conversation topic
      const firstUserMessage = initialMessages.find((m) => m.role === "user");
      let title = t("healthChat", "Health Chat");

      if (firstUserMessage) {
        // Create a short title from the first user message
        const words = firstUserMessage.content.split(" ").slice(0, 5);
        title = words.join(" ") + (words.length >= 5 ? "..." : "");
      } else {
        title = `${t("healthChat", "Health Chat")} ${new Date().toLocaleDateString()}`;
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
    } catch (error) {
      // Silently handle error
      return null;
    }
  };

  const saveMessageToSession = async (message: AIMessage) => {
    if (!(auth.currentUser && currentSessionId)) return;

    try {
      const sessionRef = doc(
        db,
        "users",
        auth.currentUser.uid,
        "chatSessions",
        currentSessionId
      );
      const currentMessages = messages.filter((m) => m.role !== "system");

      const updates: any = {
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
    } catch (error) {
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
    const textToSend = typeof textOverride === "string" ? textOverride : inputText;
    if (!textToSend.trim() || isStreaming) return;

    // Check if API key is configured in the service (not state, for security)
    try {
      const serviceKey = await openaiService.getApiKey();
      if (!serviceKey) {
        Alert.alert(
          "API Key Required",
          "Please configure your OpenAI API key first."
        );
        setShowSettings(true);
        return;
      }
    } catch {
      Alert.alert(
        "API Key Required",
        "Please configure your OpenAI API key first."
      );
      setShowSettings(true);
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
        setIsStreaming(false);
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
        setIsStreaming(false);
        // Silently handle error

        // More user-friendly error messages
        if (error.message.includes("quota exceeded")) {
          Alert.alert(
            t("quotaExceeded", "Quota Exceeded"),
            t(
              "openAIQuotaExceededMessage",
              "Your OpenAI account has exceeded its usage quota.\n\nOptions:\n1. Add billing to your OpenAI account\n2. Switch to GPT-3.5 Turbo (cheaper)\n3. Wait for your quota to reset\n\nVisit platform.openai.com to manage billing."
            ),
            [
              { text: t("openSettings", "Open Settings"), onPress: () => setShowSettings(true) },
              { text: t("ok", "OK"), style: "cancel" },
            ]
          );
        } else if (error.message.includes("Invalid API key")) {
          Alert.alert(
            t("invalidApiKey", "Invalid API Key"),
            t(
              "invalidApiKeyMessage",
              "The API key appears to be invalid. Please check and update it."
            ),
            [
              { text: t("openSettings", "Open Settings"), onPress: () => setShowSettings(true) },
              { text: t("cancel", "Cancel"), style: "cancel" },
            ]
          );
        } else {
          Alert.alert(
            t("error", "Error"),
            error.message ||
              t("failedToGetResponse", "Failed to get response. Please try again.")
          );
        }
      }
    );
  };

  const handleSaveSettings = async () => {
    if (!tempApiKey.trim()) {
      Alert.alert(
        t("error", "Error"),
        t("pleaseEnterValidApiKey", "Please enter a valid API key")
      );
      return;
    }

    await openaiService.setApiKey(tempApiKey);
    await openaiService.setModel(tempModel);

    // Save voice settings
    try {
      await AsyncStorage.setItem("voice_output_enabled", JSON.stringify(voiceOutputEnabled));
      await AsyncStorage.setItem("voice_input_enabled", JSON.stringify(voiceInputEnabled));
      await AsyncStorage.setItem("voice_language", voiceLanguage);
    } catch (error) {
      // Silently handle storage error
    }

    // Mask API key for security - only store masked version in state
    const maskedKey = `${tempApiKey.substring(0, 7)}...${tempApiKey.substring(tempApiKey.length - 4)}`;
    setApiKey(maskedKey);
    setSelectedModel(tempModel);
    setTempApiKey(""); // Clear the temp key after saving
    setShowSettings(false);
    Alert.alert(
      t("success", "Success"),
      t("settingsSavedSuccessfully", "Settings saved successfully!")
    );
  };

  const handleNewChat = async () => {
    await initializeChat();
  };

  const loadChatHistory = async () => {
    if (!auth.currentUser) return;

    try {
      const sessionsQuery = query(
        collection(db, "users", auth.currentUser.uid, "chatSessions"),
        orderBy("updatedAt", "desc"),
        limit(20)
      );

      const sessionsSnapshot = await getDocs(sessionsQuery);
      const sessions: SavedSession[] = [];

      sessionsSnapshot.forEach((doc) => {
        const data = doc.data();
        const messages = data.messages || [];
        const userMessages = messages.filter((m: any) => m.role === "user");
        const lastUserMessage = userMessages[userMessages.length - 1];

        sessions.push({
          id: doc.id,
          title: data.title || t("chatSession", "Chat Session"),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          messageCount: messages.length,
          preview: lastUserMessage?.content
            ? `${lastUserMessage.content.substring(0, 50)}...`
            : t("noMessages", "No messages"),
        });
      });

      setChatHistory(sessions);
    } catch (error) {
      // Silently handle error
    }
  };

  const loadSession = async (sessionId: string) => {
    if (!auth.currentUser) return;

    try {
      setIsLoading(true);
      const sessionDoc = await getDoc(
        doc(db, "users", auth.currentUser.uid, "chatSessions", sessionId)
      );

      if (sessionDoc.exists()) {
        const data = sessionDoc.data();
        const sessionMessages = data.messages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp?.toDate() || new Date(),
        }));

        // Add system message at the beginning
        const systemMessage: AIMessage = {
          id: "system",
          role: "system",
          content: systemPrompt,
          timestamp: new Date(),
        };

        setMessages([systemMessage, ...sessionMessages]);
        setCurrentSessionId(sessionId);
        setShowHistory(false);
        scrollToBottom();
      }
    } catch (error) {
      // Silently handle error
      Alert.alert("Error", "Failed to load chat session");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!auth.currentUser) return;

    Alert.alert(
      "Delete Chat",
      "Are you sure you want to delete this chat session?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              if (!auth.currentUser) {
                Alert.alert(
                  "Error",
                  "You must be logged in to delete chat sessions"
                );
                return;
              }
              await deleteDoc(
                doc(
                  db,
                  "users",
                  auth.currentUser.uid,
                  "chatSessions",
                  sessionId
                )
              );
              await loadChatHistory();

              // If deleting current session, start new chat
              if (sessionId === currentSessionId) {
                await handleNewChat();
              }
            } catch (error) {
              // Silently handle error
              Alert.alert(
                t("error", "Error"),
                t("failedToDeleteSession", "Failed to delete chat session")
              );
            }
          },
        },
      ]
    );
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
        <Text style={styles.headerTitle}>{t("aiAssistant", "AI Assistant")}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleNewChat}
            style={[styles.headerButton, styles.newChatHeaderButton]}
          >
            <Ionicons color="#007AFF" name="add-circle" size={28} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              await loadChatHistory();
              setShowHistory(true);
            }}
            style={[styles.headerButton, styles.historyHeaderButton]}
          >
            <View>
              <Ionicons color="#007AFF" name="chatbubbles" size={26} />
              {chatHistory.length > 0 && (
                <View style={styles.historyBadge}>
                  <Text style={styles.historyBadgeText}>
                    {chatHistory.length}
                  </Text>
                </View>
              )}
            </View>
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
                <VolumeX size={20} color="white" />
              ) : voiceOutputEnabled ? (
                <Volume2 size={20} color="white" />
              ) : (
                <VolumeX size={20} color="#666" />
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
                <MicOff size={20} color="white" />
              ) : (
                <Mic size={20} color="#666" />
              )}
            </TouchableOpacity>
          )}
          <TextInput
            editable={!isStreaming}
            multiline
            onChangeText={setInputText}
            placeholder={t("askZeina", "Ask Zeina about your health, medications, symptoms...")}
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

            <Text style={styles.modalLabel}>{t("openAIApiKey", "OpenAI API Key")}</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setTempApiKey}
              placeholder="sk-..."
              placeholderTextColor="#999"
              secureTextEntry
              style={styles.modalInput}
              value={tempApiKey}
            />

            <Text style={styles.modalHint}>
              {t("getApiKeyFromOpenAI", "Get your API key from platform.openai.com")}
            </Text>

            <Text style={[styles.modalLabel, { marginTop: 16 }]}>
              {t("aiModel", "AI Model")}
            </Text>
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
                      <Volume2 size={20} color="#007AFF" />
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
                      <Mic size={20} color="#007AFF" />
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
                    <Settings size={20} color="#007AFF" />
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

      {/* Chat History Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setShowHistory(false)}
        transparent={true}
        visible={showHistory}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("chatHistory", "Chat History")}</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons color="#333" name="close" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 400 }}
            >
              {chatHistory.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <Ionicons color="#999" name="chatbubbles-outline" size={48} />
                  <Text style={styles.emptyHistoryText}>
                    {t("noChatHistory", "No chat history yet")}
                  </Text>
                  <Text style={styles.emptyHistorySubtext}>
                    {t("conversationsWillAppear", "Your conversations will appear here")}
                  </Text>
                </View>
              ) : (
                chatHistory.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    onPress={() => loadSession(session.id)}
                    style={styles.historyItem}
                  >
                    <View style={styles.historyItemContent}>
                      <Text numberOfLines={1} style={styles.historyItemTitle}>
                        {session.title}
                      </Text>
                      <Text numberOfLines={2} style={styles.historyItemPreview}>
                        {session.preview}
                      </Text>
                      <View style={styles.historyItemMeta}>
                        <Text style={styles.historyItemDate}>
                          {session.updatedAt.toLocaleDateString()}
                        </Text>
                        <Text style={styles.historyItemMessages}>
                          {session.messageCount} messages
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      style={styles.historyItemDelete}
                    >
                      <Ionicons
                        color="#EF4444"
                        name="trash-outline"
                        size={20}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setShowHistory(false);
                handleNewChat();
              }}
              style={styles.newChatButton}
            >
              <Ionicons
                color="white"
                name="add-circle-outline"
                size={20}
                style={{ marginEnd: 8 }}
              />
              <Text style={styles.newChatButtonText}>
                {t("startNewChat", "Start New Chat")}
              </Text>
            </TouchableOpacity>
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
  historyHeaderButton: {
    position: "relative",
  },
  historyBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  historyBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
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
  emptyHistory: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyHistoryText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  historyItemContent: {
    flex: 1,
    marginEnd: 12,
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  historyItemPreview: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  historyItemMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  historyItemDate: {
    fontSize: 12,
    color: "#999",
  },
  historyItemMessages: {
    fontSize: 12,
    color: "#999",
  },
  historyItemDelete: {
    padding: 8,
  },
  newChatButton: {
    flexDirection: "row",
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  newChatButtonText: {
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
