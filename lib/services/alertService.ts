import {
  addDoc,
  collection,
  doc,
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
      await updateDoc(doc(db, "alerts", alertId), {
        resolved: true,
        resolvedAt: Timestamp.now(),
        resolvedBy: resolverId,
      });
    } catch (error) {
      throw error;
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
};
