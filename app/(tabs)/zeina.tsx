import { Ionicons } from "@expo/vector-icons";
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
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import healthContextService from "@/lib/services/healthContextService";
import openaiService, {
  type ChatMessage as AIMessage,
} from "@/lib/services/openaiService";
import ChatMessage from "../components/ChatMessage";

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

export default function ZeinaScreen() {
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<SavedSession[]>([]);

  useEffect(() => {
    initializeChat();
    loadChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeChat = async () => {
    // Add welcome message immediately so it's always visible
    const welcomeMessage: AIMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content:
        "Hello! I'm Zeina, your personal health AI assistant. I have access to your health profile, medications, symptoms, and family information. How can I help you today?",
      timestamp: new Date(),
    };

    try {
      // Initialize OpenAI service with premium key for Zeina
      await openaiService.initialize(true);
      const key = await openaiService.getApiKey(true);

      if (!key) {
        Alert.alert(
          "Service Unavailable",
          "Zeina is temporarily unavailable. Please contact support."
        );
        // Still show welcome message even if service is unavailable
        setMessages([welcomeMessage]);
        setIsLoading(false);
        return;
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

      setMessages([systemMessage, welcomeMessage]);

      // Create new chat session
      await createNewSession([systemMessage, welcomeMessage]);

      setIsLoading(false);
    } catch (error) {
      // Silently handle chat initialization error, but still show welcome message
      setMessages([welcomeMessage]);
      setIsLoading(false);
    }
  };

  const createNewSession = async (initialMessages: AIMessage[]) => {
    if (!auth.currentUser) return;

    try {
      // Generate a title based on the conversation topic
      const firstUserMessage = initialMessages.find((m) => m.role === "user");
      let title = "Chat with Zeina";

      if (firstUserMessage) {
        // Create a short title from the first user message
        const words = firstUserMessage.content.split(" ").slice(0, 5);
        title = words.join(" ") + (words.length >= 5 ? "..." : "");
      } else {
        title = "Chat with Zeina " + new Date().toLocaleDateString();
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
      // Silently handle session creation error
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
      // Silently handle message save error
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputText.trim(),
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
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            ...assistantMessage,
            content: fullResponse,
          };
          return newMessages;
        });
        scrollToBottom();
      },
      async () => {
        setIsStreaming(false);
        // Save assistant message
        await saveMessageToSession({
          ...assistantMessage,
          content: fullResponse,
        });
      },
      (error) => {
        setIsStreaming(false);
        // Silently handle chat error

        // More user-friendly error messages
        Alert.alert(
          "Error",
          error.message || "Failed to get response. Please try again."
        );
      },
      true // Use premium key for Zeina
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
          title: data.title || "Chat Session",
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          messageCount: messages.length,
          preview:
            lastUserMessage?.content?.substring(0, 50) + "..." || "No messages",
        });
      });

      setChatHistory(sessions);
    } catch (error) {
      // Silently handle chat history load error
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
      // Silently handle session load error
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
              // Silently handle session delete error
              Alert.alert("Error", "Failed to delete chat session");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Zeina</Text>
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
                Loading your health context...
              </Text>
            </View>
          ) : (
            <>
              {messages
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
                ))}
            </>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            editable={!isStreaming}
            multiline
            onChangeText={setInputText}
            placeholder="Ask Zeina about your health, medications, symptoms..."
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
              <Text style={styles.modalTitle}>Chat History</Text>
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
                    No chat history yet
                  </Text>
                  <Text style={styles.emptyHistorySubtext}>
                    Your conversations will appear here
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
                style={{ marginRight: 8 }}
              />
              <Text style={styles.newChatButtonText}>Start New Chat</Text>
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
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 4,
    marginLeft: 8,
  },
  newChatHeaderButton: {
    marginLeft: 0,
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
  premiumContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  premiumTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#333",
    marginTop: 24,
    marginBottom: 12,
  },
  premiumText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 24,
  },
  premiumSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minWidth: 200,
  },
  upgradeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
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
    marginRight: 8,
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
    marginRight: 12,
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
});
