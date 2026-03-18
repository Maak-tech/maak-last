/**
 * VHIOverallScore
 *
 * Circular progress gauge showing the composite health score (0-100)
 * with trajectory indicator (worsening / stable / improving).
 */

import { TrendingDown, TrendingUp, Minus } from "lucide-react-native";
import { View, type ViewStyle } from "react-native";
import { Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  score: number; // 0–100
  trajectory?: "worsening" | "stable" | "improving";
  changeCount?: number; // how many factors changed today
  isRTL?: boolean;
};

export default function VHIOverallScore({
  score,
  trajectory = "stable",
  changeCount,
  isRTL = false,
}: Props) {
  const { theme } = useTheme();

  const scoreColor =
    score >= 75
      ? theme.colors.accent.success ?? "#22C55E"
      : score >= 55
        ? theme.colors.accent.warning ?? "#F59E0B"
        : theme.colors.accent.error ?? "#EF4444";

  const TrajectoryIcon =
    trajectory === "improving"
      ? TrendingUp
      : trajectory === "worsening"
        ? TrendingDown
        : Minus;

  const trajectoryColor =
    trajectory === "improving"
      ? theme.colors.accent.success ?? "#22C55E"
      : trajectory === "worsening"
        ? theme.colors.accent.error ?? "#EF4444"
        : theme.colors.text.secondary;

  const trajectoryLabel = isRTL
    ? trajectory === "improving"
      ? "تحسن"
      : trajectory === "worsening"
        ? "تراجع"
        : "مستقر"
    : trajectory === "improving"
      ? "Improving"
      : trajectory === "worsening"
        ? "Worsening"
        : "Stable";

  return (
    <View style={[styles.container, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      {/* Circular score */}
      <View
        style={[
          styles.circle,
          {
            borderColor: scoreColor,
            backgroundColor: scoreColor + "18",
          },
        ]}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: "700",
            color: scoreColor,
            lineHeight: 32,
          }}
        >
          {Math.round(score)}
        </Text>
        <Text style={{ fontSize: 11, color: theme.colors.text.secondary }}>
          /100
        </Text>
      </View>

      {/* Label block */}
      <View style={[styles.labelBlock, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: theme.colors.text.primary }}>
          {isRTL ? "درجة صحتك" : "Health Score"}
        </Text>
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 4, marginTop: 4 }}>
          <TrajectoryIcon color={trajectoryColor} size={14} />
          <Text style={{ fontSize: 13, color: trajectoryColor }}>
            {trajectoryLabel}
            {changeCount != null && changeCount > 0
              ? isRTL
                ? ` — ${changeCount} تغييرات اليوم`
                : ` — ${changeCount} change${changeCount > 1 ? "s" : ""} today`
              : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = {
  container: {
    alignItems: "center" as const,
    gap: 16,
    paddingVertical: 4,
  },
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  } as ViewStyle,
  labelBlock: {
    flex: 1,
  } as ViewStyle,
};
