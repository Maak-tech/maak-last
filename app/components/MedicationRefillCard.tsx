/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Card rendering intentionally branches by urgency buckets and UI states. */
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { Card } from "@/components/design-system";
import { Badge } from "@/components/design-system/AdditionalComponents";
import { Caption, Heading, Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import {
  medicationRefillService,
  type RefillPrediction,
  type RefillSummary,
} from "@/lib/services/medicationRefillService";

type MedicationRefillCardProps = {
  refillSummary: RefillSummary;
  onViewAll?: () => void;
};

export default function MedicationRefillCard({
  refillSummary,
  onViewAll,
}: MedicationRefillCardProps) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isRTL = i18n.language === "ar";
  const [expanded, setExpanded] = useState(false);

  const styles = useMemo(() => getStyles(theme, isRTL), [theme, isRTL]);

  if (refillSummary.predictions.length === 0) {
    return null;
  }

  const criticalRefills = refillSummary.predictions.filter(
    (p) => p.urgency === "critical" || p.urgency === "high"
  );

  const getUrgencyColor = (urgency: RefillPrediction["urgency"]) => {
    switch (urgency) {
      case "critical":
        return theme.colors.accent.error;
      case "high":
        return "#F59E0B"; // Orange
      case "medium":
        return "#F97316"; // Dark orange
      case "low":
        return theme.colors.primary.main;
      default:
        return theme.colors.text.secondary;
    }
  };

  const getUrgencyIcon = (urgency: RefillPrediction["urgency"]) => {
    switch (urgency) {
      case "critical":
        return "alert-circle";
      case "high":
        return "warning";
      case "medium":
        return "time";
      case "low":
        return "checkmark-circle";
      default:
        return "information-circle";
    }
  };

  const getUrgencyLabel = (urgency: RefillPrediction["urgency"]) => {
    switch (urgency) {
      case "critical":
        return isRTL ? "حرج" : "Critical";
      case "high":
        return isRTL ? "عالي" : "High";
      case "medium":
        return isRTL ? "متوسط" : "Medium";
      case "low":
        return isRTL ? "منخفض" : "Low";
      default:
        return "";
    }
  };

  return (
    <Card contentStyle={undefined} pressable={false} style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded(!expanded)}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Ionicons
            color={theme.colors.primary.main}
            name="flask"
            size={24}
            style={styles.icon}
          />
          <View style={styles.headerText}>
            <Heading level={5} style={styles.title}>
              {isRTL ? "تنبيهات إعادة التعبئة للأدوية" : "Refill Alerts"}
            </Heading>
            <Caption numberOfLines={2} style={styles.subtitle}>
              {isRTL
                ? `${refillSummary.needsRefill} دواء يحتاج إعادة تعبئة`
                : `${refillSummary.needsRefill} medication(s) need refill`}
            </Caption>
          </View>
        </View>
        <View style={styles.headerRight}>
          {refillSummary.critical > 0 && (
            <Badge style={styles.badge} variant="error">
              {refillSummary.critical}
            </Badge>
          )}
          <Ionicons
            color={theme.colors.text.secondary}
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
          />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.content}>
          {criticalRefills.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isRTL ? "يحتاج اهتمام فوري" : "Needs Immediate Attention"}
              </Text>
              {criticalRefills.map((prediction) => (
                <View
                  key={prediction.medicationId}
                  style={styles.predictionItem}
                >
                  <View style={styles.predictionLeft}>
                    <Ionicons
                      color={getUrgencyColor(prediction.urgency)}
                      name={getUrgencyIcon(prediction.urgency)}
                      size={20}
                    />
                    <View style={styles.predictionText}>
                      <Text style={styles.medicationName}>
                        {prediction.medicationName}
                      </Text>
                      <Caption
                        numberOfLines={2}
                        style={styles.predictionDetails}
                      >
                        {prediction.dosage} •{" "}
                        {prediction.currentQuantity !== undefined
                          ? `${prediction.currentQuantity} ${prediction.quantityUnit} remaining`
                          : "Quantity not set"}
                      </Caption>
                    </View>
                  </View>
                  <View style={styles.predictionRight}>
                    <Badge
                      style={styles.urgencyBadge}
                      variant={
                        prediction.urgency === "critical" ? "error" : "warning"
                      }
                    >
                      {getUrgencyLabel(prediction.urgency)}
                    </Badge>
                    <Text
                      style={[
                        styles.daysText,
                        { color: getUrgencyColor(prediction.urgency) },
                      ]}
                    >
                      {medicationRefillService.formatDaysUntilRefill(
                        prediction.daysUntilRefill
                      )}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {refillSummary.predictions.length > criticalRefills.length && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {isRTL ? "قريباً" : "Upcoming"}
              </Text>
              {refillSummary.predictions
                .filter((p) => p.urgency !== "critical" && p.urgency !== "high")
                .slice(0, 3)
                .map((prediction) => (
                  <View
                    key={prediction.medicationId}
                    style={styles.predictionItem}
                  >
                    <View style={styles.predictionLeft}>
                      <Ionicons
                        color={getUrgencyColor(prediction.urgency)}
                        name={getUrgencyIcon(prediction.urgency)}
                        size={20}
                      />
                      <View style={styles.predictionText}>
                        <Text style={styles.medicationName}>
                          {prediction.medicationName}
                        </Text>
                        <Caption
                          numberOfLines={1}
                          style={styles.predictionDetails}
                        >
                          {prediction.dosage}
                        </Caption>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.daysText,
                        { color: getUrgencyColor(prediction.urgency) },
                      ]}
                    >
                      {medicationRefillService.formatDaysUntilRefill(
                        prediction.daysUntilRefill
                      )}
                    </Text>
                  </View>
                ))}
            </View>
          )}

          {onViewAll ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onViewAll}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>
                {isRTL ? "عرض الكل" : "View All"}
              </Text>
              <Ionicons
                color={theme.colors.primary.main}
                name={isRTL ? "arrow-forward" : "arrow-forward"}
                size={16}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

type ThemeType = ReturnType<typeof useTheme>["theme"];

const getStyles = (theme: ThemeType, isRTL: boolean) => ({
  card: {
    marginBottom: theme.spacing.base,
  },
  header: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    padding: theme.spacing.base,
  },
  headerLeft: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    flex: 1,
  },
  icon: {
    marginRight: isRTL ? 0 : theme.spacing.sm,
    marginLeft: isRTL ? theme.spacing.sm : 0,
  },
  headerText: {
    flex: 1,
  },
  title: {
    marginBottom: theme.spacing.xs / 2,
  },
  subtitle: {
    color: theme.colors.text.secondary,
  },
  headerRight: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    gap: theme.spacing.sm,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    paddingBottom: theme.spacing.base,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  section: {
    marginBottom: theme.spacing.base,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  predictionItem: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  predictionLeft: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    flex: 1,
  },
  predictionText: {
    marginLeft: isRTL ? 0 : theme.spacing.sm,
    marginRight: isRTL ? theme.spacing.sm : 0,
    flex: 1,
  },
  medicationName: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  predictionDetails: {
    color: theme.colors.text.secondary,
    fontSize: 12,
  },
  predictionRight: {
    alignItems: (isRTL ? "flex-start" : "flex-end") as
      | "flex-start"
      | "flex-end",
    gap: theme.spacing.xs,
  },
  urgencyBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
  },
  daysText: {
    fontSize: theme.typography.fontSize.sm,
    fontFamily: theme.typography.fontFamily.medium,
  },
  viewAllButton: {
    flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  viewAllText: {
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary.main,
  },
});
