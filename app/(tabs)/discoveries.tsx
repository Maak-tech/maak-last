import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft, Sparkles } from "lucide-react-native";
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
import EnrichedDiscoveryCard from "@/components/EnrichedDiscoveryCard";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  discoveryService,
  type DiscoveryType,
  type EnrichedDiscovery,
} from "@/lib/services/discoveryService";

const FILTER_TYPES: { key: DiscoveryType | "all"; labelEn: string; labelAr: string }[] = [
  { key: "all",                     labelEn: "All",            labelAr: "الكل" },
  { key: "correlation",             labelEn: "Correlations",   labelAr: "ارتباطات" },
  { key: "symptom_pattern",         labelEn: "Symptoms",       labelAr: "أعراض" },
  { key: "vital_trend",             labelEn: "Vitals",         labelAr: "علامات حيوية" },
  { key: "medication_effectiveness",labelEn: "Medications",    labelAr: "أدوية" },
  { key: "temporal_pattern",        labelEn: "Patterns",       labelAr: "أنماط" },
];

export default function DiscoveriesScreen() {
  const { i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const isRTL = i18n.language === "ar";

  const [discoveries, setDiscoveries] = useState<EnrichedDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<DiscoveryType | "all">("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);
    setLoadError(null);
    try {
      const all = await discoveryService.getAllDiscoveries(user.id, isRTL);
      setDiscoveries(all);
    } catch (err: unknown) {
      console.warn('[discoveries] Failed to load discoveries:', err instanceof Error ? err.message : String(err));
      setLoadError(
        isRTL ? "تعذّر تحميل الاكتشافات. اسحب للأسفل للمحاولة مجدداً." : "Failed to load discoveries. Pull down to retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, isRTL]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDismiss = useCallback((id: string) => {
    setDiscoveries((prev) => prev.filter((d) => d.id !== id));
    if (user?.id) discoveryService.dismissDiscovery(user.id, id).catch((err) => {
      console.debug('[discoveries] dismissDiscovery failed (non-critical):', err instanceof Error ? err.message : String(err));
    });
  }, [user?.id]);

  const filtered = activeFilter === "all"
    ? discoveries
    : discoveries.filter((d) => d.discoveryType === activeFilter);

  const newCount = filtered.filter((d) => d.status === "new").length;

  const bg = isDark ? theme.colors.background.primary : "#F8FAFC";
  const card = isDark ? "#1E293B" : "#FFFFFF";
  const border = isDark ? "#334155" : "#E2E8F0";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: card, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft color={theme.colors.text.primary} size={22} style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Sparkles color={theme.colors.primary.main} size={18} />
          <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
            {isRTL ? "الاكتشافات الصحية" : "Health Discoveries"}
          </Text>
          {newCount > 0 && (
            <View style={[styles.newBadge, { backgroundColor: theme.colors.primary.main }]}>
              <Text style={styles.newBadgeText}>{newCount}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Filter chips */}
      <View style={[styles.filterBar, { backgroundColor: card, borderBottomColor: border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTER_TYPES.map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setActiveFilter(f.key)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? theme.colors.primary.main : "transparent",
                    borderColor: isActive ? theme.colors.primary.main : border,
                  },
                ]}
              >
                <Text style={[styles.filterChipText, { color: isActive ? "#FFFFFF" : theme.colors.text.secondary }]}>
                  {isRTL ? f.labelAr : f.labelEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary.main} size="large" />
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.colors.accent.error }]}>
            {loadError}
          </Text>
          <TouchableOpacity
            onPress={() => load()}
            style={[styles.retryBtn, { borderColor: theme.colors.primary.main }]}
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
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: `${theme.colors.primary.main}15` }]}>
                <Sparkles color={theme.colors.primary.main} size={32} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
                {activeFilter === "all"
                  ? (isRTL ? "لا توجد اكتشافات بعد" : "No discoveries yet")
                  : (isRTL ? "لا توجد اكتشافات لهذا النوع" : "No discoveries of this type")
                }
              </Text>
              <Text style={[styles.emptyDesc, { color: theme.colors.text.secondary }]}>
                {isRTL
                  ? "استمر في تسجيل بياناتك الصحية لاكتشاف الأنماط"
                  : "Keep logging health data to discover patterns"}
              </Text>
              {activeFilter !== "all" && (
                <TouchableOpacity onPress={() => setActiveFilter("all")} style={[styles.clearFilter, { borderColor: theme.colors.primary.main }]}>
                  <Text style={{ color: theme.colors.primary.main, fontSize: 14 }}>
                    {isRTL ? "عرض الكل" : "View all"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map((discovery) => (
                <EnrichedDiscoveryCard
                  key={discovery.id}
                  discovery={discovery}
                  onDismiss={handleDismiss}
                />
              ))}
              <View style={{ height: 24 }} />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  newBadge: { width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  newBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  filterBar: { borderBottomWidth: 1 },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontWeight: "500" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "600", textAlign: "center" },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  clearFilter: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginTop: 4 },
  list: { padding: 16, gap: 12 },
  errorText: { fontSize: 15, textAlign: "center", paddingHorizontal: 32, lineHeight: 22 },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
});
