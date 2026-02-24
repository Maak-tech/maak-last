/**
 * MedicationIntelligenceCard
 *
 * Shows drug-drug interactions, refill predictions, and effectiveness insights.
 * Displayed on the medications screen below the header.
 * Premium Individual+ gate.
 */

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Pill,
  TrendingUp,
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
import { FeatureGate } from "@/components/FeatureGate";
import { useTheme } from "@/contexts/ThemeContext";
import { useMedicationIntelligence } from "@/hooks/useMedicationIntelligence";
import type {
  InteractionWarning,
  RefillPrediction,
} from "@/lib/services/medicationIntelligenceService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type Props = {
  userId: string | undefined;
};

const SEVERITY_COLORS = {
  major: "#EF4444",
  moderate: "#F59E0B",
  minor: "#6B7280",
};
const SEVERITY_LABELS_EN = {
  major: "Major",
  moderate: "Moderate",
  minor: "Minor",
};
const SEVERITY_LABELS_AR = { major: "خطير", moderate: "متوسط", minor: "بسيط" };

function InteractionRow({
  warning,
  isRTL,
}: {
  warning: InteractionWarning;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const color = SEVERITY_COLORS[warning.severity];
  const label = isRTL
    ? SEVERITY_LABELS_AR[warning.severity]
    : SEVERITY_LABELS_EN[warning.severity];
  const description = isRTL ? warning.descriptionAr : warning.description;
  const recommendation = isRTL
    ? warning.recommendationAr
    : warning.recommendation;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => setExpanded(!expanded)}
      style={{
        backgroundColor: color + "10",
        borderRadius: 10,
        padding: 10,
        marginBottom: 6,
        borderLeftWidth: 3,
        borderLeftColor: color,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
            gap: 6,
            flex: 1,
          }}
        >
          <AlertTriangle color={color} size={14} />
          <TypographyText
            numberOfLines={1}
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "caption",
              "semibold",
              theme.colors.text.primary
            )}
          >
            {warning.drug1} + {warning.drug2}
          </TypographyText>
        </View>
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <View
            style={{
              backgroundColor: color,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 8,
            }}
          >
            <Caption
              style={getTextStyle(
                theme as Parameters<typeof getTextStyle>[0],
                "caption",
                "semibold",
                "#fff"
              )}
            >
              {label}
            </Caption>
          </View>
          {expanded ? (
            <ChevronUp color={theme.colors.text.secondary} size={14} />
          ) : (
            <ChevronDown color={theme.colors.text.secondary} size={14} />
          )}
        </View>
      </View>
      {expanded && (
        <View style={{ marginTop: 8, gap: 4 }}>
          <TypographyText
            style={{
              ...getTextStyle(
                theme as Parameters<typeof getTextStyle>[0],
                "caption",
                "regular",
                theme.colors.text.secondary
              ),
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {description}
          </TypographyText>
          <View
            style={{
              backgroundColor: color + "15",
              borderRadius: 6,
              padding: 6,
              marginTop: 4,
            }}
          >
            <TypographyText
              style={{
                ...getTextStyle(
                  theme as Parameters<typeof getTextStyle>[0],
                  "caption",
                  "medium",
                  color
                ),
                textAlign: isRTL ? "right" : "left",
              }}
            >
              💡 {recommendation}
            </TypographyText>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function RefillRow({
  refill,
  isRTL,
}: {
  refill: RefillPrediction;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const color = refill.isUrgent ? "#EF4444" : "#F59E0B";

  return (
    <View
      style={{
        flexDirection: isRTL ? "row-reverse" : "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.light,
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Pill color={color} size={14} />
        <TypographyText
          style={getTextStyle(
            theme as Parameters<typeof getTextStyle>[0],
            "body",
            "medium",
            theme.colors.text.primary
          )}
        >
          {refill.name}
        </TypographyText>
      </View>
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        {refill.isUrgent && (
          <View
            style={{
              backgroundColor: "#EF444420",
              borderRadius: 8,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Caption
              style={getTextStyle(
                theme as Parameters<typeof getTextStyle>[0],
                "caption",
                "semibold",
                "#EF4444"
              )}
            >
              {isRTL ? "عاجل" : "Urgent"}
            </Caption>
          </View>
        )}
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
            gap: 3,
          }}
        >
          <Clock color={color} size={12} />
          <Caption
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "caption",
              "medium",
              color
            )}
          >
            {refill.daysRemaining}d
          </Caption>
        </View>
      </View>
    </View>
  );
}

function IntelligenceContent({
  userId,
  isRTL,
}: {
  userId: string | undefined;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const { interactions, refills, loading } = useMedicationIntelligence(userId);
  const [showInteractions, setShowInteractions] = useState(true);
  const [showRefills, setShowRefills] = useState(true);

  const styles = createThemedStyles((t) => ({
    card: {
      backgroundColor: t.colors.background.secondary,
      borderRadius: 16,
      padding: t.spacing.base,
      marginBottom: t.spacing.base,
    } as ViewStyle,
    sectionHeader: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: t.spacing.sm,
      marginTop: t.spacing.sm,
    } as ViewStyle,
    sectionTitle: getTextStyle(t, "body", "semibold", t.colors.text.primary),
    loadingContainer: {
      padding: t.spacing.base,
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

  if (interactions.length === 0 && refills.length === 0) return null;

  const totalWarnings =
    interactions.length + refills.filter((r) => r.isUrgent).length;

  return (
    <View style={styles.card}>
      {/* Card header */}
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <TrendingUp color={theme.colors.primary.main} size={18} />
          <TypographyText
            style={getTextStyle(
              theme as Parameters<typeof getTextStyle>[0],
              "subheading",
              "bold",
              theme.colors.text.primary
            )}
          >
            {isRTL ? "تحليل الأدوية" : "Medication Intelligence"}
          </TypographyText>
        </View>
        {totalWarnings > 0 && (
          <View
            style={{
              backgroundColor: "#EF444420",
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Caption
              style={getTextStyle(
                theme as Parameters<typeof getTextStyle>[0],
                "caption",
                "semibold",
                "#EF4444"
              )}
            >
              {totalWarnings} {isRTL ? "تنبيه" : "alerts"}
            </Caption>
          </View>
        )}
      </View>

      {/* Interactions section */}
      {interactions.length > 0 && (
        <>
          <TouchableOpacity
            onPress={() => setShowInteractions(!showInteractions)}
            style={styles.sectionHeader}
          >
            <TypographyText style={styles.sectionTitle}>
              {isRTL ? "⚠️ تفاعلات الأدوية" : "⚠️ Drug Interactions"}
            </TypographyText>
            {showInteractions ? (
              <ChevronUp color={theme.colors.text.secondary} size={16} />
            ) : (
              <ChevronDown color={theme.colors.text.secondary} size={16} />
            )}
          </TouchableOpacity>
          {showInteractions &&
            interactions.map((w, i) => (
              <InteractionRow isRTL={isRTL} key={String(i)} warning={w} />
            ))}
        </>
      )}

      {/* Refills section */}
      {refills.length > 0 && (
        <>
          <TouchableOpacity
            onPress={() => setShowRefills(!showRefills)}
            style={styles.sectionHeader}
          >
            <TypographyText style={styles.sectionTitle}>
              {isRTL ? "💊 تجديد الأدوية" : "💊 Refills Due"}
            </TypographyText>
            {showRefills ? (
              <ChevronUp color={theme.colors.text.secondary} size={16} />
            ) : (
              <ChevronDown color={theme.colors.text.secondary} size={16} />
            )}
          </TouchableOpacity>
          {showRefills &&
            refills.map((r) => (
              <RefillRow isRTL={isRTL} key={r.medicationId} refill={r} />
            ))}
        </>
      )}
    </View>
  );
}

export default function MedicationIntelligenceCard({ userId }: Props) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  return (
    <FeatureGate featureId="MEDICATION_INTELLIGENCE" showUpgradePrompt>
      <IntelligenceContent isRTL={isRTL} userId={userId} />
    </FeatureGate>
  );
}
