/**
 * LabInsightsCard
 *
 * variant="analytics" — summary card shown on the analytics screen
 * variant="banner"    — slim banner shown at the top of the lab results screen
 * Premium Individual+ gate.
 */

import { useRouter } from "expo-router";
import { AlertCircle, ChevronRight, FlaskConical, TrendingDown, TrendingUp } from "lucide-react-native";
import { useState } from "react";
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
import { useLabInsights } from "@/hooks/useLabInsights";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type Props = {
  userId: string | undefined;
  variant?: "analytics" | "banner";
};

function AnalyticsContent({
  userId,
  isRTL,
}: {
  userId: string | undefined;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const { insights, loading } = useLabInsights(userId);
  const [expanded, setExpanded] = useState(false);

  const styles = createThemedStyles((t) => ({
    card: {
      backgroundColor: t.colors.background.secondary,
      borderRadius: 16,
      padding: t.spacing.base,
      marginBottom: t.spacing.base,
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
      gap: t.spacing.sm,
    } as ViewStyle,
    badgeRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      gap: t.spacing.xs,
    } as ViewStyle,
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    } as ViewStyle,
    badgeText: getTextStyle(t, "caption", "semibold", "#fff"),
    biomarkerRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingVertical: t.spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border.light,
    } as ViewStyle,
    biomarkerName: getTextStyle(t, "body", "medium", t.colors.text.primary),
    biomarkerValue: getTextStyle(t, "caption", "regular", t.colors.text.secondary),
    narrativeText: {
      ...getTextStyle(t, "body", "regular", t.colors.text.secondary),
      lineHeight: 20,
      marginTop: t.spacing.sm,
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
    },
    viewAllButton: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      justifyContent: "flex-end" as const,
      gap: t.spacing.xs,
      marginTop: t.spacing.sm,
    } as ViewStyle,
    viewAllText: getTextStyle(t, "caption", "semibold", t.colors.primary.main),
    loadingContainer: {
      padding: t.spacing.lg,
      alignItems: "center" as const,
    } as ViewStyle,
  }))(theme);

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary.main} size="small" />
        </View>
      </View>
    );
  }

  if (!insights) return null;

  const narrative = isRTL ? insights.aiNarrativeAr : insights.aiNarrative;
  const topFlagged = insights.flaggedBiomarkers.slice(0, 3);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <FlaskConical size={18} color={theme.colors.primary.main} />
          <TypographyText
            style={getTextStyle(theme as typeof theme, "subheading", "bold", theme.colors.text.primary)}
          >
            {isRTL ? "تحليل نتائج المختبر" : "Lab Insights"}
          </TypographyText>
        </View>
        <View style={styles.badgeRow}>
          {insights.criticalCount > 0 && (
            <View style={[styles.badge, { backgroundColor: "#EF4444" }]}>
              <Caption style={styles.badgeText}>
                {insights.criticalCount} {isRTL ? "حرج" : "critical"}
              </Caption>
            </View>
          )}
          {insights.flaggedCount > 0 && (
            <View style={[styles.badge, { backgroundColor: "#F59E0B" }]}>
              <Caption style={styles.badgeText}>
                {insights.flaggedCount} {isRTL ? "غير طبيعي" : "flagged"}
              </Caption>
            </View>
          )}
        </View>
      </View>

      {topFlagged.map((b) => (
        <View key={b.name} style={styles.biomarkerRow}>
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 6 }}>
            {b.trend === "rising" ? (
              <TrendingUp size={14} color="#EF4444" />
            ) : b.trend === "falling" ? (
              <TrendingDown size={14} color="#3B82F6" />
            ) : null}
            <TypographyText style={styles.biomarkerName}>{b.name}</TypographyText>
          </View>
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 4 }}>
            <TypographyText style={styles.biomarkerValue}>
              {b.latest.value} {b.unit}
            </TypographyText>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  b.latest.status === "critical"
                    ? "#EF4444"
                    : b.latest.status === "high" || b.latest.status === "low"
                    ? "#F59E0B"
                    : "#10B981",
              }}
            />
          </View>
        </View>
      ))}

      <TouchableOpacity onPress={() => setExpanded(!expanded)}>
        <TypographyText
          style={styles.narrativeText}
          numberOfLines={expanded ? undefined : 2}
        >
          {narrative}
        </TypographyText>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.viewAllButton}
        onPress={() => router.push("/lab-results")}
      >
        <TypographyText style={styles.viewAllText}>
          {isRTL ? "عرض التقرير الكامل" : "View Full Report"}
        </TypographyText>
        <ChevronRight size={14} color={theme.colors.primary.main} />
      </TouchableOpacity>
    </View>
  );
}

function BannerContent({
  userId,
  isRTL,
}: {
  userId: string | undefined;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const { insights, loading } = useLabInsights(userId);

  const styles = createThemedStyles((t) => ({
    banner: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      backgroundColor: "#F59E0B20",
      borderRadius: 12,
      paddingHorizontal: t.spacing.base,
      paddingVertical: t.spacing.sm,
      marginBottom: t.spacing.base,
      gap: t.spacing.sm,
    } as ViewStyle,
    bannerLeft: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.xs,
      flex: 1,
    } as ViewStyle,
    bannerText: getTextStyle(t, "body", "medium", "#92400E"),
    linkText: getTextStyle(t, "caption", "semibold", t.colors.primary.main),
  }))(theme);

  if (loading || !insights || insights.flaggedCount === 0) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => router.push("/(tabs)/analytics")}
      activeOpacity={0.8}
    >
      <View style={styles.bannerLeft}>
        <AlertCircle size={16} color="#92400E" />
        <TypographyText style={styles.bannerText}>
          {isRTL
            ? `${insights.flaggedCount} قيم غير طبيعية · رؤى الذكاء الاصطناعي متاحة`
            : `${insights.flaggedCount} flagged values · AI insights available`}
        </TypographyText>
      </View>
      <TypographyText style={styles.linkText}>
        {isRTL ? "عرض" : "View"}
      </TypographyText>
    </TouchableOpacity>
  );
}

export default function LabInsightsCard({
  userId,
  variant = "analytics",
}: Props) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  return (
    <FeatureGate featureId="LAB_INSIGHTS" showUpgradePrompt>
      {variant === "analytics" ? (
        <AnalyticsContent userId={userId} isRTL={isRTL} />
      ) : (
        <BannerContent userId={userId} isRTL={isRTL} />
      )}
    </FeatureGate>
  );
}
