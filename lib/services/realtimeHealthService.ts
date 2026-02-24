/**
 * Real-time Health Updates Service
 * Provides WebSocket-like real-time updates for:
 * 1. Critical trend alerts (vital signs, symptoms)
 * 2. Family member health data updates
 *
 * Uses Firestore real-time listeners (WebSocket-based) for efficient updates
 */

import {
  collection,
  type DocumentChange,
  type DocumentData,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EmergencyAlert } from "@/types";
import type {
  SymptomTrendAnalysis,
  TrendAnalysis,
} from "./trendDetectionService";

export type TrendAlert = {
  id: string;
  userId: string;
  type: "vital_trend" | "symptom_trend";
  severity: "critical" | "warning";
  trendAnalysis: TrendAnalysis | SymptomTrendAnalysis;
  timestamp: Date;
  acknowledged?: boolean;
};

export type FamilyMemberUpdate = {
  memberId: string;
  updateType:
    | "vital_added"
    | "symptom_added"
    | "alert_created"
    | "alert_resolved"
    | "medication_taken"
    | "status_change";
  data: unknown;
  timestamp: Date;
};

export type RealtimeHealthEventHandlers = {
  onTrendAlert?: (alert: TrendAlert) => void;
  onFamilyMemberUpdate?: (update: FamilyMemberUpdate) => void;
  onAlertCreated?: (alert: EmergencyAlert) => void;
  onAlertResolved?: (alertId: string, resolverId: string) => void;
  onVitalAdded?: (vital: {
    userId: string;
    type: string;
    value: number;
    timestamp: Date;
  }) => void;
  onError?: (error: Error) => void;
};

class RealtimeHealthService {
  private readonly trendAlertSubscriptions: Map<string, Unsubscribe> =
    new Map();
  private readonly familyUpdateSubscriptions: Map<string, Unsubscribe> =
    new Map();
  private readonly alertSubscriptions: Map<string, Unsubscribe> = new Map();
  private readonly vitalSubscriptions: Map<string, Unsubscribe> = new Map();
  private eventHandlers: RealtimeHealthEventHandlers = {};
  private quotaErrorBackoff: Map<string, number> = new Map();
  private readonly MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes
  private readonly INITIAL_BACKOFF_MS = 30 * 1000; // 30 seconds

  /**
   * Check if error is a quota exceeded error
   */
  private isQuotaError(error: unknown): boolean {
    if (error && typeof error === "object" && "code" in error) {
      return error.code === "resource-exhausted";
    }
    return false;
  }

  /**
   * Get backoff delay for a subscription key
   */
  private getBackoffDelay(key: string): number {
    const currentBackoff = this.quotaErrorBackoff.get(key) || 0;
    const nextBackoff = Math.min(
      currentBackoff === 0 ? this.INITIAL_BACKOFF_MS : currentBackoff * 2,
      this.MAX_BACKOFF_MS
    );
    this.quotaErrorBackoff.set(key, nextBackoff);
    return nextBackoff;
  }

  /**
   * Reset backoff for a subscription key
   */
  private resetBackoff(key: string): void {
    this.quotaErrorBackoff.delete(key);
  }

  /**
   * Handle quota error with exponential backoff
   */
  private handleQuotaError(
    key: string,
    error: Error,
    retryCallback: () => void
  ): void {
    const backoffDelay = this.getBackoffDelay(key);
    this.eventHandlers.onError?.(error);

    // Schedule retry with exponential backoff
    setTimeout(() => {
      retryCallback();
    }, backoffDelay);
  }

  /**
   * Set event handlers for real-time updates
   */
  setEventHandlers(handlers: RealtimeHealthEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  private handleTrendAlertChange(
    change: DocumentChange<DocumentData>,
    onAlert?: (alert: TrendAlert) => void
  ): void {
    if (!(change.type === "added" || change.type === "modified")) {
      return;
    }

    const data = change.doc.data();
    const alertType = data.type as string;

    const isTrendRelated =
      alertType.includes("trend") ||
      alertType.includes("vital") ||
      (data.metadata?.trendAnalysis && data.severity !== "normal");
    if (!isTrendRelated) {
      return;
    }

    const alert: TrendAlert = {
      id: change.doc.id,
      userId: data.userId,
      type: alertType.includes("vital") ? "vital_trend" : "symptom_trend",
      severity: data.severity === "critical" ? "critical" : "warning",
      trendAnalysis: data.metadata?.trendAnalysis || {
        vitalType: alertType,
        trend: "increasing",
        severity: data.severity,
        changePercent: 0,
        timePeriod: "7 days",
        currentValue: 0,
        averageValue: 0,
        unit: "",
        message: data.message,
      },
      timestamp: data.timestamp?.toDate() || new Date(),
      acknowledged: data.acknowledged,
    };

    onAlert?.(alert);
    this.eventHandlers.onTrendAlert?.(alert);
  }

  private emitFamilyUpdate(
    update: FamilyMemberUpdate,
    onUpdate?: (familyUpdate: FamilyMemberUpdate) => void
  ): void {
    onUpdate?.(update);
    this.eventHandlers.onFamilyMemberUpdate?.(update);
  }

  private handleFamilyAlertAdded(
    change: DocumentChange<DocumentData>,
    onUpdate?: (update: FamilyMemberUpdate) => void
  ): void {
    const data = change.doc.data();
    const update: FamilyMemberUpdate = {
      memberId: data.userId,
      updateType: "alert_created",
      data: {
        alertId: change.doc.id,
        type: data.type,
        severity: data.severity,
        message: data.message,
      },
      timestamp: data.timestamp?.toDate() || new Date(),
    };

    this.emitFamilyUpdate(update, onUpdate);
    this.eventHandlers.onAlertCreated?.({
      id: change.doc.id,
      ...data,
      timestamp: data.timestamp?.toDate() || new Date(),
    } as EmergencyAlert);
  }

  private handleFamilyAlertModified(
    change: DocumentChange<DocumentData>,
    onUpdate?: (update: FamilyMemberUpdate) => void
  ): void {
    const data = change.doc.data();
    if (!data.resolved) {
      return;
    }

    const update: FamilyMemberUpdate = {
      memberId: data.userId,
      updateType: "alert_resolved",
      data: {
        alertId: change.doc.id,
        resolvedBy: data.resolvedBy,
      },
      timestamp: data.resolvedAt?.toDate() || new Date(),
    };

    this.emitFamilyUpdate(update, onUpdate);
    this.eventHandlers.onAlertResolved?.(change.doc.id, data.resolvedBy || "");
  }

  private handleFamilyAlertChange(
    change: DocumentChange<DocumentData>,
    onUpdate?: (update: FamilyMemberUpdate) => void
  ): void {
    if (change.type === "added") {
      this.handleFamilyAlertAdded(change, onUpdate);
      return;
    }
    if (change.type === "modified") {
      this.handleFamilyAlertModified(change, onUpdate);
    }
  }

  private handleUserAlertChange(
    change: DocumentChange<DocumentData>,
    onAlertCreated?: (alert: EmergencyAlert) => void,
    onAlertResolved?: (alertId: string, resolverId: string) => void
  ): void {
    const data = change.doc.data();
    const alert = {
      id: change.doc.id,
      ...data,
      timestamp: data.timestamp?.toDate() || new Date(),
    } as EmergencyAlert;

    if (change.type === "added") {
      onAlertCreated?.(alert);
      this.eventHandlers.onAlertCreated?.(alert);
      return;
    }

    if (change.type === "modified" && data.resolved) {
      onAlertResolved?.(change.doc.id, data.resolvedBy || "");
      this.eventHandlers.onAlertResolved?.(
        change.doc.id,
        data.resolvedBy || ""
      );
    }
  }

  /**
   * Subscribe to critical trend alerts for a user
   * Listens to alerts collection filtered by trend-related alert types
   */
  subscribeToTrendAlerts(
    userId: string,
    onAlert?: (alert: TrendAlert) => void
  ): Unsubscribe {
    const key = `trend_alerts_${userId}`;

    // Unsubscribe existing listener if any
    const existingUnsubscribe = this.trendAlertSubscriptions.get(key);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    const setupListener = () => {
      // Subscribe to alerts that are trend-related
      // Limit to last 7 days to reduce reads
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const q = query(
        collection(db, "alerts"),
        where("userId", "==", userId),
        where("resolved", "==", false),
        where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)),
        orderBy("timestamp", "desc"),
        limit(30)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          // Reset backoff on successful read
          this.resetBackoff(key);
          for (const change of snapshot.docChanges()) {
            this.handleTrendAlertChange(change, onAlert);
          }
        },
        (error) => {
          if (this.isQuotaError(error)) {
            // Handle quota error with backoff
            this.handleQuotaError(key, error as Error, setupListener);
            // Unsubscribe current listener to prevent further quota consumption
            const currentUnsubscribe = this.trendAlertSubscriptions.get(key);
            if (currentUnsubscribe) {
              currentUnsubscribe();
            }
          } else {
            this.eventHandlers.onError?.(error as Error);
          }
        }
      );

      this.trendAlertSubscriptions.set(key, unsubscribe);
      return unsubscribe;
    };

    return setupListener();
  }

  /**
   * Subscribe to family member updates
   * Listens to alerts, vitals, and health events for all family members
   */
  subscribeToFamilyMemberUpdates(
    familyId: string,
    memberIds: string[],
    onUpdate?: (update: FamilyMemberUpdate) => void
  ): Unsubscribe {
    const key = `family_updates_${familyId}`;

    // Unsubscribe existing listener if any
    const existingUnsubscribe = this.familyUpdateSubscriptions.get(key);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    const unsubscribes: Unsubscribe[] = [];

    // Subscribe to alerts for all family members
    if (memberIds.length > 0) {
      // Firestore 'in' query supports up to 10 items
      const chunks: string[][] = [];
      for (let i = 0; i < memberIds.length; i += 10) {
        chunks.push(memberIds.slice(i, i + 10));
      }

      const alertsKey = `family_alerts_${familyId}`;
      const setupAlertsListeners = () => {
        const alertsUnsubscribes: Unsubscribe[] = [];

        for (const chunk of chunks) {
          // Filter to last 7 days to reduce reads
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const alertsQuery = query(
            collection(db, "alerts"),
            where("userId", "in", chunk),
            where("resolved", "==", false),
            where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)),
            orderBy("timestamp", "desc"),
            limit(15) // Reduced from 20 to 15
          );

          const unsubscribe = onSnapshot(
            alertsQuery,
            (snapshot) => {
              // Reset backoff on successful read
              this.resetBackoff(alertsKey);
              for (const change of snapshot.docChanges()) {
                this.handleFamilyAlertChange(change, onUpdate);
              }
            },
            (error) => {
              if (this.isQuotaError(error)) {
                // Handle quota error with backoff
                this.handleQuotaError(alertsKey, error as Error, () => {
                  // Unsubscribe all alerts listeners
                  for (const unsub of alertsUnsubscribes) {
                    unsub();
                  }
                  alertsUnsubscribes.length = 0;
                  // Retry setup
                  const newUnsubscribes = setupAlertsListeners();
                  alertsUnsubscribes.push(...newUnsubscribes);
                  // Update main unsubscribes array
                  const index = unsubscribes.findIndex((u) =>
                    alertsUnsubscribes.includes(u)
                  );
                  if (index !== -1) {
                    unsubscribes.splice(index, alertsUnsubscribes.length);
                  }
                  unsubscribes.push(...alertsUnsubscribes);
                });
              } else {
                this.eventHandlers.onError?.(error as Error);
              }
            }
          );

          alertsUnsubscribes.push(unsubscribe);
        }

        return alertsUnsubscribes;
      };

      const alertsUnsubscribes = setupAlertsListeners();
      unsubscribes.push(...alertsUnsubscribes);
    }

    // Subscribe to recent vitals for all family members (last 24 hours)
    const vitalsChunks: string[][] = [];
    for (let i = 0; i < memberIds.length; i += 10) {
      vitalsChunks.push(memberIds.slice(i, i + 10));
    }

    const vitalsKey = `family_vitals_${familyId}`;
    const setupVitalsListeners = () => {
      const vitalsUnsubscribes: Unsubscribe[] = [];

      for (const chunk of vitalsChunks) {
        // Filter to last 24 hours to reduce reads significantly
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const vitalsQuery = query(
          collection(db, "vitals"),
          where("userId", "in", chunk),
          where("timestamp", ">=", Timestamp.fromDate(twentyFourHoursAgo)),
          orderBy("timestamp", "desc"),
          limit(20) // Reduced from 50 to 20
        );

        const unsubscribe = onSnapshot(
          vitalsQuery,
          (snapshot) => {
            // Reset backoff on successful read
            this.resetBackoff(vitalsKey);
            for (const change of snapshot.docChanges()) {
              if (change.type === "added") {
                const data = change.doc.data();
                const update: FamilyMemberUpdate = {
                  memberId: data.userId,
                  updateType: "vital_added",
                  data: {
                    vitalId: change.doc.id,
                    type: data.type,
                    value: data.value,
                    unit: data.unit,
                    source: data.source,
                  },
                  timestamp: data.timestamp?.toDate() || new Date(),
                };

                if (onUpdate) {
                  onUpdate(update);
                }
                this.eventHandlers.onFamilyMemberUpdate?.(update);
                this.eventHandlers.onVitalAdded?.({
                  userId: data.userId,
                  type: data.type,
                  value: data.value,
                  timestamp: data.timestamp?.toDate() || new Date(),
                });
              }
            }
          },
          (error) => {
            if (this.isQuotaError(error)) {
              // Handle quota error with backoff
              this.handleQuotaError(vitalsKey, error as Error, () => {
                // Unsubscribe all vitals listeners
                for (const unsub of vitalsUnsubscribes) {
                  unsub();
                }
                vitalsUnsubscribes.length = 0;
                // Retry setup
                const newUnsubscribes = setupVitalsListeners();
                vitalsUnsubscribes.push(...newUnsubscribes);
                // Update main unsubscribes array
                const index = unsubscribes.findIndex((u) =>
                  vitalsUnsubscribes.includes(u)
                );
                if (index !== -1) {
                  unsubscribes.splice(index, vitalsUnsubscribes.length);
                }
                unsubscribes.push(...vitalsUnsubscribes);
              });
            } else {
              this.eventHandlers.onError?.(error as Error);
            }
          }
        );

        vitalsUnsubscribes.push(unsubscribe);
      }

      return vitalsUnsubscribes;
    };

    const vitalsUnsubscribes = setupVitalsListeners();
    unsubscribes.push(...vitalsUnsubscribes);

    // Create a combined unsubscribe function
    const combinedUnsubscribe = () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };

    this.familyUpdateSubscriptions.set(key, combinedUnsubscribe);
    return combinedUnsubscribe;
  }

  /**
   * Subscribe to alerts for a specific user
   */
  subscribeToUserAlerts(
    userId: string,
    onAlertCreated?: (alert: EmergencyAlert) => void,
    onAlertResolved?: (alertId: string, resolverId: string) => void
  ): Unsubscribe {
    const key = `user_alerts_${userId}`;

    const existingUnsubscribe = this.alertSubscriptions.get(key);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    const setupListener = () => {
      // Filter to last 7 days to reduce reads
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const q = query(
        collection(db, "alerts"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)),
        orderBy("timestamp", "desc"),
        limit(30) // Reduced from 50 to 30
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          // Reset backoff on successful read
          this.resetBackoff(key);
          for (const change of snapshot.docChanges()) {
            this.handleUserAlertChange(change, onAlertCreated, onAlertResolved);
          }
        },
        (error) => {
          if (this.isQuotaError(error)) {
            // Handle quota error with backoff
            this.handleQuotaError(key, error as Error, setupListener);
            // Unsubscribe current listener to prevent further quota consumption
            const currentUnsubscribe = this.alertSubscriptions.get(key);
            if (currentUnsubscribe) {
              currentUnsubscribe();
            }
          } else {
            this.eventHandlers.onError?.(error as Error);
          }
        }
      );

      this.alertSubscriptions.set(key, unsubscribe);
      return unsubscribe;
    };

    return setupListener();
  }

  /**
   * Subscribe to vitals for a specific user
   */
  subscribeToUserVitals(
    userId: string,
    onVitalAdded?: (vital: {
      userId: string;
      type: string;
      value: number;
      timestamp: Date;
    }) => void
  ): Unsubscribe {
    const key = `user_vitals_${userId}`;

    const existingUnsubscribe = this.vitalSubscriptions.get(key);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    const setupListener = () => {
      // Filter to last 24 hours to reduce reads significantly
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const q = query(
        collection(db, "vitals"),
        where("userId", "==", userId),
        where("timestamp", ">=", Timestamp.fromDate(twentyFourHoursAgo)),
        orderBy("timestamp", "desc"),
        limit(30) // Reduced from 100 to 30
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          // Reset backoff on successful read
          this.resetBackoff(key);
          for (const change of snapshot.docChanges()) {
            if (change.type === "added") {
              const data = change.doc.data();
              const vital = {
                userId: data.userId,
                type: data.type,
                value: data.value,
                timestamp: data.timestamp?.toDate() || new Date(),
              };

              if (onVitalAdded) {
                onVitalAdded(vital);
              }
              this.eventHandlers.onVitalAdded?.(vital);
            }
          }
        },
        (error) => {
          if (this.isQuotaError(error)) {
            // Handle quota error with backoff
            this.handleQuotaError(key, error as Error, setupListener);
            // Unsubscribe current listener to prevent further quota consumption
            const currentUnsubscribe = this.vitalSubscriptions.get(key);
            if (currentUnsubscribe) {
              currentUnsubscribe();
            }
          } else {
            this.eventHandlers.onError?.(error as Error);
          }
        }
      );

      this.vitalSubscriptions.set(key, unsubscribe);
      return unsubscribe;
    };

    return setupListener();
  }

  /**
   * Unsubscribe from all trend alerts
   */
  unsubscribeFromTrendAlerts(userId: string): void {
    const key = `trend_alerts_${userId}`;
    const unsubscribe = this.trendAlertSubscriptions.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.trendAlertSubscriptions.delete(key);
    }
  }

  /**
   * Unsubscribe from family member updates
   */
  unsubscribeFromFamilyMemberUpdates(familyId: string): void {
    const key = `family_updates_${familyId}`;
    const unsubscribe = this.familyUpdateSubscriptions.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.familyUpdateSubscriptions.delete(key);
    }
  }

  /**
   * Unsubscribe from user alerts
   */
  unsubscribeFromUserAlerts(userId: string): void {
    const key = `user_alerts_${userId}`;
    const unsubscribe = this.alertSubscriptions.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.alertSubscriptions.delete(key);
    }
  }

  /**
   * Unsubscribe from user vitals
   */
  unsubscribeFromUserVitals(userId: string): void {
    const key = `user_vitals_${userId}`;
    const unsubscribe = this.vitalSubscriptions.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.vitalSubscriptions.delete(key);
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    for (const unsubscribe of this.trendAlertSubscriptions.values()) {
      unsubscribe();
    }
    for (const unsubscribe of this.familyUpdateSubscriptions.values()) {
      unsubscribe();
    }
    for (const unsubscribe of this.alertSubscriptions.values()) {
      unsubscribe();
    }
    for (const unsubscribe of this.vitalSubscriptions.values()) {
      unsubscribe();
    }

    this.trendAlertSubscriptions.clear();
    this.familyUpdateSubscriptions.clear();
    this.alertSubscriptions.clear();
    this.vitalSubscriptions.clear();
  }
}

export const realtimeHealthService = new RealtimeHealthService();
