/**
 * HealthRiskCard
 *
 * Displays the ML-powered health risk assessment on the Analytics screen.
 * Shows overall risk score gauge, top condition risks, and modifiable
 * risk factors with tailored recommendations.
 *
 * Premium Individual+ gate.
 */

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
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
import { useHealthRisk } from "@/hooks/useHealthRisk";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type Props = {
  userId: string | undefined;
};

function riskColor(level: "low" | "moderate" | "high" | "very_high"): string {
  switch (level) {
    case "low":
      return "#22C55E";
    case "moderate":
      return "#F59E0B";
    case "high":
      return "#EF4444";
    case "very_high":
      return "#991B1B";
  }
}

function riskLabel(
  level: "low" | "moderate" | "high" | "very_high",
  isRTL: boolean
): string {
  const labels: Record<typeof level, { en: string; ar: string }> = {
    low: { en: "Low Risk", ar: "مخاطر منخفضة" },
    moderate: { en: "Moderate Risk", ar: "مخاطر متوسطة" },
    high: { en: "High Risk", ar: "مخاطر عالية" },
    very_high: { en: "Very High Risk", ar: "مخاطر عالية جداً" },
  };
  return isRTL ? labels[level].ar : labels[level].en;
}

function RiskContent({
  userId,
  isRTL,
}: {
  userId: string | undefined;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const { assessment, loading, error, refresh } = useHealthRisk(userId, isRTL);
  const [showRecommendations, setShowRecommendations] = useState(false);

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
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    } as ViewStyle,
    riskBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    } as ViewStyle,
    scoreRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.base,
      marginBottom: t.spacing.sm,
    } as ViewStyle,
    scoreCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderWidth: 4,
    } as ViewStyle,
    conditionRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingVertical: t.spacing.xs,
    } as ViewStyle,
    conditionBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: t.colors.border.light,
      overflow: "hidden" as const,
    } as ViewStyle,
    conditionBar: {
      height: 6,
      borderRadius: 3,
    } as ViewStyle,
    factorRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "flex-start" as const,
      gap: t.spacing.sm,
      paddingVertical: t.spacing.xs,
    } as ViewStyle,
    factorDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 5,
    } as ViewStyle,
    toggleRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingTop: t.spacing.sm,
      gap: t.spacing.xs,
    } as ViewStyle,
    retryBtn: {
      marginTop: t.spacing.sm,
      alignSelf: "flex-start" as const,
      backgroundColor: t.colors.primary.main,
      paddingHorizontal: t.spacing.base,
      paddingVertical: t.spacing.xs,
      borderRadius: 10,
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
          <ActivityIndicator color={theme.colors.primary.main} size="small" />
          <TypographyText
            style={[
              getTextStyle(
                theme,
                "caption",
                "semibold",
                theme.colors.text.secondary
              ),
              { marginTop: 8 },
            ]}
          >
            {isRTL ? "جارٍ تحليل المخاطر الصحية…" : "Analysing health risks…"}
          </TypographyText>
        </View>
      </View>
    );
  }

  if (error || !assessment) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrap}>
              <AlertTriangle color="#EF4444" size={18} />
            </View>
            <TypographyText
              style={getTextStyle(
                theme,
                "body",
                "bold",
                theme.colors.text.primary
              )}
            >
              {isRTL ? "تقييم المخاطر الصحية" : "Health Risk Assessment"}
            </TypographyText>
          </View>
        </View>
        <Caption style={{ color: theme.colors.text.secondary }}>
          {error ??
            (isRTL ? "لا تتوفر بيانات كافية بعد." : "Not enough data yet.")}
        </Caption>
        {error && (
          <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
            <TypographyText
              style={getTextStyle(theme, "caption", "semibold", "#fff")}
            >
              {isRTL ? "إعادة المحاولة" : "Retry"}
            </TypographyText>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const topConditions = assessment.conditionRisks.slice(0, 3);
  const modifiableFactors = assessment.riskFactors
    .filter((f) => f.modifiable && f.riskLevel !== "low")
    .slice(0, 4);
  const scoreColor = riskColor(assessment.riskLevel);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <ShieldCheck color="#EF4444" size={18} />
          </View>
          <TypographyText
            style={getTextStyle(
              theme,
              "body",
              "bold",
              theme.colors.text.primary
            )}
          >
            {isRTL ? "تقييم المخاطر الصحية" : "Health Risk Assessment"}
          </TypographyText>
        </View>
        <View
          style={[styles.riskBadge, { backgroundColor: `${scoreColor}20` }]}
        >
          <Caption style={{ color: scoreColor, fontWeight: "700" }}>
            {riskLabel(assessment.riskLevel, isRTL)}
          </Caption>
        </View>
      </View>

      {/* Score circle + summary */}
      <View style={styles.scoreRow}>
        <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
          <TypographyText
            style={getTextStyle(theme, "heading", "bold", scoreColor)}
          >
            {Math.round(assessment.overallRiskScore)}
          </TypographyText>
        </View>
        <View style={{ flex: 1 }}>
          <TypographyText
            style={getTextStyle(
              theme,
              "caption",
              "semibold",
              theme.colors.text.secondary
            )}
          >
            {isRTL
              ? "درجة المخاطر الإجمالية / ١٠٠"
              : "Overall risk score / 100"}
          </TypographyText>
          <TypographyText
            style={[
              getTextStyle(
                theme,
                "caption",
                "regular",
                theme.colors.text.secondary
              ),
              { marginTop: 4, lineHeight: 18 },
            ]}
          >
            {isRTL
              ? `الموعد التالي للتقييم: ${assessment.nextAssessmentDate.toLocaleDateString("ar-SA")}`
              : `Next assessment: ${assessment.nextAssessmentDate.toLocaleDateString()}`}
          </TypographyText>
        </View>
      </View>

      {/* Top condition risks */}
      {topConditions.length > 0 && (
        <>
          <TypographyText
            style={[
              getTextStyle(theme, "caption", "bold", theme.colors.text.primary),
              { marginBottom: 8 },
            ]}
          >
            {isRTL ? "أعلى المخاطر المرضية" : "Top Condition Risks"}
          </TypographyText>
          {topConditions.map((cr) => (
            <View key={cr.condition} style={{ marginBottom: 10 }}>
              <View style={styles.conditionRow}>
                <TypographyText
                  style={getTextStyle(
                    theme,
                    "caption",
                    "semibold",
                    theme.colors.text.primary
                  )}
                >
                  {cr.condition}
                </TypographyText>
                <Caption style={{ color: riskColor(cr.riskLevel) }}>
                  {Math.round(cr.riskScore)}%
                </Caption>
              </View>
              <View style={styles.conditionBarTrack}>
                <View
                  style={[
                    styles.conditionBar,
                    {
                      width: `${Math.min(100, cr.riskScore)}%`,
                      backgroundColor: riskColor(cr.riskLevel),
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </>
      )}

      {/* Modifiable risk factors */}
      {modifiableFactors.length > 0 && (
        <>
          <TypographyText
            style={[
              getTextStyle(theme, "caption", "bold", theme.colors.text.primary),
              { marginTop: 8, marginBottom: 6 },
            ]}
          >
            {isRTL ? "عوامل قابلة للتعديل" : "Modifiable Risk Factors"}
          </TypographyText>
          {modifiableFactors.map((f) => (
            <View key={f.id} style={styles.factorRow}>
              <View
                style={[
                  styles.factorDot,
                  { backgroundColor: riskColor(f.riskLevel) },
                ]}
              />
              <View style={{ flex: 1 }}>
                <TypographyText
                  style={getTextStyle(
                    theme,
                    "caption",
                    "semibold",
                    theme.colors.text.primary
                  )}
                >
                  {f.name}
                </TypographyText>
                {f.recommendations && f.recommendations.length > 0 && (
                  <Caption
                    style={{ color: theme.colors.text.secondary, marginTop: 2 }}
                  >
                    {f.recommendations[0]}
                  </Caption>
                )}
              </View>
            </View>
          ))}
        </>
      )}

      {/* Recommendations toggle */}
      {assessment.preventiveRecommendations.length > 0 && (
        <>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowRecommendations((v) => !v)}
            style={styles.toggleRow}
          >
            <Caption style={{ color: theme.colors.primary.main }}>
              {showRecommendations
                ? isRTL
                  ? "إخفاء التوصيات"
                  : "Hide Recommendations"
                : isRTL
                  ? "عرض التوصيات الوقائية"
                  : "Show Preventive Recommendations"}
            </Caption>
            {showRecommendations ? (
              <ChevronUp color={theme.colors.primary.main} size={14} />
            ) : (
              <ChevronDown color={theme.colors.primary.main} size={14} />
            )}
          </TouchableOpacity>
          {showRecommendations &&
            assessment.preventiveRecommendations.map((rec, i) => (
              <View
                key={`rec-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable recommendations list
                  i
                }`}
                style={styles.factorRow}
              >
                <View
                  style={[
                    styles.factorDot,
                    { backgroundColor: theme.colors.primary.main },
                  ]}
                />
                <Caption
                  style={{
                    flex: 1,
                    color: theme.colors.text.secondary,
                    lineHeight: 18,
                  }}
                >
                  {rec}
                </Caption>
              </View>
            ))}
        </>
      )}

      {/* Disclaimer */}
      <Caption
        style={{
          color: theme.colors.text.secondary,
          marginTop: 12,
          lineHeight: 16,
          fontStyle: "italic",
        }}
      >
        {isRTL
          ? "هذا التقييم للأغراض المعلوماتية فقط وليس بديلاً عن المشورة الطبية."
          : "This assessment is for informational purposes only and is not a substitute for medical advice."}
      </Caption>
    </View>
  );
}

export default function HealthRiskCard({ userId }: Props) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  return (
    <FeatureGate featureId="HEALTH_RISK_ASSESSMENT">
      <RiskContent isRTL={isRTL} userId={userId} />
    </FeatureGate>
  );
}
