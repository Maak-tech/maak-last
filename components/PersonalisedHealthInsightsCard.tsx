/**
 * PersonalisedHealthInsightsCard
 *
 * Home-screen card that shows:
 *  1. A "Your Health Snapshot" header with overall status badge
 *  2. Each significant/moderate deviation with coloured indicator, insight text,
 *     and expandable recommendation
 *  3. When everything is within baseline: positive "All systems normal" message
 *
 * Driven by useProactiveMonitor — compares the last 7 days against the user's
 * 30-day personalised baseline across vitals, mood, symptoms, sleep, steps,
 * medication adherence, and women's health.
 *
 * Free tier: shows up to 2 deviations, premium shows all.
 */

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Heart,
  Moon,
  Pill,
  RefreshCw,
  Smile,
  Zap,
} from "lucide-react-native";
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
import { useProactiveMonitor } from "@/hooks/useProactiveMonitor";
import type { BaselineDeviation } from "@/lib/services/userBaselineService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type Props = {
  userId: string | undefined;
};

// ── Dimension meta ───────────────────────────────────────────────────────────

type DimensionMeta = {
  color: string;
  Icon: React.ComponentType<{ color: string; size: number }>;
  labelEn: string;
  labelAr: string;
};

const DIMENSION_META: Record<string, DimensionMeta> = {
  vital: {
    color: "#EF4444",
    Icon: Heart,
    labelEn: "Vital Signs",
    labelAr: "العلامات الحيوية",
  },
  mood: { color: "#8B5CF6", Icon: Smile, labelEn: "Mood", labelAr: "المزاج" },
  symptoms: {
    color: "#F59E0B",
    Icon: AlertTriangle,
    labelEn: "Symptoms",
    labelAr: "الأعراض",
  },
  medication: {
    color: "#3B82F6",
    Icon: Pill,
    labelEn: "Medication",
    labelAr: "الأدوية",
  },
  sleep: { color: "#6366F1", Icon: Moon, labelEn: "Sleep", labelAr: "النوم" },
  steps: {
    color: "#10B981",
    Icon: Activity,
    labelEn: "Activity",
    labelAr: "النشاط",
  },
  women_health: {
    color: "#EC4899",
    Icon: Zap,
    labelEn: "Cycle",
    labelAr: "الدورة",
  },
};

function getDimensionMeta(dimension: string): DimensionMeta {
  return (
    DIMENSION_META[dimension] ?? {
      color: "#64748B",
      Icon: Activity,
      labelEn: "Health",
      labelAr: "الصحة",
    }
  );
}

function severityColor(severity: BaselineDeviation["severity"]): string {
  return severity === "significant"
    ? "#EF4444"
    : severity === "moderate"
      ? "#F59E0B"
      : "#64748B";
}

// ── Deviation row component ──────────────────────────────────────────────────

function DeviationRow({
  deviation,
  isRTL,
}: {
  deviation: BaselineDeviation;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const meta = getDimensionMeta(deviation.dimension);
  const devColor = severityColor(deviation.severity);
  const hasRec =
    deviation.actionable &&
    (deviation.recommendation || deviation.recommendationAr);

  return (
    <TouchableOpacity
      activeOpacity={hasRec ? 0.7 : 1}
      onPress={hasRec ? () => setExpanded((v) => !v) : undefined}
    >
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "flex-start",
          gap: 10,
          paddingVertical: 10,
          borderBottomWidth: 0.5,
          borderBottomColor: theme.colors.border.light,
        }}
      >
        {/* Icon */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: `${meta.color}18`,
            justifyContent: "center",
            alignItems: "center",
            marginTop: 2,
          }}
        >
          <meta.Icon color={meta.color} size={16} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Label + severity dot */}
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 2,
            }}
          >
            <Caption style={{ color: meta.color, fontWeight: "700" }}>
              {isRTL ? meta.labelAr : meta.labelEn}
            </Caption>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: devColor,
              }}
            />
            <Caption style={{ color: devColor, fontWeight: "600" }}>
              {isRTL
                ? deviation.severity === "significant"
                  ? "ملحوظ"
                  : "متوسط"
                : deviation.severity === "significant"
                  ? "Significant"
                  : "Moderate"}
            </Caption>
          </View>

          {/* Insight */}
          <TypographyText
            style={getTextStyle(
              theme,
              "caption",
              "regular",
              theme.colors.text.primary
            )}
          >
            {isRTL ? deviation.insightAr : deviation.insight}
          </TypographyText>

          {/* Recommendation (expanded) */}
          {expanded && hasRec && (
            <View
              style={{
                marginTop: 6,
                backgroundColor: `${meta.color}0F`,
                borderRadius: 8,
                padding: 8,
              }}
            >
              <Caption style={{ color: meta.color, lineHeight: 17 }}>
                {isRTL
                  ? (deviation.recommendationAr ??
                    deviation.recommendation ??
                    "")
                  : (deviation.recommendation ?? "")}
              </Caption>
            </View>
          )}
        </View>

        {/* Expand arrow */}
        {hasRec && (
          <View style={{ alignSelf: "center" }}>
            {expanded ? (
              <ChevronUp color={theme.colors.text.secondary} size={14} />
            ) : (
              <ChevronDown color={theme.colors.text.secondary} size={14} />
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function PersonalisedHealthInsightsCard({ userId }: Props) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";
  const { deviations, loading, error, refresh, hasCriticalChange } =
    useProactiveMonitor(userId, isRTL);

  const [showAll, setShowAll] = useState(false);
  const FREE_LIMIT = 2;

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
      backgroundColor: hasCriticalChange
        ? "rgba(239,68,68,0.1)"
        : "rgba(16,185,129,0.1)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    } as ViewStyle,
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: hasCriticalChange
        ? "rgba(239,68,68,0.12)"
        : "rgba(16,185,129,0.12)",
    } as ViewStyle,
    allGoodBox: {
      alignItems: "center" as const,
      paddingVertical: t.spacing.lg,
      gap: t.spacing.sm,
    } as ViewStyle,
    toggleRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingTop: t.spacing.sm,
      gap: t.spacing.xs,
    } as ViewStyle,
    refreshBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.colors.background.tertiary,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    } as ViewStyle,
    center: {
      alignItems: "center" as const,
      paddingVertical: t.spacing.lg,
    } as ViewStyle,
  }))(theme);

  // Don't render during loading or error — silently fail
  if (loading && deviations.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary.main} size="small" />
          <TypographyText
            style={[
              getTextStyle(
                theme,
                "caption",
                "regular",
                theme.colors.text.secondary
              ),
              { marginTop: 8 },
            ]}
          >
            {isRTL ? "جارٍ تحليل صحتك…" : "Analysing your health…"}
          </TypographyText>
        </View>
      </View>
    );
  }

  if (error || (!loading && deviations.length === 0 && !hasCriticalChange)) {
    // Show "all good" state only when baseline exists
    if (!error && deviations.length === 0) {
      return (
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconWrap}>
                <CheckCircle color="#10B981" size={20} />
              </View>
              <TypographyText
                style={getTextStyle(
                  theme,
                  "body",
                  "bold",
                  theme.colors.text.primary
                )}
              >
                {isRTL ? "وضعك الصحي" : "Your Health Status"}
              </TypographyText>
            </View>
            <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
              <RefreshCw color={theme.colors.text.secondary} size={14} />
            </TouchableOpacity>
          </View>
          <View style={styles.allGoodBox}>
            <CheckCircle color="#10B981" size={32} />
            <TypographyText
              style={getTextStyle(theme, "body", "bold", "#10B981")}
            >
              {isRTL
                ? "كل شيء ضمن حدودك الطبيعية"
                : "All within your normal range"}
            </TypographyText>
            <Caption
              style={{
                color: theme.colors.text.secondary,
                textAlign: "center",
              }}
            >
              {isRTL
                ? "استمر في تسجيل بياناتك للحصول على رؤى أكثر دقة"
                : "Keep logging your data for more personalised insights"}
            </Caption>
          </View>
        </View>
      );
    }
    return null;
  }

  const visible = showAll ? deviations : deviations.slice(0, FREE_LIMIT);
  const hasMore = deviations.length > FREE_LIMIT;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            {hasCriticalChange ? (
              <AlertTriangle color="#EF4444" size={20} />
            ) : (
              <Activity color="#F59E0B" size={20} />
            )}
          </View>
          <TypographyText
            style={getTextStyle(
              theme,
              "body",
              "bold",
              theme.colors.text.primary
            )}
          >
            {isRTL ? "تغيرات عن خط أساسك" : "Changes from Your Baseline"}
          </TypographyText>
        </View>
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            gap: 8,
            alignItems: "center",
          }}
        >
          <View style={styles.statusPill}>
            <Caption
              style={{
                color: hasCriticalChange ? "#EF4444" : "#F59E0B",
                fontWeight: "700",
              }}
            >
              {deviations.length}{" "}
              {isRTL ? "تغيير" : deviations.length === 1 ? "change" : "changes"}
            </Caption>
          </View>
          <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
            <RefreshCw color={theme.colors.text.secondary} size={14} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sub-header */}
      <Caption
        style={{
          color: theme.colors.text.secondary,
          marginBottom: theme.spacing.sm,
        }}
      >
        {isRTL
          ? "مقارنة آخر 7 أيام بمتوسطاتك الشخصية لـ 30 يومًا"
          : "Last 7 days vs your personal 30-day averages"}
      </Caption>

      {/* Deviation rows */}
      {visible.map((dev, idx) => (
        <DeviationRow
          deviation={dev}
          // biome-ignore lint/suspicious/noArrayIndexKey: stable list within cache
          isRTL={isRTL}
          key={`${dev.dimension}_${dev.metric}_${idx}`}
        />
      ))}

      {/* Show more / less */}
      {hasMore && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowAll((v) => !v)}
          style={styles.toggleRow}
        >
          <Caption style={{ color: theme.colors.primary.main }}>
            {showAll
              ? isRTL
                ? "إظهار أقل"
                : "Show less"
              : isRTL
                ? `عرض ${deviations.length - FREE_LIMIT} تغييرات إضافية`
                : `Show ${deviations.length - FREE_LIMIT} more`}
          </Caption>
          {showAll ? (
            <ChevronUp color={theme.colors.primary.main} size={14} />
          ) : (
            <ChevronDown color={theme.colors.primary.main} size={14} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
