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
        for (const change of snapshot.docChanges()) {
          this.handleTrendAlertChange(change, onAlert);
        }
      },
      (error) => {
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

      for (const chunk of chunks) {
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
            for (const change of snapshot.docChanges()) {
              this.handleFamilyAlertChange(change, onUpdate);
            }
          },
          (error) => {
            this.eventHandlers.onError?.(error as Error);
          }
        );

        unsubscribes.push(unsubscribe);
      }
    }

    // Subscribe to recent vitals for all family members (last 24 hours)
    const vitalsChunks: string[][] = [];
    for (let i = 0; i < memberIds.length; i += 10) {
      vitalsChunks.push(memberIds.slice(i, i + 10));
    }

    for (const chunk of vitalsChunks) {
      const vitalsQuery = query(
        collection(db, "vitals"),
        where("userId", "in", chunk),
        orderBy("timestamp", "desc"),
        limit(50)
      );

      const unsubscribe = onSnapshot(
        vitalsQuery,
        (snapshot) => {
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
          this.eventHandlers.onError?.(error as Error);
        }
      );

      unsubscribes.push(unsubscribe);
    }

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

    const q = query(
      collection(db, "alerts"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        for (const change of snapshot.docChanges()) {
          this.handleUserAlertChange(change, onAlertCreated, onAlertResolved);
        }
      },
      (error) => {
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
