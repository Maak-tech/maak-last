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
      
      // Verify the document exists
      const alertDoc = await getDoc(alertRef);
      if (!alertDoc.exists()) {
        throw new Error(`Alert ${alertId} does not exist`);
      }
      
      // Update the document
      await updateDoc(alertRef, {
        resolved: true,
        resolvedAt: Timestamp.now(),
        resolvedBy: resolverId,
      });
      
      // Verify the update worked
      const updatedDoc = await getDoc(alertRef);
      const updatedData = updatedDoc.data();
      
      if (!updatedData?.resolved) {
        throw new Error(`Alert ${alertId} was not marked as resolved`);
      }
    } catch (error: any) {
      // Silently handle error
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
          const userName = user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || "User";
          await pushNotificationService.sendFallAlert(
            userId,
            alertId,
            userName,
            user.familyId
          );
        } else {
          const userName = user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`
            : user?.firstName || "User";
          await pushNotificationService.sendFallAlert(
            userId,
            alertId,
            userName
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
          resolved: data.resolved || false,
        } as EmergencyAlert;
        
        // Double-check resolved status in memory
        if (!alert.resolved) {
          alerts.push(alert);
        }
      });
      
      // Additional filter to ensure no resolved alerts slip through
      const filteredAlerts = alerts.filter(a => !a.resolved);

      // Sort by timestamp descending
      filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return filteredAlerts;
    } catch (error: any) {
      // Silently handle error
      
      // If it's an index error, try without the resolved filter
      if (error.message?.includes("index") || error.code === "failed-precondition") {
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
