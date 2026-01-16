import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logger } from "@/lib/utils/logger";

export type TimelineEventType =
  | "vital_recorded"
  | "vital_abnormal"
  | "symptom_logged"
  | "medication_taken"
  | "medication_missed"
  | "medication_scheduled"
  | "fall_detected"
  | "alert_created"
  | "alert_acknowledged"
  | "alert_resolved"
  | "mood_logged"
  | "appointment_scheduled"
  | "appointment_reminder"
  | "health_sync"
  | "caregiver_action"
  | "ai_interaction"
  | "allergy_added"
  | "medical_history_added";

export interface HealthTimelineEvent {
  id?: string;
  userId: string;
  familyId?: string;
  eventType: TimelineEventType;
  title: string;
  description?: string;
  timestamp: Date;
  severity: "info" | "warn" | "error" | "critical";
  icon?: string;
  metadata?: Record<string, unknown>;
  relatedEntityId?: string;
  relatedEntityType?: string;
  actorId?: string;
  actorType?: "user" | "system" | "caregiver" | "ai";
}

const TIMELINE_COLLECTION = "health_timeline";

class HealthTimelineService {
  async addEvent(event: Omit<HealthTimelineEvent, "id">): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, TIMELINE_COLLECTION), {
        ...event,
        timestamp: Timestamp.fromDate(event.timestamp),
      });
      return docRef.id;
    } catch (error) {
      logger.error("Failed to add timeline event", { event, error }, "HealthTimeline");
      throw error;
    }
  }

  async getEventsForUser(
    userId: string,
    options: {
      limitCount?: number;
      startDate?: Date;
      endDate?: Date;
      eventTypes?: TimelineEventType[];
    } = {}
  ): Promise<HealthTimelineEvent[]> {
    try {
      let q = query(
        collection(db, TIMELINE_COLLECTION),
        where("userId", "==", userId),
        orderBy("timestamp", "desc"),
        limit(options.limitCount || 50)
      );

      const querySnapshot = await getDocs(q);
      let events = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      })) as HealthTimelineEvent[];

      if (options.startDate) {
        events = events.filter((e) => e.timestamp >= options.startDate!);
      }
      if (options.endDate) {
        events = events.filter((e) => e.timestamp <= options.endDate!);
      }
      if (options.eventTypes && options.eventTypes.length > 0) {
        events = events.filter((e) => options.eventTypes!.includes(e.eventType));
      }

      return events;
    } catch (error) {
      logger.error("Failed to get timeline events", { userId, error }, "HealthTimeline");
      return [];
    }
  }

  async getEventsForFamily(
    userIds: string[],
    options: {
      limitCount?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<HealthTimelineEvent[]> {
    try {
      if (userIds.length === 0) return [];

      const batchSize = 10;
      const allEvents: HealthTimelineEvent[] = [];

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const q = query(
          collection(db, TIMELINE_COLLECTION),
          where("userId", "in", batch),
          orderBy("timestamp", "desc"),
          limit(options.limitCount || 100)
        );

        const querySnapshot = await getDocs(q);
        const events = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate(),
        })) as HealthTimelineEvent[];

        allEvents.push(...events);
      }

      let filteredEvents = allEvents;
      if (options.startDate) {
        filteredEvents = filteredEvents.filter((e) => e.timestamp >= options.startDate!);
      }
      if (options.endDate) {
        filteredEvents = filteredEvents.filter((e) => e.timestamp <= options.endDate!);
      }

      filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return filteredEvents.slice(0, options.limitCount || 100);
    } catch (error) {
      logger.error("Failed to get family timeline events", { userIds, error }, "HealthTimeline");
      return [];
    }
  }

  async recordVitalEvent(
    userId: string,
    vitalType: string,
    value: number,
    unit: string,
    isAbnormal: boolean,
    familyId?: string
  ): Promise<string> {
    return this.addEvent({
      userId,
      familyId,
      eventType: isAbnormal ? "vital_abnormal" : "vital_recorded",
      title: isAbnormal ? `Abnormal ${this.formatVitalName(vitalType)}` : `${this.formatVitalName(vitalType)} Recorded`,
      description: `${value} ${unit}`,
      timestamp: new Date(),
      severity: isAbnormal ? "warn" : "info",
      icon: this.getIconForVital(vitalType),
      metadata: { vitalType, value, unit, isAbnormal },
      relatedEntityType: "vital",
      actorType: "system",
    });
  }

  async recordMedicationEvent(
    userId: string,
    medicationName: string,
    action: "taken" | "missed" | "scheduled",
    familyId?: string
  ): Promise<string> {
    const eventType = action === "taken" ? "medication_taken" : 
                      action === "missed" ? "medication_missed" : "medication_scheduled";
    
    return this.addEvent({
      userId,
      familyId,
      eventType,
      title: action === "taken" ? `${medicationName} Taken` :
             action === "missed" ? `${medicationName} Missed` : `${medicationName} Scheduled`,
      timestamp: new Date(),
      severity: action === "missed" ? "warn" : "info",
      icon: "Pill",
      metadata: { medicationName, action },
      relatedEntityType: "medication",
      actorType: action === "taken" ? "user" : "system",
    });
  }

  async recordSymptomEvent(
    userId: string,
    symptomType: string,
    severity: number,
    familyId?: string
  ): Promise<string> {
    return this.addEvent({
      userId,
      familyId,
      eventType: "symptom_logged",
      title: `Symptom Logged: ${symptomType}`,
      description: `Severity: ${severity}/5`,
      timestamp: new Date(),
      severity: severity >= 4 ? "warn" : "info",
      icon: "Activity",
      metadata: { symptomType, severity },
      relatedEntityType: "symptom",
      actorType: "user",
    });
  }

  async recordAlertEvent(
    userId: string,
    alertId: string,
    action: "created" | "acknowledged" | "resolved",
    alertType: string,
    actorId?: string,
    familyId?: string
  ): Promise<string> {
    const eventType = action === "created" ? "alert_created" :
                      action === "acknowledged" ? "alert_acknowledged" : "alert_resolved";
    
    return this.addEvent({
      userId,
      familyId,
      eventType,
      title: action === "created" ? `Alert: ${alertType}` :
             action === "acknowledged" ? "Alert Acknowledged" : "Alert Resolved",
      timestamp: new Date(),
      severity: action === "created" ? "error" : "info",
      icon: "AlertTriangle",
      metadata: { alertId, alertType, action },
      relatedEntityId: alertId,
      relatedEntityType: "alert",
      actorId,
      actorType: actorId ? "caregiver" : "system",
    });
  }

  async recordMoodEvent(
    userId: string,
    mood: string,
    score: number,
    familyId?: string
  ): Promise<string> {
    return this.addEvent({
      userId,
      familyId,
      eventType: "mood_logged",
      title: `Mood: ${mood}`,
      description: `Score: ${score}/10`,
      timestamp: new Date(),
      severity: score <= 3 ? "warn" : "info",
      icon: "Smile",
      metadata: { mood, score },
      relatedEntityType: "mood",
      actorType: "user",
    });
  }

  async recordAIInteraction(
    userId: string,
    interactionType: string,
    summary: string,
    familyId?: string
  ): Promise<string> {
    return this.addEvent({
      userId,
      familyId,
      eventType: "ai_interaction",
      title: `Zeina: ${interactionType}`,
      description: summary,
      timestamp: new Date(),
      severity: "info",
      icon: "Bot",
      metadata: { interactionType },
      relatedEntityType: "ai_session",
      actorType: "ai",
    });
  }

  private formatVitalName(type: string): string {
    const names: Record<string, string> = {
      heart_rate: "Heart Rate",
      blood_oxygen: "Blood Oxygen",
      systolic_bp: "Blood Pressure",
      diastolic_bp: "Blood Pressure",
      temperature: "Temperature",
      blood_glucose: "Blood Glucose",
      respiratory_rate: "Respiratory Rate",
      weight: "Weight",
      steps: "Steps",
    };
    return names[type] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private getIconForVital(type: string): string {
    const icons: Record<string, string> = {
      heart_rate: "Heart",
      blood_oxygen: "Droplet",
      systolic_bp: "Activity",
      diastolic_bp: "Activity",
      temperature: "Thermometer",
      blood_glucose: "TrendingUp",
      respiratory_rate: "Wind",
      weight: "Scale",
      steps: "Footprints",
    };
    return icons[type] || "Activity";
  }
}

export const healthTimelineService = new HealthTimelineService();
