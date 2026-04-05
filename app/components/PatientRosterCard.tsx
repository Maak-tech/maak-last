import { ChevronRight, User } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

export interface PatientRoster {
  id: string;
  userId: string;
  displayName?: string;
  riskLevel?: "critical" | "high" | "elevated" | "normal";
  riskScore?: number;
  lastVitalSync?: string;
  anomalies?: number;
  missedMeds?: number;
  adherence?: number;
}

export interface PatientSnapshot {
  riskScore?: number;
  riskLevel?: "critical" | "high" | "elevated" | "normal";
  vhiScore?: number;
  adherence?: number;
  lastActivity?: string;
}

interface Props {
  roster: PatientRoster;
  snapshot?: PatientSnapshot;
  patientDisplayName?: string;
  onPress?: () => void;
}

const RISK_COLORS = {
  critical: "#EF4444",
  high:     "#F97316",
  elevated: "#F59E0B",
  normal:   "#10B981",
};

export default function PatientRosterCard({ roster, snapshot, patientDisplayName, onPress }: Props) {
  const { theme, isDark } = useTheme();
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";
  const riskLevel = roster.riskLevel ?? snapshot?.riskLevel ?? "normal";
  const riskColor = RISK_COLORS[riskLevel];
  const displayName = patientDisplayName ?? roster.displayName ?? "Unknown Patient";
  const vhiScore = snapshot?.vhiScore;
  const adherence = snapshot?.adherence ?? roster.adherence;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, { backgroundColor: card, borderColor: border, borderLeftColor: riskColor }]}
    >
      <View style={[styles.avatar, { backgroundColor: `${theme.colors.primary.main}15` }]}>
        <User color={theme.colors.primary.main} size={20} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.name, { color: theme.colors.text.primary }]}>{displayName}</Text>
        <View style={styles.stats}>
          {vhiScore !== undefined && (
            <Text style={[styles.stat, { color: theme.colors.text.secondary }]}>
              VHI: <Text style={{ color: theme.colors.text.primary, fontWeight: "700" }}>{Math.round(vhiScore)}</Text>
            </Text>
          )}
          {adherence !== undefined && (
            <Text style={[styles.stat, { color: theme.colors.text.secondary }]}>
              Adherence: <Text style={{ color: theme.colors.text.primary, fontWeight: "700" }}>{Math.round(adherence * 100)}%</Text>
            </Text>
          )}
          {roster.anomalies !== undefined && roster.anomalies > 0 && (
            <Text style={[styles.stat, { color: theme.colors.text.secondary }]}>
              Alerts: <Text style={{ color: RISK_COLORS.critical, fontWeight: "700" }}>{roster.anomalies}</Text>
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.riskBadge, { backgroundColor: `${riskColor}15` }]}>
        <Text style={[styles.riskText, { color: riskColor }]}>
          {riskLevel}
        </Text>
      </View>
      <ChevronRight color={theme.colors.text.secondary} size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, gap: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  content: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  stats: { flexDirection: "row", gap: 12, marginTop: 4 },
  stat: { fontSize: 12 },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  riskText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});
