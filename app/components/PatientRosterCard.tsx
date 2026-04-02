import { ChevronRight, User } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface Patient {
  id: string;
  name: string;
  email?: string;
  riskScore?: number;
  riskLevel?: "critical" | "high" | "elevated" | "normal";
  vhiScore?: number;
  adherence?: number;
  lastActivity?: string;
  cohortName?: string;
}

interface Props {
  patient: Patient;
  onPress?: (patient: Patient) => void;
}

const RISK_COLORS = {
  critical: "#EF4444",
  high:     "#F97316",
  elevated: "#F59E0B",
  normal:   "#10B981",
};

export default function PatientRosterCard({ patient, onPress }: Props) {
  const { theme, isDark } = useTheme();
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";
  const riskColor = RISK_COLORS[patient.riskLevel ?? "normal"];

  return (
    <TouchableOpacity
      onPress={() => onPress?.(patient)}
      style={[styles.card, { backgroundColor: card, borderColor: border, borderLeftColor: riskColor }]}
    >
      <View style={[styles.avatar, { backgroundColor: `${theme.colors.primary.main}15` }]}>
        <User color={theme.colors.primary.main} size={20} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.name, { color: theme.colors.text.primary }]}>{patient.name}</Text>
        {patient.cohortName && (
          <Text style={[styles.cohort, { color: theme.colors.text.secondary }]}>{patient.cohortName}</Text>
        )}
        <View style={styles.stats}>
          {patient.vhiScore !== undefined && (
            <Text style={[styles.stat, { color: theme.colors.text.secondary }]}>
              VHI: <Text style={{ color: theme.colors.text.primary, fontWeight: "700" }}>{Math.round(patient.vhiScore)}</Text>
            </Text>
          )}
          {patient.adherence !== undefined && (
            <Text style={[styles.stat, { color: theme.colors.text.secondary }]}>
              Adherence: <Text style={{ color: theme.colors.text.primary, fontWeight: "700" }}>{Math.round(patient.adherence * 100)}%</Text>
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.riskBadge, { backgroundColor: `${riskColor}15` }]}>
        <Text style={[styles.riskText, { color: riskColor }]}>
          {patient.riskLevel ?? "normal"}
        </Text>
      </View>
      <ChevronRight color={theme.colors.text.secondary} size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, borderLeftWidth: 4, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  content: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  cohort: { fontSize: 12, marginTop: 2 },
  stats: { flexDirection: "row", gap: 12, marginTop: 4 },
  stat: { fontSize: 12 },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  riskText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});
