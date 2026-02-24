import { router } from "expo-router";
import { ChevronRight, Sparkles } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  discoveryService,
  type EnrichedDiscovery,
} from "@/lib/services/discoveryService";
import EnrichedDiscoveryCard from "@/components/EnrichedDiscoveryCard";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

export default function DiscoveryCardsSection() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const [topDiscoveries, setTopDiscoveries] = useState<EnrichedDiscovery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await discoveryService.getTopDiscoveries(user.id, 5, isRTL);
        if (!cancelled) setTopDiscoveries(results);
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, isRTL]);

  const newDiscoveries = topDiscoveries.filter((d) => d.status === "new");

  const dismiss = useCallback(
    (discoveryId: string) => {
      // Optimistic local remove
      setTopDiscoveries((prev) => prev.filter((d) => d.id !== discoveryId));
      // Persist so it stays dismissed across sessions
      if (user?.id) {
        discoveryService.dismissDiscovery(user.id, discoveryId).catch(() => {
          // Non-critical — UI already updated
        });
      }
    },
    [user?.id]
  );

  const styles = createThemedStyles((t) => ({
    container: {
      marginBottom: t.spacing.base,
    } as ViewStyle,
    header: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: t.spacing.base,
    } as ViewStyle,
    headerLeft: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.sm,
    } as ViewStyle,
    headerTitle: getTextStyle(t, "subheading", "bold", t.colors.text.primary),
    viewAllButton: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.xs,
    } as ViewStyle,
    emptyContainer: {
      padding: t.spacing.lg,
      alignItems: "center" as const,
    } as ViewStyle,
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.colors.background.secondary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: t.spacing.sm,
    } as ViewStyle,
    emptyText: getTextStyle(t, "body", "regular", t.colors.text.secondary),
    rtlText: {
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
    },
  }))(theme);

  if (!user) return null;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={theme.colors.primary.main} size="small" />
        </View>
      </View>
    );
  }

  if (topDiscoveries.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Sparkles color={theme.colors.primary.main} size={20} />
            <Heading
              level={6}
              style={[styles.headerTitle, isRTL && styles.rtlText]}
            >
              {isRTL ? "اكتشافات صحية" : "Health Discoveries"}
            </Heading>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Sparkles color={theme.colors.text.secondary} size={24} />
          </View>
          <TypographyText style={[styles.emptyText, isRTL && styles.rtlText]}>
            {isRTL
              ? "استمر في تسجيل بياناتك لاكتشاف الأنماط"
              : "Keep logging to discover health patterns"}
          </TypographyText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Sparkles color={theme.colors.primary.main} size={20} />
          <Heading
            level={6}
            style={[styles.headerTitle, isRTL && styles.rtlText]}
          >
            {isRTL ? "اكتشافات صحية" : "Health Discoveries"}
          </Heading>
          {newDiscoveries.length > 0 && (
            <Badge size="small" style={{}} variant="outline">
              {newDiscoveries.length} {isRTL ? "جديد" : "new"}
            </Badge>
          )}
        </View>
        <TouchableOpacity
          onPress={() =>
            router.push(
              "/(tabs)/discoveries" as Parameters<typeof router.push>[0]
            )
          }
          style={styles.viewAllButton}
        >
          <Caption style={{ color: theme.colors.primary.main }}>
            {isRTL ? "عرض الكل" : "View All"}
          </Caption>
          <ChevronRight color={theme.colors.primary.main} size={16} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingRight: isRTL ? 0 : theme.spacing.base,
          paddingLeft: isRTL ? theme.spacing.base : 0,
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {topDiscoveries.map((discovery) => (
          <View
            key={discovery.id}
            style={{
              width: 300,
              marginRight: isRTL ? 0 : theme.spacing.sm,
              marginLeft: isRTL ? theme.spacing.sm : 0,
            }}
          >
            <EnrichedDiscoveryCard
              discovery={discovery}
              onDismiss={dismiss}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
