import { useFocusEffect, useRouter } from "expo-router";
import {
  Activity,
  ArrowLeft,
  Brain,
  Dna,
  Heart,
  Pill,
  Stethoscope,
  TrendingUp,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
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

type Domain = "vitals" | "behavior" | "symptoms" | "clinical" | "twin" | string;

interface TimelineEvent {
  id: string;
  occurredAt: string;
  source: string;
  domain?: Domain;
  value?: number | string;
  unit?: string;
  metadata?: Record<string, unknown>;
}

const DOMAIN_CONFIG: Record<string, { color: string; icon: LucideIcon; label: string; labelAr: string }> = {
  vitals:   { color: "#EF4444", icon: Heart,       label: "Vitals",   labelAr: "العلامات الحيوية" },
  symptoms: { color: "#F59E0B", icon: Activity,    label: "Symptoms", labelAr: "الأعراض" },
  clinical: { color: "#3B82F6", icon: Stethoscope, label: "Clinical", labelAr: "سريري" },
  behavior: { color: "#10B981", icon: TrendingUp,  label: "Behavior", labelAr: "السلوك" },
  twin:     { color: "#8B5CF6", icon: Brain,       label: "AI Twin",  labelAr: "التوأم الذكي" },
  genetics: { color: "#06B6D4", icon: Dna,         label: "Genetics", labelAr: "الجينات" },
  default:  { color: "#64748B", icon: Pill,        label: "Event",    labelAr: "حدث" },
};

function getDomainConfig(domain?: string) {
  if (!domain) return DOMAIN_CONFIG.default;
  return DOMAIN_CONFIG[domain] ?? DOMAIN_CONFIG.default;
}

function groupByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const groups: Record<string, TimelineEvent[]> = {};
  for (const event of events) {
    const date = new Date(event.occurredAt).toDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(event);
  }
  return groups;
}

export default function TimelineScreen() {
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTimeline = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (!isRefresh) setLoading(true);
    try {
      const data = await api.get<TimelineEvent[]>("/api/health/timeline?limit=100");
      setEvents(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.warn('[timeline] Failed to load timeline events:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadTimeline(); }, [loadTimeline]));

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString(isRTL ? "ar" : "en", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      if (d.toDateString() === today.toDateString()) return isRTL ? "اليوم" : "Today";
      if (d.toDateString() === yesterday.toDateString()) return isRTL ? "أمس" : "Yesterday";
      return d.toLocaleDateString(isRTL ? "ar" : "en", { weekday: "long", month: "short", day: "numeric" });
    } catch { return dateStr; }
  };

  const formatSource = (source: string) => {
    return source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const bg = isDark ? theme.colors.background.primary : "#F8FAFC";
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";

  const grouped = groupByDate(events);
  const dates = Object.keys(grouped);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft color={theme.colors.text.primary} size={22} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          {isRTL ? "الجدول الزمني الصحي" : "Health Timeline"}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTimeline(true); }} colors={[theme.colors.primary.main]} />}
        >
          {events.length === 0 ? (
            <View style={styles.empty}>
              <Activity color={theme.colors.text.secondary} size={48} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
                {isRTL ? "لا توجد أحداث صحية بعد" : "No health events yet"}
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.colors.text.secondary }]}>
                {isRTL ? "ستظهر هنا أحداث صحتك تلقائياً" : "Your health events will appear here automatically"}
              </Text>
            </View>
          ) : (
            <View style={styles.content}>
              {dates.map((dateKey) => (
                <View key={dateKey}>
                  {/* Date header */}
                  <View style={styles.dateHeader}>
                    <View style={[styles.dateLine, { backgroundColor: border }]} />
                    <Text style={[styles.dateLabel, { color: theme.colors.text.secondary, backgroundColor: bg }]}>
                      {formatDate(dateKey)}
                    </Text>
                    <View style={[styles.dateLine, { backgroundColor: border }]} />
                  </View>

                  {/* Events for this date */}
                  {grouped[dateKey].map((event, idx) => {
                    const config = getDomainConfig(event.domain);
                    const IconComponent = config.icon;
                    const isLast = idx === grouped[dateKey].length - 1;

                    return (
                      <View key={event.id} style={styles.eventRow}>
                        {/* Timeline spine */}
                        <View style={styles.spine}>
                          <View style={[styles.dot, { backgroundColor: config.color, borderColor: bg }]} />
                          {!isLast && <View style={[styles.line, { backgroundColor: border }]} />}
                        </View>

                        {/* Event card */}
                        <View style={[styles.eventCard, { backgroundColor: card, borderColor: border }]}>
                          <View style={[styles.iconBox, { backgroundColor: `${config.color}15` }]}>
                            <IconComponent color={config.color} size={16} />
                          </View>
                          <View style={styles.eventBody}>
                            <Text style={[styles.eventSource, { color: theme.colors.text.primary }]}>
                              {formatSource(event.source)}
                            </Text>
                            {event.value != null && (
                              <Text style={[styles.eventValue, { color: config.color }]}>
                                {String(event.value)}{event.unit ? ` ${event.unit}` : ""}
                              </Text>
                            )}
                            <View style={styles.eventMeta}>
                              <View style={[styles.domainBadge, { backgroundColor: `${config.color}15` }]}>
                                <Text style={[styles.domainText, { color: config.color }]}>
                                  {isRTL ? config.labelAr : config.label}
                                </Text>
                              </View>
                              <Text style={[styles.eventTime, { color: theme.colors.text.secondary }]}>
                                {formatTime(event.occurredAt)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
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
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "600" },
  emptyDesc: { fontSize: 14, textAlign: "center", paddingHorizontal: 40 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  dateHeader: { flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 8 },
  dateLine: { flex: 1, height: 1 },
  dateLabel: { fontSize: 12, fontWeight: "600", paddingHorizontal: 8 },
  eventRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  spine: { alignItems: "center", width: 20, paddingTop: 14 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, zIndex: 1 },
  line: { width: 2, flex: 1, marginTop: 4 },
  eventCard: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 4 },
  iconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  eventBody: { flex: 1, gap: 4 },
  eventSource: { fontSize: 14, fontWeight: "600" },
  eventValue: { fontSize: 16, fontWeight: "700" },
  eventMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  domainBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  domainText: { fontSize: 11, fontWeight: "600" },
  eventTime: { fontSize: 12 },
});
