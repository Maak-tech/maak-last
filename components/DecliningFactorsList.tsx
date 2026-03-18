/**
 * DecliningFactorsList
 *
 * Shows ranked declining health factors with impact badges.
 * Tap to expand explanation + recommendation.
 * Tap the recommendation to pre-fill that action into Nora chat.
 */

import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react-native";
import { useState } from "react";
import { TouchableOpacity, View, type ViewStyle } from "react-native";
import { Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { DecliningFactor } from "@/types/vhi";

type Props = {
  factors: DecliningFactor[];
  isRTL?: boolean;
  onAskNora?: (prompt: string) => void;
};

export default function DecliningFactorsList({
  factors,
  isRTL = false,
  onAskNora,
}: Props) {
  const { theme } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (factors.length === 0) return null;

  const errorColor = theme.colors.accent.error ?? "#EF4444";
  const warnColor = theme.colors.accent.warning ?? "#F59E0B";

  const impactColor = (impact: DecliningFactor["impact"]) =>
    impact === "high" ? errorColor : impact === "medium" ? warnColor : "#FCD34D";

  const impactLabel = (impact: DecliningFactor["impact"], rtl: boolean) =>
    rtl
      ? impact === "high" ? "عالي" : impact === "medium" ? "متوسط" : "منخفض"
      : impact === "high" ? "HIGH" : impact === "medium" ? "MED" : "LOW";

  return (
    <View style={styles.container}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: errorColor,
          letterSpacing: 0.8,
          marginBottom: 8,
          textAlign: isRTL ? "right" : "left",
        }}
      >
        {isRTL ? "ما يخفض صحتك" : "DECLINING YOUR HEALTH"}
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
            <View style={[styles.xCircle, { backgroundColor: color + "22", borderColor: color }]}>
              <Text style={{ fontSize: 11, color }}>✗</Text>
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
                <View style={{ marginTop: 6 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      color: theme.colors.text.secondary,
                      lineHeight: 18,
                      textAlign: isRTL ? "right" : "left",
                    }}
                  >
                    {factor.explanation}
                  </Text>
                  {factor.recommendation ? (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() =>
                        onAskNora?.(
                          isRTL
                            ? `${factor.factor} — ماذا يجب أن أفعل؟`
                            : `${factor.factor} — what should I do about this?`
                        )
                      }
                      style={[
                        styles.recommendationRow,
                        {
                          backgroundColor: color + "14",
                          borderColor: color + "40",
                          flexDirection: isRTL ? "row-reverse" : "row",
                        },
                      ]}
                    >
                      <MessageCircle color={color} size={13} />
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 12,
                          color,
                          lineHeight: 16,
                          textAlign: isRTL ? "right" : "left",
                        }}
                      >
                        {factor.recommendation}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = {
  container: {
    marginBottom: 4,
  } as ViewStyle,
  row: {
    alignItems: "flex-start" as const,
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  } as ViewStyle,
  xCircle: {
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
  recommendationRow: {
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    alignItems: "flex-start" as const,
  } as ViewStyle,
};
