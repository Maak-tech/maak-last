/**
 * VHIPanel
 *
 * Composites the full Virtual Health Identity panel shown at the top of the
 * Nora tab:
 *   1. Overall score + trajectory
 *   2. Health dimension grid (13 tracked dimensions vs personal baseline)
 *   3. Genetic baseline (if DNA uploaded)
 *   4. Elevating factors
 *   5. Declining factors (with tap-to-ask-Nora)
 *
 * Data source (in priority order):
 *   1. `vhi` prop — parent pre-loads via useVHI hook (avoids double-fetch)
 *   2. Internal `api.get("/api/vhi/me")` fallback — used when no prop is given
 *
 * Passing `vhi` from the parent is preferred: it enables TTL caching via the
 * `useVHI` hook and allows the Nora tab to share a single fetch across all
 * VHI-aware components.
 */

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { Text } from "@/components/design-system/Typography";
import { useTheme } from "@/contexts/ThemeContext";
import { api, ApiError } from "@/lib/apiClient";
import type { VirtualHealthIdentity } from "@/types/vhi";
import DecliningFactorsList from "./DecliningFactorsList";
import ElevatingFactorsList from "./ElevatingFactorsList";
import GeneticBaselineCard from "./GeneticBaselineCard";
import VHIDimensionGrid from "./VHIDimensionGrid";
import VHIOverallScore from "./VHIOverallScore";

type VHIResponse = { data: VirtualHealthIdentity; version: number } | null;

type Props = {
  isRTL?: boolean;
  /** Called when user taps a recommendation — pre-fills the Nora chat input */
  onAskNora?: (prompt: string) => void;
  /**
   * Pre-loaded VHI data from the parent (e.g. via `useVHI` hook).
   * When provided, the internal `api.get` fetch is skipped entirely.
   * Pass `null` to explicitly indicate "no VHI yet" (shows empty state).
   * Omit / pass `undefined` to let VHIPanel fetch for itself.
   */
  vhi?: VirtualHealthIdentity | null;
  /**
   * Loading state from the parent — only used when `vhi` prop is provided.
   * Shows the loading spinner while the parent is fetching.
   */
  loading?: boolean;
  /**
   * Optional callback to refresh VHI data after a recompute request.
   * If provided, it is called after a 3-second delay following recompute.
   */
  onRefresh?: () => void;
};

export default function VHIPanel({
  isRTL = false,
  onAskNora,
  vhi: vhiProp,
  loading: loadingProp,
  onRefresh,
}: Props) {
  const { theme } = useTheme();

  // Internal state — only used when no `vhi` prop is supplied
  const [internalVhi, setInternalVhi] = useState<VirtualHealthIdentity | null>(null);
  const [internalLoading, setInternalLoading] = useState(vhiProp === undefined);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [expandedDeclining, setExpandedDeclining] = useState<number[]>([]);
  const recomputeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending recompute timer on unmount to avoid state updates on unmounted component
  useEffect(() => {
    return () => {
      if (recomputeTimerRef.current) clearTimeout(recomputeTimerRef.current);
    };
  }, []);

  // Resolved values — prefer prop over internal state
  const vhi = vhiProp !== undefined ? vhiProp : internalVhi;
  const loading = vhiProp !== undefined
    ? (loadingProp ?? false)
    : internalLoading;

  // Only fetch internally when the parent has NOT provided a vhi prop
  useEffect(() => {
    if (vhiProp !== undefined) return; // Parent controls data — skip internal fetch
    let cancelled = false;

    setInternalLoading(true);
    api
      .get<VHIResponse>("/api/vhi/me")
      .then((res) => {
        if (cancelled) return;
        setInternalVhi(res?.data ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!(err instanceof ApiError && err.status === 404)) {
          console.warn("[VHIPanel]", err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setInternalLoading(false);
      });

    return () => { cancelled = true; };
  }, [vhiProp]);

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={theme.colors.primary.main} size="small" />
        <Text style={{ fontSize: 13, color: theme.colors.text.secondary }}>
          {isRTL ? "جاري تحميل هويتك الصحية…" : "Loading your health identity…"}
        </Text>
      </View>
    );
  }

  if (!vhi) {
    return (
      <View
        style={[
          styles.emptyCard,
          { backgroundColor: theme.colors.background.primary },
        ]}
      >
        <Text
          style={{
            fontSize: 13,
            color: theme.colors.text.secondary,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          {isRTL
            ? "هويتك الصحية الافتراضية لم تُحسب بعد. استمر في تسجيل بياناتك الصحية وستظهر هنا."
            : "Your Virtual Health Identity hasn't been computed yet. Keep logging health data and it will appear here."}
        </Text>
      </View>
    );
  }

  const compositeRisk = vhi.currentState.riskScores.compositeRisk;
  const trajectory: "worsening" | "stable" | "improving" =
    vhi.decliningFactors.filter((f) => f.impact === "high").length >= 2
      ? "worsening"
      : vhi.decliningFactors.length === 0
        ? "improving"
        : "stable";

  // Fix 3: baseline confidence gate
  const baselineConfidence = vhi.currentState.baselineConfidence ?? 0;
  const hasEnoughBaseline = baselineConfidence >= 0.3;

  // Guard risk score against NaN/null (MOB-02)
  const safeRiskScore =
    vhi?.currentState?.riskScores?.compositeRisk !== null &&
    vhi?.currentState?.riskScores?.compositeRisk !== undefined &&
    Number.isFinite(Number(vhi.currentState.riskScores.compositeRisk))
      ? Math.round(Number(vhi.currentState.riskScores.compositeRisk))
      : null;

  // Guard baseline progress bar width — clamp to [0, 100] (MOB-03)
  const safeConfidencePct = Math.min(100, Math.max(0, Math.round(baselineConfidence * 100)));

  // Show "building profile" state when confidence < 30% (MOB-04)
  if (baselineConfidence < 0.3) {
    return (
      <View style={styles.card}>
        <View style={styles.buildingProfileContainer}>
          <Text style={styles.buildingTitle}>
            {isRTL ? 'جارٍ بناء ملفك الصحي' : 'Building Your Health Profile'}
          </Text>
          <Text style={styles.buildingSubtext}>
            {isRTL
              ? `${safeConfidencePct}٪ مكتمل — سجّل المزيد من القراءات للحصول على رؤى دقيقة`
              : `${safeConfidencePct}% complete — log more readings for accurate insights`}
          </Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${safeConfidencePct}%` }]} />
          </View>
          <Text style={styles.buildingNote}>
            {isRTL
              ? 'نحتاج إلى 42 قراءة على الأقل لتحسين الدقة'
              : 'We need ~42 readings to establish your personal baseline'}
          </Text>
        </View>
      </View>
    );
  }

  // Fix 4: recompute handler
  const handleRecompute = async () => {
    if (isRecomputing) return;
    setIsRecomputing(true);
    try {
      await api.post("/api/vhi/me/recompute", {});
      recomputeTimerRef.current = setTimeout(() => {
        onRefresh?.();
        setIsRecomputing(false);
      }, 3000);
    } catch {
      setIsRecomputing(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.background.primary },
      ]}
    >
      {/* Header row with recompute button */}
      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: theme.colors.text.secondary,
            letterSpacing: 0.8,
          }}
        >
          {isRTL ? "هويتك الصحية الافتراضية" : "YOUR HEALTH IDENTITY"}
        </Text>
        <TouchableOpacity onPress={handleRecompute} disabled={isRecomputing} style={{ opacity: isRecomputing ? 0.5 : 1 }}>
          <Text style={{ fontSize: 11, color: theme.colors.primary.main }}>
            {isRTL ? "تحديث" : "Refresh"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Fix 4: Updating indicator */}
      {isRecomputing && (
        <Text style={{ fontSize: 11, color: theme.colors.text.secondary, marginBottom: 4, textAlign: isRTL ? "right" : "left" }}>
          {isRTL ? "جاري تحديث درجتك..." : "Updating your score..."}
        </Text>
      )}

      {/* Fix 3: Overall Score with baseline confidence gate (low confidence caught above as early return) */}
      {hasEnoughBaseline && (
        <>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowExplanation(true)}
            accessibilityRole="button"
            accessibilityLabel={
              isRTL
                ? `لماذا درجتي ${Math.round(vhi.currentState.overallScore)}؟`
                : `Why is my score ${Math.round(vhi.currentState.overallScore)}?`
            }
          >
            <VHIOverallScore
              changeCount={vhi.decliningFactors.length + vhi.elevatingFactors.length}
              isRTL={isRTL}
              score={vhi.currentState.overallScore}
              trajectory={trajectory}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowExplanation(true)}
            style={styles.whyLink}
            accessibilityRole="button"
          >
            <Text style={[styles.whyLinkText, { color: theme.colors.primary.main }]}>
              {isRTL
                ? `لماذا درجتي ${Math.round(vhi.currentState.overallScore)}؟`
                : `Why is my score ${Math.round(vhi.currentState.overallScore)}?`}
            </Text>
          </TouchableOpacity>
          {/* Uncertainty note for 30–70% confidence range (MOB-04) */}
          {baselineConfidence >= 0.3 && baselineConfidence < 0.7 && (
            <Text style={styles.uncertaintyNote}>
              {isRTL
                ? '⚠️ تقدير مبكر — تتحسن الدقة مع مزيد من البيانات'
                : '⚠️ Early estimate — accuracy improves with more readings'}
            </Text>
          )}
        </>
      )}

      {/* Risk sub-scores row */}
      {safeRiskScore !== null && safeRiskScore > 0 && (
        <View style={[styles.riskRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {[
            {
              label: isRTL ? "خطر السقوط" : "Fall",
              value: vhi.currentState.riskScores.fallRisk.score,
            },
            {
              label: isRTL ? "الالتزام" : "Adherence",
              value: vhi.currentState.riskScores.adherenceRisk.score,
            },
            {
              label: isRTL ? "التدهور" : "Deterioration",
              value: vhi.currentState.riskScores.deteriorationRisk.score,
            },
          ].map((item) => {
            const riskColor =
              item.value > 75
                ? theme.colors.accent.error ?? "#EF4444"
                : item.value > 55
                  ? theme.colors.accent.warning ?? "#F59E0B"
                  : theme.colors.accent.success ?? "#22C55E";
            return (
              <View key={item.label} style={styles.riskChip}>
                <Text style={{ fontSize: 11, color: theme.colors.text.secondary }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: riskColor }}>
                  {Math.round(item.value)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Dimension grid — shown when dimensions are present and at least one has data */}
      {vhi.currentState.dimensions &&
      Object.values(vhi.currentState.dimensions).some((d) => d.currentValue !== null) ? (
        <>
          <View style={styles.divider} />
          <VHIDimensionGrid dimensions={vhi.currentState.dimensions} isRTL={isRTL} />
        </>
      ) : null}

      {vhi.geneticBaseline?.hasGeneticData ? (
        <>
          <View style={styles.divider} />
          <GeneticBaselineCard
            geneticBaseline={vhi.geneticBaseline}
            isRTL={isRTL}
          />
        </>
      ) : null}

      {vhi.elevatingFactors.length > 0 ? (
        <>
          <View style={styles.divider} />
          <ElevatingFactorsList factors={vhi.elevatingFactors} isRTL={isRTL} />
        </>
      ) : null}

      {vhi.decliningFactors.length > 0 ? (
        <>
          <View style={styles.divider} />
          <DecliningFactorsList
            factors={vhi.decliningFactors}
            isRTL={isRTL}
            onAskNora={onAskNora}
          />
        </>
      ) : null}

      {/* ── Score Explanation Sheet ── */}
      <Modal
        visible={showExplanation}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExplanation(false)}
      >
        <ScoreExplanationSheet
          vhi={vhi}
          isRTL={isRTL}
          expandedDeclining={expandedDeclining}
          setExpandedDeclining={setExpandedDeclining}
          onClose={() => setShowExplanation(false)}
          onAskNora={onAskNora}
        />
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline sub-components (no separate files needed)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the colour for a score on the 0–100 health scale. */
function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

/** Returns the colour for a risk bar (lower risk = green). */
function riskBarColor(riskScore: number): string {
  if (riskScore > 70) return "#ef4444";
  if (riskScore >= 40) return "#f59e0b";
  return "#22c55e";
}

/** Horizontal risk bar — inline, no separate file. */
function RiskBar({ value, label, isRTL }: { value: number; label: string; isRTL: boolean }) {
  const filled = Math.min(100, Math.max(0, Math.round(value)));
  const color = riskBarColor(filled);
  return (
    <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <Text style={{ fontSize: 13, color: "#e5e7eb", width: 120, textAlign: isRTL ? "right" : "left" }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 7, backgroundColor: "#1f2937", borderRadius: 4, overflow: "hidden" }}>
        <View style={{ width: `${filled}%`, height: 7, backgroundColor: color, borderRadius: 4 }} />
      </View>
      <Text style={{ fontSize: 12, color, width: 40, textAlign: isRTL ? "left" : "right" }}>
        {filled}
      </Text>
    </View>
  );
}

/** Full-screen sheet rendered inside the Modal. */
function ScoreExplanationSheet({
  vhi,
  isRTL,
  expandedDeclining,
  setExpandedDeclining,
  onClose,
  onAskNora,
}: {
  vhi: VirtualHealthIdentity;
  isRTL: boolean;
  expandedDeclining: number[];
  setExpandedDeclining: Dispatch<SetStateAction<number[]>>;
  onClose: () => void;
  onAskNora?: (prompt: string) => void;
}) {
  const score = Math.round(vhi.currentState.overallScore);
  const color = scoreColor(score);

  const scoreRangeLabel =
    score >= 80
      ? isRTL ? "ممتاز (خطر منخفض)" : "Excellent (low risk)"
      : score >= 60
      ? isRTL ? "جيد (خطر قابل للإدارة)" : "Good (manageable risk)"
      : score >= 40
      ? isRTL ? "مقبول (خطر متوسط)" : "Fair (moderate risk)"
      : isRTL ? "يحتاج انتباهاً (خطر مرتفع)" : "Needs attention (high risk)";

  const topElevating = vhi.elevatingFactors.slice(0, 3);
  const topDeclining = vhi.decliningFactors.slice(0, 3);

  const riskScores = vhi.currentState.riskScores;

  const toggleDeclined = (idx: number) => {
    setExpandedDeclining((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const impactBadgeColor = (impact: "high" | "medium" | "low") =>
    impact === "high" ? "#ef4444" : impact === "medium" ? "#f59e0b" : "#6b7280";

  return (
    <View style={exStyles.sheet}>
      {/* Header */}
      <View style={[exStyles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={exStyles.closeBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={exStyles.headerTitle}>
          {isRTL ? "شرح درجة الصحة" : "Health Score Explained"}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={exStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Score badge ── */}
        <View style={[exStyles.section, { alignItems: "center" }]}>
          <View style={[exStyles.scoreBadge, { borderColor: color, backgroundColor: color + "22" }]}>
            <Text style={{ fontSize: 42, fontWeight: "700", color, lineHeight: 48 }}>
              {score}
            </Text>
            <Text style={{ fontSize: 14, color: "#9ca3af" }}>/100</Text>
          </View>
          <Text style={[exStyles.scoreBadgeLabel, { color }]}>{scoreRangeLabel}</Text>
        </View>

        <View style={exStyles.divider} />

        {/* ── Scale legend ── */}
        <View style={exStyles.section}>
          <Text style={[exStyles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "ماذا تعني الدرجات؟" : "What do the ranges mean?"}
          </Text>
          {[
            { range: "80–100", label: isRTL ? "ممتاز — خطر منخفض" : "Excellent — low risk", c: "#22c55e" },
            { range: "60–79", label: isRTL ? "جيد — خطر قابل للإدارة" : "Good — manageable risk", c: "#3b82f6" },
            { range: "40–59", label: isRTL ? "مقبول — خطر متوسط" : "Fair — moderate risk", c: "#f59e0b" },
            { range: "0–39",  label: isRTL ? "يحتاج انتباهاً — خطر مرتفع" : "Needs attention — high risk", c: "#ef4444" },
          ].map(({ range, label, c }) => (
            <View
              key={range}
              style={[
                exStyles.legendRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
                score >= parseInt(range) && score <= parseInt(range.split("–")[1] ?? "100")
                  ? { backgroundColor: c + "22", borderRadius: 6 }
                  : null,
              ]}
            >
              <View style={[exStyles.legendDot, { backgroundColor: c }]} />
              <Text style={{ fontSize: 12, color: "#e5e7eb", flex: 1, textAlign: isRTL ? "right" : "left" }}>
                <Text style={{ color: c, fontWeight: "600" }}>{range}</Text>{"  "}{label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Elevating factors ── */}
        {topElevating.length > 0 && (
          <>
            <View style={exStyles.divider} />
            <View style={exStyles.section}>
              <Text style={[exStyles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "ما يساعد درجتك" : "What's helping your score"}
              </Text>
              {topElevating.map((f, idx) => (
                <View
                  key={idx}
                  style={[exStyles.factorRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
                >
                  <Text style={{ fontSize: 15, color: "#22c55e", marginTop: 1 }}>✓</Text>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontSize: 13, color: "#f3f4f6", fontWeight: "600", textAlign: isRTL ? "right" : "left" }}>
                      {f.factor}
                    </Text>
                    <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", gap: 6, flexWrap: "wrap" }]}>
                      <View style={[exStyles.badge, { backgroundColor: "#374151" }]}>
                        <Text style={{ fontSize: 10, color: "#9ca3af" }}>{f.category}</Text>
                      </View>
                      <View style={[exStyles.badge, { backgroundColor: impactBadgeColor(f.impact) + "33" }]}>
                        <Text style={{ fontSize: 10, color: impactBadgeColor(f.impact), fontWeight: "700" }}>
                          {f.impact.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Declining factors ── */}
        {topDeclining.length > 0 && (
          <>
            <View style={exStyles.divider} />
            <View style={exStyles.section}>
              <Text style={[exStyles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>
                {isRTL ? "ما يضر درجتك" : "What's hurting your score"}
              </Text>
              {topDeclining.map((f, idx) => {
                const isExpanded = expandedDeclining.includes(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.85}
                    onPress={() => toggleDeclined(idx)}
                    style={[exStyles.factorRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
                  >
                    <Text style={{ fontSize: 15, color: "#ef4444", marginTop: 1 }}>✗</Text>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ fontSize: 13, color: "#f3f4f6", fontWeight: "600", textAlign: isRTL ? "right" : "left" }}>
                        {f.factor}
                      </Text>
                      <View style={[{ flexDirection: isRTL ? "row-reverse" : "row", gap: 6, flexWrap: "wrap" }]}>
                        <View style={[exStyles.badge, { backgroundColor: "#374151" }]}>
                          <Text style={{ fontSize: 10, color: "#9ca3af" }}>{f.category}</Text>
                        </View>
                        <View style={[exStyles.badge, { backgroundColor: impactBadgeColor(f.impact) + "33" }]}>
                          <Text style={{ fontSize: 10, color: impactBadgeColor(f.impact), fontWeight: "700" }}>
                            {f.impact.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      {f.recommendation ? (
                        <Text
                          style={{ fontSize: 12, color: "#6b7280", marginTop: 2, textAlign: isRTL ? "right" : "left" }}
                          numberOfLines={isExpanded ? undefined : 1}
                        >
                          {isRTL ? "→ " : "→ "}{f.recommendation}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* ── Risk breakdown ── */}
        <View style={exStyles.divider} />
        <View style={exStyles.section}>
          <Text style={[exStyles.sectionTitle, { textAlign: isRTL ? "right" : "left" }]}>
            {isRTL ? "تفاصيل المخاطر" : "Risk Breakdown"}
          </Text>
          <RiskBar
            value={riskScores.fallRisk.score}
            label={isRTL ? "خطر السقوط" : "Fall Risk"}
            isRTL={isRTL}
          />
          <RiskBar
            value={riskScores.adherenceRisk.score}
            label={isRTL ? "خطر الالتزام" : "Adherence Risk"}
            isRTL={isRTL}
          />
          <RiskBar
            value={riskScores.deteriorationRisk.score}
            label={isRTL ? "خطر التدهور" : "Deterioration Risk"}
            isRTL={isRTL}
          />
        </View>

        {/* ── Ask Nora ── */}
        {onAskNora && (
          <>
            <View style={exStyles.divider} />
            <View style={[exStyles.section, { alignItems: "center" }]}>
              <TouchableOpacity
                style={exStyles.askNoraBtn}
                activeOpacity={0.8}
                onPress={() => {
                  onAskNora(
                    `Why is my health score ${score}? Explain what's driving it.`
                  );
                  onClose();
                }}
              >
                <Text style={exStyles.askNoraBtnText}>
                  {isRTL ? "اسأل نورة" : "Ask Nora to explain this"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = {
  loadingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    padding: 16,
  } as ViewStyle,
  emptyCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  } as ViewStyle,
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  } as ViewStyle,
  riskRow: {
    gap: 8,
    marginTop: 12,
  } as ViewStyle,
  riskChip: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.04)",
  } as ViewStyle,
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
    marginVertical: 12,
  } as ViewStyle,
  baselineBuilding: {
    paddingVertical: 8,
  } as ViewStyle,
  baselineBuildingTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#003543",
    marginBottom: 4,
  },
  baselineBuildingSubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 10,
  },
  baselineProgress: {
    height: 6,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 3,
    overflow: "hidden" as const,
  } as ViewStyle,
  baselineProgressFill: {
    height: 6,
    backgroundColor: "#003543",
    borderRadius: 3,
  } as ViewStyle,
  buildingProfileContainer: {
    padding: 16,
    alignItems: "center" as const,
    gap: 8,
  } as ViewStyle,
  buildingTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#e5e7eb",
    textAlign: "center" as const,
  },
  buildingSubtext: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center" as const,
  },
  progressBarTrack: {
    width: "100%" as const,
    height: 6,
    backgroundColor: "#374151",
    borderRadius: 3,
    overflow: "hidden" as const,
  } as ViewStyle,
  progressBarFill: {
    height: 6,
    backgroundColor: "#3b82f6",
    borderRadius: 3,
  } as ViewStyle,
  buildingNote: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center" as const,
  },
  uncertaintyNote: {
    fontSize: 11,
    color: "#f59e0b",
    textAlign: "center" as const,
    marginTop: 4,
  },
  whyLink: {
    alignSelf: "center" as const,
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  } as ViewStyle,
  whyLinkText: {
    fontSize: 12,
    textDecorationLine: "underline" as const,
    textAlign: "center" as const,
  },
};

// ── Styles for the explanation sheet (dark modal) ────────────────────────────
const exStyles = {
  sheet: {
    flex: 1,
    backgroundColor: "#0f0f1a",
  } as ViewStyle,
  header: {
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  } as ViewStyle,
  closeBtn: {
    fontSize: 18,
    color: "#9ca3af",
    width: 32,
    textAlign: "center" as const,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#f9fafb",
    flex: 1,
    textAlign: "center" as const,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  } as ViewStyle,
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#9ca3af",
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#1f2937",
    marginHorizontal: 20,
  } as ViewStyle,
  scoreBadge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 10,
  } as ViewStyle,
  scoreBadgeLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    textAlign: "center" as const,
  },
  legendRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    paddingVertical: 5,
    paddingHorizontal: 4,
    marginBottom: 2,
  } as ViewStyle,
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  } as ViewStyle,
  factorRow: {
    gap: 10,
    alignItems: "flex-start" as const,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  } as ViewStyle,
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  } as ViewStyle,
  askNoraBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center" as const,
    minWidth: 240,
  } as ViewStyle,
  askNoraBtnText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
};
