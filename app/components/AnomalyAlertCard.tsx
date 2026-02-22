import { router } from "expo-router";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Droplets,
  Heart,
  Thermometer,
  Wind,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View, type ViewStyle } from "react-native";
import { Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { VitalAnomaly } from "@/types/discoveries";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type AnomalyAlertCardProps = {
  anomaly: VitalAnomaly;
  compact?: boolean;
  onAcknowledge?: (id: string) => void;
};

const VITAL_NAMES: Record<string, { en: string; ar: string }> = {
  heart_rate: { en: "Heart Rate", ar: "معدل ضربات القلب" },
  systolic_bp: { en: "Blood Pressure", ar: "ضغط الدم" },
  diastolic_bp: { en: "Blood Pressure", ar: "ضغط الدم" },
  blood_oxygen: { en: "Oxygen", ar: "الأكسجين" },
  temperature: { en: "Temperature", ar: "الحرارة" },
  blood_glucose: { en: "Blood Sugar", ar: "السكر" },
  respiratory_rate: { en: "Breathing", ar: "التنفس" },
};

const TIME_OF_DAY_LABELS: Record<string, { en: string; ar: string }> = {
  morning: { en: "Morning", ar: "صباحاً" },
  afternoon: { en: "Afternoon", ar: "ظهراً" },
  evening: { en: "Evening", ar: "مساءً" },
  night: { en: "Night", ar: "ليلاً" },
};

export default function AnomalyAlertCard({
  anomaly,
  compact = false,
  onAcknowledge,
}: AnomalyAlertCardProps) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const severityColor =
    anomaly.severity === "critical"
      ? theme.colors.accent.error
      : theme.colors.accent.warning;

  const vitalName = VITAL_NAMES[anomaly.vitalType] || {
    en: anomaly.vitalType,
    ar: anomaly.vitalType,
  };

  const styles = createThemedStyles((t) => ({
    card: {
      borderLeftWidth: 4,
      borderLeftColor: severityColor,
      marginBottom: t.spacing.sm,
    } as ViewStyle,
    compactCard: {
      width: 280,
      marginRight: isRTL ? 0 : t.spacing.sm,
      marginLeft: isRTL ? t.spacing.sm : 0,
    } as ViewStyle,
    header: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: t.spacing.xs,
    } as ViewStyle,
    headerLeft: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.sm,
      flex: 1,
    } as ViewStyle,
    iconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: severityColor,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    } as ViewStyle,
    valueText: getTextStyle(t, "subheading", "bold", t.colors.text.primary),
    deviationText: getTextStyle(t, "body", "regular", severityColor),
    bodyText: getTextStyle(t, "body", "regular", t.colors.text.secondary),
    captionText: getTextStyle(t, "caption", "regular", t.colors.text.secondary),
    contextRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      flexWrap: "wrap" as const,
      gap: t.spacing.xs,
      marginTop: t.spacing.xs,
    } as ViewStyle,
    actionsRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginTop: t.spacing.sm,
    } as ViewStyle,
    viewButton: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.xs,
    } as ViewStyle,
    ackButton: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.xs,
      paddingVertical: t.spacing.xs,
      paddingHorizontal: t.spacing.sm,
      borderRadius: t.spacing.sm,
      backgroundColor: t.colors.background.secondary,
    } as ViewStyle,
    rtlText: {
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
    },
  }))(theme);

  const getVitalIcon = () => {
    const iconProps = { size: 18, color: "#fff" };
    switch (anomaly.vitalType) {
      case "heart_rate":
        return <Heart {...iconProps} />;
      case "systolic_bp":
      case "diastolic_bp":
        return <Activity {...iconProps} />;
      case "blood_oxygen":
        return <Wind {...iconProps} />;
      case "temperature":
        return <Thermometer {...iconProps} />;
      case "blood_glucose":
        return <Droplets {...iconProps} />;
      default:
        return <AlertTriangle {...iconProps} />;
    }
  };

  const deviation = Math.abs(anomaly.zScore).toFixed(1);
  const direction = anomaly.zScore > 0 ? "above" : "below";
  const recommendation = isRTL
    ? anomaly.recommendationAr || anomaly.recommendation
    : anomaly.recommendation;

  return (
    <Card
      contentStyle={{}}
      style={[styles.card, compact && styles.compactCard]}
      variant="elevated"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>{getVitalIcon()}</View>
          <View style={{ flex: 1 }}>
            <TypographyText
              style={[styles.valueText, isRTL && styles.rtlText]}
              weight="bold"
            >
              {isRTL ? vitalName.ar : vitalName.en}: {anomaly.value}{" "}
              {anomaly.unit}
            </TypographyText>
            <TypographyText
              style={[styles.deviationText, isRTL && styles.rtlText]}
            >
              {deviation}σ{" "}
              {isRTL
                ? direction === "above"
                  ? "أعلى من المعتاد"
                  : "أقل من المعتاد"
                : `${direction} your baseline`}
            </TypographyText>
          </View>
        </View>
        <Badge
          size="small"
          style={{ borderColor: severityColor }}
          variant="outline"
        >
          <Caption style={{ color: severityColor }}>
            {anomaly.severity === "critical"
              ? isRTL
                ? "حرج"
                : "Critical"
              : isRTL
                ? "تحذير"
                : "Warning"}
          </Caption>
        </Badge>
      </View>

      {/* Contributing factors (multivariate) */}
      {anomaly.isMultivariate && anomaly.contributingFactors && (
        <View style={styles.contextRow}>
          {anomaly.contributingFactors.map((factor) => {
            const factorName = VITAL_NAMES[factor];
            return (
              <Badge key={factor} size="small" style={{}} variant="outline">
                <Caption>
                  +{" "}
                  {isRTL ? factorName?.ar || factor : factorName?.en || factor}
                </Caption>
              </Badge>
            );
          })}
        </View>
      )}

      {/* Context */}
      {!compact && anomaly.context && (
        <View style={styles.contextRow}>
          {anomaly.context.timeOfDay && (
            <Caption style={styles.captionText}>
              {isRTL
                ? TIME_OF_DAY_LABELS[anomaly.context.timeOfDay]?.ar
                : TIME_OF_DAY_LABELS[anomaly.context.timeOfDay]?.en}
            </Caption>
          )}
          {anomaly.context.historicalFrequency > 0 && (
            <Caption style={styles.captionText}>
              {isRTL
                ? `حدث ${anomaly.context.historicalFrequency} مرة في 30 يوم`
                : `${anomaly.context.historicalFrequency}x in last 30 days`}
            </Caption>
          )}
          {anomaly.context.recentMedications &&
            anomaly.context.recentMedications.length > 0 && (
              <Caption style={styles.captionText}>
                {isRTL ? "الأدوية: " : "Meds: "}
                {anomaly.context.recentMedications.slice(0, 2).join(", ")}
              </Caption>
            )}
        </View>
      )}

      {/* Recommendation */}
      {!compact && recommendation && (
        <TypographyText
          style={[
            styles.bodyText,
            { marginTop: theme.spacing.xs },
            isRTL && styles.rtlText,
          ]}
        >
          {recommendation}
        </TypographyText>
      )}

      {/* Actions */}
      {!compact && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={() =>
              router.push("/(tabs)/vitals" as Parameters<typeof router.push>[0])
            }
            style={styles.viewButton}
          >
            <TypographyText
              style={{ color: theme.colors.primary.main }}
              weight="semibold"
            >
              {isRTL ? "عرض التاريخ" : "View History"}
            </TypographyText>
            <ChevronRight color={theme.colors.primary.main} size={14} />
          </TouchableOpacity>

          {onAcknowledge && !anomaly.acknowledged && (
            <TouchableOpacity
              onPress={() => onAcknowledge(anomaly.id)}
              style={styles.ackButton}
            >
              <Check color={theme.colors.text.secondary} size={14} />
              <Caption>{isRTL ? "تم" : "Got it"}</Caption>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Card>
  );
}
