/**
 * DailyBriefingCard
 *
 * Shows the AI-generated morning health briefing on the home dashboard.
 * Premium Individual+ gate â€” free users see a teaser with upgrade prompt.
 */

import { useRouter } from "expo-router";
import { Brain, ChevronRight, Sparkles } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { FeatureGate } from "@/components/FeatureGate";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import { type DailyBriefing, useDailyBriefing } from "@/hooks/useDailyBriefing";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type Props = {
  userId: string | undefined;
};

function BriefingContent({
  briefing,
  loading,
  isRTL,
}: {
  briefing: DailyBriefing | null;
  loading: boolean;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const { i18n } = useTranslation();

  const styles = createThemedStyles((t) => ({
    card: {
      backgroundColor: t.colors.background.secondary,
      borderRadius: 16,
      padding: t.spacing.base,
      marginBottom: t.spacing.base,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.primary.main,
    } as ViewStyle,
    header: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: t.spacing.sm,
    } as ViewStyle,
    headerLeft: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.xs,
    } as ViewStyle,
    chip: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: 4,
      backgroundColor: t.colors.primary.main + "20",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    } as ViewStyle,
    chipText: getTextStyle(t, "caption", "medium", t.colors.primary.main),
    summaryText: {
      ...getTextStyle(t, "body", "regular", t.colors.text.primary),
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
      marginBottom: t.spacing.sm,
      lineHeight: 22,
    },
    highlightsRow: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: t.spacing.xs,
      marginBottom: t.spacing.sm,
    } as ViewStyle,
    highlightChip: {
      backgroundColor: t.colors.background.tertiary,
      borderRadius: 12,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 4,
    } as ViewStyle,
    highlightText: getTextStyle(t, "caption", "regular", t.colors.text.secondary),
    askButton: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.xs,
      alignSelf: (isRTL ? "flex-start" : "flex-end") as "flex-start" | "flex-end",
      backgroundColor: t.colors.primary.main,
      paddingHorizontal: t.spacing.base,
      paddingVertical: t.spacing.xs,
      borderRadius: 20,
    } as ViewStyle,
    askButtonText: getTextStyle(t, "caption", "semibold", "#fff"),
    loadingContainer: {
      padding: t.spacing.lg,
      alignItems: "center" as const,
    } as ViewStyle,
    emptyCard: {
      backgroundColor: t.colors.background.secondary,
      borderRadius: 16,
      padding: t.spacing.base,
      marginBottom: t.spacing.base,
      alignItems: "center" as const,
      gap: t.spacing.xs,
    } as ViewStyle,
    emptyText: getTextStyle(t, "body", "regular", t.colors.text.secondary),
  }))(theme);

  if (loading) {
    return (
      <View style={styles.emptyCard}>
        <ActivityIndicator color={theme.colors.primary.main} size="small" />
        <TypographyText style={styles.emptyText}>
          {isRTL ? "Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ Ø¥Ø­Ø§Ø·ØªÙƒ Ø§Ù„ÙŠÙˆÙ…ÙŠØ©..." : "Loading your daily briefing..."}
        </TypographyText>
      </View>
    );
  }

  if (!briefing) return null;

  const highlights =
    isRTL && briefing.highlightsAr?.length
      ? briefing.highlightsAr
      : briefing.highlights;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Brain size={18} color={theme.colors.primary.main} />
          <TypographyText style={getTextStyle(theme as typeof theme, "subheading", "bold", theme.colors.text.primary)}>
            {isRTL ? "Ø¥Ø­Ø§Ø·ØªÙƒ Ø§Ù„ÙŠÙˆÙ…ÙŠØ©" : "Daily Briefing"}
          </TypographyText>
        </View>
        <View style={styles.chip}>
          <Sparkles size={10} color={theme.colors.primary.main} />
          <Caption style={styles.chipText}>{isRTL ? "Ù…Ø¯Ø¹ÙˆÙ… Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ" : "AI-powered"}</Caption>
        </View>
      </View>

      <TypographyText style={styles.summaryText}>{briefing.summary}</TypographyText>

      {highlights.length > 0 && (
        <View style={styles.highlightsRow}>
          {highlights.map((h) => (
            <View key={h} style={styles.highlightChip}>
              <Caption style={styles.highlightText}>{h}</Caption>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.askButton}
        onPress={() => router.push("/(tabs)/zeina")}
        activeOpacity={0.8}
      >
        <TypographyText style={styles.askButtonText}>
          {isRTL ? "Ø§Ø³Ø£Ù„ Ø²ÙŠÙ†Ø§" : "Ask Zeina"}
        </TypographyText>
        <ChevronRight size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function DailyBriefingCard({ userId }: Props) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { briefing, loading, hasBriefing } = useDailyBriefing(userId);

  if (!hasBriefing && !loading) return null;

  return (
    <FeatureGate featureId="DAILY_BRIEFING" showUpgradePrompt>
      <BriefingContent briefing={briefing} loading={loading} isRTL={isRTL} />
    </FeatureGate>
  );
}
