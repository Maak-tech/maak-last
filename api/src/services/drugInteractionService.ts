/**
 * Drug interaction service — checks a new medication against the user's active
 * medications using the OpenFDA Drug Interactions API.
 *
 * This is a WARN-only service: it returns potential interactions so the API
 * can include them in the response and push a notification. It never blocks
 * a medication from being added — clinical decisions belong to clinicians.
 *
 * OpenFDA endpoint: https://api.fda.gov/drug/label.json?search=drug_interactions:"drugname"
 * No API key required for ≤240 req/min.
 */

export type DrugInteraction = {
  drug: string;
  interactionText: string;
  severity: 'major' | 'moderate' | 'minor' | 'unknown';
};

// Simple in-memory cache: drugName → interactions array, TTL 1 hour
const cache = new Map<string, { data: DrugInteraction[]; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function checkDrugInteractions(
  newDrugName: string,
  existingDrugNames: string[]
): Promise<DrugInteraction[]> {
  if (!existingDrugNames.length) return [];

  const cacheKey = newDrugName.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    // Query OpenFDA for the new drug's label interactions section
    const query = encodeURIComponent(`"${newDrugName}"`);
    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${query}+AND+drug_interactions:*&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return [];

    const data = await res.json() as { results?: Array<{ drug_interactions?: string[] }> };
    const interactionText = data.results?.[0]?.drug_interactions?.[0] ?? '';

    if (!interactionText) {
      cache.set(cacheKey, { data: [], expiresAt: Date.now() + CACHE_TTL_MS });
      return [];
    }

    // Check which of the existing drugs are mentioned in the interaction text
    const interactions: DrugInteraction[] = [];
    for (const existing of existingDrugNames) {
      if (interactionText.toLowerCase().includes(existing.toLowerCase())) {
        interactions.push({
          drug: existing,
          interactionText: interactionText.slice(0, 500),
          severity: 'unknown', // OpenFDA free-text doesn't categorize severity
        });
      }
    }

    cache.set(cacheKey, { data: interactions, expiresAt: Date.now() + CACHE_TTL_MS });
    return interactions;
  } catch (err: unknown) {
    // Never block medication creation due to DDI check failure
    console.warn('[ddi] OpenFDA check failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}
