import { StyleSheet, Text, View } from "react-native";

type Status = "active" | "inactive" | "warning" | "critical" | "normal" | string;

interface Props {
  status: Status;
  label?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:   { bg: "#D1FAE5", text: "#065F46" },
  inactive: { bg: "#F1F5F9", text: "#64748B" },
  warning:  { bg: "#FEF3C7", text: "#92400E" },
  critical: { bg: "#FEE2E2", text: "#991B1B" },
  normal:   { bg: "#DBEAFE", text: "#1E40AF" },
};

export default function StatusBadge({ status, label }: Props) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.normal;
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  text: { fontSize: 12, fontWeight: "600" },
});
