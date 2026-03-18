/* biome-ignore-all lint/style/noNestedTernary: screen copy requires nested condition branches for status/pathogenicity mapping. */
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Clock,
  Dna,
  FlaskConical,
  Pill,
  RefreshCw,
  ShieldAlert,
  Upload,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/design-system";
import { Heading, Text } from "@/components/design-system/Typography";
import GradientScreen from "@/components/figma/GradientScreen";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  type GeneticsProfile,
  type PharmacogenomicEntry,
  type PRSScore,
  geneticsService,
} from "@/lib/services/geneticsService";
import { logger } from "@/lib/utils/logger";

// ── Risk level helpers ─────────────────────────────────────────────────────────

const PRS_LEVEL_COLOR: Record<PRSScore["level"], string> = {
  low: "#22c55e",
  average: "#3b82f6",
  elevated: "#f59e0b",
  high: "#ef4444",
};

const PRS_LEVEL_LABEL_EN: Record<PRSScore["level"], string> = {
  low: "Low risk",
  average: "Average risk",
  elevated: "Elevated risk",
  high: "High risk",
};

const PRS_LEVEL_LABEL_AR: Record<PRSScore["level"], string> = {
  low: "مخاطرة منخفضة",
  average: "مخاطرة متوسطة",
  elevated: "مخاطرة مرتفعة",
  high: "مخاطرة عالية",
};

const INTERACTION_COLOR: Record<PharmacogenomicEntry["interaction"], string> = {
  standard: "#22c55e",
  reduced_efficacy: "#f59e0b",
  increased_toxicity: "#ef4444",
  contraindicated: "#7c3aed",
};

const PATHOGENICITY_COLOR: Record<string, string> = {
  pathogenic: "#ef4444",
  likely_pathogenic: "#f97316",
  vus: "#f59e0b",
  likely_benign: "#3b82f6",
  benign: "#22c55e",
};

// ── Main screen ───────────────────────────────────────────────────────────────

export default function GeneticsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isRTL = i18n.language.startsWith("ar");

  const [profile, setProfile] = useState<GeneticsProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [showAllPrs, setShowAllPrs] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    try {
      const data = await geneticsService.getProfile();
      setProfile(data);

      // Auto-poll while processing
      if (data?.processingStatus === "processing" || data?.processingStatus === "pending") {
        return true; // signal caller to keep polling
      }
      return false;
    } catch (err) {
      logger.error("[genetics] Failed to load profile:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const keepPolling = await loadProfile();
      if (mounted) {
        setLoading(false);
        if (keepPolling) {
          const id = setInterval(async () => {
            const stillPolling = await loadProfile();
            if (!stillPolling) {
              clearInterval(id);
              setPollingInterval(null);
            }
          }, 5000);
          setPollingInterval(id);
        }
      }
    })();

    return () => {
      mounted = false;
      if (pollingInterval) clearInterval(pollingInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  // ── Consent toggle ────────────────────────────────────────────────────────

  const toggleFamilyConsent = useCallback(async () => {
    if (!profile) return;
    const next = !profile.familySharingConsent;
    const label = next
      ? isRTL ? "تفعيل مشاركة النتائج مع أفراد العائلة؟" : "Allow family members to see your genetic risk summary?"
      : isRTL ? "إيقاف مشاركة النتائج مع أفراد العائلة؟" : "Stop sharing genetic results with family?";

    Alert.alert(
      isRTL ? "تغيير إعدادات المشاركة" : "Sharing preference",
      label,
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "تأكيد" : "Confirm",
          style: next ? "default" : "destructive",
          onPress: async () => {
            try {
              await geneticsService.updateConsent(next);
              setProfile((p) => p ? { ...p, familySharingConsent: next } : p);
            } catch {
              Alert.alert(isRTL ? "خطأ" : "Error", isRTL ? "تعذّر تحديث الإعداد" : "Failed to update preference");
            }
          },
        },
      ]
    );
  }, [profile, isRTL]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const statusIcon = () => {
    switch (profile?.processingStatus) {
      case "processed":    return <CheckCircle size={20} color="#22c55e" />;
      case "processing":
      case "pending":      return <Clock size={20} color="#f59e0b" />;
      case "failed":       return <XCircle size={20} color="#ef4444" />;
      default:             return <Dna size={20} color={theme.colors.text.secondary} />;
    }
  };

  const statusText = () => geneticsService.statusLabel(
    profile?.processingStatus ?? "none", isRTL
  );

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <GradientScreen>
        <SafeAreaView style={styles.flex}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary.main} />
          </View>
        </SafeAreaView>
      </GradientScreen>
    );
  }

  // ── No DNA uploaded ───────────────────────────────────────────────────────

  if (!profile || profile.processingStatus === "none") {
    return (
      <GradientScreen>
        <SafeAreaView style={styles.flex}>
          <View style={[styles.header, isRTL && styles.rtlRow]}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <Heading level={4} style={styles.headerTitle}>
              {isRTL ? "الجينوم الصحي" : "Genetic Health"}
            </Heading>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.emptyContainer}>
            <Dna size={56} color={theme.colors.primary.main} strokeWidth={1.2} />
            <Heading level={3} style={[styles.emptyTitle, isRTL && styles.rtlText]}>
              {isRTL ? "لم يتم رفع بيانات الحمض النووي" : "No DNA data uploaded"}
            </Heading>
            <Text style={[styles.emptyBody, isRTL && styles.rtlText]}>
              {isRTL
                ? "ارفع ملف بياناتك الجينية من 23andMe أو AncestryDNA للحصول على تحليل صحي شخصي."
                : "Upload your raw DNA file from 23andMe or AncestryDNA to get personalised health insights."}
            </Text>
            <Button
              title={isRTL ? "رفع ملف الحمض النووي" : "Upload DNA file"}
              onPress={() => router.push("/profile/health-integrations")}
              variant="primary"
              icon={<Upload size={16} color="#fff" />}
              style={styles.uploadButton}
            />
          </View>
        </SafeAreaView>
      </GradientScreen>
    );
  }

  // ── Processing / pending ──────────────────────────────────────────────────

  if (profile.processingStatus === "processing" || profile.processingStatus === "pending") {
    return (
      <GradientScreen>
        <SafeAreaView style={styles.flex}>
          <View style={[styles.header, isRTL && styles.rtlRow]}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <Heading level={4} style={styles.headerTitle}>
              {isRTL ? "الجينوم الصحي" : "Genetic Health"}
            </Heading>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary.main} style={styles.processingSpinner} />
            <Heading level={3} style={[styles.emptyTitle, isRTL && styles.rtlText]}>
              {isRTL ? "جارٍ تحليل بياناتك الجينية…" : "Analysing your DNA…"}
            </Heading>
            <Text style={[styles.emptyBody, isRTL && styles.rtlText]}>
              {isRTL
                ? "قد يستغرق هذا بضع دقائق. ستظهر النتائج هنا تلقائيًا عند اكتمال التحليل."
                : "This may take a few minutes. Your results will appear here automatically once ready."}
            </Text>
          </View>
        </SafeAreaView>
      </GradientScreen>
    );
  }

  // ── Failed state ──────────────────────────────────────────────────────────

  if (profile.processingStatus === "failed") {
    return (
      <GradientScreen>
        <SafeAreaView style={styles.flex}>
          <View style={[styles.header, isRTL && styles.rtlRow]}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <Heading level={4} style={styles.headerTitle}>
              {isRTL ? "الجينوم الصحي" : "Genetic Health"}
            </Heading>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.emptyContainer}>
            <XCircle size={56} color="#ef4444" strokeWidth={1.2} />
            <Heading level={3} style={[styles.emptyTitle, isRTL && styles.rtlText]}>
              {isRTL ? "فشل التحليل" : "Processing failed"}
            </Heading>
            <Text style={[styles.emptyBody, isRTL && styles.rtlText]}>
              {profile.errorMessage ?? (isRTL
                ? "تعذّر تحليل الملف. يرجى المحاولة مرة أخرى أو رفع ملف مختلف."
                : "Could not process the file. Please try again or upload a different file.")}
            </Text>
            <Button
              title={isRTL ? "رفع ملف جديد" : "Upload new file"}
              onPress={() => router.push("/profile/health-integrations")}
              variant="primary"
              icon={<RefreshCw size={16} color="#fff" />}
              style={styles.uploadButton}
            />
          </View>
        </SafeAreaView>
      </GradientScreen>
    );
  }

  // ── Processed — full results view ─────────────────────────────────────────

  const topRisks = showAllPrs ? (profile.prsScores ?? []) : geneticsService.getTopRisks(profile, 5);
  const pharmAlerts = geneticsService.getPharmAlerts(profile);
  const allPrs = profile.prsScores ?? [];
  const clinvarVariants = profile.clinvarVariants ?? [];

  return (
    <GradientScreen>
      <SafeAreaView style={styles.flex}>
        {/* Header */}
        <View style={[styles.header, isRTL && styles.rtlRow]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Heading level={4} style={styles.headerTitle}>
            {isRTL ? "الجينوم الصحي" : "Genetic Health"}
          </Heading>
          <TouchableOpacity onPress={onRefresh} hitSlop={8}>
            <RefreshCw size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Status banner */}
          <View style={[styles.statusBanner, { backgroundColor: theme.colors.background.secondary }]}>
            <View style={[styles.statusRow, isRTL && styles.rtlRow]}>
              {statusIcon()}
              <Text style={[styles.statusText, isRTL && styles.rtlText, { color: theme.colors.text.primary }]}>
                {statusText()}
              </Text>
            </View>
            {profile.processedAt && (
              <Text style={[styles.processedAt, isRTL && styles.rtlText]}>
                {isRTL ? "تمّت المعالجة: " : "Processed: "}
                {new Date(profile.processedAt).toLocaleDateString(
                  isRTL ? "ar-SA" : "en-GB",
                  { day: "numeric", month: "long", year: "numeric" }
                )}
              </Text>
            )}
          </View>

          {/* Top risk conditions */}
          {topRisks.length > 0 && (
            <View style={styles.section}>
              <View style={[styles.sectionHeader, isRTL && styles.rtlRow]}>
                <ShieldAlert size={18} color="#ef4444" />
                <Heading level={5} style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "أعلى المخاطر الجينية" : "Top genetic risks"}
                </Heading>
              </View>
              {topRisks.map((prs) => (
                <View key={prs.condition} style={[styles.card, { backgroundColor: theme.colors.background.secondary }]}>
                  <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
                    <View style={styles.cardFlex}>
                      <Text style={[styles.cardTitle, isRTL && styles.rtlText, { color: theme.colors.text.primary }]}>
                        {prs.condition}
                      </Text>
                      <Text style={[styles.cardSub, isRTL && styles.rtlText]}>
                        {prs.ancestryGroup} · {prs.snpCount.toLocaleString()} SNPs
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: `${PRS_LEVEL_COLOR[prs.level]}20` }]}>
                      <Text style={[styles.badgeText, { color: PRS_LEVEL_COLOR[prs.level] }]}>
                        {isRTL ? PRS_LEVEL_LABEL_AR[prs.level] : PRS_LEVEL_LABEL_EN[prs.level]}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.percentileRow}>
                    <View style={styles.percentileBar}>
                      <View
                        style={[
                          styles.percentileFill,
                          {
                            width: `${prs.percentile}%`,
                            backgroundColor: PRS_LEVEL_COLOR[prs.level],
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.percentileLabel}>
                      {isRTL ? `الشريحة المئوية ${prs.percentile}` : `${prs.percentile}th percentile`}
                    </Text>
                  </View>
                </View>
              ))}
              {!showAllPrs && allPrs.length > topRisks.length && (
                <TouchableOpacity
                  style={[styles.showAllRow, isRTL && styles.rtlRow]}
                  onPress={() => setShowAllPrs(true)}
                >
                  <Text style={[styles.showAllText, { color: theme.colors.primary.main }, isRTL && styles.rtlText]}>
                    {isRTL
                      ? `عرض جميع الحالات (${allPrs.length})`
                      : `View all ${allPrs.length} conditions`}
                  </Text>
                  <ChevronRight size={16} color={theme.colors.primary.main} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Pharmacogenomics alerts */}
          {pharmAlerts.length > 0 && (
            <View style={styles.section}>
              <View style={[styles.sectionHeader, isRTL && styles.rtlRow]}>
                <Pill size={18} color="#f59e0b" />
                <Heading level={5} style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "تفاعلات الأدوية الجينية" : "Drug-gene interactions"}
                </Heading>
              </View>
              {pharmAlerts.map((pgx) => (
                <View key={`${pgx.gene}-${pgx.drug}`} style={[styles.card, { backgroundColor: theme.colors.background.secondary }]}>
                  <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
                    <View style={styles.cardFlex}>
                      <Text style={[styles.cardTitle, isRTL && styles.rtlText, { color: theme.colors.text.primary }]}>
                        {pgx.drug}
                      </Text>
                      <Text style={[styles.cardSub, isRTL && styles.rtlText]}>
                        {isRTL ? `الجين: ${pgx.gene}` : `Gene: ${pgx.gene}`}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: `${INTERACTION_COLOR[pgx.interaction]}20` }]}>
                      <Text style={[styles.badgeText, { color: INTERACTION_COLOR[pgx.interaction] }]}>
                        {geneticsService.interactionLabel(pgx.interaction, isRTL)}
                      </Text>
                    </View>
                  </View>
                  {pgx.clinicalAnnotation && (
                    <Text style={[styles.annotation, isRTL && styles.rtlText]}>
                      {pgx.clinicalAnnotation}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* ClinVar variants */}
          {clinvarVariants.length > 0 && (
            <View style={styles.section}>
              <View style={[styles.sectionHeader, isRTL && styles.rtlRow]}>
                <FlaskConical size={18} color="#7c3aed" />
                <Heading level={5} style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                  {isRTL ? "المتغيرات الجينية الطبية (ClinVar)" : "Clinical variants (ClinVar)"}
                </Heading>
              </View>
              {clinvarVariants.map((v) => (
                <View key={v.rsid} style={[styles.card, { backgroundColor: theme.colors.background.secondary }]}>
                  <View style={[styles.cardRow, isRTL && styles.rtlRow]}>
                    <View style={styles.cardFlex}>
                      <Text style={[styles.cardTitle, isRTL && styles.rtlText, { color: theme.colors.text.primary }]}>
                        {v.condition}
                      </Text>
                      <Text style={[styles.cardSub, isRTL && styles.rtlText]}>
                        {v.gene} · {v.rsid}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: `${PATHOGENICITY_COLOR[v.pathogenicity] ?? "#6b7280"}20` }]}>
                      <Text style={[styles.badgeText, { color: PATHOGENICITY_COLOR[v.pathogenicity] ?? "#6b7280" }]}>
                        {v.clinicalSignificance}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.evidenceRow, isRTL && styles.rtlRow]}>
                    <AlertTriangle size={12} color={PATHOGENICITY_COLOR[v.pathogenicity] ?? "#6b7280"} />
                    <Text style={[styles.evidenceText, isRTL && styles.rtlText]}>
                      {isRTL ? `مستوى الدليل: ${v.evidenceLevel}` : `Evidence: ${v.evidenceLevel}`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Family sharing consent toggle */}
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.rtlRow]}>
              <Dna size={18} color={theme.colors.primary.main} />
              <Heading level={5} style={[styles.sectionTitle, isRTL && styles.rtlText]}>
                {isRTL ? "المشاركة مع العائلة" : "Family sharing"}
              </Heading>
            </View>
            <TouchableOpacity
              style={[styles.card, styles.consentCard, { backgroundColor: theme.colors.background.secondary }, isRTL && styles.rtlRow]}
              onPress={toggleFamilyConsent}
              activeOpacity={0.7}
            >
              <View style={styles.cardFlex}>
                <Text style={[styles.cardTitle, isRTL && styles.rtlText, { color: theme.colors.text.primary }]}>
                  {isRTL ? "مشاركة ملخص المخاطر الجينية" : "Share genetic risk summary"}
                </Text>
                <Text style={[styles.cardSub, isRTL && styles.rtlText]}>
                  {isRTL
                    ? "السماح لمسؤولي العائلة برؤية نتائج PRS وتفاعلات الأدوية (دون rsids الأولية)"
                    : "Allow family admins to see your PRS results and drug interactions (no raw rsids)"}
                </Text>
              </View>
              <View
                style={[
                  styles.consentToggle,
                  { backgroundColor: profile.familySharingConsent ? theme.colors.primary.main : "#d1d5db" },
                ]}
              >
                <View
                  style={[
                    styles.consentThumb,
                    { transform: [{ translateX: profile.familySharingConsent ? 18 : 2 }] },
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    </GradientScreen>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  rtlRow: { flexDirection: "row-reverse" },
  rtlText: { textAlign: "right" },
  headerTitle: { flex: 1, textAlign: "center" },
  headerSpacer: { width: 24 },

  // Empty / loading states
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: { textAlign: "center", marginTop: 8 },
  emptyBody: { textAlign: "center", opacity: 0.7, lineHeight: 22 },
  uploadButton: { marginTop: 8, minWidth: 200 },
  processingSpinner: { marginBottom: 8 },

  // Scroll content
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  // Status banner
  statusBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusText: { fontSize: 15, fontWeight: "500" },
  processedAt: { fontSize: 12, opacity: 0.6, marginTop: 2 },

  // Section
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15 },

  // Cards
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 8,
  },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardFlex: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  cardSub: { fontSize: 12, opacity: 0.6 },

  // Badge
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 11, fontWeight: "600" },

  // Percentile bar
  percentileRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  percentileBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  percentileFill: { height: "100%", borderRadius: 2 },
  percentileLabel: { fontSize: 11, opacity: 0.6, minWidth: 90 },

  // Show all row
  showAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 4,
  },
  showAllText: { fontSize: 13, fontWeight: "500" },

  // Annotation
  annotation: { fontSize: 12, opacity: 0.7, lineHeight: 18 },

  // Evidence row
  evidenceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  evidenceText: { fontSize: 11, opacity: 0.6 },

  // Consent card
  consentCard: { flexDirection: "row", alignItems: "center" },
  consentToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    flexShrink: 0,
  },
  consentThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },

  bottomPad: { height: 40 },
});
