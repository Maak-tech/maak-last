import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Plus,
  X,
} from "lucide-react-native";
import { useCallback, useState } from "react";
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

type TestType = "blood" | "urine" | "imaging" | "other";
type ResultFlag = "high" | "low" | "critical" | "normal";

interface LabResultItem {
  name: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  flag?: ResultFlag;
}

interface LabResult {
  id: string;
  testName: string;
  testType?: TestType;
  testDate: string;
  orderedBy?: string;
  facility?: string;
  results?: LabResultItem[];
  notes?: string;
  createdAt?: string;
}

const FLAG_COLORS: Record<ResultFlag, string> = {
  normal: "#10B981",
  low: "#3B82F6",
  high: "#F59E0B",
  critical: "#EF4444",
};

const TEST_TYPE_ICONS: Record<TestType, string> = {
  blood: "🩸",
  urine: "🧪",
  imaging: "🔬",
  other: "📋",
};

export default function LabResultsScreen() {
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [testName, setTestName] = useState("");
  const [testType, setTestType] = useState<TestType>("blood");
  const [testDate, setTestDate] = useState("");
  const [orderedBy, setOrderedBy] = useState("");
  const [facility, setFacility] = useState("");
  const [notes, setNotes] = useState("");
  const [showTypePicker, setShowTypePicker] = useState(false);

  const testTypeLabels: Record<TestType, string> = {
    blood: isRTL ? "دم" : "Blood",
    urine: isRTL ? "بول" : "Urine",
    imaging: isRTL ? "تصوير" : "Imaging",
    other: isRTL ? "أخرى" : "Other",
  };

  const loadResults = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (!isRefresh) setLoading(true);
    try {
      const data = await api.get<LabResult[]>("/api/health/lab-results");
      setResults(data ?? []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadResults(); }, [loadResults]));

  const resetForm = () => {
    setTestName("");
    setTestType("blood");
    setTestDate("");
    setOrderedBy("");
    setFacility("");
    setNotes("");
  };

  const handleAdd = async () => {
    if (!testName.trim()) {
      Alert.alert(isRTL ? "مطلوب" : "Required", isRTL ? "أدخل اسم الفحص" : "Enter test name");
      return;
    }
    if (!testDate.trim()) {
      Alert.alert(isRTL ? "مطلوب" : "Required", isRTL ? "أدخل تاريخ الفحص (YYYY-MM-DD)" : "Enter test date (YYYY-MM-DD)");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/health/lab-results", {
        testName: testName.trim(),
        testType,
        testDate: new Date(testDate).toISOString(),
        orderedBy: orderedBy.trim() || undefined,
        facility: facility.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setShowModal(false);
      resetForm();
      loadResults();
    } catch (err: any) {
      Alert.alert(isRTL ? "خطأ" : "Error", err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const bg = isDark ? theme.colors.background.primary : "#F8FAFC";
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(isRTL ? "ar" : "en", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft color={theme.colors.text.primary} size={22} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          {isRTL ? "نتائج الفحوصات" : "Lab Results"}
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
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadResults(true); }} colors={[theme.colors.primary.main]} />}
        >
          {results.length === 0 ? (
            <View style={styles.empty}>
              <FlaskConical color={theme.colors.text.secondary} size={48} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
                {isRTL ? "لا توجد نتائج فحوصات" : "No lab results yet"}
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.colors.text.secondary }]}>
                {isRTL ? "اضغط + لإضافة نتيجة فحص" : "Tap + to add a lab result"}
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {results.map((result) => (
                <View key={result.id} style={[styles.card, { backgroundColor: card, borderColor: border }]}>
                  <TouchableOpacity
                    onPress={() => setExpanded(expanded === result.id ? null : result.id)}
                    style={styles.cardHeader}
                  >
                    <Text style={styles.typeIcon}>{TEST_TYPE_ICONS[result.testType ?? "other"]}</Text>
                    <View style={styles.cardHeaderText}>
                      <Text style={[styles.testName, { color: theme.colors.text.primary }]}>{result.testName}</Text>
                      <Text style={[styles.testMeta, { color: theme.colors.text.secondary }]}>
                        {formatDate(result.testDate)}
                        {result.facility ? ` • ${result.facility}` : ""}
                      </Text>
                    </View>
                    <ChevronDown
                      color={theme.colors.text.secondary}
                      size={18}
                      style={{ transform: [{ rotate: expanded === result.id ? "180deg" : "0deg" }] }}
                    />
                  </TouchableOpacity>

                  {expanded === result.id && (
                    <View style={[styles.cardBody, { borderTopColor: border }]}>
                      {result.orderedBy && (
                        <Text style={[styles.detailText, { color: theme.colors.text.secondary }]}>
                          {isRTL ? "طلب بواسطة: " : "Ordered by: "}{result.orderedBy}
                        </Text>
                      )}
                      {result.results && result.results.length > 0 && (
                        <View style={styles.resultsTable}>
                          {result.results.map((item, idx) => (
                            <View key={idx} style={[styles.resultRow, idx > 0 && { borderTopColor: border, borderTopWidth: 1 }]}>
                              <Text style={[styles.resultName, { color: theme.colors.text.primary }]}>{item.name}</Text>
                              <View style={styles.resultRight}>
                                <Text style={[styles.resultValue, { color: item.flag ? FLAG_COLORS[item.flag] : theme.colors.text.primary }]}>
                                  {item.value}{item.unit ? ` ${item.unit}` : ""}
                                </Text>
                                {item.referenceRange && (
                                  <Text style={[styles.refRange, { color: theme.colors.text.secondary }]}>{item.referenceRange}</Text>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                      {result.notes && (
                        <Text style={[styles.detailText, { color: theme.colors.text.secondary, marginTop: 8 }]}>{result.notes}</Text>
                      )}
                    </View>
                  )}
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
                {isRTL ? "إضافة نتيجة فحص" : "Add Lab Result"}
              </Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <X color={theme.colors.text.secondary} size={22} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: theme.colors.text.secondary }]}>{isRTL ? "اسم الفحص*" : "Test Name*"}</Text>
              <TextInput value={testName} onChangeText={setTestName} placeholder={isRTL ? "مثال: CBC، HbA1c" : "e.g. CBC, HbA1c, Lipid Panel"} placeholderTextColor={theme.colors.text.secondary} style={[styles.input, { borderColor: border, color: theme.colors.text.primary, backgroundColor: bg }]} />

              <Text style={[styles.label, { color: theme.colors.text.secondary }]}>{isRTL ? "نوع الفحص" : "Test Type"}</Text>
              <TouchableOpacity onPress={() => setShowTypePicker(!showTypePicker)} style={[styles.picker, { borderColor: border, backgroundColor: bg }]}>
                <Text style={{ color: theme.colors.text.primary }}>{testTypeLabels[testType]}</Text>
                <ChevronDown color={theme.colors.text.secondary} size={18} />
              </TouchableOpacity>
              {showTypePicker && (
                <View style={[styles.pickerOptions, { backgroundColor: card, borderColor: border }]}>
                  {(["blood", "urine", "imaging", "other"] as TestType[]).map((opt) => (
                    <TouchableOpacity key={opt} onPress={() => { setTestType(opt); setShowTypePicker(false); }} style={[styles.pickerOption, testType === opt && { backgroundColor: `${theme.colors.primary.main}15` }]}>
                      <Text style={{ fontSize: 16 }}>{TEST_TYPE_ICONS[opt]}</Text>
                      <Text style={{ color: theme.colors.text.primary }}>{testTypeLabels[opt]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={[styles.label, { color: theme.colors.text.secondary }]}>{isRTL ? "تاريخ الفحص*" : "Test Date*"}</Text>
              <TextInput value={testDate} onChangeText={setTestDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.text.secondary} style={[styles.input, { borderColor: border, color: theme.colors.text.primary, backgroundColor: bg }]} />

              <Text style={[styles.label, { color: theme.colors.text.secondary }]}>{isRTL ? "الطبيب المُحيل" : "Ordered By"}</Text>
              <TextInput value={orderedBy} onChangeText={setOrderedBy} placeholder={isRTL ? "اسم الطبيب" : "Doctor name"} placeholderTextColor={theme.colors.text.secondary} style={[styles.input, { borderColor: border, color: theme.colors.text.primary, backgroundColor: bg }]} />

              <Text style={[styles.label, { color: theme.colors.text.secondary }]}>{isRTL ? "المنشأة" : "Facility"}</Text>
              <TextInput value={facility} onChangeText={setFacility} placeholder={isRTL ? "اسم المستشفى أو المختبر" : "Hospital or lab name"} placeholderTextColor={theme.colors.text.secondary} style={[styles.input, { borderColor: border, color: theme.colors.text.primary, backgroundColor: bg }]} />

              <Text style={[styles.label, { color: theme.colors.text.secondary }]}>{isRTL ? "ملاحظات" : "Notes"}</Text>
              <TextInput value={notes} onChangeText={setNotes} placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."} placeholderTextColor={theme.colors.text.secondary} multiline numberOfLines={3} style={[styles.input, styles.textarea, { borderColor: border, color: theme.colors.text.primary, backgroundColor: bg }]} />

              <TouchableOpacity onPress={handleAdd} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.colors.primary.main, opacity: saving ? 0.7 : 1 }]}>
                {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>{isRTL ? "حفظ" : "Save"}</Text>}
              </TouchableOpacity>
            </ScrollView>
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
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "600" },
  emptyDesc: { fontSize: 14 },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  typeIcon: { fontSize: 24 },
  cardHeaderText: { flex: 1 },
  testName: { fontSize: 16, fontWeight: "600" },
  testMeta: { fontSize: 13, marginTop: 2 },
  cardBody: { borderTopWidth: 1, padding: 14, gap: 6 },
  detailText: { fontSize: 13 },
  resultsTable: { marginTop: 8, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" },
  resultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 10 },
  resultName: { fontSize: 13, fontWeight: "500", flex: 1 },
  resultRight: { alignItems: "flex-end" },
  resultValue: { fontSize: 14, fontWeight: "700" },
  refRange: { fontSize: 11, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "90%", gap: 4 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "500", marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  textarea: { height: 80, textAlignVertical: "top" },
  picker: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  pickerOptions: { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginTop: 2 },
  pickerOption: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  saveBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16, marginBottom: 8 },
  saveBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
