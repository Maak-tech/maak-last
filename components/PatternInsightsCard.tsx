/**
 * PatternInsightsCard
 *
 * Surfaces temporal, medication-correlation, vital-trend, and wearable
 * integration insights from healthPatternDetectionService on the home screen.
 *
 * Free tier — no premium gate (these are lightweight, rule-based insights that
 * give genuine value and encourage users to log data, not AI-heavy).
 * Shows top 3 by default; expand to see all.
 */

import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import { usePatternInsights } from "@/hooks/usePatternInsights";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type Props = {
  userId: string | undefined;
};

/** Map insight type → accent colour */
function typeColor(type: string): string {
  switch (type) {
    case "temporal":
      return "#6366F1";
    case "correlation":
      return "#0F766E";
    case "trend":
      return "#F59E0B";
    case "ml":
      return "#8B5CF6";
    default:
      return "#64748B";
  }
}

/** Map insight type → short label */
function typeLabel(type: string, isRTL: boolean): string {
  const map: Record<string, { en: string; ar: string }> = {
    temporal: { en: "Pattern", ar: "نمط" },
    correlation: { en: "Correlation", ar: "ارتباط" },
    trend: { en: "Trend", ar: "اتجاه" },
    recommendation: { en: "Tip", ar: "نصيحة" },
    ml: { en: "AI", ar: "ذكاء اصطناعي" },
  };
  const entry = map[type] ?? { en: type, ar: type };
  return isRTL ? entry.ar : entry.en;
}

export default function PatternInsightsCard({ userId }: Props) {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { insights, loading, error } = usePatternInsights(userId, isRTL);
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
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "rgba(99, 102, 241, 0.1)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    } as ViewStyle,
    countBadge: {
      backgroundColor: t.colors.primary.main,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      minWidth: 24,
      alignItems: "center" as const,
    } as ViewStyle,
    insightRow: {
      borderRadius: 10,
      backgroundColor: t.colors.background.tertiary,
      padding: t.spacing.sm,
      marginBottom: t.spacing.xs,
    } as ViewStyle,
    insightTop: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "flex-start" as const,
      gap: t.spacing.xs,
      marginBottom: 4,
    } as ViewStyle,
    typePill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
    } as ViewStyle,
    actionRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "flex-start" as const,
      gap: t.spacing.xs,
      marginTop: 4,
      backgroundColor: "rgba(15, 118, 110, 0.07)",
      borderRadius: 8,
      padding: t.spacing.xs,
    } as ViewStyle,
    toggleRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingTop: t.spacing.sm,
      gap: t.spacing.xs,
    } as ViewStyle,
    center: {
      alignItems: "center" as const,
      paddingVertical: t.spacing.lg,
    } as ViewStyle,
  }))(theme);

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.center}>
          <ActivityIndicator size="small" color={theme.colors.primary.main} />
          <TypographyText
            style={[
              getTextStyle(theme, "caption", "semibold", theme.colors.text.secondary),
              { marginTop: 8 },
            ]}
          >
            {isRTL ? "جارٍ تحليل الأنماط الصحية…" : "Detecting health patterns…"}
          </TypographyText>
        </View>
      </View>
    );
  }

  // Don't render if there are no insights and no error (not enough data)
  if (!error && insights.length === 0) return null;

  if (error) {
    return null; // Silent failure — not critical
  }

  const visible = expanded ? insights : insights.slice(0, 3);
  const hasMore = insights.length > 3;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Lightbulb size={18} color="#6366F1" />
          </View>
          <TypographyText
            style={getTextStyle(theme, "body", "bold", theme.colors.text.primary)}
          >
            {isRTL ? "أنماط صحية" : "Health Patterns"}
          </TypographyText>
        </View>
        {insights.length > 0 && (
          <View style={styles.countBadge}>
            <Caption style={{ color: "#fff", fontWeight: "700" }}>
              {insights.length}
            </Caption>
          </View>
        )}
      </View>

      {/* Insight rows */}
      {visible.map((insight, idx) => {
        const accentColor = typeColor(insight.type);
        return (
          <View
            key={`insight-${
              // biome-ignore lint/suspicious/noArrayIndexKey: insights list is stable within TTL
              idx
            }`}
            style={[
              styles.insightRow,
              { borderLeftWidth: 3, borderLeftColor: accentColor },
            ]}
          >
            <View style={styles.insightTop}>
              <View
                style={[
                  styles.typePill,
                  { backgroundColor: `${accentColor}18` },
                ]}
              >
                <Caption style={{ color: accentColor, fontWeight: "700" }}>
                  {typeLabel(insight.type, isRTL)}
                </Caption>
              </View>
              <TypographyText
                style={[
                  getTextStyle(theme, "caption", "semibold", theme.colors.text.primary),
                  { flex: 1 },
                ]}
              >
                {insight.title}
              </TypographyText>
            </View>

            <Caption
              style={{
                color: theme.colors.text.secondary,
                lineHeight: 18,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {insight.description}
            </Caption>

            {insight.actionable && insight.recommendation && (
              <View style={styles.actionRow}>
                <Caption
                  style={{ color: "#0F766E", lineHeight: 16, flex: 1 }}
                >
                  {isRTL ? "💡 " : "💡 "}
                  {insight.recommendation}
                </Caption>
              </View>
            )}
          </View>
        );
      })}

      {/* Show more / less toggle */}
      {hasMore && (
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Caption style={{ color: theme.colors.primary.main }}>
            {expanded
              ? isRTL
                ? "إظهار أقل"
                : "Show less"
              : isRTL
                ? `عرض ${insights.length - 3} أنماط إضافية`
                : `Show ${insights.length - 3} more`}
          </Caption>
          {expanded ? (
            <ChevronUp size={14} color={theme.colors.primary.main} />
          ) : (
            <ChevronDown size={14} color={theme.colors.primary.main} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
