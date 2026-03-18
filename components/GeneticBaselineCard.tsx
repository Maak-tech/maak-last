/**
 * GeneticBaselineCard
 *
 * Shows PRS percentile tiles for each condition + pharmacogenomics alerts.
 * Hidden when geneticBaseline is null (no DNA uploaded yet).
 */

import { AlertTriangle, Dna } from "lucide-react-native";
import { View, type ViewStyle } from "react-native";
import { Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { VirtualHealthIdentity } from "@/types/vhi";

type Props = {
  geneticBaseline: VirtualHealthIdentity["geneticBaseline"];
  isRTL?: boolean;
};

export default function GeneticBaselineCard({ geneticBaseline, isRTL = false }: Props) {
  const { theme } = useTheme();

  if (!geneticBaseline?.hasGeneticData) return null;

  const levelColor = (level: string) => {
    if (level === "high") return theme.colors.accent.error ?? "#EF4444";
    if (level === "elevated") return theme.colors.accent.warning ?? "#F59E0B";
    return theme.colors.accent.success ?? "#22C55E";
  };

  const pharmAlerts = geneticBaseline.pharmacogenomics.filter(
    (p) => p.interaction !== "standard"
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Dna color={theme.colors.primary.main} size={15} />
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: theme.colors.primary.main,
            letterSpacing: 0.8,
            textAlign: isRTL ? "right" : "left",
          }}
        >
          {isRTL ? "الأساس الجيني" : "GENETIC BASELINE"}
        </Text>
      </View>

      {/* PRS tiles */}
      <View style={styles.tilesRow}>
        {geneticBaseline.prsScores.slice(0, 4).map((prs) => {
          const color = levelColor(prs.level);
          return (
            <View
              key={prs.condition}
              style={[styles.tile, { backgroundColor: color + "14", borderColor: color + "40" }]}
            >
              <Text
                style={{
                  fontSize: 10,
                  color: theme.colors.text.secondary,
                  marginBottom: 2,
                  textTransform: "capitalize",
                  textAlign: "center",
                }}
                numberOfLines={2}
              >
                {prs.condition.replace(/_/g, " ")}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color }}>
                {prs.percentile}
                <Text style={{ fontSize: 9, color }}>th</Text>
              </Text>
              <Text style={{ fontSize: 9, color, textTransform: "capitalize" }}>
                {prs.level}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Pharmacogenomics alerts */}
      {pharmAlerts.length > 0 && (
        <View
          style={[
            styles.pharmRow,
            {
              backgroundColor: (theme.colors.accent.warning ?? "#F59E0B") + "14",
              borderColor: (theme.colors.accent.warning ?? "#F59E0B") + "50",
              flexDirection: isRTL ? "row-reverse" : "row",
            },
          ]}
        >
          <AlertTriangle color={theme.colors.accent.warning ?? "#F59E0B"} size={13} />
          <Text
            style={{
              flex: 1,
              fontSize: 12,
              color: theme.colors.accent.warning ?? "#F59E0B",
              lineHeight: 16,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {isRTL
              ? `${pharmAlerts.length} تنبيه دوائي جيني — اضغط لمعرفة التفاصيل`
              : `${pharmAlerts.length} pharmacogenomics alert${pharmAlerts.length > 1 ? "s" : ""}: ${pharmAlerts
                  .map((p) => `${p.drug} (${p.interaction.replace(/_/g, " ")})`)
                  .join(", ")}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = {
  container: {
    marginBottom: 4,
  } as ViewStyle,
  header: {
    alignItems: "center" as const,
    gap: 6,
    marginBottom: 10,
  } as ViewStyle,
  tilesRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    marginBottom: 8,
  } as ViewStyle,
  tile: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center" as const,
    minWidth: 72,
    flex: 1,
  } as ViewStyle,
  pharmRow: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 7,
    alignItems: "flex-start" as const,
  } as ViewStyle,
};
