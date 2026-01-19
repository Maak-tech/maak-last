import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  onSpeak?: (text: string) => void;
  isSpeaking?: boolean;
}

export default function ChatMessage({
  role,
  content,
  isStreaming,
  timestamp,
  onSpeak,
  isSpeaking,
}: ChatMessageProps) {
  const [displayedContent, setDisplayedContent] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (isStreaming && role === "assistant") {
      setDisplayedContent(content);
    } else if (
      !isStreaming &&
      role === "assistant" &&
      displayedContent !== content
    ) {
      // Typing effect for non-streaming messages
      const timer = setTimeout(() => {
        if (currentIndex < content.length) {
          setDisplayedContent(content.slice(0, currentIndex + 1));
          setCurrentIndex(currentIndex + 1);
        }
      }, 20);
      return () => clearTimeout(timer);
    } else {
      setDisplayedContent(content);
    }
  }, [content, currentIndex, isStreaming, role, displayedContent]);

  const isUser = role === "user";

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
    >
      <View
        style={[
          styles.avatarContainer,
          isUser ? styles.userAvatar : styles.assistantAvatar,
        ]}
      >
        <Ionicons
          color="white"
          name={isUser ? "person" : "sparkles"}
          size={20}
        />
      </View>
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        <View style={styles.messageHeader}>
          {!isUser && onSpeak && (
            <Ionicons
              color={isSpeaking ? "#007AFF" : "#666"}
              name={isSpeaking ? "volume-high" : "volume-medium"}
              onPress={() => onSpeak(content)}
              size={16}
              style={styles.speakerIcon}
            />
          )}
        </View>
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userText : styles.assistantText,
          ]}
        >
          {displayedContent}
          {isStreaming && role === "assistant" && (
            <Text style={styles.cursor}>▊</Text>
          )}
        </Text>
        {timestamp && (
          <Text style={styles.timestamp}>
            {timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "flex-start",
  },
  userContainer: {
    flexDirection: "row-reverse",
  },
  assistantContainer: {
    flexDirection: "row",
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
  },
  userAvatar: {
    backgroundColor: "#007AFF",
  },
  assistantAvatar: {
    backgroundColor: "#8E44AD",
  },
  messageContainer: {
    maxWidth: "75%",
    borderRadius: 16,
    padding: 12,
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  speakerIcon: {
    padding: 2,
  },
  userMessage: {
    backgroundColor: "#007AFF",
    borderTopRightRadius: 4,
  },
  assistantMessage: {
    backgroundColor: "#F0F0F0",
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: "white",
  },
  assistantText: {
    color: "#333",
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  cursor: {
    opacity: 0.5,
    fontSize: 16,
  },
});
