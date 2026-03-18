/**
 * ElevatingFactorsList
 *
 * Shows ranked elevating health factors with impact badges.
 * Tap to expand explanation.
 */

import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import { TouchableOpacity, View, type ViewStyle } from "react-native";
import { Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { ElevatingFactor } from "@/types/vhi";

type Props = {
  factors: ElevatingFactor[];
  isRTL?: boolean;
};

export default function ElevatingFactorsList({ factors, isRTL = false }: Props) {
  const { theme } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (factors.length === 0) return null;

  const impactColor = (impact: ElevatingFactor["impact"]) =>
    impact === "high"
      ? theme.colors.accent.success ?? "#22C55E"
      : impact === "medium"
        ? "#34D399"
        : "#86EFAC";

  const impactLabel = (impact: ElevatingFactor["impact"], rtl: boolean) =>
    rtl
      ? impact === "high" ? "عالي" : impact === "medium" ? "متوسط" : "منخفض"
      : impact === "high" ? "HIGH" : impact === "medium" ? "MED" : "LOW";

  return (
    <View style={styles.container}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: theme.colors.accent.success ?? "#22C55E",
          letterSpacing: 0.8,
          marginBottom: 8,
          textAlign: isRTL ? "right" : "left",
        }}
      >
        {isRTL ? "ما يرفع صحتك" : "ELEVATING YOUR HEALTH"}
      </Text>

      {factors.map((factor, index) => {
        const isExpanded = expandedIndex === index;
        const color = impactColor(factor.impact);

        return (
          <TouchableOpacity
            key={`${factor.factor}-${index}`}
            activeOpacity={0.7}
            onPress={() => setExpandedIndex(isExpanded ? null : index)}
            style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}
          >
            <View style={[styles.checkCircle, { backgroundColor: color + "22", borderColor: color }]}>
              <Text style={{ fontSize: 11, color }}>✓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 6 }}>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: theme.colors.text.primary,
                    fontWeight: "500",
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {factor.factor}
                </Text>
                <View style={[styles.impactBadge, { backgroundColor: color + "22" }]}>
                  <Text style={{ fontSize: 10, color, fontWeight: "700" }}>
                    {impactLabel(factor.impact, isRTL)}
                  </Text>
                </View>
                {isExpanded ? (
                  <ChevronUp color={theme.colors.text.secondary} size={14} />
                ) : (
                  <ChevronDown color={theme.colors.text.secondary} size={14} />
                )}
              </View>
              {isExpanded && (
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.colors.text.secondary,
                    marginTop: 6,
                    lineHeight: 18,
                    textAlign: isRTL ? "right" : "left",
                  }}
                >
                  {factor.explanation}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const StyleSheet_hairlineWidth = 1;

const styles = {
  container: {
    marginBottom: 4,
  } as ViewStyle,
  row: {
    alignItems: "flex-start" as const,
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet_hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  } as ViewStyle,
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginTop: 1,
  } as ViewStyle,
  impactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  } as ViewStyle,
};
