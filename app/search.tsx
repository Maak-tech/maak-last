import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Text,
  TextInput,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  globalSearchService,
  type SearchFilters,
  type SearchResult,
} from "@/lib/services/globalSearchService";
import { safeFormatDate } from "@/utils/dateFormat";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

export default function GlobalSearchScreen() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  const styles = createThemedStyles((theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
    header: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    searchContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    searchIcon: {
      marginEnd: theme.spacing.sm,
    },
    searchInput: {
      flex: 1,
      ...getTextStyle(theme, "body", "regular", theme.colors.text.primary),
      paddingVertical: theme.spacing.sm,
      textAlign: isRTL ? "right" : "left",
    },
    clearButton: {
      padding: theme.spacing.xs,
    },
    filterButton: {
      padding: theme.spacing.sm,
    },
    suggestionsContainer: {
      paddingHorizontal: theme.spacing.base,
      marginBottom: theme.spacing.md,
    },
    suggestionChip: {
      backgroundColor: theme.colors.primary[50],
      borderRadius: theme.borderRadius.full,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginEnd: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    suggestionText: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.primary.main),
    },
    resultsContainer: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
    },
    resultItem: {
      marginBottom: theme.spacing.sm,
    },
    resultCard: {
      padding: theme.spacing.md,
    },
    resultHeader: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
      marginBottom: theme.spacing.xs,
    },
    resultTitle: {
      ...getTextStyle(theme, "subheading", "bold", theme.colors.text.primary),
      flex: 1,
    },
    resultType: {
      ...getTextStyle(theme, "caption", "bold", theme.colors.primary.main),
      textTransform: "uppercase" as const,
      fontSize: 10,
    },
    resultSubtitle: {
      ...getTextStyle(theme, "body", "medium", theme.colors.text.secondary),
      marginBottom: theme.spacing.xs,
    },
    resultDescription: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.tertiary),
    },
    resultTimestamp: {
      ...getTextStyle(theme, "caption", "regular", theme.colors.text.secondary),
      marginTop: theme.spacing.xs,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingVertical: theme.spacing.xl,
    },
    emptyText: {
      ...getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
      textAlign: "center" as const,
      marginBottom: theme.spacing.md,
    },
    filtersContainer: {
      padding: theme.spacing.base,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.light,
      backgroundColor: theme.colors.background.secondary,
    },
    filterSection: {
      marginBottom: theme.spacing.md,
    },
    filterLabel: {
      ...getTextStyle(theme, "body", "bold", theme.colors.text.primary),
      marginBottom: theme.spacing.sm,
    },
    filterChips: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
    },
    filterChip: {
      backgroundColor: theme.colors.background.primary,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      marginEnd: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border.light,
    },
    filterChipActive: {
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.main,
    },
    filterChipText: {
      ...getTextStyle(theme, "caption", "medium", theme.colors.text.primary),
    },
    filterChipTextActive: {
      color: theme.colors.neutral.white,
    },
    rtlText: {
      textAlign: isRTL ? "right" : "left",
    },
  }))(theme);

  useEffect(() => {
    loadSuggestions();
  }, []);

  useEffect(() => {
    // Debounced search
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, filters]);

  const loadSuggestions = async () => {
    if (!user?.id) return;

    try {
      const userSuggestions = await globalSearchService.getSearchSuggestions(
        user.id
      );
      setSuggestions(userSuggestions);
    } catch (error) {
      // Silently handle error
    }
  };

  const performSearch = async (searchQuery: string) => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const searchResults = await globalSearchService.search(
        user.id,
        searchQuery,
        filters
      );
      setResults(searchResults);
    } catch (error) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        isRTL ? "فشل في البحث" : "Search failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResultPress = (result: SearchResult) => {
    if (result.action?.route) {
      router.push(result.action.route as any);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setQuery(suggestion);
    Keyboard.dismiss();
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    Keyboard.dismiss();
  };

  const toggleFilter = (type: keyof SearchFilters, value: string) => {
    setFilters((prev) => {
      const currentValues = (prev[type] as string[]) || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];

      return {
        ...prev,
        [type]: newValues.length > 0 ? newValues : undefined,
      };
    });
  };

  const getResultIcon = (type: SearchResult["type"]) => {
    const iconProps = { size: 20, color: theme.colors.primary.main };
    switch (type) {
      case "medication":
        return <Ionicons name="medical" {...iconProps} />;
      case "symptom":
        return <Ionicons name="pulse" {...iconProps} />;
      case "mood":
        return <Ionicons name="happy" {...iconProps} />;
      case "family":
        return <Ionicons name="people" {...iconProps} />;
      default:
        return <Ionicons name="search" {...iconProps} />;
    }
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      onPress={() => handleResultPress(item)}
      style={styles.resultItem as ViewStyle}
    >
      <Card
        contentStyle={{}}
        onPress={() => {}}
        pressable={false}
        style={styles.resultCard as ViewStyle}
        variant="elevated"
      >
        <View style={styles.resultHeader as ViewStyle}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            {getResultIcon(item.type)}
            <Text
              style={[
                styles.resultTitle as TextStyle,
                { marginStart: theme.spacing.sm },
              ]}
            >
              {item.title}
            </Text>
          </View>
          <Badge size="small" style={{}} variant="outline">
            {item.type}
          </Badge>
        </View>

        <Text style={styles.resultSubtitle as TextStyle}>{item.subtitle}</Text>

        <Text numberOfLines={2} style={styles.resultDescription as TextStyle}>
          {item.description}
        </Text>

        <Text style={styles.resultTimestamp as TextStyle}>
          {safeFormatDate(item.timestamp)}
        </Text>
      </Card>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer as ViewStyle}>
      <Ionicons
        color={theme.colors.text.tertiary}
        name="search-outline"
        size={48}
      />
      <Text style={styles.emptyText as TextStyle}>
        {query.trim()
          ? isRTL
            ? "لا توجد نتائج لهذا البحث"
            : "No results found for this search"
          : isRTL
            ? "ابدأ البحث عن بياناتك الصحية"
            : "Start searching your health data"}
      </Text>
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer as ViewStyle}>
      <View style={styles.filterSection as ViewStyle}>
        <Text style={styles.filterLabel as TextStyle}>
          {isRTL ? "نوع البيانات" : "Data Types"}
        </Text>
        <View style={styles.filterChips as ViewStyle}>
          {[
            { key: "medication", label: isRTL ? "الأدوية" : "Medications" },
            { key: "symptom", label: isRTL ? "الأعراض" : "Symptoms" },
            { key: "mood", label: isRTL ? "الحالة النفسية" : "Mood" },
            { key: "family", label: isRTL ? "العائلة" : "Family" },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => toggleFilter("types", key)}
              style={[
                styles.filterChip as ViewStyle,
                (filters.types || []).includes(key) &&
                  (styles.filterChipActive as ViewStyle),
              ]}
            >
              <Text
                style={[
                  styles.filterChipText as TextStyle,
                  (filters.types || []).includes(key) &&
                    (styles.filterChipTextActive as TextStyle),
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container as ViewStyle}>
      <View style={styles.header as ViewStyle}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginBottom: theme.spacing.md }}
        >
          <Ionicons
            color={theme.colors.text.primary}
            name="arrow-back"
            size={24}
          />
        </TouchableOpacity>

        <View style={styles.searchContainer as ViewStyle}>
          <Ionicons
            color={theme.colors.text.secondary}
            name="search"
            size={20}
            style={styles.searchIcon as TextStyle}
          />
          <TextInput
            autoFocus
            onChangeText={setQuery}
            onSubmitEditing={() => Keyboard.dismiss()}
            placeholder={
              isRTL ? "البحث في البيانات الصحية..." : "Search health data..."
            }
            returnKeyType="search"
            style={styles.searchInput as TextStyle}
            value={query}
          />
          {query ? (
            <TouchableOpacity
              onPress={clearSearch}
              style={styles.clearButton as ViewStyle}
            >
              <Ionicons
                color={theme.colors.text.secondary}
                name="close-circle"
                size={20}
              />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={styles.filterButton as ViewStyle}
          >
            <Ionicons
              color={
                showFilters
                  ? theme.colors.primary.main
                  : theme.colors.text.secondary
              }
              name="filter"
              size={20}
            />
          </TouchableOpacity>
        </View>
      </View>

      {showFilters && renderFilters()}

      {!query.trim() && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer as ViewStyle}>
          <Text
            style={[
              styles.filterLabel as TextStyle,
              { marginBottom: theme.spacing.sm },
            ]}
          >
            {isRTL ? "اقتراحات البحث" : "Search Suggestions"}
          </Text>
          <View style={styles.filterChips as ViewStyle}>
            {suggestions.slice(0, 8).map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                onPress={() => handleSuggestionPress(suggestion)}
                style={styles.suggestionChip as ViewStyle}
              >
                <Text style={styles.suggestionText as TextStyle}>
                  {suggestion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.resultsContainer as ViewStyle}>
        {loading ? (
          <View style={styles.emptyContainer as ViewStyle}>
            <ActivityIndicator color={theme.colors.primary.main} size="large" />
          </View>
        ) : (
          <FlatList
            data={results}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmptyState}
            renderItem={renderResult}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
