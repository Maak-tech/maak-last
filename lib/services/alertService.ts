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
import type { EmergencyAlert } from "@/types";
import { pushNotificationService } from "./pushNotificationService";
import { userService } from "./userService";

export const alertService = {
  async createAlert(alertData: Omit<EmergencyAlert, "id">): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, "alerts"), {
        ...alertData,
        timestamp: Timestamp.fromDate(alertData.timestamp),
      });
      return docRef.id;
    } catch (error) {
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
      
      // First, verify the document exists
      const alertDoc = await getDoc(alertRef);
      if (!alertDoc.exists()) {
        throw new Error(`Alert ${alertId} does not exist`);
      }
      
      const alertData = alertDoc.data();
      console.log(`Resolving alert ${alertId}:`, {
        currentResolved: alertData.resolved,
        userId: alertData.userId,
        resolverId,
      });
      
      // Update the document
      await updateDoc(alertRef, {
        resolved: true,
        resolvedAt: Timestamp.now(),
        resolvedBy: resolverId,
      });
      
      // Verify the update worked
      const updatedDoc = await getDoc(alertRef);
      const updatedData = updatedDoc.data();
      console.log(`Alert ${alertId} update verified:`, {
        resolved: updatedData?.resolved,
        resolvedAt: updatedData?.resolvedAt,
        resolvedBy: updatedData?.resolvedBy,
      });
      
      if (!updatedData?.resolved) {
        throw new Error(`Alert ${alertId} was not marked as resolved`);
      }
      
      console.log(`Alert ${alertId} resolved successfully by ${resolverId}`);
    } catch (error: any) {
      console.error(`Error resolving alert ${alertId}:`, error);
      console.error(`Error details:`, {
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to resolve alert: ${error.message || "Unknown error"}`);
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
      };

      const alertId = await this.createAlert(alertData);

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
          await pushNotificationService.sendFallAlert(
            userId,
            alertId,
            user?.name || "User"
          );
        }
      } catch (notificationError) {
        // Silently fail
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
      // Query without orderBy first to avoid index requirement, then sort in memory
      const q = query(
        collection(db, "alerts"),
        where("userId", "==", userId),
        where("resolved", "==", false)
      );

      console.log(`[getActiveAlerts] Querying alerts for user ${userId}`);
      const querySnapshot = await getDocs(q);
      const alerts: EmergencyAlert[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const alert = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          resolved: data.resolved || false,
        } as EmergencyAlert;
        
        // Double-check resolved status (in case query filter didn't work)
        if (!alert.resolved) {
          alerts.push(alert);
        } else {
          console.log(`[getActiveAlerts] Filtered out resolved alert ${doc.id}`);
        }
      });

      console.log(`[getActiveAlerts] Found ${alerts.length} active alerts (before filtering)`);
      
      // Additional filter in memory to ensure no resolved alerts slip through
      const filteredAlerts = alerts.filter(a => !a.resolved);
      console.log(`[getActiveAlerts] After filtering: ${filteredAlerts.length} active alerts`);

      // Sort by timestamp descending in memory
      filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return filteredAlerts;
    } catch (error: any) {
      console.error("[getActiveAlerts] Error fetching active alerts:", error);
      console.error("[getActiveAlerts] Error details:", {
        code: error.code,
        message: error.message,
      });
      
      // If it's an index error, try without the resolved filter
      if (error.message?.includes("index") || error.code === "failed-precondition") {
        console.log("[getActiveAlerts] Retrying without resolved filter...");
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
              resolved: data.resolved || false,
            } as EmergencyAlert;
            
            // Filter resolved alerts in memory
            if (!alert.resolved) {
              alerts.push(alert);
            }
          });
          alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          console.log(`[getActiveAlerts] Retry found ${alerts.length} active alerts`);
          return alerts;
        } catch (retryError: any) {
          console.error("[getActiveAlerts] Error fetching alerts (retry):", retryError);
          return [];
        }
      }
      return [];
    }
  },
};
