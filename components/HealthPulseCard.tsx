/**
 * HealthPulseCard
 *
 * A compact, unified entry-point card that shows the user's top-line health
 * signals at a glance: Health Score (trend) + Recovery Score (state).
 *
 * Tapping navigates to the full Analytics screen where all detail is available.
 * A red dot badge appears when there is a critical unacknowledged anomaly.
 */

import { useRouter } from "expo-router";
import {
  AlertCircle,
  BarChart2,
  ChevronRight,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
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
import { useMLInsightsBadge } from "@/hooks/useMLInsightsBadge";
import { usePredictiveScore } from "@/hooks/usePredictiveScore";
import { useRecoveryScore } from "@/hooks/useRecoveryScore";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthPulseCardProps = {
  userId: string | undefined;
  isRTL?: boolean;
};

// ─── Score circle sub-component ───────────────────────────────────────────────

function ScoreCircle({
  score,
  color,
}: {
  score: number;
  color: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 3,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color + "18",
        flexShrink: 0,
      }}
    >
      <TypographyText
        style={getTextStyle(
          theme as Parameters<typeof getTextStyle>[0],
          "subheading",
          "bold",
          color
        )}
      >
        {score}
      </TypographyText>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HealthPulseCard({ userId, isRTL = false }: HealthPulseCardProps) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const rtl = isRTL || i18n.language === "ar";
  const { theme } = useTheme();

  const { forecast, loading: forecastLoading } = usePredictiveScore(userId);
  const { recoveryScore, loading: recoveryLoading } = useRecoveryScore(userId);
  const { hasCritical } = useMLInsightsBadge(userId);

  const isLoading = forecastLoading || recoveryLoading;

  const styles = createThemedStyles((t) => ({
    card: {
      backgroundColor: t.colors.background.card,
      borderRadius: 16,
      padding: t.spacing.base,
      marginBottom: t.spacing.base,
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
      flexDirection: (rtl ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.base,
    } as ViewStyle,
    infoBlock: {
      flex: 1,
    } as ViewStyle,
    titleRow: {
      flexDirection: (rtl ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.xs,
      marginBottom: 2,
    } as ViewStyle,
    titleText: getTextStyle(t, "body", "bold", t.colors.text.primary),
    subtitleText: getTextStyle(t, "caption", "regular", t.colors.text.secondary),
    chevronWrap: {
      padding: 4,
    } as ViewStyle,
    criticalDot: {
      position: "absolute" as const,
      top: -4,
      right: rtl ? undefined : -4,
      left: rtl ? -4 : undefined,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: t.colors.accent.error,
      borderWidth: 2,
      borderColor: t.colors.background.card,
    } as ViewStyle,
    loadingWrap: {
      backgroundColor: t.colors.background.card,
      borderRadius: 16,
      padding: t.spacing.base,
      marginBottom: t.spacing.base,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      height: 80,
    } as ViewStyle,
  }))(theme);

  const getTrendColor = (trend: "improving" | "stable" | "declining"): string => {
    switch (trend) {
      case "improving": return "#10B981";
      case "declining": return "#EF4444";
      default: return "#F59E0B";
    }
  };

  const getTrendIcon = (trend: "improving" | "stable" | "declining") => {
    const color = getTrendColor(trend);
    switch (trend) {
      case "improving": return <TrendingUp color={color} size={14} />;
      case "declining": return <TrendingDown color={color} size={14} />;
      default: return <Minus color={color} size={14} />;
    }
  };

  const getTrendLabel = (trend: "improving" | "stable" | "declining"): string => {
    if (rtl) {
      switch (trend) {
        case "improving": return "في تحسن";
        case "declining": return "في تراجع";
        default: return "مستقر";
      }
    }
    switch (trend) {
      case "improving": return "Improving";
      case "declining": return "Declining";
      default: return "Stable";
    }
  };

  if (isLoading && !forecast && !recoveryScore) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={theme.colors.primary.main} size="small" />
      </View>
    );
  }

  const healthScore = forecast?.currentScore ?? 75;
  const trend = forecast?.trend ?? "stable";
  const trendColor = getTrendColor(trend);
  const scoreColor = healthScore >= 70 ? "#10B981" : healthScore >= 50 ? "#F59E0B" : "#EF4444";

  const recoveryScoreValue = recoveryScore?.score ?? null;
  const recoveryStateLabel = recoveryScore?.stateDisplay.label
    ? (rtl ? recoveryScore.stateDisplay.label.ar : recoveryScore.stateDisplay.label.en)
    : null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push("/(tabs)/analytics" as Parameters<typeof router.push>[0])}
      style={styles.card}
    >
      {/* Score circle with critical dot */}
      <View>
        <ScoreCircle color={scoreColor} score={healthScore} />
        {hasCritical && <View style={styles.criticalDot} />}
      </View>

      {/* Text block */}
      <View style={styles.infoBlock}>
        <View style={styles.titleRow}>
          <BarChart2 color={theme.colors.primary.main} size={14} />
          <TypographyText style={styles.titleText}>
            {rtl ? `الصحة: ${getTrendLabel(trend)}` : `Health is ${getTrendLabel(trend)}`}
          </TypographyText>
          {getTrendIcon(trend)}
        </View>

        {recoveryScoreValue !== null && recoveryStateLabel ? (
          <Caption style={[styles.subtitleText, { textAlign: rtl ? "right" : "left" }]}>
            {rtl
              ? `التعافي: ${recoveryScoreValue} · ${recoveryStateLabel}`
              : `Recovery: ${recoveryScoreValue} · ${recoveryStateLabel}`}
          </Caption>
        ) : (
          <Caption style={[styles.subtitleText, { textAlign: rtl ? "right" : "left" }]}>
            {rtl ? "اضغط لعرض التحليلات الكاملة" : "Tap to view full analytics"}
          </Caption>
        )}

        {hasCritical && (
          <View style={{ flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <AlertCircle color={theme.colors.accent.error} size={12} />
            <Caption style={{ color: theme.colors.accent.error }}>
              {rtl ? "تحذير حيوي نشط" : "Active vital alert"}
            </Caption>
          </View>
        )}
      </View>

      {/* Chevron */}
      <View style={styles.chevronWrap}>
        <ChevronRight
          color={theme.colors.text.secondary}
          size={18}
          style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }}
        />
      </View>
    </TouchableOpacity>
  );
}
