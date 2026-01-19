import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Caption, Text } from "@/components/design-system/Typography";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { tagService } from "@/lib/services/tagService";

interface TagInputProps {
  tags: string[];
  onChangeTags: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  showSuggestions?: boolean;
}

export default function TagInput({
  tags,
  onChangeTags,
  placeholder,
  maxTags = 10,
  showSuggestions = true,
}: TagInputProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestionsList, setShowSuggestionsList] = useState(false);

  const styles = getStyles(theme, isRTL);

  useEffect(() => {
    if (showSuggestions && inputValue.trim().length > 0 && user) {
      loadSuggestions();
    } else {
      setSuggestions([]);
      setShowSuggestionsList(false);
    }
  }, [inputValue, tags, user, showSuggestions]);

  const loadSuggestions = async () => {
    if (!user) return;

    try {
      const suggested = await tagService.getSuggestedTags(user.id, tags, 5);
      const filtered = suggested.filter((tag) =>
        tag.toLowerCase().includes(inputValue.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestionsList(filtered.length > 0);
    } catch (error) {
      setSuggestions([]);
      setShowSuggestionsList(false);
    }
  };

  const handleAddTag = (tag?: string) => {
    const tagToAdd = tag || inputValue.trim();
    if (!tagToAdd) return;

    const normalized = tagService.normalizeTag(tagToAdd);
    if (!tagService.isValidTag(normalized)) {
      return;
    }

    if (tags.length >= maxTags) {
      return;
    }

    if (!tags.includes(normalized)) {
      onChangeTags([...tags, normalized]);
    }

    setInputValue("");
    setShowSuggestionsList(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChangeTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleInputSubmit = () => {
    if (inputValue.trim()) {
      handleAddTag();
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    handleAddTag(suggestion);
  };

  return (
    <View style={styles.container}>
      {/* Current Tags */}
      {tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {tags.map((tag, index) => (
            <Badge key={index} style={styles.tag} variant="outline">
              <Text style={styles.tagText}>{tag}</Text>
              <TouchableOpacity
                hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                onPress={() => handleRemoveTag(tag)}
                style={styles.removeTagButton}
              >
                <Ionicons
                  color={theme.colors.text.secondary}
                  name="close-circle"
                  size={16}
                />
              </TouchableOpacity>
            </Badge>
          ))}
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          maxLength={30}
          onChangeText={setInputValue}
          onSubmitEditing={handleInputSubmit}
          placeholder={
            placeholder ||
            (isRTL ? "أضف علامة (اضغط Enter)" : "Add tag (press Enter)")
          }
          placeholderTextColor={theme.colors.text.secondary}
          returnKeyType="done"
          style={styles.input}
          value={inputValue}
        />
        {tags.length < maxTags && (
          <TouchableOpacity
            disabled={!inputValue.trim()}
            onPress={() => handleAddTag()}
            style={styles.addButton}
          >
            <Ionicons
              color={
                inputValue.trim()
                  ? theme.colors.primary.main
                  : theme.colors.text.secondary
              }
              name="add-circle"
              size={24}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Suggestions */}
      {showSuggestionsList && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Caption numberOfLines={undefined} style={styles.suggestionsTitle}>
            {isRTL ? "اقتراحات" : "Suggestions"}
          </Caption>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionsScroll}
          >
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleSuggestionPress(suggestion)}
                style={styles.suggestionChip}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Helper Text */}
      <Caption numberOfLines={undefined} style={styles.helperText}>
        {isRTL
          ? `يمكنك إضافة حتى ${maxTags} علامة`
          : `You can add up to ${maxTags} tags`}
      </Caption>
    </View>
  );
}

const getStyles = (theme: any, isRTL: boolean) => ({
  container: {
    marginBottom: theme.spacing.base,
  },
  tagsContainer: {
    flexDirection: (isRTL
      ? "row-reverse"
      : "row") as ViewStyle["flexDirection"],
    flexWrap: "wrap" as ViewStyle["flexWrap"],
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  } as ViewStyle,
  tag: {
    flexDirection: isRTL ? "row-reverse" : "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  tagText: {
    ...theme.typography.caption,
    fontSize: 12,
    color: theme.colors.text.primary,
  },
  removeTagButton: {
    marginLeft: isRTL ? 0 : theme.spacing.xs / 2,
    marginRight: isRTL ? theme.spacing.xs / 2 : 0,
  },
  inputContainer: {
    flexDirection: (isRTL
      ? "row-reverse"
      : "row") as ViewStyle["flexDirection"],
    alignItems: "center" as ViewStyle["alignItems"],
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background.secondary,
  } as ViewStyle,
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text.primary,
    padding: 0,
  },
  addButton: {
    marginLeft: isRTL ? 0 : theme.spacing.sm,
    marginRight: isRTL ? theme.spacing.sm : 0,
  },
  suggestionsContainer: {
    marginTop: theme.spacing.sm,
  },
  suggestionsTitle: {
    marginBottom: theme.spacing.xs,
    color: theme.colors.text.secondary,
  },
  suggestionsScroll: {
    maxHeight: 40,
  },
  suggestionChip: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: isRTL ? 0 : theme.spacing.xs,
    marginLeft: isRTL ? theme.spacing.xs : 0,
  },
  suggestionText: {
    ...theme.typography.caption,
    fontSize: 12,
    color: theme.colors.text.primary,
  },
  helperText: {
    marginTop: theme.spacing.xs,
    color: theme.colors.text.secondary,
    fontSize: 11,
  },
});
