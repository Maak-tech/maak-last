import {
  Activity,
  AlertTriangle,
  Clock,
  Pill,
  User,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View, type ViewStyle } from "react-native";
import { Card } from "@/components/design-system";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import type { PatientHealthSnapshot } from "@/lib/services/populationHealthService";
import type { PatientRoster } from "@/types";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

// ─── Types ────────────────────────────────────────────────────────────────────

type PatientRosterCardProps = {
  roster: PatientRoster;
  snapshot: PatientHealthSnapshot;
  patientDisplayName?: string;
  onPress?: () => void;
};

// ─── Risk Color Helpers ───────────────────────────────────────────────────────

const RISK_COLORS = {
  critical: "#EF4444",
  high: "#F97316",
  elevated: "#F59E0B",
  normal: "#10B981",
};

const RISK_BG_COLORS = {
  critical: "#FEF2F2",
  high: "#FFF7ED",
  elevated: "#FFFBEB",
  normal: "#ECFDF5",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientRosterCard({
  roster,
  snapshot,
  patientDisplayName,
  onPress,
}: PatientRosterCardProps) {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const styles = createThemedStyles((t) => ({
    card: {
      marginBottom: t.spacing.sm,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.spacing.base,
    } as ViewStyle,
    row: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center",
    } as ViewStyle,
    riskDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: isRTL ? 0 : t.spacing.sm,
      marginLeft: isRTL ? t.spacing.sm : 0,
    } as ViewStyle,
    nameColumn: {
      flex: 1,
    } as ViewStyle,
    riskBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      alignSelf: "flex-start",
    } as ViewStyle,
    metricsRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      marginTop: t.spacing.xs,
      flexWrap: "wrap",
      gap: t.spacing.sm,
    } as ViewStyle,
    metricChip: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center",
      gap: 4,
    } as ViewStyle,
    divider: {
      height: 1,
      backgroundColor: t.colors.border.light,
      marginVertical: t.spacing.xs,
    } as ViewStyle,
  }))(theme);

  const riskColor = RISK_COLORS[snapshot.riskLevel];
  const riskBgColor = RISK_BG_COLORS[snapshot.riskLevel];

  const riskLabel = isRTL
    ? {
        critical: "حرج",
        high: "مرتفع",
        elevated: "مرتفع قليلاً",
        normal: "طبيعي",
      }[snapshot.riskLevel]
    : {
        critical: "Critical",
        high: "High",
        elevated: "Elevated",
        normal: "Normal",
      }[snapshot.riskLevel];

  const displayName =
    patientDisplayName || roster.userId.slice(0, 8).toUpperCase();

  const lastSyncText = (() => {
    if (!snapshot.lastVitalSyncAt) {
      return isRTL ? "لا توجد بيانات حيوية" : "No vitals synced";
    }
    const diffMs = Date.now() - snapshot.lastVitalSyncAt.getTime();
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    const minutes = Math.floor(diffMs / (60 * 1000));

    if (minutes < 60) {
      return isRTL ? `منذ ${minutes} دقيقة` : `${minutes}m ago`;
    }
    if (hours < 24) {
      return isRTL ? `منذ ${hours} ساعة` : `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return isRTL ? `منذ ${days} يوم` : `${days}d ago`;
  })();

  return (
    <TouchableOpacity activeOpacity={0.7} disabled={!onPress} onPress={onPress}>
      <Card style={styles.card}>
        {/* Top row: risk dot + name + risk badge */}
        <View style={styles.row}>
          <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
          <View style={styles.nameColumn}>
            <TypographyText
              style={[
                getTextStyle(
                  theme,
                  "body",
                  "semibold",
                  theme.colors.text.primary
                ),
                { textAlign: isRTL ? "right" : "left" },
              ]}
            >
              {displayName}
            </TypographyText>
          </View>
          <View style={[styles.riskBadge, { backgroundColor: riskBgColor }]}>
            <Caption
              style={{
                color: riskColor,
                fontWeight: "600",
              }}
            >
              {riskLabel}
            </Caption>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Metrics row */}
        <View style={styles.metricsRow}>
          {/* Last sync */}
          <View style={styles.metricChip}>
            <Clock color={theme.colors.text.secondary} size={12} />
            <Caption style={{ color: theme.colors.text.secondary }}>
              {lastSyncText}
            </Caption>
          </View>

          {/* Anomalies */}
          {snapshot.recentAnomalies.total > 0 && (
            <View style={styles.metricChip}>
              <AlertTriangle
                color={
                  snapshot.recentAnomalies.critical > 0
                    ? RISK_COLORS.critical
                    : RISK_COLORS.elevated
                }
                size={12}
              />
              <Caption
                style={{
                  color:
                    snapshot.recentAnomalies.critical > 0
                      ? RISK_COLORS.critical
                      : RISK_COLORS.elevated,
                }}
              >
                {isRTL
                  ? `${snapshot.recentAnomalies.total} شذوذ`
                  : `${snapshot.recentAnomalies.total} anomal${snapshot.recentAnomalies.total === 1 ? "y" : "ies"}`}
              </Caption>
            </View>
          )}

          {/* Missed medications */}
          {snapshot.missedMedicationsToday > 0 && (
            <View style={styles.metricChip}>
              <Pill color={RISK_COLORS.high} size={12} />
              <Caption style={{ color: RISK_COLORS.high }}>
                {isRTL
                  ? `${snapshot.missedMedicationsToday} جرعة فائتة`
                  : `${snapshot.missedMedicationsToday} missed`}
              </Caption>
            </View>
          )}

          {/* Active alerts */}
          {snapshot.activeAlerts > 0 && (
            <View style={styles.metricChip}>
              <Activity color={theme.colors.text.secondary} size={12} />
              <Caption style={{ color: theme.colors.text.secondary }}>
                {isRTL
                  ? `${snapshot.activeAlerts} تنبيه`
                  : `${snapshot.activeAlerts} alert${snapshot.activeAlerts === 1 ? "" : "s"}`}
              </Caption>
            </View>
          )}

          {/* All clear */}
          {snapshot.recentAnomalies.total === 0 &&
            snapshot.missedMedicationsToday === 0 &&
            snapshot.activeAlerts === 0 && (
              <View style={styles.metricChip}>
                <User color={RISK_COLORS.normal} size={12} />
                <Caption style={{ color: RISK_COLORS.normal }}>
                  {isRTL ? "وضع جيد" : "All clear"}
                </Caption>
              </View>
            )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}
