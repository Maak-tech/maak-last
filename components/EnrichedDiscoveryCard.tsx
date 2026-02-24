/**
 * EnrichedDiscoveryCard
 *
 * Renders any EnrichedDiscovery regardless of type (correlation,
 * symptom_pattern, vital_trend, medication_effectiveness).
 *
 * Shows:
 *  - Type icon + accent colour
 *  - Title + confidence badge
 *  - Description
 *  - "New" badge for fresh discoveries
 *  - Recommendation row (when actionable)
 *  - Dismiss button
 *
 * Used on the dedicated discoveries screen.
 */

import {
  Activity,
  Clock,
  GitBranch,
  Pill,
  Sparkles,
  Watch,
  X,
} from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { EnrichedDiscovery, DiscoveryType } from "@/lib/services/discoveryService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type Props = {
  discovery: EnrichedDiscovery;
  onDismiss?: (id: string) => void;
};

const TYPE_META: Record<
  DiscoveryType,
  { accentColor: string; en: string; ar: string }
> = {
  correlation: {
    accentColor: "#3B82F6",
    en: "Correlation",
    ar: "ارتباط",
  },
  symptom_pattern: {
    accentColor: "#8B5CF6",
    en: "Symptom Pattern",
    ar: "نمط الأعراض",
  },
  vital_trend: {
    accentColor: "#EF4444",
    en: "Vital Trend",
    ar: "اتجاه الحيوية",
  },
  medication_effectiveness: {
    accentColor: "#10B981",
    en: "Medication",
    ar: "الأدوية",
  },
  temporal_pattern: {
    accentColor: "#6366F1",
    en: "Time Pattern",
    ar: "نمط زمني",
  },
  medication_pattern: {
    accentColor: "#0EA5E9",
    en: "Med Pattern",
    ar: "نمط الدواء",
  },
  integration_insight: {
    accentColor: "#F59E0B",
    en: "Wearable",
    ar: "جهاز ذكي",
  },
};

function TypeIcon({
  type,
  color,
  size = 18,
}: {
  type: DiscoveryType;
  color: string;
  size?: number;
}) {
  switch (type) {
    case "correlation":
      return <GitBranch color={color} size={size} />;
    case "symptom_pattern":
      return <Sparkles color={color} size={size} />;
    case "vital_trend":
      return <Activity color={color} size={size} />;
    case "medication_effectiveness":
    case "medication_pattern":
      return <Pill color={color} size={size} />;
    case "temporal_pattern":
      return <Clock color={color} size={size} />;
    case "integration_insight":
      return <Watch color={color} size={size} />;
  }
}

export default function EnrichedDiscoveryCard({ discovery, onDismiss }: Props) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const meta = TYPE_META[discovery.discoveryType];
  const accentColor = meta.accentColor;
  const typeLabel = isRTL ? meta.ar : meta.en;

  const confidencePct = Math.min(100, Math.round(discovery.confidence));
  const isNew = discovery.status === "new";

  const styles = createThemedStyles((t) => ({
    card: {
      backgroundColor: t.colors.background.secondary,
      borderRadius: 14,
      borderLeftWidth: 4,
      borderLeftColor: accentColor,
      marginBottom: t.spacing.base,
      overflow: "hidden" as const,
    } as ViewStyle,
    inner: {
      padding: t.spacing.base,
    } as ViewStyle,
    headerRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "flex-start" as const,
      justifyContent: "space-between" as const,
      marginBottom: t.spacing.sm,
    } as ViewStyle,
    headerLeft: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.sm,
      flex: 1,
    } as ViewStyle,
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${accentColor}20`,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    } as ViewStyle,
    titleWrap: {
      flex: 1,
    } as ViewStyle,
    pillRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.xs,
      marginBottom: 4,
    } as ViewStyle,
    typePill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: `${accentColor}18`,
    } as ViewStyle,
    newPill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: "#F59E0B",
    } as ViewStyle,
    dismissBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.colors.background.tertiary,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    } as ViewStyle,
    description: {
      lineHeight: 20,
      marginBottom: t.spacing.sm,
    },
    confidenceRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.sm,
    } as ViewStyle,
    confidenceTrack: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border.light,
      maxWidth: 120,
    } as ViewStyle,
    confidenceFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: accentColor,
      width: `${confidencePct}%` as unknown as number,
    } as ViewStyle,
    recommendationBox: {
      backgroundColor: `${accentColor}0F`,
      borderRadius: 10,
      padding: t.spacing.sm,
      marginTop: t.spacing.sm,
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      gap: t.spacing.xs,
    } as ViewStyle,
  }))(theme);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.(discovery.id);
  };

  return (
    <View style={styles.card}>
      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrap}>
              <TypeIcon type={discovery.discoveryType} color={accentColor} />
            </View>
            <View style={styles.titleWrap}>
              <View style={styles.pillRow}>
                <View style={styles.typePill}>
                  <Caption style={{ color: accentColor, fontWeight: "700" }}>
                    {typeLabel}
                  </Caption>
                </View>
                {isNew && (
                  <View style={styles.newPill}>
                    <Caption style={{ color: "#fff", fontWeight: "700" }}>
                      {isRTL ? "جديد" : "New"}
                    </Caption>
                  </View>
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
                {discovery.title}
              </TypographyText>
            </View>
          </View>

          {/* Dismiss */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleDismiss}
            style={styles.dismissBtn}
          >
            <X color={theme.colors.text.secondary} size={14} />
          </TouchableOpacity>
        </View>

        {/* Description */}
        <TypographyText
          style={[
            getTextStyle(theme, "body", "regular", theme.colors.text.secondary),
            styles.description,
          ]}
        >
          {discovery.description}
        </TypographyText>

        {/* Confidence bar */}
        <View style={styles.confidenceRow}>
          <Caption style={{ color: theme.colors.text.secondary }}>
            {isRTL ? "الثقة" : "Confidence"}
          </Caption>
          <View style={styles.confidenceTrack}>
            <View style={styles.confidenceFill} />
          </View>
          <Caption
            style={{
              color: accentColor,
              fontWeight: "700",
            }}
          >
            {confidencePct}%
          </Caption>
        </View>

        {/* Recommendation */}
        {discovery.actionable && discovery.recommendation && (
          <View style={styles.recommendationBox}>
            <Caption style={{ color: accentColor, lineHeight: 18, flex: 1 }}>
              {isRTL ? "💡 " : "💡 "}
              {discovery.recommendation}
            </Caption>
          </View>
        )}
      </View>
    </View>
  );
}
