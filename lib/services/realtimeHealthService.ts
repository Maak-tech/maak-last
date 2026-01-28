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

export interface TrendAlert {
  id: string;
  userId: string;
  type: "vital_trend" | "symptom_trend";
  severity: "critical" | "warning";
  trendAnalysis: TrendAnalysis | SymptomTrendAnalysis;
  timestamp: Date;
  acknowledged?: boolean;
}

export interface FamilyMemberUpdate {
  memberId: string;
  updateType:
    | "vital_added"
    | "symptom_added"
    | "alert_created"
    | "alert_resolved"
    | "medication_taken"
    | "status_change";
  data: any;
  timestamp: Date;
}

export interface RealtimeHealthEventHandlers {
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
}

class RealtimeHealthService {
  private trendAlertSubscriptions: Map<string, Unsubscribe> = new Map();
  private familyUpdateSubscriptions: Map<string, Unsubscribe> = new Map();
  private alertSubscriptions: Map<string, Unsubscribe> = new Map();
  private vitalSubscriptions: Map<string, Unsubscribe> = new Map();
  private eventHandlers: RealtimeHealthEventHandlers = {};

  /**
   * Set event handlers for real-time updates
   */
  setEventHandlers(handlers: RealtimeHealthEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
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

    // Subscribe to alerts that are trend-related
    const q = query(
      collection(db, "alerts"),
      where("userId", "==", userId),
      where("resolved", "==", false),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            const data = change.doc.data();
            const alertType = data.type as string;

            // Check if this is a trend-related alert
            if (
              alertType.includes("trend") ||
              alertType.includes("vital") ||
              (data.metadata?.trendAnalysis && data.severity !== "normal")
            ) {
              const alert: TrendAlert = {
                id: change.doc.id,
                userId: data.userId,
                type: alertType.includes("vital")
                  ? "vital_trend"
                  : "symptom_trend",
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

              // Call handler
              if (onAlert) {
                onAlert(alert);
              }
              this.eventHandlers.onTrendAlert?.(alert);
            }
          }
        });
      },
      (error) => {
        console.error("Error subscribing to trend alerts:", error);
        this.eventHandlers.onError?.(error as Error);
      }
    );

    this.trendAlertSubscriptions.set(key, unsubscribe);
    return unsubscribe;
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

      chunks.forEach((chunk) => {
        const alertsQuery = query(
          collection(db, "alerts"),
          where("userId", "in", chunk),
          where("resolved", "==", false),
          orderBy("timestamp", "desc"),
          limit(20)
        );

        const unsubscribe = onSnapshot(
          alertsQuery,
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
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

                if (onUpdate) {
                  onUpdate(update);
                }
                this.eventHandlers.onFamilyMemberUpdate?.(update);
                this.eventHandlers.onAlertCreated?.({
                  id: change.doc.id,
                  ...data,
                  timestamp: data.timestamp?.toDate() || new Date(),
                } as EmergencyAlert);
              } else if (change.type === "modified") {
                const data = change.doc.data();
                if (data.resolved) {
                  const update: FamilyMemberUpdate = {
                    memberId: data.userId,
                    updateType: "alert_resolved",
                    data: {
                      alertId: change.doc.id,
                      resolvedBy: data.resolvedBy,
                    },
                    timestamp: data.resolvedAt?.toDate() || new Date(),
                  };

                  if (onUpdate) {
                    onUpdate(update);
                  }
                  this.eventHandlers.onFamilyMemberUpdate?.(update);
                  this.eventHandlers.onAlertResolved?.(
                    change.doc.id,
                    data.resolvedBy || ""
                  );
                }
              }
            });
          },
          (error) => {
            console.error("Error subscribing to family alerts:", error);
            this.eventHandlers.onError?.(error as Error);
          }
        );

        unsubscribes.push(unsubscribe);
      });
    }

    // Subscribe to recent vitals for all family members (last 24 hours)
    const vitalsChunks: string[][] = [];
    for (let i = 0; i < memberIds.length; i += 10) {
      vitalsChunks.push(memberIds.slice(i, i + 10));
    }

    vitalsChunks.forEach((chunk) => {
      const vitalsQuery = query(
        collection(db, "vitals"),
        where("userId", "in", chunk),
        orderBy("timestamp", "desc"),
        limit(50)
      );

      const unsubscribe = onSnapshot(
        vitalsQuery,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
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
          });
        },
        (error) => {
          console.error("Error subscribing to family vitals:", error);
          this.eventHandlers.onError?.(error as Error);
        }
      );

      unsubscribes.push(unsubscribe);
    });

    // Create a combined unsubscribe function
    const combinedUnsubscribe = () => {
      unsubscribes.forEach((unsub) => unsub());
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

    const q = query(
      collection(db, "alerts"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const alert = {
            id: change.doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date(),
          } as EmergencyAlert;

          if (change.type === "added") {
            if (onAlertCreated) {
              onAlertCreated(alert);
            }
            this.eventHandlers.onAlertCreated?.(alert);
          } else if (change.type === "modified" && data.resolved) {
            if (onAlertResolved) {
              onAlertResolved(change.doc.id, data.resolvedBy || "");
            }
            this.eventHandlers.onAlertResolved?.(
              change.doc.id,
              data.resolvedBy || ""
            );
          }
        });
      },
      (error) => {
        console.error("Error subscribing to user alerts:", error);
        this.eventHandlers.onError?.(error as Error);
      }
    );

    this.alertSubscriptions.set(key, unsubscribe);
    return unsubscribe;
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

    const q = query(
      collection(db, "vitals"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
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
        });
      },
      (error) => {
        console.error("Error subscribing to user vitals:", error);
        this.eventHandlers.onError?.(error as Error);
      }
    );

    this.vitalSubscriptions.set(key, unsubscribe);
    return unsubscribe;
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
    this.trendAlertSubscriptions.forEach((unsub) => unsub());
    this.familyUpdateSubscriptions.forEach((unsub) => unsub());
    this.alertSubscriptions.forEach((unsub) => unsub());
    this.vitalSubscriptions.forEach((unsub) => unsub());

    this.trendAlertSubscriptions.clear();
    this.familyUpdateSubscriptions.clear();
    this.alertSubscriptions.clear();
    this.vitalSubscriptions.clear();
  }
}

export const realtimeHealthService = new RealtimeHealthService();
