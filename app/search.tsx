import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { globalSearchService, type SearchResult, type SearchFilters } from "@/lib/services/globalSearchService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Card } from "@/components/design-system";
import { Heading, Text as TypographyText } from "@/components/design-system/Typography";

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
      const userSuggestions = await globalSearchService.getSearchSuggestions(user.id);
      setSuggestions(userSuggestions);
    } catch (error) {
      // Silently handle error
    }
  };

  const performSearch = async (searchQuery: string) => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const searchResults = await globalSearchService.search(user.id, searchQuery, filters);
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
    setFilters(prev => {
      const currentValues = prev[type] as string[] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
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
      style={styles.resultItem}
    >
      <Card 
        variant="elevated" 
        style={styles.resultCard}
        pressable={false}
      >
        <View style={styles.resultHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            {getResultIcon(item.type)}
            <Text style={[styles.resultTitle, { marginStart: theme.spacing.sm }]}>
              {item.title}
            </Text>
          </View>
          <Badge variant="outline" size="small" style={{}}>
            {item.type}
          </Badge>
        </View>

        <Text style={styles.resultSubtitle}>
          {item.subtitle}
        </Text>

        <Text style={styles.resultDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <Text style={styles.resultTimestamp}>
          {item.timestamp.toLocaleDateString()}
        </Text>
      </Card>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="search-outline"
        size={48}
        color={theme.colors.text.tertiary}
      />
      <Text style={styles.emptyText}>
        {query.trim()
          ? (isRTL ? "لا توجد نتائج لهذا البحث" : "No results found for this search")
          : (isRTL ? "ابدأ البحث عن بياناتك الصحية" : "Start searching your health data")
        }
      </Text>
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>
          {isRTL ? "نوع البيانات" : "Data Types"}
        </Text>
        <View style={styles.filterChips}>
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
                styles.filterChip,
                (filters.types || []).includes(key) && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  (filters.types || []).includes(key) && styles.filterChipTextActive,
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginBottom: theme.spacing.md }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={theme.colors.text.secondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={isRTL ? "البحث في البيانات الصحية..." : "Search health data..."}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {query ? (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={styles.filterButton}
          >
            <Ionicons
              name="filter"
              size={20}
              color={showFilters ? theme.colors.primary.main : theme.colors.text.secondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {showFilters && renderFilters()}

      {!query.trim() && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={[styles.filterLabel, { marginBottom: theme.spacing.sm }]}>
            {isRTL ? "اقتراحات البحث" : "Search Suggestions"}
          </Text>
          <View style={styles.filterChips}>
            {suggestions.slice(0, 8).map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                onPress={() => handleSuggestionPress(suggestion)}
                style={styles.suggestionChip}
              >
                <Text style={styles.suggestionText}>
                  {suggestion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.resultsContainer}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary.main} />
          </View>
        ) : (
          <FlatList
            data={results}
            renderItem={renderResult}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmptyState}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </SafeAreaView>
  );
}
        )}
      </View>
    </SafeAreaView>
  );
}