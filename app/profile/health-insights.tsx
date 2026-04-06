import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowUp,
  Bell,
  Brain,
  CheckCircle,
  Dna,
  TrendingDown,
  TrendingUp,
  Zap,
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

type Impact = "high" | "medium" | "low";
type Priority = "urgent" | "high" | "normal" | "low";

interface VHIResponse {
  id?: string;
  data?: {
    currentState?: {
      overallScore?: number;
      riskScores?: {
        fallRisk?: { score: number; drivers: string[] };
        adherenceRisk?: { score: number; drivers: string[] };
        deteriorationRisk?: { score: number; drivers: string[] };
        geneticRiskLoad?: { score: number; drivers: string[] };
        compositeRisk?: number;
        trajectory?: string;
      };
    };
    elevatingFactors?: Array<{ factor: string; category: string; impact: Impact; explanation: string }>;
    decliningFactors?: Array<{ factor: string; category: string; impact: Impact; explanation: string; recommendation: string }>;
    pendingActions?: Array<{ id: string; priority: Priority; title: string; rationale: string; acknowledged: boolean }>;
  };
}

const IMPACT_COLORS: Record<Impact, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#10B981",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "#EF4444",
  high: "#F59E0B",
  normal: "#3B82F6",
  low: "#64748B",
};

function RiskBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <View style={styles.riskRow}>
      <Text style={styles.riskLabel}>{label}</Text>
      <View style={styles.riskTrack}>
        <View style={[styles.riskFill, { width: `${Math.min(score, 100)}%` as `${number}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.riskScore, { color }]}>{Math.round(score)}%</Text>
    </View>
  );
}

export default function HealthInsightsScreen() {
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [vhi, setVhi] = useState<VHIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (!isRefresh) setLoading(true);
    try {
      const data = await api.get<VHIResponse>("/api/vhi/me");
      setVhi(data);
    } catch (err: unknown) {
      console.warn('[health-insights] Failed to load VHI:', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAcknowledge = async (actionId: string) => {
    setAcknowledging(actionId);
    try {
      await api.post(`/api/vhi/me/actions/${actionId}/acknowledge`, {});
      setVhi((prev) => {
        if (!prev?.data?.pendingActions) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            pendingActions: prev.data.pendingActions.map((a) =>
              a.id === actionId ? { ...a, acknowledged: true } : a
            ),
          },
        };
      });
    } catch (err: unknown) {
      console.warn('[health-insights] Failed to acknowledge VHI action:', err instanceof Error ? err.message : String(err));
    } finally {
      setAcknowledging(null);
    }
  };

  const bg = isDark ? theme.colors.background.primary : "#F8FAFC";
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";
  const textPrimary = theme.colors.text.primary;
  const textSecondary = theme.colors.text.secondary;

  const d = vhi?.data;
  const score = d?.currentState?.overallScore ?? 0;
  const risks = d?.currentState?.riskScores;
  const trajectory = risks?.trajectory ?? "stable";
  const trajectoryColor = trajectory === "improving" ? "#10B981" : trajectory === "worsening" ? "#EF4444" : "#F59E0B";
  const trajectoryLabel = isRTL
    ? trajectory === "improving" ? "تحسن" : trajectory === "worsening" ? "تراجع" : "مستقر"
    : trajectory === "improving" ? "Improving" : trajectory === "worsening" ? "Worsening" : "Stable";

  const elevating = Array.isArray(d?.elevatingFactors) ? d.elevatingFactors : [];
  const declining = Array.isArray(d?.decliningFactors) ? d.decliningFactors : [];
  const pending = (Array.isArray(d?.pendingActions) ? d.pendingActions : []).filter((a) => !a.acknowledged);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft color={textPrimary} size={22} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>
          {isRTL ? "رؤى صحية" : "Health Insights"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      ) : !d ? (
        <View style={styles.center}>
          <Brain color={textSecondary} size={48} />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>
            {isRTL ? "لا توجد بيانات بعد" : "No insights yet"}
          </Text>
          <Text style={[styles.emptyDesc, { color: textSecondary }]}>
            {isRTL ? "أضف بيانات صحية لتوليد رؤى شخصية" : "Add health data to generate personalised insights"}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[theme.colors.primary.main]} />}
        >
          {/* VHI Score card */}
          <View style={[styles.scoreCard, { backgroundColor: theme.colors.primary.main }]}>
            <Text style={styles.scoreLabel}>{isRTL ? "نقاط الهوية الصحية" : "Health Identity Score"}</Text>
            <Text style={styles.scoreValue}>{Math.round(score)}</Text>
            <View style={[styles.trajectoryBadge, { backgroundColor: `${trajectoryColor}30` }]}>
              {trajectory === "improving" ? <TrendingUp color={trajectoryColor} size={14} /> : trajectory === "worsening" ? <TrendingDown color={trajectoryColor} size={14} /> : <ArrowUp color={trajectoryColor} size={14} />}
              <Text style={[styles.trajectoryText, { color: trajectoryColor }]}>{trajectoryLabel}</Text>
            </View>
          </View>

          {/* Risk scores */}
          {risks && (
            <View style={[styles.section, { backgroundColor: card, borderColor: border }]}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>
                {isRTL ? "درجات المخاطر" : "Risk Scores"}
              </Text>
              <RiskBar label={isRTL ? "خطر السقوط" : "Fall Risk"} score={risks.fallRisk?.score ?? 0} color="#EF4444" />
              <RiskBar label={isRTL ? "الالتزام بالأدوية" : "Adherence Risk"} score={risks.adherenceRisk?.score ?? 0} color="#F59E0B" />
              <RiskBar label={isRTL ? "خطر التدهور" : "Deterioration Risk"} score={risks.deteriorationRisk?.score ?? 0} color="#8B5CF6" />
              <RiskBar label={isRTL ? "الحمل الجيني" : "Genetic Risk Load"} score={risks.geneticRiskLoad?.score ?? 0} color="#06B6D4" />
            </View>
          )}

          {/* Pending actions */}
          {pending.length > 0 && (
            <View style={[styles.section, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.sectionHeaderRow}>
                <Bell color={theme.colors.primary.main} size={18} />
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>
                  {isRTL ? "إجراءات مطلوبة" : "Recommended Actions"}
                </Text>
              </View>
              {pending.map((action) => (
                <View key={action.id} style={[styles.actionCard, { borderColor: PRIORITY_COLORS[action.priority] }]}>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[action.priority] }]} />
                  <View style={styles.actionContent}>
                    <Text style={[styles.actionTitle, { color: textPrimary }]}>{action.title}</Text>
                    <Text style={[styles.actionRationale, { color: textSecondary }]}>{action.rationale}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleAcknowledge(action.id)}
                    disabled={acknowledging === action.id}
                    style={[styles.ackBtn, { borderColor: theme.colors.primary.main }]}
                  >
                    {acknowledging === action.id
                      ? <ActivityIndicator size="small" color={theme.colors.primary.main} />
                      : <CheckCircle color={theme.colors.primary.main} size={20} />
                    }
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Elevating factors */}
          {elevating.length > 0 && (
            <View style={[styles.section, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.sectionHeaderRow}>
                <TrendingUp color="#10B981" size={18} />
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>
                  {isRTL ? "عوامل إيجابية" : "Elevating Factors"}
                </Text>
              </View>
              {elevating.map((f, i) => (
                <View key={`elevating-${f.factor}-${i}`} style={styles.factorRow}>
                  <View style={[styles.impactDot, { backgroundColor: IMPACT_COLORS[f.impact] }]} />
                  <View style={styles.factorContent}>
                    <Text style={[styles.factorName, { color: textPrimary }]}>{f.factor}</Text>
                    <Text style={[styles.factorExpl, { color: textSecondary }]}>{f.explanation}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Declining factors */}
          {declining.length > 0 && (
            <View style={[styles.section, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.sectionHeaderRow}>
                <TrendingDown color="#EF4444" size={18} />
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>
                  {isRTL ? "عوامل تحتاج تحسين" : "Areas to Improve"}
                </Text>
              </View>
              {declining.map((f, i) => (
                <View key={`declining-${f.factor}-${i}`} style={[styles.factorRow, styles.decliningRow, { borderColor: border }]}>
                  <View style={[styles.impactDot, { backgroundColor: IMPACT_COLORS[f.impact] }]} />
                  <View style={styles.factorContent}>
                    <Text style={[styles.factorName, { color: textPrimary }]}>{f.factor}</Text>
                    <Text style={[styles.factorExpl, { color: textSecondary }]}>{f.explanation}</Text>
                    {f.recommendation && (
                      <View style={[styles.recBox, { backgroundColor: `${theme.colors.primary.main}10` }]}>
                        <Zap color={theme.colors.primary.main} size={12} />
                        <Text style={[styles.recText, { color: theme.colors.primary.main }]}>{f.recommendation}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
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
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, paddingTop: 80 },
  emptyTitle: { fontSize: 17, fontWeight: "600" },
  emptyDesc: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
  scoreCard: { margin: 16, borderRadius: 20, padding: 28, alignItems: "center", gap: 8 },
  scoreLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "500" },
  scoreValue: { color: "#FFFFFF", fontSize: 64, fontWeight: "800", lineHeight: 72 },
  trajectoryBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  trajectoryText: { fontSize: 13, fontWeight: "600" },
  section: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  riskRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  riskLabel: { fontSize: 13, color: "#64748B", width: 120 },
  riskTrack: { flex: 1, height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" },
  riskFill: { height: "100%", borderRadius: 3 },
  riskScore: { fontSize: 13, fontWeight: "700", width: 36, textAlign: "right" },
  actionCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  actionContent: { flex: 1, gap: 4 },
  actionTitle: { fontSize: 14, fontWeight: "600" },
  actionRationale: { fontSize: 13, lineHeight: 18 },
  ackBtn: { width: 32, height: 32, borderWidth: 1, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  factorRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  decliningRow: { borderBottomWidth: 1, paddingBottom: 12 },
  impactDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  factorContent: { flex: 1, gap: 4 },
  factorName: { fontSize: 14, fontWeight: "600" },
  factorExpl: { fontSize: 13, lineHeight: 18 },
  recBox: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 4 },
  recText: { fontSize: 12, fontWeight: "500", flex: 1 },
});
