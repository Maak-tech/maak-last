import { Lightbulb, X } from "lucide-react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import type { EnrichedDiscovery } from "@/lib/services/discoveryService";

const CATEGORY_COLORS: Record<string, string> = {
  symptom_vital:      "#EF4444",
  temporal_pattern:   "#8B5CF6",
  medication_vital:   "#10B981",
  lifestyle_vital:    "#F59E0B",
  genetic_risk:       "#06B6D4",
  correlation:        "#3B82F6",
};

interface Props {
  discovery: EnrichedDiscovery;
  onDismiss?: (id: string) => void;
}

export default function EnrichedDiscoveryCard({ discovery, onDismiss }: Props) {
  const { theme, isDark } = useTheme();
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";
  const color = CATEGORY_COLORS[discovery.category] ?? CATEGORY_COLORS[discovery.discoveryType] ?? "#3B82F6";

  const confidenceLabel = discovery.confidence >= 80 ? "High confidence"
    : discovery.confidence >= 60 ? "Moderate confidence"
    : "Early signal";

  return (
    <View style={[styles.card, { backgroundColor: card, borderColor: border, borderLeftColor: color }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}15` }]}>
          <Lightbulb color={color} size={18} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: theme.colors.text.primary }]} numberOfLines={2}>
            {discovery.title}
          </Text>
          <Text style={[styles.meta, { color: color }]}>
            {confidenceLabel} · {Math.round(discovery.confidence)}%
          </Text>
        </View>
        {onDismiss && (
          <TouchableOpacity
            onPress={() => onDismiss(discovery.id)}
            style={styles.dismissBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X color={theme.colors.text.secondary} size={16} />
          </TouchableOpacity>
        )}
      </View>

      {/* Description */}
      <Text style={[styles.desc, { color: theme.colors.text.secondary }]}>
        {discovery.description}
      </Text>

      {/* Recommendation */}
      {discovery.actionable && discovery.recommendation && (
        <View style={[styles.recBox, { backgroundColor: `${color}10`, borderColor: `${color}30` }]}>
          <Text style={[styles.recLabel, { color: color }]}>Recommendation</Text>
          <Text style={[styles.recText, { color: theme.colors.text.primary }]}>
            {discovery.recommendation}
          </Text>
        </View>
      )}

      {/* Status badge */}
      {discovery.status === "new" && (
        <View style={[styles.newBadge, { backgroundColor: `${color}20` }]}>
          <Text style={[styles.newBadgeText, { color: color }]}>New</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, borderLeftWidth: 4, padding: 16, gap: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  titleBlock: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", lineHeight: 20 },
  meta: { fontSize: 12, marginTop: 3, fontWeight: "600" },
  dismissBtn: { padding: 4 },
  desc: { fontSize: 14, lineHeight: 20 },
  recBox: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 4 },
  recLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  recText: { fontSize: 13, lineHeight: 18 },
  newBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  newBadgeText: { fontSize: 11, fontWeight: "700" },
});
