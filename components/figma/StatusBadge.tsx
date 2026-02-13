import { StyleSheet, Text, View } from "react-native";

type StatusBadgeProps = {
  status?: "stable" | "monitor" | "critical" | "unknown";
  label?: string;
};

const STATUS_MAP = {
  stable: {
    label: "Stable",
    text: "#10B981",
    background: "rgba(16, 185, 129, 0.12)",
  },
  monitor: {
    label: "Monitor",
    text: "#F59E0B",
    background: "rgba(245, 158, 11, 0.12)",
  },
  critical: {
    label: "Critical",
    text: "#EF4444",
    background: "rgba(239, 68, 68, 0.12)",
  },
  unknown: {
    label: "Unknown",
    text: "#6C7280",
    background: "rgba(156, 163, 175, 0.12)",
  },
} as const;

export default function StatusBadge({
  status = "unknown",
  label,
}: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? STATUS_MAP.unknown;

  return (
    <View style={[styles.badge, { backgroundColor: config.background }]}>
      <Text style={[styles.text, { color: config.text }]}>
        {label ?? config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
  },
});
