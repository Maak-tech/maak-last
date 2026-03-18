/**
 * GeneticRiskSummaryCard
 *
 * Admin-facing genetic risk summary for a family member.
 *
 * Displays:
 *   1. PRS condition tiles (percentile + risk level) — ALL conditions, not just top 4
 *   2. Pharmacogenomics alerts with drug + interaction label
 *   3. A "no consent" state when familySharingConsent = false
 *
 * This component intentionally shows NO raw rsids or ClinVar variant details —
 * only the condition-level summary suitable for a family admin.
 *
 * Used in: family member detail screen, caregiver dashboard
 */

import { AlertTriangle, Dna, Lock } from "lucide-react-native";
import { View, type ViewStyle } from "react-native";
import { Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type GeneticRiskSummaryData = {
  conditions: Array<{
    condition: string;
    percentile: number;
    level: "low" | "average" | "elevated" | "high";
  }>;
  pharmacogenomicsAlerts: Array<{
    drug: string;
    interaction:
      | "standard"
      | "reduced_efficacy"
      | "increased_toxicity"
      | "contraindicated";
    gene?: string;
  }>;
};

type Props = {
  /** Genetic summary — null if consent has not been given */
  summary: GeneticRiskSummaryData | null | undefined;
  /** Member's first name — used in copy ("Emma has 2 alerts") */
  memberName?: string;
  isRTL?: boolean;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function levelColor(
  level: "low" | "average" | "elevated" | "high",
  errorColor: string,
  warningColor: string,
  successColor: string
): string {
  if (level === "high")     return errorColor;
  if (level === "elevated") return warningColor;
  return successColor;
}

function interactionLabel(
  interaction: GeneticRiskSummaryData["pharmacogenomicsAlerts"][number]["interaction"],
  isRTL: boolean
): string {
  if (isRTL) {
    switch (interaction) {
      case "reduced_efficacy":   return "فاعلية منخفضة";
      case "increased_toxicity": return "سمية مرتفعة";
      case "contraindicated":    return "موانع الاستخدام";
      default:                   return "معتاد";
    }
  }
  switch (interaction) {
    case "reduced_efficacy":   return "Reduced efficacy";
    case "increased_toxicity": return "Increased toxicity";
    case "contraindicated":    return "Contraindicated";
    default:                   return "Standard";
  }
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function GeneticRiskSummaryCard({
  summary,
  memberName,
  isRTL = false,
}: Props) {
  const { theme } = useTheme();

  const errorColor   = theme.colors.accent.error   ?? "#EF4444";
  const warningColor = theme.colors.accent.warning  ?? "#F59E0B";
  const successColor = theme.colors.accent.success  ?? "#22C55E";
  const primaryColor = theme.colors.primary.main;

  // ── No consent state ────────────────────────────────────────────────────────
  if (!summary) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.background.secondary,
            borderColor: theme.colors.border.light,
          },
        ]}
      >
        <View
          style={[
            styles.header,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
        >
          <Lock color={theme.colors.text.secondary} size={14} />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: theme.colors.text.secondary,
              letterSpacing: 0.6,
              textAlign: isRTL ? "right" : "left",
            }}
          >
            {isRTL ? "البيانات الجينية" : "GENETIC DATA"}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 12,
            color: theme.colors.text.secondary,
            textAlign: isRTL ? "right" : "left",
            lineHeight: 18,
          }}
        >
          {isRTL
            ? `لم يوافق ${memberName ?? "العضو"} على مشاركة بياناته الجينية مع الأسرة بعد.`
            : `${memberName ?? "This member"} has not yet consented to sharing genetic data with family.`}
        </Text>
      </View>
    );
  }

  const activeAlerts = summary.pharmacogenomicsAlerts.filter(
    (a) => a.interaction !== "standard"
  );
  const riskyConditions = summary.conditions.filter(
    (c) => c.level === "high" || c.level === "elevated"
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background.secondary,
          borderColor: theme.colors.border.light,
        },
      ]}
    >
      {/* Header */}
      <View
        style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}
      >
        <Dna color={primaryColor} size={14} />
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: primaryColor,
            letterSpacing: 0.6,
            flex: 1,
            textAlign: isRTL ? "right" : "left",
          }}
        >
          {isRTL ? "الملخص الجيني" : "GENETIC RISK SUMMARY"}
        </Text>
        {riskyConditions.length > 0 && (
          <Text
            style={{
              fontSize: 10,
              color: warningColor,
              fontWeight: "600",
            }}
          >
            {isRTL
              ? `${riskyConditions.length} خطر مرتفع`
              : `${riskyConditions.length} elevated`}
          </Text>
        )}
      </View>

      {/* PRS tiles */}
      {summary.conditions.length > 0 ? (
        <View style={styles.tilesRow}>
          {summary.conditions.map((c) => {
            const color = levelColor(c.level, errorColor, warningColor, successColor);
            return (
              <View
                key={c.condition}
                style={[
                  styles.tile,
                  {
                    backgroundColor: color + "14",
                    borderColor: color + "44",
                  },
                ]}
              >
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 9,
                    color: theme.colors.text.secondary,
                    marginBottom: 2,
                    textTransform: "capitalize",
                    textAlign: "center",
                  }}
                >
                  {c.condition.replace(/_/g, " ")}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color }}>
                  {c.percentile}
                  <Text style={{ fontSize: 8, color }}>th</Text>
                </Text>
                <Text style={{ fontSize: 9, color, textTransform: "capitalize" }}>
                  {isRTL
                    ? (c.level === "high"
                        ? "مرتفع"
                        : c.level === "elevated"
                          ? "مرتفع نسبياً"
                          : c.level === "average"
                            ? "متوسط"
                            : "منخفض")
                    : c.level}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={{ fontSize: 12, color: theme.colors.text.secondary, marginBottom: 8 }}>
          {isRTL ? "لا توجد بيانات PRS بعد" : "No PRS data available yet"}
        </Text>
      )}

      {/* Pharmacogenomics alerts */}
      {activeAlerts.length > 0 && (
        <View
          style={[
            styles.pharmRow,
            {
              backgroundColor: warningColor + "14",
              borderColor: warningColor + "50",
              flexDirection: isRTL ? "row-reverse" : "row",
            },
          ]}
        >
          <AlertTriangle color={warningColor} size={13} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: warningColor,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {isRTL
                ? `${activeAlerts.length} تنبيه دوائي`
                : `${activeAlerts.length} pharmacogenomics alert${activeAlerts.length > 1 ? "s" : ""}`}
            </Text>
            {activeAlerts.map((alert) => (
              <Text
                key={`${alert.drug}-${alert.interaction}`}
                style={{
                  fontSize: 11,
                  color: theme.colors.text.secondary,
                  textAlign: isRTL ? "right" : "left",
                }}
              >
                {`${alert.drug}${alert.gene ? ` (${alert.gene})` : ""} — ${interactionLabel(alert.interaction, isRTL)}`}
              </Text>
            ))}
          </View>
        </View>
      )}

      {activeAlerts.length === 0 && summary.pharmacogenomicsAlerts.length > 0 && (
        <Text
          style={{
            fontSize: 11,
            color: successColor,
            textAlign: isRTL ? "right" : "left",
            marginTop: 4,
          }}
        >
          {isRTL ? "✓ لا تنبيهات دوائية جينية" : "✓ No pharmacogenomics alerts"}
        </Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  } as ViewStyle,
  header: {
    alignItems: "center" as const,
    gap: 6,
    marginBottom: 12,
  } as ViewStyle,
  tilesRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 7,
    marginBottom: 10,
  } as ViewStyle,
  tile: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 9,
    alignItems: "center" as const,
    minWidth: 68,
    flex: 1,
  } as ViewStyle,
  pharmRow: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 8,
    alignItems: "flex-start" as const,
  } as ViewStyle,
};
