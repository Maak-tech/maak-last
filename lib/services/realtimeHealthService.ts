/**
 * Real-time Health Updates Service — Firebase-free replacement.
 *
 * Replaced Firestore onSnapshot listeners with REST polling (30-second intervals).
 * Public interface is identical — all subscribe methods return () => void (Unsubscribe).
 *
 * When the Elysia WebSocket infrastructure (api/src/routes/realtime.ts) is ready,
 * this service can be swapped for native WebSocket subscriptions without changing callers.
 *
 * Endpoints polled:
 *   GET /api/alerts?limit=20                  → subscribeToTrendAlerts / subscribeToUserAlerts
 *   GET /api/family/:familyId/members         → subscribeToFamilyMemberUpdates
 *   GET /api/health/vitals?limit=30           → subscribeToUserVitals
 */

import { api } from "@/lib/apiClient";
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

/** Return type of subscribe methods — calling it cancels the subscription */
export type Unsubscribe = () => void;

const POLL_INTERVAL_MS = 30_000; // 30 seconds

/** Convert a raw API alert row to a TrendAlert if it's trend-related */
function rawToTrendAlert(raw: Record<string, unknown>): TrendAlert | null {
  const alertType = (raw.type ?? "") as string;
  const meta = (raw.metadata ?? {}) as Record<string, unknown>;

  const isTrendRelated =
    alertType.includes("trend") ||
    alertType.includes("vital") ||
    (meta.trendAnalysis !== undefined && raw.severity !== "normal");

  if (!isTrendRelated) return null;

  return {
    id: raw.id as string,
    userId: raw.userId as string,
    type: alertType.includes("vital") ? "vital_trend" : "symptom_trend",
    severity: raw.severity === "critical" ? "critical" : "warning",
    trendAnalysis: (meta.trendAnalysis as TrendAnalysis | SymptomTrendAnalysis) ?? {
      vitalType: alertType,
      trend: "increasing",
      severity: raw.severity,
      changePercent: 0,
      timePeriod: "7 days",
      currentValue: 0,
      averageValue: 0,
      unit: "",
      message: raw.message,
    },
    timestamp: raw.timestamp ? new Date(raw.timestamp as string) : new Date(),
    acknowledged: raw.acknowledged as boolean | undefined,
  };
}

class RealtimeHealthService {
  private readonly intervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  // Tracks alert IDs for which onAlertCreated has fired
  private readonly seenCreatedIds: Map<string, Set<string>> = new Map();
  // Tracks alert IDs for which onAlertResolved has fired
  private readonly seenResolvedIds: Map<string, Set<string>> = new Map();
  // Tracks vital/trend IDs already emitted
  private readonly seenItemIds: Map<string, Set<string>> = new Map();

  private eventHandlers: RealtimeHealthEventHandlers = {};

  /** Set global event handlers (applied to all subscriptions) */
  setEventHandlers(handlers: RealtimeHealthEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Subscribe to critical trend alerts for a user.
   * Polls GET /api/alerts?limit=20 every 30s and fires onAlert for trend-related alerts.
   */
  subscribeToTrendAlerts(
    userId: string,
    onAlert?: (alert: TrendAlert) => void
  ): Unsubscribe {
    const key = `trend_alerts_${userId}`;
    this.cancelKey(key);

    const seenIds = new Set<string>();
    this.seenItemIds.set(key, seenIds);

    const poll = async () => {
      try {
        const raw = await api.get<Record<string, unknown>[]>("/api/alerts?limit=20");
        for (const rawAlert of raw ?? []) {
          const id = rawAlert.id as string;
          if (seenIds.has(id)) continue;
          seenIds.add(id);

          const trendAlert = rawToTrendAlert(rawAlert);
          if (trendAlert) {
            onAlert?.(trendAlert);
            this.eventHandlers.onTrendAlert?.(trendAlert);
          }
        }
      } catch (error) {
        this.eventHandlers.onError?.(
          error instanceof Error ? error : new Error("Poll error (trend alerts)")
        );
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    this.intervals.set(key, id);

    return () => this.cancelKey(key);
  }

  /**
   * Subscribe to family member updates (alerts + vitals).
   * Polls GET /api/family/:familyId/members every 30s and fires onUpdate for new alerts.
   */
  subscribeToFamilyMemberUpdates(
    familyId: string,
    memberIds: string[],
    onUpdate?: (update: FamilyMemberUpdate) => void
  ): Unsubscribe {
    const key = `family_updates_${familyId}`;
    this.cancelKey(key);

    const seenCreated = new Set<string>();
    const seenResolved = new Set<string>();
    this.seenCreatedIds.set(key, seenCreated);
    this.seenResolvedIds.set(key, seenResolved);

    const poll = async () => {
      try {
        const memberData = await api.get<
          Array<{ memberId: string; recentAlerts?: Record<string, unknown>[] }>
        >(`/api/family/${familyId}/members`);

        for (const member of memberData ?? []) {
          for (const rawAlert of member.recentAlerts ?? []) {
            const id = rawAlert.id as string;
            const isResolved = (rawAlert.resolved as boolean) || rawAlert.resolvedAt != null;
            const meta = (rawAlert.metadata ?? {}) as Record<string, unknown>;

            if (!seenCreated.has(id) && !isResolved) {
              seenCreated.add(id);
              const update: FamilyMemberUpdate = {
                memberId: member.memberId,
                updateType: "alert_created",
                data: {
                  alertId: id,
                  type: rawAlert.type,
                  severity: rawAlert.severity,
                  message: rawAlert.message,
                },
                timestamp: rawAlert.timestamp
                  ? new Date(rawAlert.timestamp as string)
                  : new Date(),
              };
              onUpdate?.(update);
              this.eventHandlers.onFamilyMemberUpdate?.(update);
              this.eventHandlers.onAlertCreated?.(rawAlert as unknown as EmergencyAlert);
            } else if (isResolved && !seenResolved.has(id)) {
              seenCreated.add(id);
              seenResolved.add(id);
              const resolvedBy = (meta.resolvedBy ?? "") as string;
              const update: FamilyMemberUpdate = {
                memberId: member.memberId,
                updateType: "alert_resolved",
                data: { alertId: id, resolvedBy },
                timestamp: rawAlert.resolvedAt
                  ? new Date(rawAlert.resolvedAt as string)
                  : new Date(),
              };
              onUpdate?.(update);
              this.eventHandlers.onFamilyMemberUpdate?.(update);
              this.eventHandlers.onAlertResolved?.(id, resolvedBy);
            }
          }
        }
      } catch (error) {
        this.eventHandlers.onError?.(
          error instanceof Error ? error : new Error("Poll error (family updates)")
        );
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    this.intervals.set(key, id);

    return () => this.cancelKey(key);
  }

  /**
   * Subscribe to alerts for a specific user.
   * Polls GET /api/alerts?limit=20 every 30s and fires onAlertCreated / onAlertResolved.
   */
  subscribeToUserAlerts(
    userId: string,
    onAlertCreated?: (alert: EmergencyAlert) => void,
    onAlertResolved?: (alertId: string, resolverId: string) => void
  ): Unsubscribe {
    const key = `user_alerts_${userId}`;
    this.cancelKey(key);

    const seenCreated = new Set<string>();
    const seenResolved = new Set<string>();
    this.seenCreatedIds.set(key, seenCreated);
    this.seenResolvedIds.set(key, seenResolved);

    const poll = async () => {
      try {
        const raw = await api.get<Record<string, unknown>[]>("/api/alerts?limit=20");

        for (const rawAlert of raw ?? []) {
          const id = rawAlert.id as string;
          const isResolved = (rawAlert.resolved as boolean) || rawAlert.resolvedAt != null;
          const meta = (rawAlert.metadata ?? {}) as Record<string, unknown>;

          if (!seenCreated.has(id)) {
            seenCreated.add(id);
            if (!isResolved) {
              onAlertCreated?.(rawAlert as unknown as EmergencyAlert);
              this.eventHandlers.onAlertCreated?.(rawAlert as unknown as EmergencyAlert);
            } else {
              // Already resolved on first observation — skip both callbacks
              seenResolved.add(id);
            }
          } else if (isResolved && !seenResolved.has(id)) {
            seenResolved.add(id);
            const resolvedBy = (meta.resolvedBy ?? "") as string;
            onAlertResolved?.(id, resolvedBy);
            this.eventHandlers.onAlertResolved?.(id, resolvedBy);
          }
        }
      } catch (error) {
        this.eventHandlers.onError?.(
          error instanceof Error ? error : new Error("Poll error (user alerts)")
        );
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    this.intervals.set(key, id);

    return () => this.cancelKey(key);
  }

  /**
   * Subscribe to vitals for a specific user.
   * Polls GET /api/health/vitals?limit=30 every 30s and fires onVitalAdded for new vitals.
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
    this.cancelKey(key);

    const seenIds = new Set<string>();
    this.seenItemIds.set(key, seenIds);

    const poll = async () => {
      try {
        const raw = await api.get<Record<string, unknown>[]>(
          "/api/health/vitals?limit=30"
        );

        for (const rawVital of raw ?? []) {
          const id = rawVital.id as string;
          if (seenIds.has(id)) continue;
          seenIds.add(id);

          const vital = {
            userId: (rawVital.userId ?? userId) as string,
            type: rawVital.type as string,
            value:
              typeof rawVital.value === "number"
                ? rawVital.value
                : Number.parseFloat(String(rawVital.value ?? 0)),
            timestamp: rawVital.recordedAt
              ? new Date(rawVital.recordedAt as string)
              : new Date(),
          };

          onVitalAdded?.(vital);
          this.eventHandlers.onVitalAdded?.(vital);
        }
      } catch (error) {
        this.eventHandlers.onError?.(
          error instanceof Error ? error : new Error("Poll error (user vitals)")
        );
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    this.intervals.set(key, id);

    return () => this.cancelKey(key);
  }

  // ── Explicit unsubscribe helpers (mirror old API) ─────────────────────────────

  unsubscribeFromTrendAlerts(userId: string): void {
    this.cancelKey(`trend_alerts_${userId}`);
  }

  unsubscribeFromFamilyMemberUpdates(familyId: string): void {
    this.cancelKey(`family_updates_${familyId}`);
  }

  unsubscribeFromUserAlerts(userId: string): void {
    this.cancelKey(`user_alerts_${userId}`);
  }

  unsubscribeFromUserVitals(userId: string): void {
    this.cancelKey(`user_vitals_${userId}`);
  }

  /** Cancel all active polling subscriptions */
  unsubscribeAll(): void {
    for (const id of this.intervals.values()) {
      clearInterval(id);
    }
    this.intervals.clear();
    this.seenCreatedIds.clear();
    this.seenResolvedIds.clear();
    this.seenItemIds.clear();
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private cancelKey(key: string): void {
    const id = this.intervals.get(key);
    if (id !== undefined) {
      clearInterval(id);
      this.intervals.delete(key);
    }
    this.seenCreatedIds.delete(key);
    this.seenResolvedIds.delete(key);
    this.seenItemIds.delete(key);
  }
}

export const realtimeHealthService = new RealtimeHealthService();
