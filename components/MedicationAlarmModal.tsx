import { Pill, X } from "lucide-react-native";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMedicationAlarm } from "@/contexts/MedicationAlarmContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function MedicationAlarmModal() {
  const { activeAlarm, dismissAlarm } = useMedicationAlarm();
  const { theme } = useTheme();

  if (!activeAlarm) return null;

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }]}>
          <View style={[styles.icon, { backgroundColor: `${theme.colors.primary.main}15` }]}>
            <Pill color={theme.colors.primary.main} size={32} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            Time for your medication
          </Text>
          <Text style={[styles.name, { color: theme.colors.primary.main }]}>
            {activeAlarm.medicationName}
          </Text>
          {activeAlarm.dosage && (
            <Text style={[styles.dosage, { color: theme.colors.text.secondary }]}>
              {activeAlarm.dosage}
            </Text>
          )}
          <TouchableOpacity
            onPress={dismissAlarm}
            style={[styles.dismissBtn, { backgroundColor: theme.colors.primary.main }]}
          >
            <Text style={styles.dismissText}>Mark as taken</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={dismissAlarm} style={styles.closeBtn}>
            <X color={theme.colors.text.secondary} size={20} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 32 },
  card: { width: "100%", borderRadius: 24, padding: 28, alignItems: "center", gap: 12 },
  icon: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  name: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  dosage: { fontSize: 15, textAlign: "center" },
  dismissBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  dismissText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  closeBtn: { position: "absolute", top: 16, right: 16, padding: 4 },
});
