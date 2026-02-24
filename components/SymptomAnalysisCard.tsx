/**
 * SymptomAnalysisCard
 *
 * Surfaces the ML symptom pattern recognition engine on the Analytics screen.
 * Shows detected patterns, diagnosis suggestions (with disclaimer), and overall
 * risk tier.
 *
 * Premium Individual+ gate.
 */

import { Activity, AlertCircle, ChevronDown, ChevronUp, Info } from "lucide-react-native";
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
import { useSymptomAnalysis } from "@/hooks/useSymptomAnalysis";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type Props = {
  userId: string | undefined;
};

function urgencyColor(urgency: "low" | "medium" | "high" | "emergency"): string {
  switch (urgency) {
    case "low":
      return "#22C55E";
    case "medium":
      return "#F59E0B";
    case "high":
      return "#EF4444";
    case "emergency":
      return "#7F1D1D";
  }
}

function severityColor(severity: "mild" | "moderate" | "severe"): string {
  switch (severity) {
    case "mild":
      return "#22C55E";
    case "moderate":
      return "#F59E0B";
    case "severe":
      return "#EF4444";
  }
}

function overallRiskColor(risk: "low" | "medium" | "high"): string {
  switch (risk) {
    case "low":
      return "#22C55E";
    case "medium":
      return "#F59E0B";
    case "high":
      return "#EF4444";
  }
}

function AnalysisContent({
  userId,
  isRTL,
}: {
  userId: string | undefined;
  isRTL: boolean;
}) {
  const { theme } = useTheme();
  const { analysis, loading, error, refresh } = useSymptomAnalysis(userId, isRTL);
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);
  const [showDiagnosis, setShowDiagnosis] = useState(false);

  const styles = createThemedStyles((th) => ({
    card: {
      backgroundColor: th.colors.background.secondary,
      borderRadius: 16,
      padding: th.spacing.base,
      marginBottom: th.spacing.base,
    } as ViewStyle,
    header: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: th.spacing.sm,
    } as ViewStyle,
    headerLeft: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: th.spacing.sm,
    } as ViewStyle,
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "rgba(99, 102, 241, 0.12)",
      alignItems: "center" as const,
      justifyContent: "center" as const,
    } as ViewStyle,
    riskBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    } as ViewStyle,
    patternCard: {
      borderRadius: 12,
      backgroundColor: th.colors.background.tertiary,
      padding: th.spacing.sm,
      marginBottom: th.spacing.sm,
    } as ViewStyle,
    patternHeader: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
    } as ViewStyle,
    patternHeaderLeft: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: th.spacing.xs,
    } as ViewStyle,
    severityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    } as ViewStyle,
    symptomChip: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: "rgba(99, 102, 241, 0.1)",
    } as ViewStyle,
    chipRow: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 4,
      marginTop: th.spacing.xs,
    } as ViewStyle,
    diagnosisRow: {
      borderRadius: 10,
      backgroundColor: th.colors.background.tertiary,
      padding: th.spacing.sm,
      marginBottom: th.spacing.xs,
    } as ViewStyle,
    diagnosisTop: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
    } as ViewStyle,
    toggleRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingTop: th.spacing.sm,
      gap: th.spacing.xs,
    } as ViewStyle,
    center: {
      alignItems: "center" as const,
      paddingVertical: th.spacing.lg,
    } as ViewStyle,
    retryBtn: {
      marginTop: th.spacing.sm,
      alignSelf: "flex-start" as const,
      backgroundColor: th.colors.primary,
      paddingHorizontal: th.spacing.base,
      paddingVertical: th.spacing.xs,
      borderRadius: 10,
    } as ViewStyle,
    infoRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "flex-start" as const,
      gap: th.spacing.xs,
      backgroundColor: "rgba(245, 158, 11, 0.08)",
      borderRadius: 10,
      padding: th.spacing.sm,
      marginTop: th.spacing.sm,
    } as ViewStyle,
  }));

  if (loading) {
    return (
      <View style={styles.card}>
        <View style={styles.center}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <TypographyText
            style={[
              getTextStyle(theme, "caption", "semibold", theme.colors.text.secondary),
              { marginTop: 8 },
            ]}
          >
            {isRTL ? "جارٍ تحليل أنماط الأعراض…" : "Analysing symptom patterns…"}
          </TypographyText>
        </View>
      </View>
    );
  }

  const noPatterns =
    !analysis ||
    (analysis.patterns.length === 0 &&
      analysis.diagnosisSuggestions.length === 0);

  if (error || noPatterns) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrap}>
              <Activity size={18} color="#6366F1" />
            </View>
            <TypographyText
              style={getTextStyle(theme, "body", "bold", theme.colors.text.primary)}
            >
              {isRTL ? "تحليل الأعراض" : "Symptom Analysis"}
            </TypographyText>
          </View>
        </View>
        <Caption style={{ color: theme.colors.text.secondary }}>
          {error ??
            (isRTL
              ? "لا تتوفر بيانات كافية. سجّل المزيد من الأعراض للحصول على تحليل."
              : "Not enough data. Log more symptoms to get an analysis.")}
        </Caption>
        {error && (
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
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

  const overallRisk = analysis.riskAssessment.overallRisk;
  const overallColor = overallRiskColor(overallRisk);
  const topPatterns = analysis.patterns.slice(0, 3);
  const topSuggestions = analysis.diagnosisSuggestions.slice(0, 3);

  const overallRiskLabelMap = {
    low: { en: "Low Risk", ar: "مخاطر منخفضة" },
    medium: { en: "Moderate Risk", ar: "مخاطر متوسطة" },
    high: { en: "High Risk", ar: "مخاطر عالية" },
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Activity size={18} color="#6366F1" />
          </View>
          <TypographyText
            style={getTextStyle(theme, "body", "bold", theme.colors.text.primary)}
          >
            {isRTL ? "تحليل الأعراض" : "Symptom Analysis"}
          </TypographyText>
        </View>
        <View
          style={[
            styles.riskBadge,
            { backgroundColor: `${overallColor}20` },
          ]}
        >
          <Caption style={{ color: overallColor, fontWeight: "700" }}>
            {isRTL
              ? overallRiskLabelMap[overallRisk].ar
              : overallRiskLabelMap[overallRisk].en}
          </Caption>
        </View>
      </View>

      {/* Detected patterns */}
      {topPatterns.length > 0 && (
        <>
          <TypographyText
            style={[
              getTextStyle(theme, "caption", "bold", theme.colors.text.primary),
              { marginBottom: 8 },
            ]}
          >
            {isRTL ? "الأنماط المُكتشفة" : "Detected Patterns"}
          </TypographyText>
          {topPatterns.map((p) => {
            const isOpen = expandedPattern === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={styles.patternCard}
                onPress={() => setExpandedPattern(isOpen ? null : p.id)}
                activeOpacity={0.8}
              >
                <View style={styles.patternHeader}>
                  <View style={styles.patternHeaderLeft}>
                    <View
                      style={[
                        styles.severityDot,
                        { backgroundColor: severityColor(p.severity) },
                      ]}
                    />
                    <TypographyText
                      style={getTextStyle(
                        theme,
                        "caption",
                        "semibold",
                        theme.colors.text.primary
                      )}
                    >
                      {p.name}
                    </TypographyText>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Caption
                      style={{
                        color: theme.colors.text.secondary,
                      }}
                    >
                      {Math.round(p.confidence)}%
                    </Caption>
                    {isOpen ? (
                      <ChevronUp size={14} color={theme.colors.text.secondary} />
                    ) : (
                      <ChevronDown
                        size={14}
                        color={theme.colors.text.secondary}
                      />
                    )}
                  </View>
                </View>
                {isOpen && (
                  <>
                    <Caption
                      style={{
                        color: theme.colors.text.secondary,
                        marginTop: 6,
                        lineHeight: 18,
                      }}
                    >
                      {p.description}
                    </Caption>
                    <View style={styles.chipRow}>
                      {p.symptoms.map((s) => (
                        <View key={s} style={styles.symptomChip}>
                          <Caption style={{ color: "#6366F1" }}>{s}</Caption>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* Diagnosis suggestions toggle */}
      {topSuggestions.length > 0 && (
        <>
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setShowDiagnosis((v) => !v)}
            activeOpacity={0.7}
          >
            <Caption style={{ color: theme.colors.primary }}>
              {showDiagnosis
                ? isRTL
                  ? "إخفاء اقتراحات التشخيص"
                  : "Hide Diagnosis Suggestions"
                : isRTL
                  ? `عرض ${topSuggestions.length} اقتراح تشخيصي`
                  : `Show ${topSuggestions.length} Diagnosis Suggestion${topSuggestions.length > 1 ? "s" : ""}`}
            </Caption>
            {showDiagnosis ? (
              <ChevronUp size={14} color={theme.colors.primary} />
            ) : (
              <ChevronDown size={14} color={theme.colors.primary} />
            )}
          </TouchableOpacity>

          {showDiagnosis && (
            <>
              {/* Medical disclaimer */}
              <View style={styles.infoRow}>
                <Info size={14} color="#F59E0B" style={{ marginTop: 1 }} />
                <Caption
                  style={{
                    flex: 1,
                    color: "#92400E",
                    lineHeight: 16,
                  }}
                >
                  {isRTL
                    ? "هذه اقتراحات معلوماتية فقط، وليست تشخيصاً طبياً. استشر طبيبك دائماً."
                    : "These are informational suggestions only, not a medical diagnosis. Always consult your doctor."}
                </Caption>
              </View>

              {topSuggestions.map((s) => (
                <View key={s.id} style={styles.diagnosisRow}>
                  <View style={styles.diagnosisTop}>
                    <TypographyText
                      style={getTextStyle(
                        theme,
                        "caption",
                        "semibold",
                        theme.colors.text.primary
                      )}
                    >
                      {s.condition}
                    </TypographyText>
                    <View
                      style={[
                        styles.riskBadge,
                        {
                          backgroundColor: `${urgencyColor(s.urgency)}20`,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                        },
                      ]}
                    >
                      <Caption
                        style={{
                          color: urgencyColor(s.urgency),
                          fontWeight: "700",
                        }}
                      >
                        {s.urgency.charAt(0).toUpperCase() + s.urgency.slice(1)}
                      </Caption>
                    </View>
                  </View>
                  <Caption
                    style={{
                      color: theme.colors.text.secondary,
                      marginTop: 4,
                      lineHeight: 17,
                    }}
                  >
                    {s.reasoning}
                  </Caption>
                  {s.recommendations.length > 0 && (
                    <Caption
                      style={{
                        color: theme.colors.primary,
                        marginTop: 4,
                      }}
                    >
                      {isRTL ? "التوصيات: " : "Recommendations: "}
                      {s.recommendations.slice(0, 2).join(" · ")}
                    </Caption>
                  )}
                </View>
              ))}
            </>
          )}
        </>
      )}

      {/* Overall concerns */}
      {analysis.riskAssessment.concerns.length > 0 && (
        <View style={styles.infoRow}>
          <AlertCircle size={14} color="#EF4444" style={{ marginTop: 1 }} />
          <Caption
            style={{ flex: 1, color: theme.colors.text.secondary, lineHeight: 16 }}
          >
            {analysis.riskAssessment.concerns.join(" · ")}
          </Caption>
        </View>
      )}
    </View>
  );
}

export default function SymptomAnalysisCard({ userId }: Props) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  return (
    <FeatureGate featureId="SYMPTOM_ANALYSIS">
      <AnalysisContent userId={userId} isRTL={isRTL} />
    </FeatureGate>
  );
}
