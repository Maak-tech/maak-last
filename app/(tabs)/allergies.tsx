import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Plus,
  Trash2,
  X,
} from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/apiClient";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

type Severity = "mild" | "moderate" | "severe" | "life_threatening";

interface Allergy {
  id: string;
  substance: string;
  reaction?: string;
  severity?: Severity;
  diagnosedDate?: string;
  notes?: string;
  createdAt?: string;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  mild: "#10B981",
  moderate: "#F59E0B",
  severe: "#EF4444",
  life_threatening: "#7C3AED",
};

export default function AllergiesScreen() {
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [substance, setSubstance] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<Severity>("mild");
  const [notes, setNotes] = useState("");
  const [showSeverityPicker, setShowSeverityPicker] = useState(false);

  const severityOptions: Severity[] = ["mild", "moderate", "severe", "life_threatening"];
  const severityLabels: Record<Severity, string> = {
    mild: isRTL ? "خفيف" : "Mild",
    moderate: isRTL ? "متوسط" : "Moderate",
    severe: isRTL ? "شديد" : "Severe",
    life_threatening: isRTL ? "خطر على الحياة" : "Life Threatening",
  };

  const loadAllergies = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (!isRefresh) setLoading(true);
    try {
      const data = await api.get<Allergy[]>("/api/health/allergies");
      setAllergies(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.warn('[allergies] Failed to load allergies:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadAllergies(); }, [loadAllergies]));

  const resetForm = () => {
    setSubstance("");
    setReaction("");
    setSeverity("mild");
    setNotes("");
  };

  const handleAdd = async () => {
    if (!substance.trim()) {
      Alert.alert(
        isRTL ? "مطلوب" : "Required",
        isRTL ? "يرجى إدخال اسم المادة المسببة للحساسية" : "Please enter the allergy substance"
      );
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/health/allergies", {
        substance: substance.trim(),
        reaction: reaction.trim() || undefined,
        severity,
        notes: notes.trim() || undefined,
      });
      setShowModal(false);
      resetForm();
      loadAllergies();
    } catch (err: unknown) {
      Alert.alert(isRTL ? "خطأ" : "Error", (err instanceof Error ? err.message : null) ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (allergy: Allergy) => {
    Alert.alert(
      isRTL ? "حذف الحساسية" : "Delete Allergy",
      isRTL
        ? `هل تريد حذف حساسية "${allergy.substance}"؟`
        : `Delete allergy to "${allergy.substance}"?`,
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/health/allergies/${allergy.id}`);
              setAllergies((prev) => prev.filter((a) => a.id !== allergy.id));
            } catch (err: unknown) {
              console.warn('[allergies] Failed to delete allergy:', err);
              Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "فشل الحذف" : "Failed to delete");
            }
          },
        },
      ]
    );
  };

  const bg = isDark ? theme.colors.background.primary : "#F8FAFC";
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft color={theme.colors.text.primary} size={22} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          {isRTL ? "الحساسية" : "Allergies"}
        </Text>
        <TouchableOpacity onPress={() => setShowModal(true)} style={[styles.addBtn, { backgroundColor: theme.colors.primary.main }]}>
          <Plus color="#FFFFFF" size={20} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAllergies(true); }} colors={[theme.colors.primary.main]} />}
        >
          {allergies.length === 0 ? (
            <View style={styles.empty}>
              <AlertTriangle color={theme.colors.text.secondary} size={48} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
                {isRTL ? "لا توجد حساسيات مسجلة" : "No allergies recorded"}
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.colors.text.secondary }]}>
                {isRTL ? "اضغط + لإضافة حساسية" : "Tap + to add an allergy"}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {allergies.map((allergy) => (
                <View key={allergy.id} style={[styles.card, { backgroundColor: card, borderColor: border }]}>
                  <View style={[styles.severityBar, { backgroundColor: SEVERITY_COLORS[allergy.severity ?? "mild"] }]} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardRow}>
                      <Text style={[styles.substance, { color: theme.colors.text.primary }]}>{allergy.substance}</Text>
                      {allergy.severity && (
                        <View style={[styles.badge, { backgroundColor: `${SEVERITY_COLORS[allergy.severity]}20` }]}>
                          <Text style={[styles.badgeText, { color: SEVERITY_COLORS[allergy.severity] }]}>
                            {severityLabels[allergy.severity]}
                          </Text>
                        </View>
                      )}
                    </View>
                    {allergy.reaction && (
                      <Text style={[styles.reaction, { color: theme.colors.text.secondary }]}>
                        {isRTL ? "التفاعل: " : "Reaction: "}{allergy.reaction}
                      </Text>
                    )}
                    {allergy.notes && (
                      <Text style={[styles.notes, { color: theme.colors.text.secondary }]}>{allergy.notes}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(allergy)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Trash2 color={theme.colors.accent.error} size={18} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
                {isRTL ? "إضافة حساسية" : "Add Allergy"}
              </Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <X color={theme.colors.text.secondary} size={22} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
              {isRTL ? "المادة*" : "Substance*"}
            </Text>
            <TextInput
              value={substance}
              onChangeText={setSubstance}
              placeholder={isRTL ? "مثال: البنسلين، الفول السوداني" : "e.g. Penicillin, Peanuts"}
              placeholderTextColor={theme.colors.text.secondary}
              style={[styles.input, { borderColor: border, color: theme.colors.text.primary, backgroundColor: bg }]}
            />

            <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
              {isRTL ? "التفاعل" : "Reaction"}
            </Text>
            <TextInput
              value={reaction}
              onChangeText={setReaction}
              placeholder={isRTL ? "مثال: طفح جلدي، صعوبة التنفس" : "e.g. Rash, difficulty breathing"}
              placeholderTextColor={theme.colors.text.secondary}
              style={[styles.input, { borderColor: border, color: theme.colors.text.primary, backgroundColor: bg }]}
            />

            <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
              {isRTL ? "الشدة" : "Severity"}
            </Text>
            <TouchableOpacity
              onPress={() => setShowSeverityPicker(!showSeverityPicker)}
              style={[styles.picker, { borderColor: border, backgroundColor: bg }]}
            >
              <Text style={{ color: theme.colors.text.primary }}>{severityLabels[severity]}</Text>
              <ChevronDown color={theme.colors.text.secondary} size={18} />
            </TouchableOpacity>
            {showSeverityPicker && (
              <View style={[styles.pickerOptions, { backgroundColor: card, borderColor: border }]}>
                {severityOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => { setSeverity(opt); setShowSeverityPicker(false); }}
                    style={[styles.pickerOption, severity === opt && { backgroundColor: `${theme.colors.primary.main}15` }]}
                  >
                    <View style={[styles.dot, { backgroundColor: SEVERITY_COLORS[opt] }]} />
                    <Text style={{ color: theme.colors.text.primary }}>{severityLabels[opt]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
              {isRTL ? "ملاحظات" : "Notes"}
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."}
              placeholderTextColor={theme.colors.text.secondary}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textarea, { borderColor: border, color: theme.colors.text.primary, backgroundColor: bg }]}
            />

            <TouchableOpacity
              onPress={handleAdd}
              disabled={saving}
              style={[styles.saveBtn, { backgroundColor: theme.colors.primary.main, opacity: saving ? 0.7 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{isRTL ? "حفظ" : "Save"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "600", flex: 1, textAlign: "center" },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "600" },
  emptyDesc: { fontSize: 14 },
  list: { padding: 16, gap: 12 },
  card: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  severityBar: { width: 4, alignSelf: "stretch" },
  cardContent: { flex: 1, padding: 14, gap: 4 },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  substance: { fontSize: 16, fontWeight: "600" },
  reaction: { fontSize: 13 },
  notes: { fontSize: 13 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 8 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "500", marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  textarea: { height: 80, textAlignVertical: "top" },
  picker: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  pickerOptions: { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginTop: 2 },
  pickerOption: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
