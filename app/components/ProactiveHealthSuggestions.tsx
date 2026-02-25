/* biome-ignore-all lint/nursery/noShadow: Local theme callback naming in style factory is kept for consistency in this component. */
import { router } from "expo-router";
import {
  Activity,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Heart,
  Lightbulb,
  Pill,
  Smile,
  TrendingUp,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import EnrichedDiscoveryCard from "@/components/EnrichedDiscoveryCard";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  discoveryService,
  type EnrichedDiscovery,
} from "@/lib/services/discoveryService";
import {
  type HealthSuggestion,
  proactiveHealthSuggestionsService,
} from "@/lib/services/proactiveHealthSuggestionsService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type ProactiveHealthSuggestionsProps = {
  maxSuggestions?: number;
  showDismissed?: boolean;
  onSuggestionTap?: (suggestion: HealthSuggestion) => void;
  /** When true, appends the top new health discovery after the suggestions list */
  showDiscoveries?: boolean;
};

export default function ProactiveHealthSuggestions({
  maxSuggestions = 5,
  showDismissed: _showDismissed = false,
  onSuggestionTap,
  showDiscoveries = false,
}: ProactiveHealthSuggestionsProps) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [suggestions, setSuggestions] = useState<HealthSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [_refreshing, setRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const lastLoadRef = useRef<number>(0);
  const dismissedIdsRef = useRef(dismissedIds);
  dismissedIdsRef.current = dismissedIds;
  const CACHE_MS = 10 * 60_000; // 10 minutes

  // Top new discovery state (only loaded when showDiscoveries=true)
  const [topDiscovery, setTopDiscovery] = useState<EnrichedDiscovery | null>(null);

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
    headerTitle: getTextStyle(
      theme,
      "subheading",
      "bold",
      theme.colors.text.primary
    ),
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
    suggestionTitle: getTextStyle(
      theme,
      "subheading",
      "bold",
      theme.colors.text.primary
    ),
    suggestionDescription: getTextStyle(
      theme,
      "body",
      "regular",
      theme.colors.text.secondary
    ),
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
    emptyText: getTextStyle(
      theme,
      "body",
      "regular",
      theme.colors.text.secondary
    ),
    rtlText: {
      textAlign: (isRTL ? "right" : "left") as
        | "left"
        | "right"
        | "center"
        | "justify"
        | "auto",
    },
  }))(theme);

  // biome-ignore lint/correctness/useExhaustiveDependencies: suggestions.length intentionally omitted to prevent refetch loop
  const loadSuggestions = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        return;
      }

      // Skip reload if cache is fresh (unless explicit refresh)
      if (
        !isRefresh &&
        Date.now() - lastLoadRef.current < CACHE_MS &&
        suggestions.length > 0
      ) {
        setLoading(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const allSuggestions =
          await proactiveHealthSuggestionsService.generateSuggestions(
            user.id,
            isRTL
          );

        // Filter out dismissed suggestions using ref to avoid dependency
        const currentDismissed = dismissedIdsRef.current;
        const filteredSuggestions = allSuggestions.filter(
          (s) => !currentDismissed.has(s.id)
        );

        setSuggestions(filteredSuggestions.slice(0, maxSuggestions));
        lastLoadRef.current = Date.now();
      } catch (_error) {
        // Silently handle error
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, maxSuggestions, isRTL]
  );

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  // Load top new discovery when showDiscoveries is enabled
  useEffect(() => {
    if (!showDiscoveries || !user?.id) return;
    let cancelled = false;
    discoveryService.getTopDiscoveries(user.id, 5, isRTL).then((results) => {
      if (cancelled) return;
      const newest = results.find((d) => d.status === "new") ?? null;
      setTopDiscovery(newest);
    }).catch(() => {
      // Non-critical
    });
    return () => { cancelled = true; };
  }, [showDiscoveries, user?.id, isRTL]);

  const handleDismiss = (suggestionId: string) => {
    setDismissedIds((prev) => new Set(prev).add(suggestionId));
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
  };

  const handleDismissDiscovery = (discoveryId: string) => {
    setTopDiscovery(null);
    if (user?.id) {
      discoveryService.dismissDiscovery(user.id, discoveryId).catch(() => {});
    }
  };

  const comingSoonRoutes = [
    "/(tabs)/calendar",
    "/(tabs)/calendar/add",
    "/(tabs)/resources",
  ];

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This handler intentionally centralizes route and action fallbacks for suggestions.
  const handleSuggestionTap = (suggestion: HealthSuggestion) => {
    if (onSuggestionTap) {
      onSuggestionTap(suggestion);
    } else if (suggestion.action?.route) {
      if (
        comingSoonRoutes.some((route) =>
          suggestion.action?.route?.includes(route)
        )
      ) {
        Alert.alert(
          isRTL ? "قريباً" : "Coming Soon",
          isRTL
            ? "هذه الميزة قيد التطوير وستكون متاحة قريباً."
            : "This feature is under development and will be available soon.",
          [{ text: isRTL ? "حسناً" : "OK" }]
        );
      } else {
        router.push(
          suggestion.action.route as Parameters<typeof router.push>[0]
        );
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
      // Discovery-derived suggestions (EN + AR)
      Discoveries: "#0D9488",
      الاكتشافات: "#0D9488",
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
          <ActivityIndicator color={theme.colors.primary.main} size="small" />
        </View>
      </View>
    );
  }

  if (suggestions.length === 0 && (!showDiscoveries || !topDiscovery)) {
    return null;
  }

  if (suggestions.length === 0 && showDiscoveries && topDiscovery) {
    // Only a discovery to show — render it under the section header
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Heading
            level={6}
            style={[styles.headerTitle, isRTL && styles.rtlText]}
          >
            {isRTL ? "الاقتراحات والاكتشافات" : "Suggestions & Discoveries"}
          </Heading>
        </View>
        <View style={{ marginTop: theme.spacing.xs }}>
          <EnrichedDiscoveryCard discovery={topDiscovery} onDismiss={handleDismissDiscovery} />
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/discoveries" as Parameters<typeof router.push>[0])}
          style={[styles.suggestionAction, { marginTop: theme.spacing.sm }]}
        >
          <Caption style={{ color: theme.colors.primary.main }}>
            {isRTL ? "عرض جميع الاكتشافات" : "See all discoveries"}
          </Caption>
          <ChevronRight color={theme.colors.primary.main} size={16} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Heading
          level={6}
          style={[styles.headerTitle, isRTL && styles.rtlText]}
        >
          {showDiscoveries
            ? (isRTL ? "الاقتراحات والاكتشافات" : "Suggestions & Discoveries")
            : (isRTL ? "اقتراحات صحية" : "Health Suggestions")}
        </Heading>
        <Badge size="small" style={{}} variant="outline">
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
            contentStyle={{}}
            key={suggestion.id}
            onPress={() => handleSuggestionTap(suggestion)}
            style={[
              styles.suggestionCard,
              {
                borderLeftColor: getPriorityColor(suggestion.priority),
                width: 260,
                marginRight: theme.spacing.sm,
                marginBottom: 0,
              },
            ]}
            variant="elevated"
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
                    style={[styles.suggestionTitle, isRTL && styles.rtlText]}
                    weight="bold"
                  >
                    {suggestion.title}
                  </TypographyText>
                  <Badge
                    size="small"
                    style={{
                      marginBottom: theme.spacing.xs,
                      alignSelf: "flex-start",
                      borderColor: getCategoryColor(suggestion.category),
                    }}
                    variant="outline"
                  >
                    <Caption
                      numberOfLines={1}
                      style={{ color: getCategoryColor(suggestion.category) }}
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
                <X color={theme.colors.text.secondary} size={16} />
              </TouchableOpacity>
            </View>

            <TypographyText
              style={[styles.suggestionDescription, isRTL && styles.rtlText]}
            >
              {suggestion.description}
            </TypographyText>

            {suggestion.action ? (
              <TouchableOpacity
                onPress={() => handleSuggestionTap(suggestion)}
                style={styles.suggestionAction}
              >
                <TypographyText
                  style={{ color: getPriorityColor(suggestion.priority) }}
                  weight="semibold"
                >
                  {suggestion.action.label}
                </TypographyText>
                <ChevronRight
                  color={getPriorityColor(suggestion.priority)}
                  size={16}
                />
              </TouchableOpacity>
            ) : null}
          </Card>
        ))}
      </ScrollView>

      {showDiscoveries && topDiscovery && (
        <View style={{ marginTop: theme.spacing.base }}>
          <EnrichedDiscoveryCard discovery={topDiscovery} onDismiss={handleDismissDiscovery} />
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/discoveries" as Parameters<typeof router.push>[0])}
            style={[styles.suggestionAction, { marginTop: theme.spacing.sm }]}
          >
            <Caption style={{ color: theme.colors.primary.main }}>
              {isRTL ? "عرض جميع الاكتشافات" : "See all discoveries"}
            </Caption>
            <ChevronRight color={theme.colors.primary.main} size={16} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
