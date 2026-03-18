/**
 * VHI Context Injector
 *
 * Formats a user's Virtual Health Identity into a plain-text block that is
 * injected into Nora's system prompt, giving her full awareness of the user's
 * genetic baseline, current health state, elevating factors, declining factors,
 * and pending actions.
 *
 * The server already pre-computes `vhi.data.noraContextBlock` every 15 minutes.
 * This module returns that block if available, and falls back to a client-side
 * construction when the server block is absent or empty.
 *
 * Usage:
 *   const block = formatVHIForNora(vhi, "en");
 *   // Inject into healthContextService prompt as `## Virtual Health Identity`
 */

import type { VHI, VHIAction, ElevatingFactor, DecliningFactor, VHIGeneticBaseline } from "@/lib/services/vhiService";

// ── Risk level label helpers ──────────────────────────────────────────────────

function riskLabel(score: number): string {
  if (score >= 85) return "CRITICAL";
  if (score >= 75) return "HIGH";
  if (score >= 60) return "MODERATE";
  return "LOW";
}

function interactionLabel(
  interaction: "standard" | "reduced_efficacy" | "increased_toxicity" | "contraindicated"
): string {
  switch (interaction) {
    case "reduced_efficacy":   return "reduced efficacy";
    case "increased_toxicity": return "increased toxicity";
    case "contraindicated":    return "contraindicated";
    default:                   return "standard";
  }
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildGeneticSection(gb: VHIGeneticBaseline | null | undefined): string {
  if (!gb?.hasGeneticData) return "";

  const lines: string[] = ["Genetic Baseline:"];

  if (gb.prsScores.length > 0) {
    for (const prs of gb.prsScores) {
      lines.push(`  ${prs.condition}: ${prs.percentile}th percentile (${prs.level})`);
    }
  }

  const activePharm = gb.pharmacogenomics.filter((p) => p.interaction !== "standard");
  if (activePharm.length > 0) {
    lines.push("  Pharmacogenomics alerts:");
    for (const p of activePharm) {
      lines.push(`    ${p.drug} → ${interactionLabel(p.interaction)} (${p.gene})`);
    }
  }

  if (gb.protectiveVariants.length > 0) {
    lines.push(`  Protective variants: ${gb.protectiveVariants.join(", ")}`);
  }

  if (gb.riskVariants.length > 0) {
    lines.push(`  Risk variants: ${gb.riskVariants.join(", ")}`);
  }

  return lines.join("\n");
}

function buildCurrentStateSection(vhi: VHI): string {
  const rs = vhi.data.currentState.riskScores;
  const score = vhi.data.currentState.overallScore;
  const level = riskLabel(rs.compositeRisk);

  const lines: string[] = [
    `Current State: overall score ${score}/100, composite risk ${rs.compositeRisk}/100 (${level})`,
  ];

  const riskRows: Array<[string, number, string[]]> = [
    ["Fall Risk",          rs.fallRisk.score,          rs.fallRisk.drivers],
    ["Adherence Risk",     rs.adherenceRisk.score,      rs.adherenceRisk.drivers],
    ["Deterioration Risk", rs.deteriorationRisk.score,  rs.deteriorationRisk.drivers],
    ["Genetic Risk Load",  rs.geneticRiskLoad.score,    rs.geneticRiskLoad.drivers],
  ];

  for (const [label, score, drivers] of riskRows) {
    if (score > 0) {
      const driverStr = drivers.length > 0 ? ` — ${drivers.slice(0, 2).join(", ")}` : "";
      lines.push(`  ${label}: ${score}/100${driverStr}`);
    }
  }

  return lines.join("\n");
}

function buildElevatingSection(factors: ElevatingFactor[], limit = 5): string {
  if (factors.length === 0) return "";
  const lines: string[] = ["Top Elevating Factors:"];
  const sorted = [...factors].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.impact] - order[b.impact];
  });
  sorted.slice(0, limit).forEach((f, i) => {
    lines.push(`  ${i + 1}. [${f.impact.toUpperCase()}] ${f.factor} (${f.category})`);
  });
  return lines.join("\n");
}

function buildDecliningSection(factors: DecliningFactor[], limit = 5): string {
  if (factors.length === 0) return "";
  const lines: string[] = ["Top Declining Factors:"];
  const sorted = [...factors].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.impact] - order[b.impact];
  });
  sorted.slice(0, limit).forEach((f, i) => {
    lines.push(`  ${i + 1}. [${f.impact.toUpperCase()}] ${f.factor} (${f.category})`);
    if (f.recommendation) {
      lines.push(`     → ${f.recommendation}`);
    }
  });
  return lines.join("\n");
}

function buildActionsSection(actions: VHIAction[]): string {
  const pending = actions.filter((a) => !a.acknowledged);
  if (pending.length === 0) return "";
  const lines: string[] = ["Pending Actions:"];
  for (const a of pending.slice(0, 3)) {
    const dispatchedNote = a.dispatched ? "" : " (not yet dispatched)";
    lines.push(`  [${a.priority.toUpperCase()}] ${a.title}${dispatchedNote}`);
  }
  return lines.join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Format a VHI object into a plain-text context block for Nora's system prompt.
 *
 * Preference order:
 *   1. Server-computed `vhi.data.noraContextBlock` (most authoritative)
 *   2. Client-side constructed block (fallback when server block is absent)
 *
 * @param vhi      The Virtual Health Identity object from `vhiService.getMyVHI()`
 * @param language ISO 639-1 language code, e.g. "en" or "ar"
 * @returns        A formatted text block to inject under `## Virtual Health Identity`
 */
export function formatVHIForNora(vhi: VHI | null, language = "en"): string | null {
  if (!vhi?.data) return null;

  // Prefer the server-computed block — it's the most complete and up-to-date
  if (vhi.data.noraContextBlock && vhi.data.noraContextBlock.trim().length > 0) {
    return vhi.data.noraContextBlock;
  }

  // Client-side fallback — build from structured fields
  const sections: string[] = [];

  const geneticSection = buildGeneticSection(vhi.data.geneticBaseline);
  if (geneticSection) sections.push(geneticSection);

  sections.push(buildCurrentStateSection(vhi));

  const elevating = buildElevatingSection(vhi.data.elevatingFactors ?? []);
  if (elevating) sections.push(elevating);

  const declining = buildDecliningSection(vhi.data.decliningFactors ?? []);
  if (declining) sections.push(declining);

  const actions = buildActionsSection(vhi.data.pendingActions ?? []);
  if (actions) sections.push(actions);

  const computedAtNote = vhi.computedAt
    ? `\n[VHI computed at: ${new Date(vhi.computedAt).toLocaleString(language === "ar" ? "ar-SA" : "en-US")}]`
    : "";

  return sections.join("\n\n") + computedAtNote;
}

/**
 * Convenience wrapper: formats a VHI into a full `## Virtual Health Identity`
 * section ready for direct concatenation into a Nora system prompt.
 *
 * Returns `null` if no VHI is available (no DNA or health data yet).
 */
export function buildVHISystemPromptSection(
  vhi: VHI | null,
  language = "en"
): string | null {
  const block = formatVHIForNora(vhi, language);
  if (!block) return null;

  return `## Virtual Health Identity\n\n${block}`;
}
