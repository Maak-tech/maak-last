import { useFocusEffect, useRouter } from "expo-router";
import {
  Activity,
  ArrowLeft,
  Heart,
  Moon,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Period = "7d" | "30d" | "90d";

interface VitalPoint { value: number; recordedAt: string; type: string }

interface MetricSummary {
  key: string;
  labelEn: string;
  labelAr: string;
  unit: string;
  icon: LucideIcon;
  color: string;
  current: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
  trend: "up" | "down" | "stable";
  points: number[];
}

function Sparkline({ points, color, height = 40 }: { points: number[]; color: string; height?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = (SCREEN_WIDTH - 80) / points.length;

  return (
    <View style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
      {points.map((v, i) => {
        const h = ((v - min) / range) * (height - 4) + 4;
        return (
          <View
            key={`bar-${i}-${v}`}
            style={{
              width: Math.max(w - 2, 3),
              height: h,
              backgroundColor: i === points.length - 1 ? color : `${color}60`,
              borderRadius: 2,
            }}
          />
        );
      })}
    </View>
  );
}

function buildSummaries(vitals: VitalPoint[], isRTL: boolean): MetricSummary[] {
  const metaDefs = [
    { key: "heartRate",   labelEn: "Heart Rate",    labelAr: "معدل ضربات القلب",  unit: "bpm", icon: Heart,    color: "#EF4444" },
    { key: "steps",       labelEn: "Steps",          labelAr: "الخطوات",           unit: "steps", icon: Activity, color: "#10B981" },
    { key: "sleepHours",  labelEn: "Sleep",          labelAr: "النوم",             unit: "hrs",  icon: Moon,     color: "#8B5CF6" },
    { key: "weight",      labelEn: "Weight",         labelAr: "الوزن",             unit: "kg",   icon: Zap,      color: "#F59E0B" },
  ];

  return metaDefs.map((meta) => {
    const pts = vitals.filter((v) => v.type === meta.key).map((v) => v.value);
    const avg = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null;
    const min = pts.length ? Math.min(...pts) : null;
    const max = pts.length ? Math.max(...pts) : null;
    const current = pts.length ? pts[pts.length - 1] : null;
    const half = Math.floor(pts.length / 2);
    const firstHalfAvg = half > 0 ? pts.slice(0, half).reduce((a, b) => a + b, 0) / half : null;
    const secondHalfAvg = half > 0 ? pts.slice(half).reduce((a, b) => a + b, 0) / (pts.length - half) : null;
    let trend: "up" | "down" | "stable" = "stable";
    if (firstHalfAvg !== null && secondHalfAvg !== null) {
      const diff = secondHalfAvg - firstHalfAvg;
      if (diff > firstHalfAvg * 0.03) trend = "up";
      else if (diff < -firstHalfAvg * 0.03) trend = "down";
    }
    return { ...meta, current, avg, min, max, trend, points: pts.slice(-20) };
  }).filter((m) => m.points.length > 0);
}

export default function AnalyticsScreen() {
  const { i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [vitals, setVitals] = useState<VitalPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("30d");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Skip the period-change effect on initial mount — useFocusEffect already fires load() then.
  const periodMountedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (!isRefresh) setLoading(true);
    setLoadError(null);
    try {
      const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
      const from = new Date();
      from.setDate(from.getDate() - days);
      const data = await api.get<VitalPoint[]>(
        `/api/health/vitals?from=${from.toISOString()}&limit=500`
      );
      setVitals(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.warn('[analytics] Failed to load vitals:', err);
      setLoadError(isRTL ? "تعذّر تحميل البيانات. اسحب للأسفل للمحاولة." : "Failed to load data. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, period, isRTL]);

  // Reload when screen gains focus (handles returning from other screens)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Also reload when period changes while screen is already focused.
  // useFocusEffect only re-fires on navigation focus events, not on dep changes
  // while the screen is already in the foreground.
  // Skip the first render — useFocusEffect already fires load() on mount.
  useEffect(() => {
    if (!periodMountedRef.current) { periodMountedRef.current = true; return; }
    load();
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const summaries = buildSummaries(vitals, isRTL);

  const bg = isDark ? theme.colors.background.primary : "#F8FAFC";
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";

  const periods: { key: Period; label: string }[] = [
    { key: "7d", label: isRTL ? "٧ أيام" : "7 days" },
    { key: "30d", label: isRTL ? "٣٠ يوم" : "30 days" },
    { key: "90d", label: isRTL ? "٩٠ يوم" : "90 days" },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft color={theme.colors.text.primary} size={22} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          {isRTL ? "التحليلات الصحية" : "Health Analytics"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Period selector */}
      <View style={[styles.periodBar, { backgroundColor: card, borderBottomColor: border }]}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => setPeriod(p.key)}
            style={[styles.periodBtn, period === p.key && { backgroundColor: theme.colors.primary.main, borderRadius: 8 }]}
          >
            <Text style={[styles.periodText, { color: period === p.key ? "#FFFFFF" : theme.colors.text.secondary }]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: theme.colors.accent.error, textAlign: "center", paddingHorizontal: 32 }]}>
            {loadError}
          </Text>
          <TouchableOpacity
            onPress={() => load()}
            style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.primary.main }}
          >
            <Text style={{ color: theme.colors.primary.main, fontSize: 14, fontWeight: "600" }}>
              {isRTL ? "إعادة المحاولة" : "Retry"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[theme.colors.primary.main]} />}
        >
          {summaries.length === 0 ? (
            <View style={styles.empty}>
              <Activity color={theme.colors.text.secondary} size={48} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
                {isRTL ? "لا توجد بيانات كافية" : "Not enough data yet"}
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.colors.text.secondary }]}>
                {isRTL ? "سجل قياساتك الصحية لرؤية التحليلات" : "Record health measurements to see analytics"}
              </Text>
            </View>
          ) : (
            <View style={styles.content}>
              {summaries.map((metric) => {
                const Icon = metric.icon;
                return (
                  <View key={metric.key} style={[styles.metricCard, { backgroundColor: card, borderColor: border }]}>
                    {/* Card header */}
                    <View style={styles.metricHeader}>
                      <View style={[styles.metricIcon, { backgroundColor: `${metric.color}15` }]}>
                        <Icon color={metric.color} size={20} />
                      </View>
                      <View style={styles.metricTitleBlock}>
                        <Text style={[styles.metricTitle, { color: theme.colors.text.primary }]}>
                          {isRTL ? metric.labelAr : metric.labelEn}
                        </Text>
                        <Text style={[styles.metricPts, { color: theme.colors.text.secondary }]}>
                          {metric.points.length} {isRTL ? "قياس" : "readings"}
                        </Text>
                      </View>
                      <View style={styles.trendBlock}>
                        {metric.trend === "up"
                          ? <TrendingUp color="#10B981" size={18} />
                          : metric.trend === "down"
                            ? <TrendingDown color="#EF4444" size={18} />
                            : <Activity color="#F59E0B" size={18} />
                        }
                      </View>
                    </View>

                    {/* Current value */}
                    {metric.current !== null && (
                      <View style={styles.currentRow}>
                        <Text style={[styles.currentValue, { color: metric.color }]}>
                          {metric.current % 1 === 0 ? metric.current : metric.current.toFixed(1)}
                        </Text>
                        <Text style={[styles.currentUnit, { color: theme.colors.text.secondary }]}>
                          {metric.unit}
                        </Text>
                      </View>
                    )}

                    {/* Sparkline */}
                    {metric.points.length >= 2 && (
                      <View style={styles.sparklineContainer}>
                        <Sparkline points={metric.points} color={metric.color} />
                      </View>
                    )}

                    {/* Stats row */}
                    <View style={[styles.statsRow, { borderTopColor: border }]}>
                      {[
                        { label: isRTL ? "متوسط" : "Avg", value: metric.avg },
                        { label: isRTL ? "أدنى" : "Min", value: metric.min },
                        { label: isRTL ? "أعلى" : "Max", value: metric.max },
                      ].map((stat) => (
                        <View key={stat.label} style={styles.statItem}>
                          <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
                            {stat.value !== null ? (stat.value % 1 === 0 ? stat.value : stat.value.toFixed(1)) : "—"}
                          </Text>
                          <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>{stat.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
              <View style={{ height: 32 }} />
            </View>
          )}
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
  periodBar: { flexDirection: "row", padding: 8, paddingHorizontal: 16, gap: 8, borderBottomWidth: 1 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  periodText: { fontSize: 13, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "600" },
  emptyDesc: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
  content: { padding: 16, gap: 16 },
  metricCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  metricHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  metricIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  metricTitleBlock: { flex: 1 },
  metricTitle: { fontSize: 15, fontWeight: "700" },
  metricPts: { fontSize: 12, marginTop: 2 },
  trendBlock: { width: 32, alignItems: "center" },
  currentRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  currentValue: { fontSize: 36, fontWeight: "800", lineHeight: 40 },
  currentUnit: { fontSize: 14 },
  sparklineContainer: { paddingVertical: 4 },
  statsRow: { flexDirection: "row", borderTopWidth: 1, paddingTop: 12 },
  statItem: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 15, fontWeight: "700" },
  statLabel: { fontSize: 12 },
});
