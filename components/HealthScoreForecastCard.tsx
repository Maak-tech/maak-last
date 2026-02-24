/**
 * HealthScoreForecastCard
 *
 * variant="home"      — teaser card on the home dashboard (score + trend arrow + sparkline)
 * variant="analytics" — full 7-day chart hero on analytics screen
 * Premium Individual+ gate — free users see current score only (no forecast).
 */

import { useRouter } from "expo-router";
import {
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
import { FeatureGate } from "@/components/FeatureGate";
import { useTheme } from "@/contexts/ThemeContext";
import { usePredictiveScore } from "@/hooks/usePredictiveScore";
import { useFeatureGate } from "@/lib/services/featureGateService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type Props = {
  userId: string | undefined;
  variant?: "home" | "analytics";
  gated?: boolean;
};

const TREND_ICONS = {
  improving: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
};
const TREND_COLORS = {
  improving: "#10B981",
  stable: "#6B7280",
  declining: "#EF4444",
};
const TREND_LABELS_EN = {
  improving: "Improving",
  stable: "Stable",
  declining: "Declining",
};
const TREND_LABELS_AR = {
  improving: "تحسّن",
  stable: "مستقر",
  declining: "تراجع",
};

const DAY_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_SHORT_AR = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

function ScoreCircle({ score, size = 72 }: { score: number; size?: number }) {
  const { theme } = useTheme();
  const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
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
        backgroundColor: color + "15",
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

/** Tiny sparkline bar chart */
function SparklineChart({
  scores,
  width = 120,
  height = 32,
}: {
  scores: { score: number }[];
  width?: number;
  height?: number;
}) {
  const { theme } = useTheme();
  if (scores.length === 0) return null;

  const min = Math.min(...scores.map((s) => s.score));
  const max = Math.max(...scores.map((s) => s.score));
  const range = max - min || 1;
  const barWidth = (width - (scores.length - 1) * 2) / scores.length;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        width,
        height,
        gap: 2,
      }}
    >
      {scores.map((s, i) => {
        const barHeight = Math.max(4, ((s.score - min) / range) * height);
        const color =
          s.score >= 80 ? "#10B981" : s.score >= 60 ? "#F59E0B" : "#EF4444";
        return (
          <View
            key={String(i)}
            style={{
              width: barWidth,
              height: barHeight,
              backgroundColor: color,
              borderRadius: 2,
              opacity: 0.7,
            }}
          />
        );
      })}
    </View>
  );
}

/** Full forecast chart for analytics screen */
function ForecastBarChart({
  historical,
  forecast,
  isRTL,
}: {
  historical: { date: Date; score: number }[];
  forecast: { date: Date; score: number; confidence: number }[];
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const allScores = [
    ...historical.map((h) => h.score),
    ...forecast.map((f) => f.score),
  ];
  const min = Math.min(...allScores);
  const max = Math.max(...allScores);
  const range = max - min || 1;
  const chartHeight = 80;
  const dayLabels = isRTL ? DAY_SHORT_AR : DAY_SHORT_EN;
  const combined = [
    ...historical.map((h) => ({ ...h, isForecast: false })),
    ...forecast.map((f) => ({ ...f, isForecast: true })),
  ];

  return (
    <View style={{ marginTop: 12 }}>
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "flex-end",
          height: chartHeight + 24,
          gap: 4,
        }}
      >
        {combined.map((item, i) => {
          const barHeight = Math.max(
            6,
            ((item.score - min) / range) * chartHeight
          );
          const color =
            item.score >= 80
              ? "#10B981"
              : item.score >= 60
                ? "#F59E0B"
                : "#EF4444";
          return (
            <View
              key={String(i)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "flex-end",
                height: chartHeight + 24,
              }}
            >
              <View
                style={{
                  width: "100%",
                  height: barHeight,
                  backgroundColor: color,
                  borderRadius: 3,
                  opacity: item.isForecast ? 0.45 : 0.85,
                  borderWidth: item.isForecast ? 1 : 0,
                  borderColor: color,
                  borderStyle: "dashed",
                }}
              />
              <Caption
                style={{
                  ...getTextStyle(
                    theme as Parameters<typeof getTextStyle>[0],
                    "caption",
                    "regular",
                    theme.colors.text.secondary
                  ),
                  marginTop: 4,
                  fontSize: 9,
                }}
              >
                {dayLabels[item.date.getDay()]}
              </Caption>
            </View>
          );
        })}
      </View>
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          gap: 12,
          marginTop: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 12,
              height: 8,
              backgroundColor: "#10B98185",
              borderRadius: 2,
            }}
          />
          <Caption
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "caption",
              "regular",
              theme.colors.text.secondary
            )}
          >
            {isRTL ? "الماضي" : "Past"}
          </Caption>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 12,
              height: 8,
              backgroundColor: "#10B98140",
              borderRadius: 2,
              borderWidth: 1,
              borderColor: "#10B981",
              borderStyle: "dashed",
            }}
          />
          <Caption
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "caption",
              "regular",
              theme.colors.text.secondary
            )}
          >
            {isRTL ? "التوقع" : "Forecast"}
          </Caption>
        </View>
      </View>
    </View>
  );
}

export default function HealthScoreForecastCard({
  userId,
  variant = "home",
  gated = true,
}: Props) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const isRTL = i18n.language === "ar";
  const { forecast, loading } = usePredictiveScore(userId);
  const { hasAccess } = useFeatureGate("PREDICTIVE_SCORE");

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
    trendBadge: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    } as ViewStyle,
    insightText: {
      ...getTextStyle(t, "caption", "regular", t.colors.text.secondary),
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
      marginTop: t.spacing.xs,
    },
    linkRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: 4,
      marginTop: t.spacing.xs,
    } as ViewStyle,
    linkText: getTextStyle(t, "caption", "semibold", t.colors.primary.main),
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

  if (!forecast) return null;

  const TrendIcon = TREND_ICONS[forecast.trend];
  const trendColor = TREND_COLORS[forecast.trend];
  const trendLabel = isRTL
    ? TREND_LABELS_AR[forecast.trend]
    : TREND_LABELS_EN[forecast.trend];
  const insight = isRTL ? forecast.insightAr : forecast.insight;

  if (variant === "home") {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <TypographyText
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "subheading",
              "bold",
              theme.colors.text.primary
            )}
          >
            {isRTL ? "مؤشر الصحة" : "Health Score"}
          </TypographyText>
          {hasAccess && (
            <View
              style={[
                styles.trendBadge,
                { backgroundColor: trendColor + "20" },
              ]}
            >
              <TrendIcon color={trendColor} size={12} />
              <Caption
                style={getTextStyle(
                  theme as Parameters<typeof getTextStyle>[0],
                  "caption",
                  "semibold",
                  trendColor
                )}
              >
                {trendLabel}
              </Caption>
            </View>
          )}
        </View>

        <View style={styles.row}>
          <ScoreCircle score={forecast.currentScore} />
          {hasAccess && forecast.historicalScores.length > 0 && (
            <View style={{ flex: 1, gap: 6 }}>
              <SparklineChart scores={forecast.historicalScores} width={100} />
              <TypographyText numberOfLines={2} style={styles.insightText}>
                {insight}
              </TypographyText>
            </View>
          )}
        </View>

        {hasAccess && (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/analytics")}
            style={styles.linkRow}
          >
            <TypographyText style={styles.linkText}>
              {isRTL ? "عرض توقع 7 أيام" : "See 7-day forecast"}
            </TypographyText>
            <ChevronRight color={theme.colors.primary.main} size={14} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // analytics variant
  if (gated) {
    return (
      <FeatureGate featureId="PREDICTIVE_SCORE" showUpgradePrompt>
      <View style={styles.card}>
        <View style={styles.header}>
          <TypographyText
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "subheading",
              "bold",
              theme.colors.text.primary
            )}
          >
            {isRTL ? "توقع مؤشر الصحة - 7 أيام" : "7-Day Health Forecast"}
          </TypographyText>
          <View
            style={[styles.trendBadge, { backgroundColor: trendColor + "20" }]}
          >
            <TrendIcon color={trendColor} size={12} />
            <Caption
              style={getTextStyle(
                theme as Parameters<typeof getTextStyle>[0],
                "caption",
                "semibold",
                trendColor
              )}
            >
              {trendLabel}
            </Caption>
          </View>
        </View>

        <ForecastBarChart
          forecast={forecast.forecast}
          historical={forecast.historicalScores}
          isRTL={isRTL}
        />

        <TypographyText style={styles.insightText}>{insight}</TypographyText>

        {forecast.lowestDay && (
          <View
            style={{
              marginTop: 8,
              padding: 8,
              backgroundColor: "#F59E0B15",
              borderRadius: 8,
              borderLeftWidth: 3,
              borderLeftColor: "#F59E0B",
            }}
          >
            <Caption
              style={getTextStyle(
                theme as Parameters<typeof getTextStyle>[0],
                "caption",
                "medium",
                "#92400E"
              )}
            >
              {isRTL
                ? `⚠️ ${DAY_SHORT_AR[forecast.lowestDay.date.getDay()]} قد يكون أصعب يوم — راقب الأعراض`
                : `⚠️ ${DAY_SHORT_EN[forecast.lowestDay.date.getDay()]} may be your toughest day — monitor your symptoms`}
            </Caption>
          </View>
        )}
      </View>
    </FeatureGate>
    );
  }

  // analytics variant — ungated
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TypographyText
          style={getTextStyle(
            theme as Parameters<typeof getTextStyle>[0],
            "subheading",
            "bold",
            theme.colors.text.primary
          )}
        >
          {isRTL ? "توقع مؤشر الصحة - 7 أيام" : "7-Day Health Forecast"}
        </TypographyText>
        <View
          style={[styles.trendBadge, { backgroundColor: trendColor + "20" }]}
        >
          <TrendIcon color={trendColor} size={12} />
          <Caption
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "caption",
              "semibold",
              trendColor
            )}
          >
            {trendLabel}
          </Caption>
        </View>
      </View>

      <ForecastBarChart
        forecast={forecast.forecast}
        historical={forecast.historicalScores}
        isRTL={isRTL}
      />

      <TypographyText style={styles.insightText}>{insight}</TypographyText>

      {forecast.lowestDay && (
        <View
          style={{
            marginTop: 8,
            padding: 8,
            backgroundColor: "#F59E0B15",
            borderRadius: 8,
            borderLeftWidth: 3,
            borderLeftColor: "#F59E0B",
          }}
        >
          <Caption
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "caption",
              "medium",
              "#92400E"
            )}
          >
            {isRTL
              ? `⚠️ ${DAY_SHORT_AR[forecast.lowestDay.date.getDay()]} قد يكون أصعب يوم — راقب الأعراض`
              : `⚠️ ${DAY_SHORT_EN[forecast.lowestDay.date.getDay()]} may be your toughest day — monitor your symptoms`}
          </Caption>
        </View>
      )}
    </View>
  );
}
