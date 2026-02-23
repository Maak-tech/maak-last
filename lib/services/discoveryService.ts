/**
 * Unified Discovery Service
 *
 * Aggregates all discovery types into a single feed so components don't need
 * to call multiple services. Currently merges correlation discoveries; the
 * architecture is ready for symptom-pattern / vital-trend / medication-
 * effectiveness types as those pipelines mature.
 */

import { correlationDiscoveryService } from "./correlationDiscoveryService";
import type { HealthDiscovery } from "@/types/discoveries";

export type DiscoveryType =
  | "correlation"
  | "symptom_pattern"
  | "vital_trend"
  | "medication_effectiveness";

export type EnrichedDiscovery = HealthDiscovery & {
  discoveryType: DiscoveryType;
};

/** Get all non-dismissed discoveries for a user, newest first */
export async function getAllDiscoveries(
  userId: string,
  _isArabic = false
): Promise<EnrichedDiscovery[]> {
  try {
    const result =
      await correlationDiscoveryService.refreshDiscoveries(userId, 30);

    const correlations: EnrichedDiscovery[] = (result.discoveries ?? [])
      .filter((d) => d.status !== "dismissed")
      .map((d) => ({ ...d, discoveryType: "correlation" as DiscoveryType }));

    // Sort newest first
    correlations.sort(
      (a, b) =>
        new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime()
    );

    return correlations;
  } catch {
    return [];
  }
}

/**
 * Get top N discoveries for the home screen — new items first, then by
 * confidence score.
 */
export async function getTopDiscoveries(
  userId: string,
  maxCount = 5,
  isArabic = false
): Promise<EnrichedDiscovery[]> {
  const all = await getAllDiscoveries(userId, isArabic);
  return all
    .sort((a, b) => {
      if (a.status === "new" && b.status !== "new") return -1;
      if (b.status === "new" && a.status !== "new") return 1;
      return b.confidence - a.confidence;
    })
    .slice(0, maxCount);
}

export const discoveryService = {
  getAllDiscoveries,
  getTopDiscoveries,
};
