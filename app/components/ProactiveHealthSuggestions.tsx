import { router } from "expo-router";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  Heart,
  Lightbulb,
  Pill,
  Smile,
  TrendingUp,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  proactiveHealthSuggestionsService,
  type HealthSuggestion,
} from "@/lib/services/proactiveHealthSuggestionsService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Card } from "@/components/design-system";
import { Caption, Heading, Text as TypographyText } from "@/components/design-system/Typography";

interface ProactiveHealthSuggestionsProps {
  maxSuggestions?: number;
  showDismissed?: boolean;
  onSuggestionTap?: (suggestion: HealthSuggestion) => void;
}

export default function ProactiveHealthSuggestions({
  maxSuggestions = 5,
  showDismissed = false,
  onSuggestionTap,
}: ProactiveHealthSuggestionsProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [suggestions, setSuggestions] = useState<HealthSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const styles = createThemedStyles((theme) => ({
    container: {
      marginBottom: theme.spacing.base,
    } as ViewStyle,
    header: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.base,
    } as ViewStyle,
    headerTitle: getTextStyle(theme, "subheading", "bold", theme.colors.text.primary),
    suggestionCard: {
      marginBottom: theme.spacing.base,
      borderLeftWidth: 4,
    } as ViewStyle,
    suggestionHeader: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
      marginBottom: theme.spacing.xs,
    } as ViewStyle,
    suggestionLeft: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: theme.spacing.sm,
      flex: 1,
    } as ViewStyle,
    suggestionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    } as ViewStyle,
    suggestionContent: {
      flex: 1,
    } as ViewStyle,
    suggestionTitle: getTextStyle(theme, "subheading", "bold", theme.colors.text.primary),
    suggestionDescription: getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
    suggestionAction: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    } as ViewStyle,
    dismissButton: {
      padding: theme.spacing.xs,
    } as ViewStyle,
    emptyContainer: {
      padding: theme.spacing.xl,
      alignItems: "center" as const,
    } as ViewStyle,
    emptyText: getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
    rtlText: {
      textAlign: (isRTL ? "right" : "left") as "left" | "right" | "center" | "justify" | "auto",
    },
  }))(theme) as any;

  const loadSuggestions = useCallback(async (isRefresh = false) => {
    if (!user) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const allSuggestions = await proactiveHealthSuggestionsService.generateSuggestions(
        user.id,
        isRTL
      );

      // Filter out dismissed suggestions
      const filteredSuggestions = allSuggestions.filter(
        (s) => !dismissedIds.has(s.id)
      );

      setSuggestions(
        filteredSuggestions.slice(0, maxSuggestions)
      );
    } catch (error) {
      // Silently handle error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, maxSuggestions, dismissedIds, isRTL]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleDismiss = (suggestionId: string) => {
    setDismissedIds((prev) => new Set(prev).add(suggestionId));
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
  };

  const comingSoonRoutes = [
    "/(tabs)/calendar",
    "/(tabs)/calendar/add",
    "/(tabs)/resources",
  ];

  const handleSuggestionTap = (suggestion: HealthSuggestion) => {
    if (onSuggestionTap) {
      onSuggestionTap(suggestion);
    } else if (suggestion.action?.route) {
      if (comingSoonRoutes.some(route => suggestion.action?.route?.includes(route))) {
        Alert.alert(
          isRTL ? "قريباً" : "Coming Soon",
          isRTL 
            ? "هذه الميزة قيد التطوير وستكون متاحة قريباً."
            : "This feature is under development and will be available soon.",
          [{ text: isRTL ? "حسناً" : "OK" }]
        );
      } else {
        router.push(suggestion.action.route as any);
      }
    } else if (suggestion.action?.action) {
      suggestion.action.action();
    }
  };

  const getIcon = (iconName?: string) => {
    const iconProps = { size: 20, color: theme.colors.neutral.white };
    switch (iconName) {
      case "Pill":
        return <Pill {...iconProps} />;
      case "Activity":
        return <Activity {...iconProps} />;
      case "Smile":
        return <Smile {...iconProps} />;
      case "Heart":
        return <Heart {...iconProps} />;
      case "Calendar":
        return <Calendar {...iconProps} />;
      case "AlertTriangle":
        return <AlertTriangle {...iconProps} />;
      case "TrendingUp":
        return <TrendingUp {...iconProps} />;
      default:
        return <Lightbulb {...iconProps} />;
    }
  };

  const getPriorityColor = (priority: HealthSuggestion["priority"]): string => {
    switch (priority) {
      case "high":
        return theme.colors.accent.error;
      case "medium":
        return theme.colors.accent.warning;
      case "low":
        return theme.colors.primary.main;
      default:
        return theme.colors.border.medium;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Medication: "#3B82F6",
      Symptoms: "#EF4444",
      Wellness: "#10B981",
      Lifestyle: "#8B5CF6",
      Health: "#F59E0B",
      "Preventive Care": "#6366F1",
    };
    return colors[category] || theme.colors.primary.main;
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary.main} />
        </View>
      </View>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Heading level={6} style={[styles.headerTitle, isRTL && styles.rtlText]}>
          {isRTL ? "اقتراحات صحية" : "Health Suggestions"}
        </Heading>
        <Badge variant="outline" size="small" style={{}}>
          {suggestions.length}
        </Badge>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: theme.spacing.base }}
      >
        {suggestions.map((suggestion) => (
          <Card
            key={suggestion.id}
            variant="elevated"
            style={[
              styles.suggestionCard,
              {
                width: 300,
                borderLeftColor: getPriorityColor(suggestion.priority),
              },
            ]}
            contentStyle={{}}
            onPress={() => handleSuggestionTap(suggestion)}
          >
            <View style={styles.suggestionHeader}>
              <View style={styles.suggestionLeft}>
                <View
                  style={[
                    styles.suggestionIcon,
                    { backgroundColor: getCategoryColor(suggestion.category) },
                  ]}
                >
                  {getIcon(suggestion.icon)}
                </View>
                <View style={styles.suggestionContent}>
                  <TypographyText
                    weight="bold"
                    style={[styles.suggestionTitle, isRTL && styles.rtlText]}
                  >
                    {suggestion.title}
                  </TypographyText>
                  <Badge
                    variant="outline"
                    size="small"
                    style={{
                      marginBottom: theme.spacing.xs,
                      alignSelf: "flex-start",
                      borderColor: getCategoryColor(suggestion.category),
                    }}
                  >
                    <Caption 
                      style={{ color: getCategoryColor(suggestion.category) }}
                      numberOfLines={1}
                    >
                      {suggestion.category}
                    </Caption>
                  </Badge>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleDismiss(suggestion.id)}
                style={styles.dismissButton}
              >
                <X size={16} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <TypographyText
              style={[styles.suggestionDescription, isRTL && styles.rtlText]}
            >
              {suggestion.description}
            </TypographyText>

            {suggestion.action && (
              <TouchableOpacity
                onPress={() => handleSuggestionTap(suggestion)}
                style={styles.suggestionAction}
              >
                <TypographyText
                  weight="semibold"
                  style={{ color: getPriorityColor(suggestion.priority) }}
                >
                  {suggestion.action.label}
                </TypographyText>
                <ChevronRight
                  size={16}
                  color={getPriorityColor(suggestion.priority)}
                />
              </TouchableOpacity>
            )}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
