import { router } from "expo-router";
import {
  ChevronRight,
  Clock,
  Heart,
  MessageCircle,
  Pill,
  Smile,
  TrendingUp,
  X,
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
import type { DiscoveryCategory, HealthDiscovery } from "@/types/discoveries";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

type CorrelationDiscoveryCardProps = {
  discovery: HealthDiscovery;
  compact?: boolean;
  onDismiss?: (id: string) => void;
  onPress?: (discovery: HealthDiscovery) => void;
};

const CATEGORY_COLORS: Record<DiscoveryCategory, string> = {
  symptom_medication: "#3B82F6",
  symptom_mood: "#8B5CF6",
  symptom_vital: "#EF4444",
  medication_vital: "#10B981",
  mood_vital: "#F59E0B",
  temporal_pattern: "#6366F1",
};

const CATEGORY_LABELS: Record<DiscoveryCategory, { en: string; ar: string }> = {
  symptom_medication: { en: "Medication", ar: "الأدوية" },
  symptom_mood: { en: "Mood", ar: "المزاج" },
  symptom_vital: { en: "Vitals", ar: "العلامات الحيوية" },
  medication_vital: { en: "Medication", ar: "الأدوية" },
  mood_vital: { en: "Mood", ar: "المزاج" },
  temporal_pattern: { en: "Timing", ar: "التوقيت" },
};

export default function CorrelationDiscoveryCard({
  discovery,
  compact = false,
  onDismiss,
  onPress,
}: CorrelationDiscoveryCardProps) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";

  const categoryColor =
    CATEGORY_COLORS[discovery.category] || theme.colors.primary.main;
  const categoryLabel = CATEGORY_LABELS[discovery.category];

  const styles = createThemedStyles((t) => ({
    card: {
      borderLeftWidth: 4,
      borderLeftColor: categoryColor,
      marginBottom: t.spacing.sm,
    } as ViewStyle,
    compactCard: {
      width: 300,
      marginRight: isRTL ? 0 : t.spacing.sm,
      marginLeft: isRTL ? t.spacing.sm : 0,
    } as ViewStyle,
    header: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
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
      backgroundColor: categoryColor,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    } as ViewStyle,
    titleText: getTextStyle(t, "body", "bold", t.colors.text.primary),
    descriptionText: getTextStyle(
      t,
      "body",
      "regular",
      t.colors.text.secondary
    ),
    metaRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.sm,
      marginTop: t.spacing.xs,
    } as ViewStyle,
    confidenceBar: {
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border.light,
      flex: 1,
      maxWidth: 80,
    } as ViewStyle,
    confidenceFill: {
      height: 4,
      borderRadius: 2,
    } as ViewStyle,
    captionText: getTextStyle(t, "caption", "regular", t.colors.text.secondary),
    actionsRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginTop: t.spacing.sm,
    } as ViewStyle,
    askZeinaButton: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center" as const,
      gap: t.spacing.xs,
    } as ViewStyle,
    dismissButton: {
      padding: t.spacing.xs,
    } as ViewStyle,
    rtlText: {
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
    },
    newBadge: {
      marginLeft: isRTL ? 0 : t.spacing.xs,
      marginRight: isRTL ? t.spacing.xs : 0,
    } as ViewStyle,
  }))(theme);

  const getCategoryIcon = () => {
    const iconProps = { size: 18, color: "#fff" };
    switch (discovery.category) {
      case "symptom_medication":
      case "medication_vital":
        return <Pill {...iconProps} />;
      case "symptom_mood":
      case "mood_vital":
        return <Smile {...iconProps} />;
      case "symptom_vital":
        return <Heart {...iconProps} />;
      case "temporal_pattern":
        return <Clock {...iconProps} />;
      default:
        return <TrendingUp {...iconProps} />;
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return "#10B981";
    if (confidence >= 60) return "#F59E0B";
    return "#EF4444";
  };

  const handleAskZeina = () => {
    const question = isRTL
      ? `أخبرني المزيد عن: ${discovery.descriptionAr || discovery.description}`
      : `Tell me more about: ${discovery.description}`;
    router.push({
      pathname: "/(tabs)/zeina",
      params: { question },
    });
  };

  const title =
    isRTL && discovery.titleAr ? discovery.titleAr : discovery.title;
  const description =
    isRTL && discovery.descriptionAr
      ? discovery.descriptionAr
      : discovery.description;
  const recommendation =
    isRTL && discovery.recommendationAr
      ? discovery.recommendationAr
      : discovery.recommendation;

  return (
    <Card
      contentStyle={{}}
      onPress={onPress ? () => onPress(discovery) : undefined}
      style={[styles.card, compact && styles.compactCard]}
      variant="elevated"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>{getCategoryIcon()}</View>
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <TypographyText
                numberOfLines={compact ? 1 : 2}
                style={[styles.titleText, isRTL && styles.rtlText]}
                weight="bold"
              >
                {title}
              </TypographyText>
              {discovery.status === "new" && (
                <Badge size="small" style={styles.newBadge} variant="outline">
                  <Caption style={{ color: theme.colors.primary.main }}>
                    {isRTL ? "جديد" : "New"}
                  </Caption>
                </Badge>
              )}
            </View>
            <Badge
              size="small"
              style={{
                alignSelf: isRTL ? "flex-end" : "flex-start",
                marginTop: 2,
                borderColor: categoryColor,
              }}
              variant="outline"
            >
              <Caption style={{ color: categoryColor }}>
                {isRTL ? categoryLabel.ar : categoryLabel.en}
              </Caption>
            </Badge>
          </View>
        </View>
        {onDismiss && (
          <TouchableOpacity
            onPress={() => onDismiss(discovery.id)}
            style={styles.dismissButton}
          >
            <X color={theme.colors.text.secondary} size={16} />
          </TouchableOpacity>
        )}
      </View>

      {/* Description */}
      <TypographyText
        numberOfLines={compact ? 2 : undefined}
        style={[styles.descriptionText, isRTL && styles.rtlText]}
      >
        {description}
      </TypographyText>

      {/* Confidence + Data Points */}
      <View style={styles.metaRow}>
        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              {
                width: `${discovery.confidence}%`,
                backgroundColor: getConfidenceColor(discovery.confidence),
              },
            ]}
          />
        </View>
        <Caption style={styles.captionText}>
          {discovery.confidence}% {isRTL ? "ثقة" : "confident"}
        </Caption>
        {discovery.dataPoints > 0 && (
          <Caption style={styles.captionText}>
            {isRTL
              ? `${discovery.dataPoints} نقطة بيانات`
              : `${discovery.dataPoints} data points`}
          </Caption>
        )}
      </View>

      {/* Recommendation */}
      {!compact && recommendation && (
        <TypographyText
          style={[
            styles.captionText,
            { marginTop: theme.spacing.xs, fontStyle: "italic" },
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
            onPress={handleAskZeina}
            style={styles.askZeinaButton}
          >
            <MessageCircle color={theme.colors.primary.main} size={16} />
            <TypographyText
              style={{ color: theme.colors.primary.main }}
              weight="semibold"
            >
              {isRTL ? "اسأل زينة" : "Ask Zeina"}
            </TypographyText>
            <ChevronRight color={theme.colors.primary.main} size={14} />
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}
