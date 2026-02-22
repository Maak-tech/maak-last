/**
 * Correlation Discovery Service
 *
 * Orchestrates correlation computation via correlationAnalysisService,
 * persists discoveries to Firestore, detects new/changed discoveries,
 * and manages discovery lifecycle (new → seen → dismissed).
 */

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logger } from "@/lib/utils/logger";
import type {
  DiscoveryCategory,
  DiscoveryFilter,
  DiscoveryRefreshResult,
  DiscoveryStatus,
  HealthDiscovery,
} from "@/types/discoveries";
import {
  type CorrelationResult,
  correlationAnalysisService,
} from "./correlationAnalysisService";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CONFIDENCE_CHANGE_THRESHOLD = 15; // reset to "new" if confidence changes by 15+

class CorrelationDiscoveryService {
  private cache: Map<string, HealthDiscovery[]> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();

  /**
   * Get the Firestore subcollection path for a user's discoveries
   */
  private getCollectionRef(userId: string) {
    return collection(db, "users", userId, "discoveries");
  }

  /**
   * Generate a stable key for a correlation result to deduplicate
   */
  private getDiscoveryKey(
    category: string,
    factor1: string,
    factor2: string
  ): string {
    const sorted = [factor1, factor2].sort();
    return `${category}_${sorted[0]}_${sorted[1]}`;
  }

  /**
   * Check if the in-memory cache is still valid
   */
  private isCacheValid(userId: string): boolean {
    const timestamp = this.cacheTimestamps.get(userId);
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_TTL_MS;
  }

  /**
   * Convert a CorrelationResult from the analysis service into a HealthDiscovery
   */
  private correlationToDiscovery(
    userId: string,
    result: CorrelationResult,
    periodDays: number
  ): Omit<HealthDiscovery, "id" | "status" | "discoveredAt" | "lastUpdatedAt"> {
    return {
      userId,
      category: result.type as DiscoveryCategory,
      title: this.generateTitle(result),
      description: result.description,
      strength: result.strength,
      confidence: result.confidence,
      actionable: result.actionable,
      recommendation: result.recommendation,
      dataPoints:
        (result.data.supportingData as { sampleSize?: number })?.sampleSize ??
        0,
      periodDays,
      factor1: result.data.factor1,
      factor2: result.data.factor2,
    };
  }

  /**
   * Generate a concise title for a correlation
   */
  private generateTitle(result: CorrelationResult): string {
    const { factor1, factor2 } = result.data;
    switch (result.type) {
      case "symptom_medication":
        return `${factor1} & ${factor2}`;
      case "symptom_mood":
        return `${factor1} & Mood`;
      case "symptom_vital":
        return `${factor1} & ${factor2}`;
      case "medication_vital":
        return `${factor1} & ${factor2}`;
      case "mood_vital":
        return `Mood & ${factor2}`;
      case "temporal_pattern":
        return `${factor1} timing pattern`;
      default:
        return `${factor1} & ${factor2}`;
    }
  }

  /**
   * Refresh discoveries by running correlation analysis and persisting results.
   * Compares new results against existing discoveries for deduplication.
   */
  async refreshDiscoveries(
    userId: string,
    isArabic = false
  ): Promise<DiscoveryRefreshResult> {
    try {
      // Run correlation analysis (the heavy computation)
      const [insight, insightAr] = await Promise.all([
        correlationAnalysisService.generateCorrelationAnalysis(
          userId,
          90,
          false
        ),
        isArabic
          ? correlationAnalysisService.generateCorrelationAnalysis(
              userId,
              90,
              true
            )
          : Promise.resolve(null),
      ]);

      if (!insight || insight.correlationResults.length === 0) {
        return {
          discoveries: await this.getDiscoveries(userId),
          newCount: 0,
          updatedCount: 0,
          hasNewActionable: false,
        };
      }

      // Load existing discoveries for comparison
      const existing = await this.loadFromFirestore(userId);
      const existingByKey = new Map<string, HealthDiscovery>();
      for (const d of existing) {
        const key = this.getDiscoveryKey(d.category, d.factor1, d.factor2);
        existingByKey.set(key, d);
      }

      const now = new Date();
      let newCount = 0;
      let updatedCount = 0;
      let hasNewActionable = false;
      const processedKeys = new Set<string>();

      // Process each correlation result
      for (let i = 0; i < insight.correlationResults.length; i++) {
        const result = insight.correlationResults[i];
        const arResult = insightAr?.correlationResults[i];
        const key = this.getDiscoveryKey(
          result.type,
          result.data.factor1,
          result.data.factor2
        );
        processedKeys.add(key);

        const base = this.correlationToDiscovery(userId, result, 90);
        const existingDoc = existingByKey.get(key);

        if (existingDoc) {
          // Update existing discovery
          const confidenceChanged =
            Math.abs(existingDoc.confidence - result.confidence) >=
            CONFIDENCE_CHANGE_THRESHOLD;
          const status: DiscoveryStatus = confidenceChanged
            ? "new"
            : existingDoc.status;

          const updated: HealthDiscovery = {
            ...existingDoc,
            ...base,
            id: existingDoc.id,
            status,
            discoveredAt: existingDoc.discoveredAt,
            lastUpdatedAt: now,
            titleAr: arResult?.description
              ? this.generateTitle(arResult)
              : existingDoc.titleAr,
            descriptionAr: arResult?.description ?? existingDoc.descriptionAr,
            recommendationAr:
              arResult?.recommendation ?? existingDoc.recommendationAr,
          };

          await this.saveToFirestore(userId, updated);
          if (confidenceChanged) {
            updatedCount++;
            if (updated.actionable) hasNewActionable = true;
          }
        } else {
          // New discovery
          const discovery: HealthDiscovery = {
            ...base,
            id: key,
            status: "new",
            discoveredAt: now,
            lastUpdatedAt: now,
            titleAr: arResult ? this.generateTitle(arResult) : undefined,
            descriptionAr: arResult?.description,
            recommendationAr: arResult?.recommendation,
          };

          await this.saveToFirestore(userId, discovery);
          newCount++;
          if (discovery.actionable) hasNewActionable = true;
        }
      }

      // Invalidate cache after refresh
      this.cache.delete(userId);
      this.cacheTimestamps.delete(userId);

      const discoveries = await this.getDiscoveries(userId);
      return { discoveries, newCount, updatedCount, hasNewActionable };
    } catch (error) {
      logger.error(
        "Failed to refresh discoveries",
        { userId, error },
        "CorrelationDiscovery"
      );
      return {
        discoveries: await this.getDiscoveries(userId).catch(() => []),
        newCount: 0,
        updatedCount: 0,
        hasNewActionable: false,
      };
    }
  }

  /**
   * Get all discoveries for a user, optionally filtered
   */
  async getDiscoveries(
    userId: string,
    filter?: DiscoveryFilter
  ): Promise<HealthDiscovery[]> {
    if (!filter && this.isCacheValid(userId)) {
      return this.cache.get(userId) || [];
    }

    let discoveries = await this.loadFromFirestore(userId);

    if (filter) {
      if (filter.category) {
        discoveries = discoveries.filter((d) => d.category === filter.category);
      }
      if (filter.minConfidence !== undefined) {
        discoveries = discoveries.filter(
          (d) => d.confidence >= (filter.minConfidence ?? 0)
        );
      }
      if (filter.status) {
        discoveries = discoveries.filter((d) => d.status === filter.status);
      }
      if (filter.actionableOnly) {
        discoveries = discoveries.filter((d) => d.actionable);
      }
    }

    if (!filter) {
      this.cache.set(userId, discoveries);
      this.cacheTimestamps.set(userId, Date.now());
    }

    return discoveries;
  }

  /**
   * Get top N discoveries sorted by relevance score (|strength| × confidence)
   */
  async getTopDiscoveries(
    userId: string,
    count = 3
  ): Promise<HealthDiscovery[]> {
    const discoveries = await this.getDiscoveries(userId);
    return discoveries
      .filter((d) => d.status !== "dismissed" && d.actionable)
      .sort(
        (a, b) =>
          Math.abs(b.strength) * b.confidence -
          Math.abs(a.strength) * a.confidence
      )
      .slice(0, count);
  }

  /**
   * Get discoveries that are newer than a given date (for Zeina proactive messaging)
   */
  async getNewDiscoveriesSince(
    userId: string,
    since: Date
  ): Promise<HealthDiscovery[]> {
    const discoveries = await this.getDiscoveries(userId);
    return discoveries
      .filter(
        (d) =>
          d.status === "new" &&
          d.discoveredAt.getTime() > since.getTime() &&
          d.confidence >= 60
      )
      .sort(
        (a, b) =>
          Math.abs(b.strength) * b.confidence -
          Math.abs(a.strength) * a.confidence
      );
  }

  /**
   * Mark a discovery as seen
   */
  async markAsSeen(userId: string, discoveryId: string): Promise<void> {
    try {
      const docRef = doc(this.getCollectionRef(userId), discoveryId);
      await setDoc(docRef, { status: "seen" }, { merge: true });
      // Update cache
      const cached = this.cache.get(userId);
      if (cached) {
        const idx = cached.findIndex((d) => d.id === discoveryId);
        if (idx !== -1) cached[idx].status = "seen";
      }
    } catch (error) {
      logger.error(
        "Failed to mark discovery as seen",
        { userId, discoveryId, error },
        "CorrelationDiscovery"
      );
    }
  }

  /**
   * Mark a discovery as dismissed
   */
  async markAsDismissed(userId: string, discoveryId: string): Promise<void> {
    try {
      const docRef = doc(this.getCollectionRef(userId), discoveryId);
      await setDoc(docRef, { status: "dismissed" }, { merge: true });
      // Update cache
      const cached = this.cache.get(userId);
      if (cached) {
        const idx = cached.findIndex((d) => d.id === discoveryId);
        if (idx !== -1) cached[idx].status = "dismissed";
      }
    } catch (error) {
      logger.error(
        "Failed to dismiss discovery",
        { userId, discoveryId, error },
        "CorrelationDiscovery"
      );
    }
  }

  // ─── Private Firestore Helpers ──────────────────────────────────────────

  private async loadFromFirestore(userId: string): Promise<HealthDiscovery[]> {
    try {
      const q = query(
        this.getCollectionRef(userId),
        orderBy("lastUpdatedAt", "desc")
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          ...data,
          id: docSnap.id,
          discoveredAt: data.discoveredAt?.toDate?.() ?? new Date(),
          lastUpdatedAt: data.lastUpdatedAt?.toDate?.() ?? new Date(),
          notifiedAt: data.notifiedAt?.toDate?.() ?? undefined,
        } as HealthDiscovery;
      });
    } catch (error) {
      logger.error(
        "Failed to load discoveries from Firestore",
        { userId, error },
        "CorrelationDiscovery"
      );
      return [];
    }
  }

  private async saveToFirestore(
    userId: string,
    discovery: HealthDiscovery
  ): Promise<void> {
    try {
      const docRef = doc(this.getCollectionRef(userId), discovery.id);
      const { id, ...data } = discovery;
      await setDoc(docRef, {
        ...data,
        discoveredAt: Timestamp.fromDate(discovery.discoveredAt),
        lastUpdatedAt: Timestamp.fromDate(discovery.lastUpdatedAt),
        ...(discovery.notifiedAt
          ? { notifiedAt: Timestamp.fromDate(discovery.notifiedAt) }
          : {}),
      });
    } catch (error) {
      logger.error(
        "Failed to save discovery to Firestore",
        { userId, discoveryId: discovery.id, error },
        "CorrelationDiscovery"
      );
    }
  }

  /**
   * Mark a discovery as notified (to prevent duplicate notifications)
   */
  async markAsNotified(userId: string, discoveryId: string): Promise<void> {
    try {
      const docRef = doc(this.getCollectionRef(userId), discoveryId);
      await setDoc(
        docRef,
        { notifiedAt: Timestamp.fromDate(new Date()) },
        { merge: true }
      );
    } catch (error) {
      logger.error(
        "Failed to mark discovery as notified",
        { userId, discoveryId, error },
        "CorrelationDiscovery"
      );
    }
  }
}

export const correlationDiscoveryService = new CorrelationDiscoveryService();
