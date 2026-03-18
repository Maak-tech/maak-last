/**
 * Elevating / Declining Factor Service (client-side)
 *
 * Utility service for sorting, filtering, grouping, and formatting the
 * `elevatingFactors` and `decliningFactors` arrays from a user's Virtual
 * Health Identity.
 *
 * The server synthesises these factor lists every 15 minutes in `vhiCycle.ts`.
 * This service does NOT compute factors — it only reads, organises, and formats
 * them for display and Nora's context injection.
 *
 * Factor categories:
 *   - genetic      → DNA / PRS / pharmacogenomics
 *   - behavioral   → medication adherence, sleep, activity, mood
 *   - clinical     → lab results, doctor notes, diagnoses
 *   - environmental → external signals (future use)
 */

import type {
  ElevatingFactor,
  DecliningFactor,
} from "@/lib/services/vhiService";
import type { VHI } from "@/lib/services/vhiService";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FactorCategory = "genetic" | "behavioral" | "clinical" | "environmental";
export type FactorImpact   = "high" | "medium" | "low";

export type GroupedElevatingFactors = Record<FactorCategory, ElevatingFactor[]>;
export type GroupedDecliningFactors = Record<FactorCategory, DecliningFactor[]>;

export type FactorDisplayItem<T> = T & {
  /** Hex colour code for impact level */
  color: string;
  /** Icon name hint for the UI (maps to lucide-react-native) */
  iconHint: "trending-up" | "trending-down" | "dna" | "heart-pulse" | "pill" | "activity" | "alert-triangle";
};

// ── Constants ─────────────────────────────────────────────────────────────────

const IMPACT_WEIGHT: Record<FactorImpact, number> = {
  high:   3,
  medium: 2,
  low:    1,
};

// ── Sorting ───────────────────────────────────────────────────────────────────

/**
 * Sort elevating factors: HIGH impact first, then MEDIUM, then LOW.
 * Within the same impact level, preserve original order (server-ranked).
 */
export function sortElevatingFactors(
  factors: ElevatingFactor[]
): ElevatingFactor[] {
  return [...factors].sort(
    (a, b) => IMPACT_WEIGHT[b.impact] - IMPACT_WEIGHT[a.impact]
  );
}

/**
 * Sort declining factors: HIGH impact first, then MEDIUM, then LOW.
 */
export function sortDecliningFactors(
  factors: DecliningFactor[]
): DecliningFactor[] {
  return [...factors].sort(
    (a, b) => IMPACT_WEIGHT[b.impact] - IMPACT_WEIGHT[a.impact]
  );
}

// ── Filtering ─────────────────────────────────────────────────────────────────

export function filterByImpact<T extends { impact: FactorImpact }>(
  factors: T[],
  impact: FactorImpact
): T[] {
  return factors.filter((f) => f.impact === impact);
}

export function filterByCategory<T extends { category: FactorCategory }>(
  factors: T[],
  category: FactorCategory
): T[] {
  return factors.filter((f) => f.category === category);
}

/** Return only high- and medium-impact items (exclude low for compact views). */
export function filterSignificant<T extends { impact: FactorImpact }>(
  factors: T[]
): T[] {
  return factors.filter((f) => f.impact === "high" || f.impact === "medium");
}

// ── Grouping ──────────────────────────────────────────────────────────────────

export function groupElevatingByCategory(
  factors: ElevatingFactor[]
): GroupedElevatingFactors {
  const empty: GroupedElevatingFactors = {
    genetic: [],
    behavioral: [],
    clinical: [],
    environmental: [],
  };
  return factors.reduce((acc, f) => {
    acc[f.category].push(f);
    return acc;
  }, empty);
}

export function groupDecliningByCategory(
  factors: DecliningFactor[]
): GroupedDecliningFactors {
  const empty: GroupedDecliningFactors = {
    genetic: [],
    behavioral: [],
    clinical: [],
    environmental: [],
  };
  return factors.reduce((acc, f) => {
    acc[f.category].push(f);
    return acc;
  }, empty);
}

// ── Display helpers ───────────────────────────────────────────────────────────

type ColorSet = { error: string; warning: string; success: string; info?: string };

function impactColorForElevating(impact: FactorImpact, colors: ColorSet): string {
  switch (impact) {
    case "high":   return colors.success;
    case "medium": return colors.info ?? "#6366F1"; // indigo fallback
    case "low":    return colors.info ?? "#6366F1";
  }
}

function impactColorForDeclining(impact: FactorImpact, colors: ColorSet): string {
  switch (impact) {
    case "high":   return colors.error;
    case "medium": return colors.warning;
    case "low":    return colors.info ?? "#6366F1";
  }
}

function iconHintForCategory(
  category: FactorCategory,
  isElevating: boolean
): FactorDisplayItem<ElevatingFactor>["iconHint"] {
  if (category === "genetic") return "dna";
  if (category === "clinical") return "heart-pulse";
  if (category === "behavioral") return isElevating ? "trending-up" : "pill";
  return "activity";
}

/**
 * Annotate elevating factors with a colour and icon hint for rendering.
 */
export function toElevatingDisplayItems(
  factors: ElevatingFactor[],
  colors: ColorSet
): FactorDisplayItem<ElevatingFactor>[] {
  return sortElevatingFactors(factors).map((f) => ({
    ...f,
    color: impactColorForElevating(f.impact, colors),
    iconHint: iconHintForCategory(f.category, true),
  }));
}

/**
 * Annotate declining factors with a colour and icon hint for rendering.
 */
export function toDecliningDisplayItems(
  factors: DecliningFactor[],
  colors: ColorSet
): FactorDisplayItem<DecliningFactor>[] {
  return sortDecliningFactors(factors).map((f) => ({
    ...f,
    color: impactColorForDeclining(f.impact, colors),
    iconHint: f.impact === "high" ? "alert-triangle" : iconHintForCategory(f.category, false),
  }));
}

// ── VHI extraction ────────────────────────────────────────────────────────────

/**
 * Extract elevating factors from a VHI object.
 * Returns an empty array if the VHI is null or has no factors.
 */
export function getElevatingFactors(vhi: VHI | null): ElevatingFactor[] {
  return vhi?.data?.elevatingFactors ?? [];
}

/**
 * Extract declining factors from a VHI object.
 * Returns an empty array if the VHI is null or has no factors.
 */
export function getDecliningFactors(vhi: VHI | null): DecliningFactor[] {
  return vhi?.data?.decliningFactors ?? [];
}

/**
 * Return the top N elevating factors sorted by impact.
 */
export function getTopElevating(vhi: VHI | null, limit = 3): ElevatingFactor[] {
  return sortElevatingFactors(getElevatingFactors(vhi)).slice(0, limit);
}

/**
 * Return the top N declining factors sorted by impact.
 */
export function getTopDeclining(vhi: VHI | null, limit = 3): DecliningFactor[] {
  return sortDecliningFactors(getDecliningFactors(vhi)).slice(0, limit);
}

/**
 * True if any declining factor has `impact === "high"`.
 * Used to gate urgent alerts / red banners.
 */
export function hasHighImpactDeclining(vhi: VHI | null): boolean {
  return getDecliningFactors(vhi).some((f) => f.impact === "high");
}

/**
 * Count factors by category across both elevating and declining lists.
 * Useful for a "health signals" breakdown view.
 */
export function countByCategory(vhi: VHI | null): Record<FactorCategory, { elevating: number; declining: number }> {
  const result: Record<FactorCategory, { elevating: number; declining: number }> = {
    genetic:     { elevating: 0, declining: 0 },
    behavioral:  { elevating: 0, declining: 0 },
    clinical:    { elevating: 0, declining: 0 },
    environmental: { elevating: 0, declining: 0 },
  };

  for (const f of getElevatingFactors(vhi)) result[f.category].elevating++;
  for (const f of getDecliningFactors(vhi)) result[f.category].declining++;

  return result;
}

// ── Singleton-style default export ────────────────────────────────────────────

const elevatingDecliningService = {
  // Sorting
  sortElevating:  sortElevatingFactors,
  sortDeclining:  sortDecliningFactors,

  // Filtering
  filterByImpact,
  filterByCategory,
  filterSignificant,

  // Grouping
  groupElevatingByCategory,
  groupDecliningByCategory,

  // Display
  toElevatingDisplayItems,
  toDecliningDisplayItems,

  // VHI extraction
  getElevating:      getElevatingFactors,
  getDeclining:      getDecliningFactors,
  getTopElevating,
  getTopDeclining,
  hasHighImpactDeclining,
  countByCategory,
};

export default elevatingDecliningService;
