/**
 * RecoveryScoreCard
 *
 * Displays the clinically-grounded Body Recovery Score — a trajectory/momentum
 * signal that answers "Is my body getting better, stable, or declining?"
 *
 * Based on 5 evidence-backed vitals:
 *   HRV (35%) · Sleep (25%) · Resting HR (15%) · Respiratory Rate (10%) · Body Temperature (10%)
 *
 * variant="home"      — compact teaser on the home dashboard
 * variant="analytics" — full breakdown with factor bars and suggestions
 */

import { useRouter } from "expo-router";
import {
  AlertTriangle,
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
import { useRecoveryScore } from "@/hooks/useRecoveryScore";
import type { RecoveryFactor, RecoveryScoreBreakdown } from "@/lib/services/recoveryScoreService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  userId: string | undefined;
  variant?: "home" | "analytics";
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RecoveryCircle({
  score,
  color,
  size = 72,
}: {
  score: number;
  color: string;
  size?: number;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 4,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color + "18",
      }}
    >
      <TypographyText
        style={getTextStyle(
          theme as Parameters<typeof getTextStyle>[0],
          "heading",
          "bold",
          color
        )}
      >
        {score}
      </TypographyText>
    </View>
  );
}

function FactorBar({
  factor,
  isRTL,
}: {
  factor: RecoveryFactor;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const barColor =
    factor.score >= 75
      ? "#10B981"
      : factor.score >= 50
        ? "#F59E0B"
        : "#EF4444";

  const DirectionIcon =
    factor.direction === "improving"
      ? TrendingUp
      : factor.direction === "declining"
        ? TrendingDown
        : Minus;

  const directionColor =
    factor.direction === "improving"
      ? "#10B981"
      : factor.direction === "declining"
        ? "#EF4444"
        : "#6B7280";

  return (
    <View style={{ marginBottom: 12 }}>
      {/* Label row */}
      <View
        style={{
          flexDirection: (isRTL ? "row-reverse" : "row") as
            | "row"
            | "row-reverse",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <View
          style={{
            flexDirection: (isRTL ? "row-reverse" : "row") as
              | "row"
              | "row-reverse",
            alignItems: "center",
            gap: 6,
          }}
        >
          <DirectionIcon color={directionColor} size={12} />
          <TypographyText
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "caption",
              "semibold",
              theme.colors.text.primary
            )}
          >
            {isRTL ? factor.label.ar : factor.label.en}
          </TypographyText>
        </View>
        <Caption
          style={getTextStyle(
            theme as Parameters<typeof getTextStyle>[0],
            "caption",
            "regular",
            theme.colors.text.secondary
          )}
        >
          {factor.score}/100
        </Caption>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 6,
          backgroundColor: theme.colors.background.tertiary ?? "#E5E7EB",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 6,
            width: `${factor.score}%`,
            backgroundColor: barColor,
            borderRadius: 3,
          }}
        />
      </View>

      {/* Insight text */}
      {factor.dataPoints > 0 && (
        <Caption
          style={{
            ...getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "caption",
              "regular",
              theme.colors.text.secondary
            ),
            marginTop: 3,
            textAlign: (isRTL ? "right" : "left") as "left" | "right",
          }}
        >
          {isRTL ? factor.insight.ar : factor.insight.en}
        </Caption>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RecoveryScoreCard({
  userId,
  variant = "home",
}: Props) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const isRTL = i18n.language === "ar";
  const { recoveryScore, loading } = useRecoveryScore(userId);

  const styles = createThemedStyles((t) => ({
    card: {
      backgroundColor: t.colors.background.secondary,
      borderRadius: 16,
      padding: t.spacing.base,
      marginBottom: t.spacing.base,
    } as ViewStyle,
    header: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: t.spacing.sm,
    } as ViewStyle,
    row: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.base,
    } as ViewStyle,
    stateBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    } as ViewStyle,
    insightText: {
      ...getTextStyle(t, "caption", "regular", t.colors.text.secondary),
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
      flex: 1,
    },
    linkRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: 4,
      marginTop: t.spacing.sm,
    } as ViewStyle,
    linkText: getTextStyle(t, "caption", "semibold", t.colors.primary.main),
    loadingContainer: {
      padding: t.spacing.lg,
      alignItems: "center" as const,
    } as ViewStyle,
    sectionTitle: {
      ...getTextStyle(t, "caption", "semibold", t.colors.text.secondary),
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
      marginBottom: t.spacing.sm,
      marginTop: t.spacing.base,
    },
    suggestionBox: {
      backgroundColor: t.colors.background.tertiary ?? t.colors.background.primary,
      borderRadius: 10,
      padding: t.spacing.sm,
      marginTop: t.spacing.sm,
    } as ViewStyle,
    anomalyBanner: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: 6,
      backgroundColor: "#FEF2F2",
      borderRadius: 8,
      padding: 8,
      marginTop: t.spacing.sm,
    } as ViewStyle,
    clinicalNote: {
      ...getTextStyle(t, "caption", "regular", t.colors.text.secondary),
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
      marginTop: t.spacing.sm,
      fontStyle: "italic",
      opacity: 0.8,
    },
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

  if (!recoveryScore) return null;

  const { stateDisplay, primaryInsight, breakdown, suggestions, insufficientData, spO2AnomalyFlag } = recoveryScore;
  const stateColor = stateDisplay.color;
  const stateLabel = isRTL ? stateDisplay.label.ar : stateDisplay.label.en;
  const insight = isRTL ? primaryInsight.ar : primaryInsight.en;

  const factorOrder: (keyof RecoveryScoreBreakdown["factors"])[] = [
    "hrv",
    "sleep",
    "rhr",
    "respiratoryRate",
    "bodyTemperature",
  ];

  // ── Home variant ──────────────────────────────────────────────────────────

  if (variant === "home") {
    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <TypographyText
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "subheading",
              "bold",
              theme.colors.text.primary
            )}
          >
            {isRTL ? "درجة التعافي" : "Recovery Score"}
          </TypographyText>
          <View
            style={[
              styles.stateBadge,
              { backgroundColor: stateColor + "20" },
            ]}
          >
            <Caption
              style={getTextStyle(
                theme as Parameters<typeof getTextStyle>[0],
                "caption",
                "semibold",
                stateColor
              )}
            >
              {stateLabel}
            </Caption>
          </View>
        </View>

        {/* Score circle + insight */}
        <View style={styles.row}>
          <RecoveryCircle
            score={recoveryScore.score}
            color={stateColor}
            size={72}
          />
          <TypographyText numberOfLines={3} style={styles.insightText}>
            {insight}
          </TypographyText>
        </View>

        {/* SpO2 anomaly override banner */}
        {spO2AnomalyFlag && (
          <View style={styles.anomalyBanner}>
            <AlertTriangle color="#EF4444" size={14} />
            <Caption
              style={getTextStyle(
                theme as Parameters<typeof getTextStyle>[0],
                "caption",
                "semibold",
                "#EF4444"
              )}
            >
              {isRTL
                ? "مستويات الأكسجين في الدم منخفضة — راجع طبيبك"
                : "Low blood oxygen detected — consult your doctor"}
            </Caption>
          </View>
        )}

        {/* Insufficient data note */}
        {insufficientData && (
          <Caption
            style={{
              ...getTextStyle(
                theme as Parameters<typeof getTextStyle>[0],
                "caption",
                "regular",
                theme.colors.text.secondary
              ),
              marginTop: 6,
              textAlign: (isRTL ? "right" : "left") as "left" | "right",
              opacity: 0.7,
            }}
          >
            {isRTL
              ? "بيانات محدودة — استمر في التسجيل لتحسين الدقة"
              : "Limited data — keep logging vitals to improve accuracy"}
          </Caption>
        )}

        {/* See breakdown link */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/analytics")}
          style={styles.linkRow}
        >
          <TypographyText style={styles.linkText}>
            {isRTL ? "عرض التفاصيل الكاملة" : "See full breakdown"}
          </TypographyText>
          <ChevronRight color={theme.colors.primary.main} size={14} />
        </TouchableOpacity>
      </View>
    );
  }

  // ── Analytics variant ─────────────────────────────────────────────────────

  return (
    <View style={styles.card}>
      {/* Header with large score circle */}
      <View style={styles.header}>
        <TypographyText
          style={getTextStyle(
            theme as Parameters<typeof getTextStyle>[0],
            "subheading",
            "bold",
            theme.colors.text.primary
          )}
        >
          {isRTL ? "درجة التعافي" : "Recovery Score"}
        </TypographyText>
        <View
          style={[
            styles.stateBadge,
            { backgroundColor: stateColor + "20" },
          ]}
        >
          <Caption
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "caption",
              "semibold",
              stateColor
            )}
          >
            {stateLabel}
          </Caption>
        </View>
      </View>

      {/* Score circle + primary insight */}
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <RecoveryCircle
          score={recoveryScore.score}
          color={stateColor}
          size={96}
        />
        <TypographyText
          style={{
            ...getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "body",
              "regular",
              theme.colors.text.secondary
            ),
            textAlign: "center",
            marginTop: 12,
            paddingHorizontal: 8,
          }}
          numberOfLines={3}
        >
          {insight}
        </TypographyText>
      </View>

      {/* SpO2 anomaly banner */}
      {spO2AnomalyFlag && (
        <View style={styles.anomalyBanner}>
          <AlertTriangle color="#EF4444" size={14} />
          <Caption
            style={{
              ...getTextStyle(
                theme as Parameters<typeof getTextStyle>[0],
                "caption",
                "semibold",
                "#EF4444"
              ),
              flex: 1,
              textAlign: (isRTL ? "right" : "left") as "left" | "right",
            }}
          >
            {isRTL
              ? "مستويات الأكسجين في الدم منخفضة (< 94٪) — هذا يؤثر على التعافي"
              : "Low blood oxygen detected (< 94%) — this may be affecting your recovery"}
          </Caption>
        </View>
      )}

      {/* Factor breakdown */}
      <TypographyText style={styles.sectionTitle}>
        {isRTL ? "ما الذي يحرك هذه الدرجة؟" : "What's driving this score?"}
      </TypographyText>

      {factorOrder.map((key) => (
        <FactorBar
          key={key}
          factor={breakdown.factors[key]}
          isRTL={isRTL}
        />
      ))}

      {/* Targeted suggestions for weakest factor */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionBox}>
          {suggestions.map((suggestion, i) => (
            <View key={String(i)}>
              {i > 0 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: "#E5E7EB",
                    marginVertical: 8,
                  }}
                />
              )}
              <Caption
                style={{
                  ...getTextStyle(
                    theme as Parameters<typeof getTextStyle>[0],
                    "caption",
                    "semibold",
                    theme.colors.primary.main
                  ),
                  textAlign: (isRTL ? "right" : "left") as "left" | "right",
                  marginBottom: 4,
                }}
              >
                {isRTL ? suggestion.title.ar : suggestion.title.en}
              </Caption>
              <Caption
                style={{
                  ...getTextStyle(
                    theme as Parameters<typeof getTextStyle>[0],
                    "caption",
                    "regular",
                    theme.colors.text.secondary
                  ),
                  textAlign: (isRTL ? "right" : "left") as "left" | "right",
                }}
              >
                {isRTL ? suggestion.description.ar : suggestion.description.en}
              </Caption>
            </View>
          ))}
        </View>
      )}

      {/* Insufficient data note */}
      {insufficientData && (
        <Caption style={styles.clinicalNote}>
          {isRTL
            ? "درجة التعافي ستصبح أكثر دقة مع تسجيل المزيد من البيانات."
            : "Recovery score will become more accurate as you log more vitals."}
        </Caption>
      )}

      {/* Clinical context note */}
      <Caption style={styles.clinicalNote}>
        {isRTL
          ? "يعتمد على معدلاتك الشخصية لـ HRV والنوم ومعدل القلب ومعدل التنفس ودرجة الحرارة."
          : "Based on your personal baselines for HRV, sleep, resting heart rate, respiratory rate, and body temperature."}
      </Caption>
    </View>
  );
}
