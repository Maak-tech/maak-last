<<<<<<< Updated upstream
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EmergencyAlert } from '@/types';
import { pushNotificationService } from './pushNotificationService';
import { userService } from './userService';
=======
/**
 * Alert service — Firebase-free replacement.
 *
 * All Firestore reads/writes and Cloud Function calls replaced with:
 *   POST   /api/alerts                  → createAlert
 *   GET    /api/alerts?limit=N          → getUserAlerts
 *   GET    /api/alerts/active           → getActiveAlerts
 *   GET    /api/alerts/active/count     → getActiveAlertsCount
 *   GET    /api/alerts/family?...       → getFamilyAlerts
 *   PATCH  /api/alerts/:id/resolve      → resolveAlert
 *   PATCH  /api/alerts/:id/acknowledge  → acknowledgeAlert
 *   PATCH  /api/alerts/:id/responders   → addResponder
 */

import { api } from "@/lib/apiClient";
import {
  escalationService,
  healthTimelineService,
  observabilityEmitter,
} from "@/lib/observability";
import type { EmergencyAlert } from "@/types";
import { emergencySmsService } from "./emergencySmsService";
import { pushNotificationService } from "./pushNotificationService";
import { userService } from "./userService";

// ── Helpers ──────────────────────────────────────────────────────────────────

const mapAlertSeverityToObservability = (
  severity: EmergencyAlert["severity"]
): "critical" | "error" | "warn" => {
  if (severity === "critical") return "critical";
  if (severity === "high") return "error";
  return "warn";
};

const mapAlertTypeToIcon = (type: EmergencyAlert["type"]): string => {
  if (type === "fall") return "alert-triangle";
  if (type === "medication") return "pill";
  return "heart-pulse";
};

/** Ensure Date fields on API response are proper Date objects */
const normalizeAlert = (a: EmergencyAlert): EmergencyAlert => ({
  ...a,
  timestamp: a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp),
  resolvedAt: a.resolvedAt ? new Date(a.resolvedAt) : undefined,
  acknowledgedAt: a.acknowledgedAt ? new Date(a.acknowledgedAt) : undefined,
});

// ── Per-family alert cache (30s TTL) ─────────────────────────────────────────

const FAMILY_ALERTS_CACHE_TTL_MS = 30_000;
const familyAlertsCache = new Map<
  string,
  { cachedAt: number; alerts: EmergencyAlert[] }
>();
const familyAlertsInFlight = new Map<string, Promise<EmergencyAlert[]>>();

// ── Per-user active-alerts cache (60s TTL) ────────────────────────────────────

const ACTIVE_ALERTS_CACHE_TTL = 60_000;
const _activeAlertsCountCache = new Map<
  string,
  { count: number; timestamp: number }
>();
const _activeAlertsCache = new Map<
  string,
  { alerts: EmergencyAlert[]; timestamp: number }
>();

const buildFamilyAlertsCacheKey = (userIds: string[], limitCount: number) =>
  `${[...userIds].sort().join(",")}::${limitCount}`;
>>>>>>> Stashed changes

// ── Service ──────────────────────────────────────────────────────────────────

export const alertService = {
<<<<<<< Updated upstream
  // Create emergency alert
  async createAlert(alertData: Omit<EmergencyAlert, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'alerts'), {
        ...alertData,
        timestamp: Timestamp.fromDate(alertData.timestamp),
=======
  async createAlert(alertData: Omit<EmergencyAlert, "id">): Promise<string> {
    try {
      const result = await api.post<EmergencyAlert>("/api/alerts", {
        type: alertData.type,
        severity: alertData.severity,
        message: alertData.message,
        userId: alertData.userId,
        metadata: alertData.metadata,
      });

      const alertId = result.id;

      await healthTimelineService.addEvent({
        userId: alertData.userId,
        eventType: "alert_created",
        title: `Alert: ${alertData.type}`,
        description: alertData.message,
        timestamp: alertData.timestamp,
        severity: mapAlertSeverityToObservability(alertData.severity),
        icon: mapAlertTypeToIcon(alertData.type),
        metadata: {
          alertId,
          alertType: alertData.type,
          alertSeverity: alertData.severity,
        },
        relatedEntityId: alertId,
        relatedEntityType: "alert",
        actorType: "system",
      });

      observabilityEmitter.emit({
        eventType: "alert_service",
        domain: "alerts",
        source: "alertService",
        message: `Alert created: ${alertData.type}`,
        severity: "info",
        status: "success",
        metadata: { alertId, alertType: alertData.type, userId: alertData.userId },
      });

      _activeAlertsCountCache.delete(alertData.userId);
      _activeAlertsCache.delete(alertData.userId);

      return alertId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      observabilityEmitter.emit({
        eventType: "alert_service",
        domain: "alerts",
        source: "alertService",
        message: "Failed to create alert",
        severity: "error",
        status: "failure",
        error: { message: errorMessage },
        metadata: { alertType: alertData.type, userId: alertData.userId },
>>>>>>> Stashed changes
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  },

  // Get user alerts
  async getUserAlerts(
    _userId: string, // server resolves via session
    limitCount = 20
  ): Promise<EmergencyAlert[]> {
<<<<<<< Updated upstream
    try {
      const q = query(
        collection(db, 'alerts'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const alerts: EmergencyAlert[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as EmergencyAlert);
      });

      return alerts;
    } catch (error) {
      console.error('Error getting alerts:', error);
      throw error;
    }
  },

  // Get family alerts
  async getFamilyAlerts(
    userIds: string[],
    limitCount = 50
  ): Promise<EmergencyAlert[]> {
    try {
      const q = query(
        collection(db, 'alerts'),
        where('userId', 'in', userIds),
        where('resolved', '==', false),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const alerts: EmergencyAlert[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate(),
        } as EmergencyAlert);
      });

      return alerts;
    } catch (error) {
      console.error('Error getting family alerts:', error);
      throw error;
    }
  },

  // Resolve alert
  async resolveAlert(alertId: string, resolverId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'alerts', alertId), {
        resolved: true,
        resolvedAt: Timestamp.now(),
        resolvedBy: resolverId,
      });
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw error;
=======
    const result = await api.get<EmergencyAlert[]>(
      `/api/alerts?limit=${limitCount}`
    );
    return (result ?? []).map(normalizeAlert);
  },

  async getFamilyAlerts(
    userIds: string[],
    limitCount = 50,
    forceRefresh = false
  ): Promise<EmergencyAlert[]> {
    if (userIds.length === 0) return [];

    const cacheKey = buildFamilyAlertsCacheKey(userIds, limitCount);
    const cached = familyAlertsCache.get(cacheKey);
    if (
      !forceRefresh &&
      cached &&
      Date.now() - cached.cachedAt < FAMILY_ALERTS_CACHE_TTL_MS
    ) {
      return cached.alerts;
    }

    const inFlight = familyAlertsInFlight.get(cacheKey);
    if (!forceRefresh && inFlight) return inFlight;

    const loadPromise = (async () => {
      const result = await api.get<EmergencyAlert[]>(
        `/api/alerts/family?userIds=${userIds.join(",")}&limit=${limitCount}&resolved=false`
      );
      const finalAlerts = (result ?? []).map(normalizeAlert);
      familyAlertsCache.set(cacheKey, { cachedAt: Date.now(), alerts: finalAlerts });
      return finalAlerts;
    })().finally(() => familyAlertsInFlight.delete(cacheKey));

    familyAlertsInFlight.set(cacheKey, loadPromise);
    return loadPromise;
  },

  async resolveAlert(alertId: string, resolverId: string): Promise<void> {
    try {
      // Fetch current alert data for timeline + escalation
      const alertList = await api.get<EmergencyAlert[]>(`/api/alerts?limit=200`);
      const alertData = alertList?.find((a) => a.id === alertId);

      observabilityEmitter.emit({
        eventType: "alert_service",
        domain: "alerts",
        source: "alertService",
        message: "Resolving alert via API",
        severity: "info",
        status: "pending",
        metadata: { alertId, resolverId },
      });

      await api.patch(`/api/alerts/${alertId}/resolve`, { resolverId });

      observabilityEmitter.emit({
        eventType: "alert_service",
        domain: "alerts",
        source: "alertService",
        message: `Alert resolved: ${alertData?.type ?? alertId}`,
        severity: "info",
        status: "success",
        metadata: { alertId, resolvedBy: resolverId },
      });

      // Health timeline event (non-blocking)
      if (alertData?.userId) {
        healthTimelineService
          .addEvent({
            userId: alertData.userId,
            eventType: "alert_resolved",
            title: `Alert resolved: ${alertData.type}`,
            description: "Alert was resolved",
            timestamp: new Date(),
            severity: "info",
            icon: "check-circle",
            metadata: { alertId, alertType: alertData.type, resolvedBy: resolverId },
            relatedEntityId: alertId,
            relatedEntityType: "alert",
            actorId: resolverId,
            actorType: "user",
          })
          .catch(() => {
            // Non-critical — alert already resolved
          });

        // Escalation resolution (non-critical)
        escalationService.resolveEscalation(alertId, resolverId).catch(() => {
          // Expected to fail if no escalation was active
        });
      }

      familyAlertsCache.clear();
      familyAlertsInFlight.clear();
      if (alertData?.userId) {
        _activeAlertsCountCache.delete(alertData.userId);
        _activeAlertsCache.delete(alertData.userId);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      observabilityEmitter.emit({
        eventType: "alert_service",
        domain: "alerts",
        source: "alertService",
        message: "Failed to resolve alert",
        severity: "error",
        status: "failure",
        error: { message: errorMessage },
        metadata: { alertId, resolverId },
      });
      throw new Error(`Failed to resolve alert: ${errorMessage}`);
>>>>>>> Stashed changes
    }
  },

  // Add responder to alert
  async addResponder(alertId: string, responderId: string): Promise<void> {
<<<<<<< Updated upstream
    try {
      const alertDoc = doc(db, 'alerts', alertId);
      // Note: This is a simplified version. In production, you'd want to use arrayUnion
      await updateDoc(alertDoc, {
        responders: [responderId], // This would typically use arrayUnion for proper array handling
=======
    await api.patch(`/api/alerts/${alertId}/responders`, { responderId });
  },

  async createFallAlert(userId: string, location?: string): Promise<string> {
    const alertData: Omit<EmergencyAlert, "id"> = {
      userId,
      type: "fall",
      severity: "high",
      message: `Fall detected for user. Immediate attention may be required.${
        location ? ` Location: ${location}` : ""
      }`,
      timestamp: new Date(),
      resolved: false,
      responders: [],
      metadata: { location },
    };

    const alertId = await this.createAlert(alertData);
    const user = await userService.getUser(userId);

    await healthTimelineService.addEvent({
      userId,
      eventType: "fall_detected",
      title: "Fall detected",
      description: location ? `Location: ${location}` : "Fall detected - location unknown",
      timestamp: new Date(),
      severity: "critical",
      icon: "alert-triangle",
      metadata: { alertId, location },
      relatedEntityId: alertId,
      relatedEntityType: "alert",
      actorType: "system",
    });

    await escalationService.startEscalation(alertId, "fall_detected", userId, user?.familyId);

    try {
      const userName =
        user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.firstName || "User";

      if (user?.familyId) {
        await pushNotificationService.sendFallAlert(userId, alertId, userName, user.familyId);
      } else {
        await pushNotificationService.sendFallAlert(userId, alertId, userName);
      }

      await emergencySmsService.sendEmergencySms({
        alertType: "fall",
        message: `Emergency: ${userName} may have fallen and needs help.${
          location ? ` Location: ${location}.` : ""
        }`,
      });
    } catch (notificationError) {
      observabilityEmitter.emit({
        eventType: "alert_service",
        domain: "notifications",
        source: "alertService",
        message: "Failed to send fall alert notification",
        severity: "warn",
        status: "failure",
        error: {
          message: notificationError instanceof Error ? notificationError.message : "Unknown error",
        },
        metadata: { alertId, userId },
>>>>>>> Stashed changes
      });
    } catch (error) {
      console.error('Error adding responder:', error);
      throw error;
    }
  },

<<<<<<< Updated upstream
  // Create fall detection alert
  async createFallAlert(userId: string, location?: string): Promise<string> {
    try {
      const alertData: Omit<EmergencyAlert, 'id'> = {
        userId,
        type: 'fall',
        severity: 'high',
        message: `Fall detected for user. Immediate attention may be required.${
          location ? ` Location: ${location}` : ''
        }`,
        timestamp: new Date(),
        resolved: false,
        responders: [],
      };

      const alertId = await this.createAlert(alertData);

      // Send push notification to family members
      try {
        const user = await userService.getUser(userId);
        if (user && user.familyId) {
          await pushNotificationService.sendFallAlert(
            userId,
            alertId,
            user.name,
            user.familyId
          );
        } else {
          // If no family, send test notification to user
          await pushNotificationService.sendFallAlert(
            userId,
            alertId,
            user?.name || 'User'
          );
        }
      } catch (notificationError) {
        console.error(
          'Error sending fall alert notification:',
          notificationError
        );
        // Don't throw error here - alert was created successfully
      }

      return alertId;
    } catch (error) {
      console.error('Error creating fall alert:', error);
      throw error;
    }
  },

  // Create medication reminder alert
  async createMedicationAlert(
    userId: string,
    medicationName: string
  ): Promise<string> {
    try {
      const alertData: Omit<EmergencyAlert, 'id'> = {
        userId,
        type: 'medication',
        severity: 'medium',
        message: `Medication reminder: ${medicationName} was not taken as scheduled.`,
        timestamp: new Date(),
        resolved: false,
        responders: [],
      };

      return await this.createAlert(alertData);
    } catch (error) {
      console.error('Error creating medication alert:', error);
      throw error;
    }
=======
  async createMedicationAlert(userId: string, medicationName: string): Promise<string> {
    return this.createAlert({
      userId,
      type: "medication",
      severity: "medium",
      message: `Medication reminder: ${medicationName} was not taken as scheduled.`,
      timestamp: new Date(),
      resolved: false,
      responders: [],
    });
>>>>>>> Stashed changes
  },

  // Create vitals alert
  async createVitalsAlert(
    userId: string,
    vitalType: string,
    value: number,
    normalRange: string
  ): Promise<string> {
<<<<<<< Updated upstream
    try {
      const alertData: Omit<EmergencyAlert, 'id'> = {
        userId,
        type: 'vitals',
        severity: 'high',
        message: `Abnormal ${vitalType} reading: ${value}. Normal range: ${normalRange}`,
        timestamp: new Date(),
        resolved: false,
        responders: [],
      };

      return await this.createAlert(alertData);
    } catch (error) {
      console.error('Error creating vitals alert:', error);
      throw error;
    }
  },

  // Get active alerts count
  async getActiveAlertsCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'alerts'),
        where('userId', '==', userId),
        where('resolved', '==', false)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting active alerts count:', error);
      return 0;
    }
  },
=======
    return this.createAlert({
      userId,
      type: "vitals",
      severity: "high",
      message: `Abnormal ${vitalType} reading: ${value}. Normal range: ${normalRange}`,
      timestamp: new Date(),
      resolved: false,
      responders: [],
    });
  },

  async createCaregiverAlert(
    caregiverId: string,
    familyId: string,
    message: string,
    severity: "low" | "medium" | "high" | "critical" = "medium"
  ): Promise<string> {
    const caregiver = await userService.getUser(caregiverId);
    if (
      !caregiver ||
      caregiver.familyId !== familyId ||
      (caregiver.role !== "admin" && caregiver.role !== "caregiver")
    ) {
      throw new Error("Access denied: Only admins and caregivers can send alerts");
    }

    const alertId = await this.createAlert({
      userId: caregiverId,
      type: "emergency",
      severity,
      message: `Caregiver Alert: ${message}`,
      timestamp: new Date(),
      resolved: false,
      responders: [],
    });

    pushNotificationService
      .sendToAdmins(
        familyId,
        { title: "Caregiver Alert", body: message, data: { type: "caregiver_alert", alertId, caregiverId, familyId } },
        caregiverId
      )
      .catch(() => {
        // Silently fail if notification fails
      });

    return alertId;
  },

  async acknowledgeAlert(alertId: string, caregiverId: string): Promise<void> {
    await api.patch(`/api/alerts/${alertId}/acknowledge`, { caregiverId });
    familyAlertsCache.clear();
    familyAlertsInFlight.clear();
    // We don't know the userId here without an extra fetch — clear all per-user caches
    _activeAlertsCountCache.clear();
    _activeAlertsCache.clear();
  },

  async getActiveAlertsCount(_userId: string): Promise<number> {
    // Check in-memory cache first
    const cached = _activeAlertsCountCache.get(_userId);
    if (cached && Date.now() - cached.timestamp < ACTIVE_ALERTS_CACHE_TTL) {
      return cached.count;
    }

    try {
      const result = await api.get<{ count: number }>("/api/alerts/active/count");
      const count = result?.count ?? 0;
      _activeAlertsCountCache.set(_userId, { count, timestamp: Date.now() });
      return count;
    } catch {
      return 0;
    }
  },

  async getActiveAlerts(_userId: string): Promise<EmergencyAlert[]> {
    const cached = _activeAlertsCache.get(_userId);
    if (cached && Date.now() - cached.timestamp < ACTIVE_ALERTS_CACHE_TTL) {
      return cached.alerts;
    }

    try {
      const result = await api.get<EmergencyAlert[]>("/api/alerts/active");
      const alerts = (result ?? []).map(normalizeAlert);
      _activeAlertsCache.set(_userId, { alerts, timestamp: Date.now() });
      return alerts;
    } catch {
      return [];
    }
  },
>>>>>>> Stashed changes
};
