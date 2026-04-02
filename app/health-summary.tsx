import { useFocusEffect, useRouter } from "expo-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle,
  Clock,
  Dna,
  FlaskConical,
  Heart,
  Pill,
  Stethoscope,
  User,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/apiClient";

interface VHISummary {
  data?: {
    currentState?: {
      overallScore?: number;
      riskScores?: { compositeRisk?: number; trajectory?: string };
    };
    careContext?: {
      activeConditions?: string[];
      activeAllergies?: Array<{ substance: string; severity: string }>;
      activeMedications?: Array<{ name: string; adherence: number }>;
      labAbnormalities?: Array<{ test: string; value: string; flag: string }>;
      lastClinicianVisit?: string;
      pendingFollowUps?: string[];
    };
    geneticBaseline?: {
      hasGeneticData: boolean;
      prsScores?: Array<{ condition: string; percentile: number; level: string }>;
    } | null;
    pendingActions?: Array<{ acknowledged: boolean }>;
  };
}

interface StatCard {
  icon: any;
  iconColor: string;
  label: string;
  value: string | number;
  sub?: string;
  onPress?: () => void;
}

function SummaryCard({ icon: Icon, iconColor, label, value, sub, onPress }: StatCard) {
  const { theme, isDark } = useTheme();
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[styles.statCard, { backgroundColor: card, borderColor: border }]}
    >
      <View style={[styles.statIcon, { backgroundColor: `${iconColor}15` }]}>
        <Icon color={iconColor} size={22} />
      </View>
      <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>{label}</Text>
      {sub && <Text style={[styles.statSub, { color: iconColor }]}>{sub}</Text>}
    </TouchableOpacity>
  );
}

export default function HealthSummaryScreen() {
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [vhi, setVhi] = useState<VHISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (!isRefresh) setLoading(true);
    try {
      const data = await api.get<VHISummary>("/api/vhi");
      setVhi(data);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const bg = isDark ? theme.colors.background.primary : "#F8FAFC";
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";

  const d = vhi?.data;
  const care = d?.careContext;
  const genetic = d?.geneticBaseline;
  const score = d?.currentState?.overallScore ?? 0;
  const trajectory = d?.currentState?.riskScores?.trajectory ?? "stable";
  const pendingCount = (d?.pendingActions ?? []).filter((a) => !a.acknowledged).length;

  const trajectoryColor = trajectory === "improving" ? "#10B981" : trajectory === "worsening" ? "#EF4444" : "#F59E0B";
  const trajectoryLabel = isRTL
    ? trajectory === "improving" ? "تحسن" : trajectory === "worsening" ? "تراجع" : "مستقر"
    : trajectory === "improving" ? "Improving" : trajectory === "worsening" ? "Worsening" : "Stable";

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return isRTL ? "غير متاح" : "N/A";
    try {
      return new Date(dateStr).toLocaleDateString(isRTL ? "ar" : "en", { year: "numeric", month: "short", day: "numeric" });
    } catch { return dateStr; }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft color={theme.colors.text.primary} size={22} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          {isRTL ? "ملخص الصحة" : "Health Summary"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[theme.colors.primary.main]} />}
        >
          {/* Hero score */}
          <View style={[styles.hero, { backgroundColor: theme.colors.primary.main }]}>
            <User color="rgba(255,255,255,0.7)" size={20} />
            <Text style={styles.heroName}>{user?.name ?? (isRTL ? "المستخدم" : "User")}</Text>
            <Text style={styles.heroScore}>{Math.round(score)}</Text>
            <Text style={styles.heroScoreLabel}>{isRTL ? "نقاط الهوية الصحية" : "VHI Score"}</Text>
            <View style={[styles.trajBadge, { backgroundColor: `${trajectoryColor}30` }]}>
              <Text style={[styles.trajText, { color: trajectoryColor }]}>{trajectoryLabel}</Text>
            </View>
          </View>

          {/* Stat grid */}
          {d && (
            <View style={styles.grid}>
              <SummaryCard
                icon={Activity}
                iconColor="#3B82F6"
                label={isRTL ? "الحالات النشطة" : "Conditions"}
                value={care?.activeConditions?.length ?? 0}
                onPress={() => router.push("/profile/medical-history")}
              />
              <SummaryCard
                icon={Pill}
                iconColor="#10B981"
                label={isRTL ? "الأدوية" : "Medications"}
                value={care?.activeMedications?.length ?? 0}
                onPress={() => router.push("/(tabs)/medications")}
              />
              <SummaryCard
                icon={AlertTriangle}
                iconColor="#EF4444"
                label={isRTL ? "الحساسيات" : "Allergies"}
                value={care?.activeAllergies?.length ?? 0}
                onPress={() => router.push("/(tabs)/allergies")}
              />
              <SummaryCard
                icon={FlaskConical}
                iconColor="#F59E0B"
                label={isRTL ? "نتائج غير طبيعية" : "Abnormal Labs"}
                value={care?.labAbnormalities?.length ?? 0}
                onPress={() => router.push("/(tabs)/lab-results")}
              />
              <SummaryCard
                icon={Brain}
                iconColor="#8B5CF6"
                label={isRTL ? "إجراءات معلقة" : "Pending Actions"}
                value={pendingCount}
                onPress={() => router.push("/profile/health-insights")}
              />
              <SummaryCard
                icon={Dna}
                iconColor="#06B6D4"
                label={isRTL ? "البيانات الجينية" : "Genetic Data"}
                value={genetic?.hasGeneticData ? (isRTL ? "متاح" : "Available") : (isRTL ? "غير متاح" : "None")}
                onPress={() => router.push("/profile/genetics")}
              />
            </View>
          )}

          {/* Active conditions */}
          {(care?.activeConditions?.length ?? 0) > 0 && (
            <View style={[styles.section, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.sectionRow}>
                <Stethoscope color={theme.colors.primary.main} size={18} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
                  {isRTL ? "الحالات الصحية" : "Active Conditions"}
                </Text>
              </View>
              {care!.activeConditions!.map((c, i) => (
                <View key={i} style={styles.listRow}>
                  <View style={[styles.bullet, { backgroundColor: theme.colors.primary.main }]} />
                  <Text style={[styles.listText, { color: theme.colors.text.primary }]}>{c}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Medications */}
          {(care?.activeMedications?.length ?? 0) > 0 && (
            <View style={[styles.section, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.sectionRow}>
                <Pill color="#10B981" size={18} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
                  {isRTL ? "الأدوية النشطة" : "Active Medications"}
                </Text>
              </View>
              {care!.activeMedications!.map((med, i) => (
                <View key={i} style={styles.medRow}>
                  <Text style={[styles.listText, { color: theme.colors.text.primary }]}>{med.name}</Text>
                  <View style={[styles.adherenceBadge, { backgroundColor: med.adherence >= 0.8 ? "#10B98115" : "#F59E0B15" }]}>
                    <Text style={[styles.adherenceText, { color: med.adherence >= 0.8 ? "#10B981" : "#F59E0B" }]}>
                      {Math.round(med.adherence * 100)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Pending follow-ups */}
          {(care?.pendingFollowUps?.length ?? 0) > 0 && (
            <View style={[styles.section, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.sectionRow}>
                <Clock color="#F59E0B" size={18} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
                  {isRTL ? "متابعات معلقة" : "Pending Follow-ups"}
                </Text>
              </View>
              {care!.pendingFollowUps!.map((f, i) => (
                <View key={i} style={styles.listRow}>
                  <CheckCircle color="#F59E0B" size={14} />
                  <Text style={[styles.listText, { color: theme.colors.text.primary }]}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Last clinician visit */}
          {care?.lastClinicianVisit && (
            <View style={[styles.section, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.sectionRow}>
                <Heart color="#EF4444" size={18} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
                  {isRTL ? "آخر زيارة طبية" : "Last Clinician Visit"}
                </Text>
              </View>
              <Text style={[styles.listText, { color: theme.colors.text.secondary }]}>
                {formatDate(care.lastClinicianVisit)}
              </Text>
            </View>
          )}

          {!d && (
            <View style={styles.noData}>
              <Brain color={theme.colors.text.secondary} size={48} />
              <Text style={[styles.noDataTitle, { color: theme.colors.text.primary }]}>
                {isRTL ? "لا توجد بيانات بعد" : "No summary available yet"}
              </Text>
              <Text style={[styles.noDataDesc, { color: theme.colors.text.secondary }]}>
                {isRTL ? "أضف بياناتك الصحية لتوليد الملخص" : "Add your health data to generate a summary"}
              </Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "600", flex: 1, textAlign: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  hero: { margin: 16, borderRadius: 20, padding: 28, alignItems: "center", gap: 6 },
  heroName: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  heroScore: { color: "#FFFFFF", fontSize: 56, fontWeight: "800", lineHeight: 64 },
  heroScoreLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  trajBadge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, marginTop: 4 },
  trajText: { fontSize: 13, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  statCard: { width: "30%", flexGrow: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center", gap: 6 },
  statIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11, textAlign: "center" },
  statSub: { fontSize: 11, fontWeight: "600" },
  section: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  listRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3 },
  listText: { fontSize: 14, flex: 1 },
  medRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  adherenceBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  adherenceText: { fontSize: 12, fontWeight: "700" },
  noData: { alignItems: "center", paddingTop: 60, gap: 12 },
  noDataTitle: { fontSize: 17, fontWeight: "600" },
  noDataDesc: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
});
