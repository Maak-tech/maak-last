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

import { useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View, type ViewStyle } from "react-native";
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

  // Resolved values — prefer prop over internal state
  const vhi = vhiProp !== undefined ? vhiProp : internalVhi;
  const loading = vhiProp !== undefined
    ? (loadingProp ?? false)
    : internalLoading;

  // Only fetch internally when the parent has NOT provided a vhi prop
  useEffect(() => {
    if (vhiProp !== undefined) return; // Parent controls data — skip internal fetch
    api
      .get<VHIResponse>("/api/vhi/me")
      .then((res) => {
        setInternalVhi(res?.data ?? null);
      })
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) {
          console.warn("[VHIPanel]", err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => setInternalLoading(false));
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

  // Fix 4: recompute handler
  const handleRecompute = async () => {
    if (isRecomputing) return;
    setIsRecomputing(true);
    try {
      await api.post("/api/vhi/me/recompute", {});
      setTimeout(() => {
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

      {/* Fix 3: Overall Score with baseline confidence gate */}
      {hasEnoughBaseline ? (
        <VHIOverallScore
          changeCount={vhi.decliningFactors.length + vhi.elevatingFactors.length}
          isRTL={isRTL}
          score={vhi.currentState.overallScore}
          trajectory={trajectory}
        />
      ) : (
        <View style={styles.baselineBuilding}>
          <Text style={styles.baselineBuildingTitle}>
            {isRTL ? "جاري بناء خط الأساس الصحي" : "Building your health baseline"}
          </Text>
          <Text style={styles.baselineBuildingSubtitle}>
            {isRTL
              ? "استمر في تسجيل بياناتك — ستظهر درجتك الصحية الشخصية خلال أيام قليلة."
              : "Keep logging data — your personalized health score will appear in a few days."}
          </Text>
          <View style={styles.baselineProgress}>
            <View style={[styles.baselineProgressFill, { width: `${Math.round(baselineConfidence * 100)}%` }]} />
          </View>
        </View>
      )}

      {/* Risk sub-scores row */}
      {compositeRisk > 0 && (
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
};
