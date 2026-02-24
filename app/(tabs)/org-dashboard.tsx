import { router, useLocalSearchParams } from "expo-router";
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
  Users,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  TextInput,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import PatientRosterCard from "@/app/components/PatientRosterCard";
import {
  Caption,
  Text as TypographyText,
} from "@/components/design-system/Typography";
import WavyBackground from "@/components/figma/WavyBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useMyOrganization } from "@/hooks/useMyOrganization";
import { useOrganizationDashboard } from "@/hooks/useOrganizationDashboard";
import type { SortField } from "@/lib/services/cohortRiskService";
import { organizationService } from "@/lib/services/organizationService";
import { createThemedStyles, getTextStyle } from "@/utils/styles";

// ─── Filter / Sort Options ────────────────────────────────────────────────────

type RiskFilter = "all" | "critical" | "high" | "elevated" | "normal";

const RISK_FILTERS: Array<{ key: RiskFilter; en: string; ar: string }> = [
  { key: "all", en: "All", ar: "الكل" },
  { key: "critical", en: "Critical", ar: "حرج" },
  { key: "high", en: "High", ar: "مرتفع" },
  { key: "elevated", en: "Elevated", ar: "متصاعد" },
  { key: "normal", en: "Normal", ar: "طبيعي" },
];

const SORT_OPTIONS: Array<{
  key: SortField;
  en: string;
  ar: string;
}> = [
  { key: "riskScore", en: "Risk", ar: "الخطر" },
  { key: "lastVitalSync", en: "Sync", ar: "المزامنة" },
  { key: "anomalies", en: "Alerts", ar: "التنبيهات" },
  { key: "missedMeds", en: "Meds", ar: "الأدوية" },
];

const RISK_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  elevated: "#F59E0B",
  normal: "#10B981",
};

// ─── Summary Stat Card ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  theme,
}: {
  label: string;
  value: number;
  color: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background.secondary,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: "center",
        minWidth: 72,
      }}
    >
      <TypographyText
        style={[
          getTextStyle(theme, "heading", "bold", color),
          { fontSize: 22, lineHeight: 28 },
        ]}
      >
        {value}
      </TypographyText>
      <Caption
        style={{ color: theme.colors.text.secondary, textAlign: "center" }}
      >
        {label}
      </Caption>
    </View>
  );
}

const PAGE_SIZE = 20;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OrgDashboardScreen() {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const isRTL = i18n.language === "ar";

  // Prefer orgId from route params (when navigated from org hub),
  // fall back to the user's first active org membership.
  const params = useLocalSearchParams<{
    orgId?: string;
    cohortId?: string;
    cohortName?: string;
  }>();
  const { org: myOrg } = useMyOrganization();
  const orgId: string | undefined = params.orgId || myOrg?.id;
  const cohortId: string | undefined = params.cohortId || undefined;
  const cohortName: string | undefined = params.cohortName || undefined;

  const {
    org,
    filteredPatients,
    summary,
    loading,
    refreshing,
    error,
    riskFilter,
    sortBy,
    searchQuery,
    setRiskFilter,
    setSortBy,
    setSearchQuery,
    refresh,
  } = useOrganizationDashboard(orgId, {
    autoLoad: true,
    refreshIntervalMs: 5 * 60 * 1000, // refresh every 5 minutes
    cohortId,
  });

  // ─── Pagination ──────────────────────────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset to first page whenever the filtered list changes (filter / sort / search).
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [riskFilter, sortBy, searchQuery]);

  const visiblePatients = filteredPatients.slice(0, visibleCount);
  const hasMorePatients = visibleCount < filteredPatients.length;

  // ─── Enroll Patient State ────────────────────────────────────────────────────
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollUserId, setEnrollUserId] = useState("");
  const [enrollDisplayName, setEnrollDisplayName] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const handleEnroll = async () => {
    if (!(orgId && enrollUserId.trim() && user?.id)) return;
    setEnrolling(true);
    try {
      await organizationService.enrollPatient(orgId, enrollUserId.trim(), {
        enrolledBy: user.id,
        displayName: enrollDisplayName.trim() || undefined,
        consentScope: ["vitals", "medications", "symptoms", "ai_analysis"],
      });
      setShowEnroll(false);
      setEnrollUserId("");
      setEnrollDisplayName("");
      Alert.alert("Enrolled", "Patient has been added to your roster.", [
        { text: "OK", onPress: () => refresh() },
      ]);
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to enroll patient."
      );
    } finally {
      setEnrolling(false);
    }
  };

  const styles = createThemedStyles((t) => ({
    container: {
      flex: 1,
      backgroundColor: t.colors.background.primary,
    } as ViewStyle,
    header: {
      paddingHorizontal: t.spacing.base,
      paddingTop: t.spacing.xl,
      paddingBottom: t.spacing.lg,
    } as ViewStyle,
    headerRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center",
      marginBottom: t.spacing.xs,
    } as ViewStyle,
    backBtn: {
      padding: t.spacing.xs,
      marginRight: isRTL ? 0 : t.spacing.sm,
      marginLeft: isRTL ? t.spacing.sm : 0,
    } as ViewStyle,
    summaryRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.base,
      marginBottom: t.spacing.base,
    } as ViewStyle,
    searchContainer: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center",
      backgroundColor: t.colors.background.secondary,
      borderRadius: 12,
      paddingHorizontal: t.spacing.sm,
      marginHorizontal: t.spacing.base,
      marginBottom: t.spacing.sm,
      height: 44,
      gap: t.spacing.xs,
    } as ViewStyle,
    searchInput: {
      flex: 1,
      ...getTextStyle(t, "body", "regular", t.colors.text.primary),
      textAlign: (isRTL ? "right" : "left") as "left" | "right",
    } as TextStyle,
    filterRow: {
      paddingHorizontal: t.spacing.base,
      marginBottom: t.spacing.sm,
    } as ViewStyle,
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      marginRight: isRTL ? 0 : t.spacing.xs,
      marginLeft: isRTL ? t.spacing.xs : 0,
    } as ViewStyle,
    sortRow: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      paddingHorizontal: t.spacing.base,
      marginBottom: t.spacing.sm,
      alignItems: "center",
      gap: t.spacing.xs,
    } as ViewStyle,
    sortChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    } as ViewStyle,
    listContent: {
      paddingHorizontal: t.spacing.base,
      paddingBottom: t.spacing.xl * 3,
    } as ViewStyle,
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
    } as ViewStyle,
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.colors.background.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: t.spacing.base,
    } as ViewStyle,
    sectionLabel: {
      flexDirection: (isRTL ? "row-reverse" : "row") as "row" | "row-reverse",
      alignItems: "center",
      gap: t.spacing.xs,
      paddingHorizontal: t.spacing.base,
      marginBottom: t.spacing.xs,
    } as ViewStyle,
  }))(theme);

  const txt = (en: string, ar: string) => (isRTL ? ar : en);
  const ChevronIcon = isRTL ? ChevronRight : ChevronLeft;

  return (
    <View style={styles.container}>
      <WavyBackground height={180}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <ChevronIcon color="#fff" size={24} />
            </TouchableOpacity>
            <Building2
              color="#fff"
              size={22}
              style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }}
            />
            <TypographyText
              style={[
                getTextStyle(theme, "subheading", "bold", "#fff"),
                { flex: 1, textAlign: isRTL ? "right" : "left" },
              ]}
            >
              {org?.name ?? txt("Population Dashboard", "لوحة صحة المرضى")}
            </TypographyText>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() =>
                router.push(
                  `/(tabs)/tasks?orgId=${encodeURIComponent(orgId ?? "")}` as never
                )
              }
              style={{ marginRight: 12 }}
            >
              <ClipboardList color="#fff" size={20} />
            </TouchableOpacity>
            <TouchableOpacity disabled={refreshing} onPress={refresh}>
              <RefreshCw
                color={refreshing ? "rgba(255,255,255,0.5)" : "#fff"}
                size={20}
              />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Caption
              style={{
                color: "rgba(255,255,255,0.8)",
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {txt(
                "Real-time patient monitoring",
                "مراقبة المرضى في الوقت الفعلي"
              )}
            </Caption>
            {cohortName ? (
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}
              >
                <Caption style={{ color: "#fff", fontWeight: "600" }}>
                  {cohortName}
                </Caption>
              </View>
            ) : null}
          </View>
        </View>
      </WavyBackground>

      {/* Summary stats */}
      {summary && (
        <View style={styles.summaryRow}>
          <StatCard
            color={theme.colors.primary.main}
            label={txt("Total", "الإجمالي")}
            theme={theme}
            value={summary.total}
          />
          <StatCard
            color={RISK_COLORS.critical}
            label={txt("Critical", "حرج")}
            theme={theme}
            value={summary.criticalCount}
          />
          <StatCard
            color={RISK_COLORS.elevated}
            label={txt("Alerts", "تنبيهات")}
            theme={theme}
            value={summary.unacknowledgedAnomalies}
          />
          <StatCard
            color={RISK_COLORS.normal}
            label={txt("Normal", "طبيعي")}
            theme={theme}
            value={summary.normalCount}
          />
        </View>
      )}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search color={theme.colors.text.secondary} size={16} />
        <TextInput
          autoCorrect={false}
          onChangeText={setSearchQuery}
          placeholder={txt("Search patients...", "بحث في المرضى...")}
          placeholderTextColor={theme.colors.text.secondary}
          style={styles.searchInput}
          value={searchQuery}
        />
      </View>

      {/* Risk filters */}
      <ScrollView
        contentContainerStyle={[
          styles.filterRow,
          {
            flexDirection: (isRTL ? "row-reverse" : "row") as
              | "row"
              | "row-reverse",
          },
        ]}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {RISK_FILTERS.map((f) => {
          const isActive = riskFilter === f.key;
          const color =
            f.key === "all"
              ? theme.colors.primary.main
              : (RISK_COLORS[f.key] ?? theme.colors.primary.main);
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setRiskFilter(f.key as RiskFilter)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? color : "transparent",
                  borderColor: isActive ? color : theme.colors.border.light,
                },
              ]}
            >
              <Caption
                style={{
                  color: isActive ? "#fff" : theme.colors.text.secondary,
                  fontWeight: isActive ? "600" : "400",
                }}
              >
                {isRTL ? f.ar : f.en}
              </Caption>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sort row */}
      <View style={styles.sortRow}>
        <Caption
          style={{
            color: theme.colors.text.secondary,
            marginRight: isRTL ? 0 : 4,
            marginLeft: isRTL ? 4 : 0,
          }}
        >
          {txt("Sort:", "ترتيب:")}
        </Caption>
        {SORT_OPTIONS.map((opt) => {
          const isActive = sortBy === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setSortBy(opt.key)}
              style={[
                styles.sortChip,
                {
                  backgroundColor: isActive
                    ? theme.colors.primary.main
                    : "transparent",
                  borderColor: isActive
                    ? theme.colors.primary.main
                    : theme.colors.border.light,
                },
              ]}
            >
              <Caption
                style={{
                  color: isActive ? "#fff" : theme.colors.text.secondary,
                  fontWeight: isActive ? "600" : "400",
                }}
              >
                {isRTL ? opt.ar : opt.en}
              </Caption>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Patient list */}
      <ScrollView
        refreshControl={
          <RefreshControl
            onRefresh={refresh}
            refreshing={refreshing}
            tintColor={theme.colors.primary.main}
          />
        }
      >
        {/* Count label */}
        {!loading && (
          <View style={styles.sectionLabel}>
            <Users color={theme.colors.text.secondary} size={14} />
            <Caption style={{ color: theme.colors.text.secondary }}>
              {isRTL
                ? `${Math.min(visibleCount, filteredPatients.length)} من ${filteredPatients.length} مريض`
                : `${Math.min(visibleCount, filteredPatients.length)} of ${filteredPatients.length} patient${filteredPatients.length !== 1 ? "s" : ""}`}
            </Caption>
          </View>
        )}

        <View style={styles.listContent}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator
                color={theme.colors.primary.main}
                size="large"
              />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <AlertTriangle color={theme.colors.text.secondary} size={24} />
              </View>
              <TypographyText
                style={[
                  getTextStyle(
                    theme,
                    "body",
                    "semibold",
                    theme.colors.text.primary
                  ),
                  { textAlign: "center", marginBottom: 4 },
                ]}
              >
                {txt("Failed to load", "فشل التحميل")}
              </TypographyText>
              <Caption
                style={{
                  color: theme.colors.text.secondary,
                  textAlign: "center",
                }}
              >
                {error}
              </Caption>
            </View>
          ) : filteredPatients.length === 0 ? (
            <View style={styles.centered}>
              <View style={styles.emptyIcon}>
                <Shield color={theme.colors.text.secondary} size={24} />
              </View>
              <TypographyText
                style={[
                  getTextStyle(
                    theme,
                    "body",
                    "semibold",
                    theme.colors.text.primary
                  ),
                  { textAlign: "center", marginBottom: 4 },
                ]}
              >
                {txt("No patients found", "لا يوجد مرضى")}
              </TypographyText>
              <Caption
                style={{
                  color: theme.colors.text.secondary,
                  textAlign: "center",
                }}
              >
                {riskFilter === "all"
                  ? txt(
                      "Enroll patients to see them here",
                      "قم بتسجيل المرضى لرؤيتهم هنا"
                    )
                  : txt(
                      "No patients match this filter",
                      "لا يوجد مرضى يطابقون هذا التصفية"
                    )}
              </Caption>
            </View>
          ) : (
            <>
              {visiblePatients.map((p) => (
                <PatientRosterCard
                  key={p.roster.id}
                  onPress={() => {
                    router.push(
                      `/(settings)/org/patient-detail?orgId=${encodeURIComponent(orgId ?? "")}&userId=${encodeURIComponent(p.roster.userId)}${p.roster.displayName ? `&patientName=${encodeURIComponent(p.roster.displayName)}` : ""}` as never
                    );
                  }}
                  patientDisplayName={p.roster.displayName}
                  roster={p.roster}
                  snapshot={p.snapshot}
                />
              ))}
              {hasMorePatients && (
                <TouchableOpacity
                  onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  style={{
                    alignItems: "center",
                    paddingVertical: 14,
                    marginTop: 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border.light,
                  }}
                >
                  <TypographyText
                    style={getTextStyle(
                      theme,
                      "body",
                      "semibold",
                      theme.colors.primary.main
                    )}
                  >
                    {isRTL
                      ? `تحميل المزيد (${filteredPatients.length - visibleCount})`
                      : `Load more (${filteredPatients.length - visibleCount} remaining)`}
                  </TypographyText>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Enroll Patient FAB */}
      {!loading && orgId && (
        <TouchableOpacity
          onPress={() => setShowEnroll(true)}
          style={{
            position: "absolute",
            right: 20,
            bottom: 24,
            backgroundColor: "#6366F1",
            borderRadius: 28,
            paddingHorizontal: 18,
            paddingVertical: 13,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            shadowColor: "#6366F1",
            shadowOpacity: 0.35,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          }}
        >
          <UserPlus color="#FFF" size={17} />
          <TypographyText
            style={{ color: "#FFF", fontWeight: "600", fontSize: 14 }}
          >
            Enroll Patient
          </TypographyText>
        </TouchableOpacity>
      )}

      {/* Enroll Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setShowEnroll(false);
          setEnrollUserId("");
          setEnrollDisplayName("");
        }}
        presentationStyle="pageSheet"
        visible={showEnroll}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.background.primary,
            padding: 24,
            paddingTop: 48,
          }}
        >
          <TypographyText
            style={getTextStyle(
              theme,
              "heading",
              "bold",
              theme.colors.text.primary
            )}
          >
            Enroll Patient
          </TypographyText>
          <Caption
            style={{
              color: theme.colors.text.secondary,
              marginTop: 4,
              marginBottom: 24,
            }}
          >
            Patient must already have a Maak account and will be granted default
            consent scope (vitals, meds, symptoms, AI analysis).
          </Caption>

          <Caption
            style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
          >
            PATIENT DISPLAY NAME (optional)
          </Caption>
          <TextInput
            onChangeText={setEnrollDisplayName}
            placeholder="e.g. John Smith"
            placeholderTextColor={theme.colors.text.secondary}
            style={{
              backgroundColor: theme.colors.background.secondary,
              borderRadius: 10,
              padding: 14,
              color: theme.colors.text.primary,
              fontSize: 15,
              marginBottom: 16,
            }}
            value={enrollDisplayName}
          />

          <Caption
            style={{ color: theme.colors.text.secondary, marginBottom: 6 }}
          >
            PATIENT USER ID *
          </Caption>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setEnrollUserId}
            placeholder="Firebase UID"
            placeholderTextColor={theme.colors.text.secondary}
            style={{
              backgroundColor: theme.colors.background.secondary,
              borderRadius: 10,
              padding: 14,
              color: theme.colors.text.primary,
              fontSize: 15,
              marginBottom: 24,
            }}
            value={enrollUserId}
          />

          <TouchableOpacity
            disabled={enrolling || !enrollUserId.trim()}
            onPress={handleEnroll}
            style={{
              backgroundColor: "#6366F1",
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              opacity: enrolling || !enrollUserId.trim() ? 0.5 : 1,
            }}
          >
            {enrolling ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <TypographyText
                style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}
              >
                Enroll
              </TypographyText>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowEnroll(false);
              setEnrollUserId("");
              setEnrollDisplayName("");
            }}
            style={{ alignItems: "center", padding: 14 }}
          >
            <Caption style={{ color: theme.colors.text.secondary }}>
              Cancel
            </Caption>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
