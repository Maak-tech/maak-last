import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  globalSearchService,
  type SearchResult,
} from "@/lib/services/globalSearchService";
import { safeFormatDate } from "@/utils/dateFormat";

type SearchResultType = SearchResult["type"];

import { Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Caption, Text } from "@/components/design-system/Typography";

interface GlobalSearchProps {
  visible: boolean;
  onClose: () => void;
}

const TYPE_LABELS: Partial<
  Record<SearchResultType, { en: string; ar: string; icon: string }>
> = {
  medication: { en: "Medication", ar: "دواء", icon: "💊" },
  symptom: { en: "Symptom", ar: "أعراض صحية", icon: "🤒" },
  mood: { en: "Mood", ar: "مزاج نفسي", icon: "😊" },
  family: { en: "Family", ar: "عائلة", icon: "👨‍👩‍👧‍👦" },
  note: { en: "Note", ar: "ملاحظة", icon: "📝" },
};

export default function GlobalSearch({ visible, onClose }: GlobalSearchProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<SearchResultType[]>([
    "medication",
    "symptom",
    "mood",
    "family",
    "note",
  ]);
  const [showFilters, setShowFilters] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const styles = useMemo(() => getStyles(theme, isRTL), [theme, isRTL]);

  useEffect(() => {
    if (visible) {
      // Focus input when modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      // Clear search when modal closes
      setSearchQuery("");
      setResults([]);
    }
  }, [visible]);

  const performSearch = useCallback(
    async (query: string) => {
      if (!(user && query.trim())) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const searchResults = await globalSearchService.search(
          user.id,
          query,
          {
            types: selectedTypes,
          },
          50
        );
        setResults(searchResults);
      } catch (error) {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [user, selectedTypes]
  );

  useEffect(() => {
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  const handleResultPress = (result: SearchResult) => {
    // Navigate to appropriate screen based on type
    switch (result.type) {
      case "medication":
        router.push("/(tabs)/medications");
        break;
      case "symptom":
        router.push("/(tabs)/symptoms");
        break;
      case "mood":
        router.push("/(tabs)/moods");
        break;
      case "family":
        router.push("/(tabs)/family");
        break;
      case "note":
        router.push("/(tabs)/profile");
        break;
    }
    onClose();
  };

  const toggleTypeFilter = (type: SearchResultType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const formatDate = useCallback(
    (date: Date) => {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return isRTL ? "اليوم" : "Today";
      }
      if (diffDays === 1) {
        return isRTL ? "أمس" : "Yesterday";
      }
      if (diffDays < 7) {
        return isRTL ? `منذ ${diffDays} أيام` : `${diffDays} days ago`;
      }
      return safeFormatDate(date, isRTL ? "ar-u-ca-gregory" : "en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    },
    [isRTL]
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.searchContainer}>
            <Ionicons
              color={theme.colors.text.secondary}
              name="search"
              size={20}
              style={styles.searchIcon}
            />
            <TextInput
              autoFocus
              onChangeText={setSearchQuery}
              placeholder={
                isRTL
                  ? "ابحث في جميع بياناتك الصحية..."
                  : "Search all your health data..."
              }
              placeholderTextColor={theme.colors.text.secondary}
              ref={inputRef}
              returnKeyType="search"
              style={styles.searchInput}
              value={searchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={styles.clearButton}
              >
                <Ionicons
                  color={theme.colors.text.secondary}
                  name="close-circle"
                  size={20}
                />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons
              color={theme.colors.text.primary}
              name={isRTL ? "arrow-forward" : "arrow-back"}
              size={24}
            />
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView
            contentContainerStyle={styles.filtersScroll}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {(
              [
                "medication",
                "symptom",
                "mood",
                "family",
                "note",
              ] as SearchResultType[]
            ).map((type) => {
              const isSelected = selectedTypes.includes(type);
              const label = TYPE_LABELS[type];
              if (!label) return null;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => toggleTypeFilter(type)}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextSelected,
                    ]}
                  >
                    {label.icon} {isRTL ? label.ar : label.en}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Results */}
        <View style={styles.resultsContainer}>
          {isSearching ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator
                color={theme.colors.primary.main}
                size="large"
              />
              <Text style={styles.loadingText}>
                {isRTL ? "جاري البحث..." : "Searching..."}
              </Text>
            </View>
          ) : results.length === 0 && searchQuery.length >= 2 ? (
            <View style={styles.centerContainer}>
              <Ionicons
                color={theme.colors.text.secondary}
                name="search-outline"
                size={48}
              />
              <Text style={styles.emptyText}>
                {isRTL ? "لم يتم العثور على نتائج" : "No results found"}
              </Text>
              <Caption
                numberOfLines={undefined}
                style={[styles.emptySubtext, { textAlign: "center" as const }]}
              >
                {isRTL
                  ? "جرب مصطلحات بحث مختلفة"
                  : "Try different search terms"}
              </Caption>
            </View>
          ) : searchQuery.length < 2 ? (
            <View style={styles.centerContainer}>
              <Ionicons
                color={theme.colors.text.secondary}
                name="search-outline"
                size={48}
              />
              <Text style={styles.emptyText}>
                {isRTL ? "ابدأ الكتابة للبحث..." : "Start typing to search..."}
              </Text>
            </View>
          ) : (
            <FlatList
              contentContainerStyle={styles.resultsList}
              data={results}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              renderItem={({ item }) => {
                const typeLabel = TYPE_LABELS[item.type];
                if (!typeLabel) return null;
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleResultPress(item)}
                  >
                    <Card
                      contentStyle={undefined}
                      pressable={false}
                      style={styles.resultCard}
                    >
                      <View style={styles.resultHeader}>
                        <View style={styles.resultLeft}>
                          <Text style={styles.resultIcon}>
                            {typeLabel.icon}
                          </Text>
                          <View style={styles.resultText}>
                            <Text style={styles.resultTitle}>{item.title}</Text>
                            <Caption
                              numberOfLines={undefined}
                              style={styles.resultSubtitle}
                            >
                              {item.subtitle}
                            </Caption>
                          </View>
                        </View>
                        <View style={styles.resultRight}>
                          <Badge style={styles.typeBadge} variant="outline">
                            {isRTL ? typeLabel.ar : typeLabel.en}
                          </Badge>
                          <Caption
                            numberOfLines={undefined}
                            style={styles.resultDate}
                          >
                            {formatDate(item.timestamp)}
                          </Caption>
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (theme: any, isRTL: boolean) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: (isRTL
      ? "row-reverse"
      : "row") as ViewStyle["flexDirection"],
    alignItems: "center" as ViewStyle["alignItems"],
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.base,
  } as ViewStyle,
  searchContainer: {
    flex: 1,
    flexDirection: (isRTL
      ? "row-reverse"
      : "row") as ViewStyle["flexDirection"],
    alignItems: "center" as ViewStyle["alignItems"],
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  } as ViewStyle,
  searchIcon: {
    marginRight: isRTL ? 0 : theme.spacing.sm,
    marginLeft: isRTL ? theme.spacing.sm : 0,
  },
  searchInput: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text.primary,
    padding: 0,
  },
  clearButton: {
    padding: theme.spacing.xs,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  filtersContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filtersScroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.base,
    gap: theme.spacing.sm,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: isRTL ? 0 : theme.spacing.sm,
    marginLeft: isRTL ? theme.spacing.sm : 0,
  },
  filterChipSelected: {
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.main,
  },
  filterChipText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  filterChipTextSelected: {
    color: theme.colors.background.primary,
    fontWeight: "600",
  },
  resultsContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center" as ViewStyle["justifyContent"],
    alignItems: "center" as ViewStyle["alignItems"],
    padding: theme.spacing.xl,
  } as ViewStyle,
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.base,
  },
  emptyText: {
    ...theme.typography.heading,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.base,
    textAlign: "center",
  },
  emptySubtext: {
    marginTop: theme.spacing.sm,
    textAlign: "center" as const,
  },
  resultsList: {
    padding: theme.spacing.lg,
    gap: theme.spacing.base,
  },
  resultCard: {
    marginBottom: theme.spacing.base,
  },
  resultHeader: {
    flexDirection: (isRTL
      ? "row-reverse"
      : "row") as ViewStyle["flexDirection"],
    alignItems: "flex-start" as ViewStyle["alignItems"],
    justifyContent: "space-between" as ViewStyle["justifyContent"],
  } as ViewStyle,
  resultLeft: {
    flexDirection: (isRTL
      ? "row-reverse"
      : "row") as ViewStyle["flexDirection"],
    alignItems: "center" as ViewStyle["alignItems"],
    flex: 1,
  } as ViewStyle,
  resultIcon: {
    fontSize: 24,
    marginRight: isRTL ? 0 : theme.spacing.base,
    marginLeft: isRTL ? theme.spacing.base : 0,
  },
  resultText: {
    flex: 1,
  },
  resultTitle: {
    ...theme.typography.heading,
    fontSize: 16,
    marginBottom: theme.spacing.xs / 2,
  },
  resultSubtitle: {
    color: theme.colors.text.secondary,
  },
  resultRight: {
    alignItems: (isRTL ? "flex-start" : "flex-end") as ViewStyle["alignItems"],
    gap: theme.spacing.xs,
  } as ViewStyle,
  typeBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  resultDate: {
    color: theme.colors.text.secondary,
    fontSize: 11,
  },
});
