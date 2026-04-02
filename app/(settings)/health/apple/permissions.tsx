import { useRouter } from "expo-router";
import {
  Activity,
  ArrowLeft,
  CheckCircle,
  Circle,
  Droplets,
  Heart,
  Moon,
  Scale,
  ThermometerSun,
  Zap,
} from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/apiClient";

interface HealthMetric {
  key: string;
  labelEn: string;
  labelAr: string;
  descEn: string;
  descAr: string;
  icon: any;
  color: string;
  category: string;
}

const METRICS: HealthMetric[] = [
  { key: "heartRate",      labelEn: "Heart Rate",         labelAr: "معدل ضربات القلب",  descEn: "Beats per minute",                    descAr: "نبضات في الدقيقة",          icon: Heart,         color: "#EF4444", category: "vitals" },
  { key: "hrv",            labelEn: "Heart Rate Variability", labelAr: "تقلب معدل ضربات القلب", descEn: "Autonomic nervous system balance", descAr: "توازن الجهاز العصبي",     icon: Activity,      color: "#F97316", category: "vitals" },
  { key: "bloodPressure",  labelEn: "Blood Pressure",     labelAr: "ضغط الدم",           descEn: "Systolic / diastolic mmHg",           descAr: "الضغط الانقباضي/الانبساطي", icon: Droplets,      color: "#3B82F6", category: "vitals" },
  { key: "oxygenSaturation", labelEn: "Blood Oxygen",     labelAr: "تشبع الأكسجين",     descEn: "SpO₂ percentage",                     descAr: "نسبة الأكسجين في الدم",    icon: Zap,           color: "#06B6D4", category: "vitals" },
  { key: "steps",          labelEn: "Steps",               labelAr: "الخطوات اليومية",   descEn: "Daily step count",                    descAr: "عدد الخطوات اليومية",      icon: Activity,      color: "#10B981", category: "activity" },
  { key: "sleepHours",     labelEn: "Sleep",               labelAr: "النوم",              descEn: "Sleep duration and stages",           descAr: "مدة ومراحل النوم",         icon: Moon,          color: "#8B5CF6", category: "sleep" },
  { key: "weight",         labelEn: "Weight",              labelAr: "الوزن",              descEn: "Body weight in kg",                   descAr: "وزن الجسم بالكيلوغرام",   icon: Scale,         color: "#F59E0B", category: "body" },
  { key: "bodyTemperature",labelEn: "Body Temperature",   labelAr: "درجة حرارة الجسم",  descEn: "Core body temperature",               descAr: "درجة حرارة الجسم الأساسية", icon: ThermometerSun, color: "#EC4899", category: "vitals" },
];

const CATEGORIES = [
  { key: "vitals",   labelEn: "Vitals",   labelAr: "العلامات الحيوية" },
  { key: "activity", labelEn: "Activity", labelAr: "النشاط" },
  { key: "sleep",    labelEn: "Sleep",    labelAr: "النوم" },
  { key: "body",     labelEn: "Body",     labelAr: "الجسم" },
];

export default function AppleHealthPermissionsScreen() {
  const { i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [selected, setSelected] = useState<Set<string>>(
    new Set(METRICS.map((m) => m.key)) // all on by default
  );
  const [saving, setSaving] = useState(false);

  const bg = isDark ? theme.colors.background.primary : "#F8FAFC";
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === METRICS.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(METRICS.map((m) => m.key)));
    }
  };

  const handleSave = async () => {
    if (selected.size === 0) {
      Alert.alert(
        isRTL ? "تنبيه" : "Warning",
        isRTL
          ? "يجب اختيار مقياس واحد على الأقل"
          : "Please select at least one metric to sync"
      );
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/integrations/apple-health/permissions", {
        metrics: Array.from(selected),
      });
      Alert.alert(
        isRTL ? "تم الحفظ" : "Permissions Saved",
        isRTL
          ? "سيتم مزامنة المقاييس المختارة من Apple Health"
          : "Selected metrics will be synced from Apple Health",
        [{ text: isRTL ? "حسناً" : "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert(
        isRTL ? "خطأ" : "Error",
        err?.message ?? (isRTL ? "تعذر حفظ الإعدادات" : "Failed to save permissions")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft
            color={theme.colors.text.primary}
            size={22}
            style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          {isRTL ? "اختر ما تشاركه" : "Choose what to share"}
        </Text>
        <TouchableOpacity onPress={toggleAll} style={styles.selectAllBtn}>
          <Text style={[styles.selectAllText, { color: theme.colors.primary.main }]}>
            {selected.size === METRICS.length
              ? (isRTL ? "إلغاء الكل" : "Deselect all")
              : (isRTL ? "تحديد الكل" : "Select all")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: theme.colors.text.secondary }]}>
          {isRTL
            ? "اختر البيانات الصحية التي تريد مشاركتها مع Nuralix من Apple Health."
            : "Choose which health data to share with Nuralix from Apple Health."}
        </Text>

        {CATEGORIES.map((cat) => {
          const catMetrics = METRICS.filter((m) => m.category === cat.key);
          return (
            <View key={cat.key} style={styles.categorySection}>
              <Text style={[styles.categoryLabel, { color: theme.colors.text.secondary }]}>
                {isRTL ? cat.labelAr : cat.labelEn}
              </Text>
              <View style={[styles.categoryCard, { backgroundColor: card, borderColor: border }]}>
                {catMetrics.map((metric, idx) => {
                  const Icon = metric.icon;
                  const isSelected = selected.has(metric.key);
                  return (
                    <TouchableOpacity
                      key={metric.key}
                      onPress={() => toggle(metric.key)}
                      style={[
                        styles.metricRow,
                        idx < catMetrics.length - 1 && { borderBottomWidth: 1, borderBottomColor: border },
                      ]}
                    >
                      <View style={[styles.metricIcon, { backgroundColor: `${metric.color}15` }]}>
                        <Icon color={metric.color} size={20} />
                      </View>
                      <View style={styles.metricText}>
                        <Text style={[styles.metricLabel, { color: theme.colors.text.primary }]}>
                          {isRTL ? metric.labelAr : metric.labelEn}
                        </Text>
                        <Text style={[styles.metricDesc, { color: theme.colors.text.secondary }]}>
                          {isRTL ? metric.descAr : metric.descEn}
                        </Text>
                      </View>
                      {isSelected ? (
                        <CheckCircle color={theme.colors.primary.main} size={22} />
                      ) : (
                        <Circle color={border} size={22} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: theme.colors.primary.main, opacity: saving ? 0.7 : 1 }]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>
                {isRTL
                  ? `حفظ (${selected.size} مقياس)`
                  : `Save ${selected.size} metric${selected.size !== 1 ? "s" : ""}`}
              </Text>
            )}
          </TouchableOpacity>
          <Text style={[styles.privacyNote, { color: theme.colors.text.secondary }]}>
            {isRTL
              ? "يمكنك تغيير هذه الإعدادات في أي وقت من إعدادات iOS › الخصوصية › Apple Health"
              : "You can change these at any time in iOS Settings › Privacy › Apple Health"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center" },
  selectAllBtn: { paddingHorizontal: 4 },
  selectAllText: { fontSize: 13, fontWeight: "600" },
  intro: { fontSize: 14, lineHeight: 20, margin: 16, marginBottom: 8 },
  categorySection: { paddingHorizontal: 16, marginBottom: 16 },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  categoryCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  metricIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  metricText: { flex: 1 },
  metricLabel: { fontSize: 15, fontWeight: "600" },
  metricDesc: { fontSize: 13, marginTop: 2 },
  footer: { padding: 20, gap: 12 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  privacyNote: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});
