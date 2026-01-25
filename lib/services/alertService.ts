import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  escalationService,
  healthTimelineService,
  observabilityEmitter,
} from "@/lib/observability";
import type { EmergencyAlert } from "@/types";
import { emergencySmsService } from "./emergencySmsService";
import { pushNotificationService } from "./pushNotificationService";
import { userService } from "./userService";

export const alertService = {
  async createAlert(alertData: Omit<EmergencyAlert, "id">): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, "alerts"), {
        ...alertData,
        timestamp: Timestamp.fromDate(alertData.timestamp),
      });

      await healthTimelineService.addEvent({
        userId: alertData.userId,
        eventType: "alert_created",
        title: `Alert: ${alertData.type}`,
        description: alertData.message,
        timestamp: alertData.timestamp,
        severity:
          alertData.severity === "critical"
            ? "critical"
            : alertData.severity === "high"
              ? "error"
              : "warn",
        icon:
          alertData.type === "fall"
            ? "alert-triangle"
            : alertData.type === "medication"
              ? "pill"
              : "heart-pulse",
        metadata: {
          alertId: docRef.id,
          alertType: alertData.type,
          alertSeverity: alertData.severity,
        },
        relatedEntityId: docRef.id,
        relatedEntityType: "alert",
        actorType: "system",
      });

      observabilityEmitter.emit({
        domain: "alerts",
        source: "alertService",
        message: `Alert created: ${alertData.type}`,
        severity:
          alertData.severity === "critical"
            ? "critical"
            : alertData.severity === "high"
              ? "error"
              : "warn",
        status: "success",
        metadata: {
          alertId: docRef.id,
          alertType: alertData.type,
          userId: alertData.userId,
        },
      });

      return docRef.id;
    } catch (error) {
      observabilityEmitter.emit({
        domain: "alerts",
        source: "alertService",
        message: "Failed to create alert",
        severity: "error",
        status: "failure",
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
        metadata: { alertType: alertData.type, userId: alertData.userId },
      });
      throw error;
    }
  },

  async getUserAlerts(
    userId: string,
    limitCount = 20
  ): Promise<EmergencyAlert[]> {
    try {
      const q = query(
        collection(db, "alerts"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc"),
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
      throw error;
    }
  },

  async getFamilyAlerts(
    userIds: string[],
    limitCount = 50
  ): Promise<EmergencyAlert[]> {
    try {
      const q = query(
        collection(db, "alerts"),
        where("userId", "in", userIds),
        where("resolved", "==", false),
        orderBy("timestamp", "desc"),
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
      throw error;
    }
  },

  async resolveAlert(alertId: string, resolverId: string): Promise<void> {
    try {
      const alertRef = doc(db, "alerts", alertId);

      const alertDoc = await getDoc(alertRef);
      if (!alertDoc.exists()) {
        throw new Error(`Alert ${alertId} does not exist`);
      }

      const alertData = alertDoc.data();

      await updateDoc(alertRef, {
        resolved: true,
        resolvedAt: Timestamp.now(),
        resolvedBy: resolverId,
      });

      const updatedDoc = await getDoc(alertRef);
      const updatedData = updatedDoc.data();

      if (!updatedData?.resolved) {
        throw new Error(`Alert ${alertId} was not marked as resolved`);
      }

      await healthTimelineService.addEvent({
        userId: alertData.userId,
        eventType: "alert_resolved",
        title: `Alert resolved: ${alertData.type}`,
        description: "Alert was resolved",
        timestamp: new Date(),
        severity: "info",
        icon: "check-circle",
        metadata: {
          alertId,
          alertType: alertData.type,
          resolvedBy: resolverId,
        },
        relatedEntityId: alertId,
        relatedEntityType: "alert",
        actorId: resolverId,
        actorType: "user",
      });

      await escalationService.resolveEscalation(alertId, resolverId);

      observabilityEmitter.emit({
        domain: "alerts",
        source: "alertService",
        message: `Alert resolved: ${alertData.type}`,
        severity: "info",
        status: "success",
        metadata: {
          alertId,
          alertType: alertData.type,
          resolvedBy: resolverId,
        },
      });
    } catch (error: any) {
      observabilityEmitter.emit({
        domain: "alerts",
        source: "alertService",
        message: "Failed to resolve alert",
        severity: "error",
        status: "failure",
        error: {
          message: error.message || "Unknown error",
        },
        metadata: { alertId, resolverId },
      });
      throw new Error(
        `Failed to resolve alert: ${error.message || "Unknown error"}`
      );
    }
  },

  async addResponder(alertId: string, responderId: string): Promise<void> {
    try {
      await updateDoc(doc(db, "alerts", alertId), {
        responders: [responderId],
      });
    } catch (error) {
      throw error;
    }
  },

  async createFallAlert(userId: string, location?: string): Promise<string> {
    try {
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
        description: location
          ? `Location: ${location}`
          : "Fall detected - location unknown",
        timestamp: new Date(),
        severity: "critical",
        icon: "alert-triangle",
        metadata: { alertId, location },
        relatedEntityId: alertId,
        relatedEntityType: "alert",
        actorType: "system",
      });

      await escalationService.startEscalation(
        alertId,
        "fall_detected",
        userId,
        user?.familyId
      );

      try {
        if (user && user.familyId) {
          const userName =
            user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.firstName || "User";
          await pushNotificationService.sendFallAlert(
            userId,
            alertId,
            userName,
            user.familyId
          );
          await emergencySmsService.sendEmergencySms({
            userId,
            alertType: "fall",
            message: `Emergency: ${userName} may have fallen and needs help.${
              location ? ` Location: ${location}.` : ""
            }`,
          });
        } else {
          const userName =
            user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.firstName || "User";
          await pushNotificationService.sendFallAlert(
            userId,
            alertId,
            userName
          );
          await emergencySmsService.sendEmergencySms({
            userId,
            alertType: "fall",
            message: `Emergency: ${userName} may have fallen and needs help.${
              location ? ` Location: ${location}.` : ""
            }`,
          });
        }
      } catch (notificationError) {
        observabilityEmitter.emit({
          domain: "notifications",
          source: "alertService",
          message: "Failed to send fall alert notification",
          severity: "warn",
          status: "failure",
          error: {
            message:
              notificationError instanceof Error
                ? notificationError.message
                : "Unknown error",
          },
          metadata: { alertId, userId },
        });
      }

      return alertId;
    } catch (error) {
      throw error;
    }
  },

  async createMedicationAlert(
    userId: string,
    medicationName: string
  ): Promise<string> {
    try {
      const alertData: Omit<EmergencyAlert, "id"> = {
        userId,
        type: "medication",
        severity: "medium",
        message: `Medication reminder: ${medicationName} was not taken as scheduled.`,
        timestamp: new Date(),
        resolved: false,
        responders: [],
      };

      return await this.createAlert(alertData);
    } catch (error) {
      throw error;
    }
  },

  async createVitalsAlert(
    userId: string,
    vitalType: string,
    value: number,
    normalRange: string
  ): Promise<string> {
    try {
      const alertData: Omit<EmergencyAlert, "id"> = {
        userId,
        type: "vitals",
        severity: "high",
        message: `Abnormal ${vitalType} reading: ${value}. Normal range: ${normalRange}`,
        timestamp: new Date(),
        resolved: false,
        responders: [],
      };

      return await this.createAlert(alertData);
    } catch (error) {
      throw error;
    }
  },

  // Create caregiver notification to admin
  async createCaregiverAlert(
    caregiverId: string,
    familyId: string,
    message: string,
    severity: "low" | "medium" | "high" | "critical" = "medium"
  ): Promise<string> {
    try {
      // Verify caregiver has permission
      const caregiver = await userService.getUser(caregiverId);
      if (
        !caregiver ||
        caregiver.familyId !== familyId ||
        (caregiver.role !== "admin" && caregiver.role !== "caregiver")
      ) {
        throw new Error(
          "Access denied: Only admins and caregivers can send alerts"
        );
      }

      const alertData: Omit<EmergencyAlert, "id"> = {
        userId: caregiverId,
        type: "emergency",
        severity,
        message: `Caregiver Alert: ${message}`,
        timestamp: new Date(),
        resolved: false,
        responders: [],
      };

      const alertId = await this.createAlert(alertData);

      // Send notification to all admins in the family
      try {
        await pushNotificationService.sendToAdmins(
          familyId,
          {
            title: "Caregiver Alert",
            body: message,
            data: {
              type: "caregiver_alert",
              alertId,
              caregiverId,
              familyId,
            },
          },
          caregiverId // Exclude the caregiver who sent the alert
        );
      } catch (notificationError) {
        // Silently fail if notification fails
      }

      return alertId;
    } catch (error) {
      throw error;
    }
  },

  async getActiveAlertsCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, "alerts"),
        where("userId", "==", userId),
        where("resolved", "==", false)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      return 0;
    }
  },

  async getActiveAlerts(userId: string): Promise<EmergencyAlert[]> {
    try {
      const q = query(
        collection(db, "alerts"),
        where("userId", "==", userId),
        where("resolved", "==", false)
      );

      const querySnapshot = await getDocs(q);
      const alerts: EmergencyAlert[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const alert = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          resolved: data.resolved,
        } as EmergencyAlert;

        // Double-check resolved status in memory
        if (!alert.resolved) {
          alerts.push(alert);
        }
      });

      // Additional filter to ensure no resolved alerts slip through
      const filteredAlerts = alerts.filter((a) => !a.resolved);

      // Sort by timestamp descending
      filteredAlerts.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      return filteredAlerts;
    } catch (error: any) {
      // Silently handle error

      // If it's an index error, try without the resolved filter
      if (
        error.message?.includes("index") ||
        error.code === "failed-precondition"
      ) {
        try {
          const q = query(
            collection(db, "alerts"),
            where("userId", "==", userId)
          );
          const querySnapshot = await getDocs(q);
          const alerts: EmergencyAlert[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const alert = {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || new Date(),
              resolved: data.resolved,
            } as EmergencyAlert;

            if (!alert.resolved) {
              alerts.push(alert);
            }
          });
          alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          return alerts;
        } catch (retryError: any) {
          // Silently handle error
          return [];
        }
      }
      return [];
    }
  },
};
