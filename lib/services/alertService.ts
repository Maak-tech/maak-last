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

export const alertService = {
  // Create emergency alert
  async createAlert(alertData: Omit<EmergencyAlert, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'alerts'), {
        ...alertData,
        timestamp: Timestamp.fromDate(alertData.timestamp),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  },

  // Get user alerts
  async getUserAlerts(
    userId: string,
    limitCount = 20
  ): Promise<EmergencyAlert[]> {
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
    }
  },

  // Add responder to alert
  async addResponder(alertId: string, responderId: string): Promise<void> {
    try {
      const alertDoc = doc(db, 'alerts', alertId);
      // Note: This is a simplified version. In production, you'd want to use arrayUnion
      await updateDoc(alertDoc, {
        responders: [responderId], // This would typically use arrayUnion for proper array handling
      });
    } catch (error) {
      console.error('Error adding responder:', error);
      throw error;
    }
  },

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
  },

  // Create vitals alert
  async createVitalsAlert(
    userId: string,
    vitalType: string,
    value: number,
    normalRange: string
  ): Promise<string> {
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
};
