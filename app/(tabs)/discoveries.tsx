import { useRouter } from "expo-router";
import { ArrowLeft, Sparkles } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import CorrelationDiscoveryCard from "@/app/components/CorrelationDiscoveryCard";
import {
  Caption,
  Heading,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import GradientScreen from "@/components/figma/GradientScreen";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useCorrelationDiscoveries } from "@/hooks/useCorrelationDiscoveries";
import type { DiscoveryCategory } from "@/types/discoveries";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type FilterTab = "all" | DiscoveryCategory;

const FILTER_TABS: Array<{
  key: FilterTab;
  en: string;
  ar: string;
}> = [
  { key: "all", en: "All", ar: "الكل" },
  { key: "symptom_medication", en: "Medications", ar: "الأدوية" },
  { key: "symptom_mood", en: "Mood", ar: "المزاج" },
  { key: "symptom_vital", en: "Vitals", ar: "الحيوية" },
  { key: "temporal_pattern", en: "Timing", ar: "التوقيت" },
];

export default function DiscoveriesScreen() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [refreshing, setRefreshing] = useState(false);

  const { discoveries, loading, refresh, dismiss, filterByCategory } =
    useCorrelationDiscoveries(user?.id, { isArabic: isRTL });

  const filteredDiscoveries =
    activeFilter === "all"
      ? discoveries.filter((d) => d.status !== "dismissed")
      : filterByCategory(activeFilter as DiscoveryCategory).filter(
          (d) => d.status !== "dismissed"
        );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const styles = createThemedStyles((t) => ({
    headerContainer: {
      paddingTop: 60,
      paddingBottom: t.spacing.lg,
      paddingHorizontal: t.spacing.base,
    } as ViewStyle,
    headerRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.sm,
      marginBottom: t.spacing.sm,
    } as ViewStyle,
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center" as const,
      alignItems: "center" as const,
    } as ViewStyle,
    headerTitle: getTextStyle(t, "heading", "bold", "#fff"),
    headerSubtitle: getTextStyle(t, "body", "regular", "rgba(255,255,255,0.8)"),
    content: {
      flex: 1,
      paddingHorizontal: t.spacing.base,
      paddingTop: t.spacing.base,
    } as ViewStyle,
    filterRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      marginBottom: t.spacing.base,
    } as ViewStyle,
    filterTab: {
      paddingHorizontal: t.spacing.base,
      paddingVertical: t.spacing.sm,
      borderRadius: 20,
      marginRight: isRTL ? 0 : t.spacing.sm,
      marginLeft: isRTL ? t.spacing.sm : 0,
      backgroundColor: t.colors.background.secondary,
    } as ViewStyle,
    filterTabActive: {
      backgroundColor: t.colors.primary.main,
    } as ViewStyle,
    filterTabText: getTextStyle(
      t,
      "caption",
      "semibold",
      t.colors.text.secondary
    ),
    filterTabTextActive: {
      color: "#fff",
    },
    emptyContainer: {
      alignItems: "center" as const,
      paddingVertical: t.spacing.xl * 2,
    } as ViewStyle,
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: t.colors.background.secondary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: t.spacing.base,
    } as ViewStyle,
    emptyTitle: getTextStyle(t, "subheading", "bold", t.colors.text.primary),
    emptyText: getTextStyle(t, "body", "regular", t.colors.text.secondary),
    countText: getTextStyle(t, "caption", "regular", t.colors.text.secondary),
    rtlText: {
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
    },
  }))(theme);

  return (
    <GradientScreen>
      <ScrollView
        refreshControl={
          <RefreshControl onRefresh={onRefresh} refreshing={refreshing} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <WavyBackground>
          <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <ArrowLeft color="#fff" size={20} />
              </TouchableOpacity>
              <Sparkles color="#fff" size={24} />
              <Heading level={3} style={styles.headerTitle}>
                {isRTL ? "الاكتشافات الصحية" : "Health Discoveries"}
              </Heading>
            </View>
            <TypographyText style={styles.headerSubtitle}>
              {isRTL
                ? "أنماط وارتباطات مكتشفة من بياناتك الصحية"
                : "Patterns and correlations found in your health data"}
            </TypographyText>
          </View>
        </WavyBackground>

        <View style={styles.content}>
          {/* Filter Tabs */}
          <ScrollView
            contentContainerStyle={styles.filterRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {FILTER_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveFilter(tab.key)}
                style={[
                  styles.filterTab,
                  activeFilter === tab.key && styles.filterTabActive,
                ]}
              >
                <Caption
                  style={[
                    styles.filterTabText,
                    activeFilter === tab.key && styles.filterTabTextActive,
                  ]}
                >
                  {isRTL ? tab.ar : tab.en}
                </Caption>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Count */}
          {!loading && filteredDiscoveries.length > 0 && (
            <Caption
              style={[styles.countText, { marginBottom: theme.spacing.sm }]}
            >
              {isRTL
                ? `${filteredDiscoveries.length} اكتشاف`
                : `${filteredDiscoveries.length} discoveries found`}
            </Caption>
          )}

          {/* Loading */}
          {loading && (
            <View style={styles.emptyContainer}>
              <ActivityIndicator
                color={theme.colors.primary.main}
                size="large"
              />
              <TypographyText
                style={[styles.emptyText, { marginTop: theme.spacing.base }]}
              >
                {isRTL ? "جارٍ تحليل بياناتك..." : "Analyzing your data..."}
              </TypographyText>
            </View>
          )}

          {/* Empty State */}
          {!loading && filteredDiscoveries.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Sparkles color={theme.colors.text.secondary} size={32} />
              </View>
              <Heading
                level={6}
                style={[styles.emptyTitle, isRTL && styles.rtlText]}
              >
                {isRTL ? "لا اكتشافات بعد" : "No discoveries yet"}
              </Heading>
              <TypographyText
                style={[
                  styles.emptyText,
                  { textAlign: "center", marginTop: theme.spacing.sm },
                ]}
              >
                {isRTL
                  ? "استمر في تسجيل الأعراض والأدوية والحالة المزاجية لاكتشاف الأنماط"
                  : "Keep logging symptoms, medications, and moods to discover patterns"}
              </TypographyText>
            </View>
          )}

          {/* Discovery Cards */}
          {!loading &&
            filteredDiscoveries.map((discovery) => (
              <CorrelationDiscoveryCard
                discovery={discovery}
                key={discovery.id}
                onDismiss={dismiss}
              />
            ))}
        </View>
      </ScrollView>
    </GradientScreen>
  );
}
