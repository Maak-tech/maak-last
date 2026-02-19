/* biome-ignore-all lint/suspicious/useAwait: Public API keeps async signatures for compatibility with existing callers. */
/* biome-ignore-all lint/nursery/useMaxParams: Legacy event-recording helpers keep explicit positional params. */
/* biome-ignore-all lint/style/noNestedTernary: Legacy event title/type mapping remains compact in this module. */
import {
  addDoc,
  collection,
  type DocumentData,
  getDocs,
  limit,
  orderBy,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  query,
  startAfter,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logger } from "@/lib/utils/logger";

export type TimelineEventType =
  | "vital_recorded"
  | "vital_abnormal"
  | "symptom_logged"
  | "period_logged"
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

export type HealthTimelineEvent = {
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
};

const TIMELINE_COLLECTION = "health_timeline";

const isMissingIndexError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown };
  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  const message =
    typeof maybeError.message === "string" ? maybeError.message : "";

  return (
    code === "failed-precondition" &&
    message.toLowerCase().includes("requires an index")
  );
};

class HealthTimelineService {
  private mapDocsToEvents(
    docs: QueryDocumentSnapshot<DocumentData>[]
  ): HealthTimelineEvent[] {
    return docs
      .map((doc: { id: string; data: () => Record<string, unknown> }) => {
        const data = doc.data();
        const ts = data.timestamp as { toDate?: () => Date } | undefined;
        if (!ts || typeof ts.toDate !== "function") {
          return null;
        }
        return {
          id: doc.id,
          ...data,
          timestamp: ts.toDate(),
        } as HealthTimelineEvent;
      })
      .filter((event): event is HealthTimelineEvent => event !== null);
  }

  private applyInMemoryFilters(
    events: HealthTimelineEvent[],
    options: {
      startDate?: Date;
      endDate?: Date;
      eventTypes?: TimelineEventType[];
    }
  ): HealthTimelineEvent[] {
    let filteredEvents = events;

    if (options.startDate) {
      const startDate = options.startDate;
      filteredEvents = filteredEvents.filter(
        (event) => event.timestamp >= startDate
      );
    }
    if (options.endDate) {
      const endDate = options.endDate;
      filteredEvents = filteredEvents.filter(
        (event) => event.timestamp <= endDate
      );
    }
    if (options.eventTypes && options.eventTypes.length > 0) {
      const eventTypes = options.eventTypes;
      filteredEvents = filteredEvents.filter((event) =>
        eventTypes.includes(event.eventType)
      );
    }

    return filteredEvents;
  }

  /**
   * Recursively removes undefined values from an object
   * Firebase doesn't support undefined values, so we need to filter them out
   */
  private removeUndefinedValues(
    obj: Record<string, unknown>
  ): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        continue; // Skip undefined values
      }
      if (Array.isArray(value)) {
        // Filter undefined values from arrays
        cleaned[key] = value.filter((item) => item !== undefined);
      } else if (
        value !== null &&
        typeof value === "object" &&
        !(value instanceof Date) &&
        !(value instanceof Timestamp)
      ) {
        // Recursively clean nested objects
        cleaned[key] = this.removeUndefinedValues(
          value as Record<string, unknown>
        );
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  async addEvent(event: Omit<HealthTimelineEvent, "id">): Promise<string> {
    try {
      // Remove undefined values before sending to Firebase
      const cleanedEvent = this.removeUndefinedValues(
        event as Record<string, unknown>
      );

      const docRef = await addDoc(collection(db, TIMELINE_COLLECTION), {
        ...cleanedEvent,
        timestamp: Timestamp.fromDate(event.timestamp),
      });
      return docRef.id;
    } catch (error) {
      logger.error(
        "Failed to add timeline event",
        { event, error },
        "HealthTimeline"
      );
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
      const targetLimit = options.limitCount || 50;
      const eventTypes = options.eventTypes;
      const canFilterEventTypesInDb =
        !!eventTypes && eventTypes.length > 0 && eventTypes.length <= 10;

      const queryConstraints: QueryConstraint[] = [
        where("userId", "==", userId),
      ];

      if (options.startDate) {
        queryConstraints.push(
          where("timestamp", ">=", Timestamp.fromDate(options.startDate))
        );
      }
      if (options.endDate) {
        queryConstraints.push(
          where("timestamp", "<=", Timestamp.fromDate(options.endDate))
        );
      }
      if (canFilterEventTypesInDb && eventTypes) {
        queryConstraints.push(where("eventType", "in", eventTypes));
      }

      queryConstraints.push(orderBy("timestamp", "desc"));

      const pageSize = Math.max(targetLimit, 50);
      const needsInMemoryEventTypeFilter =
        !!eventTypes && eventTypes.length > 0 && !canFilterEventTypesInDb;

      const collectedEvents: HealthTimelineEvent[] = [];
      let cursor: QueryDocumentSnapshot<DocumentData> | undefined;

      try {
        while (collectedEvents.length < targetLimit) {
          const pagingConstraints = [...queryConstraints, limit(pageSize)];
          if (cursor) {
            pagingConstraints.push(startAfter(cursor));
          }

          const querySnapshot = await getDocs(
            query(collection(db, TIMELINE_COLLECTION), ...pagingConstraints)
          );
          const pageEvents = this.mapDocsToEvents(querySnapshot.docs);
          const filteredPageEvents = needsInMemoryEventTypeFilter
            ? pageEvents.filter((event) =>
                eventTypes?.includes(event.eventType)
              )
            : pageEvents;

          collectedEvents.push(...filteredPageEvents);

          if (querySnapshot.docs.length < pageSize) {
            break;
          }

          const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
          if (!lastDoc) {
            break;
          }
          cursor = lastDoc;
        }
      } catch (error) {
        if (!isMissingIndexError(error)) {
          throw error;
        }

        logger.warn(
          "Timeline index missing, falling back to non-indexed query",
          { userId },
          "HealthTimeline"
        );

        const fallbackQuery = query(
          collection(db, TIMELINE_COLLECTION),
          where("userId", "==", userId)
        );
        const fallbackSnapshot = await getDocs(fallbackQuery);
        const fallbackEvents = this.mapDocsToEvents(fallbackSnapshot.docs);
        const filteredFallbackEvents = this.applyInMemoryFilters(
          fallbackEvents,
          options
        );

        filteredFallbackEvents.sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
        return filteredFallbackEvents.slice(0, targetLimit);
      }

      return collectedEvents.slice(0, targetLimit);
    } catch (error) {
      logger.error(
        "Failed to get timeline events",
        { userId, error },
        "HealthTimeline"
      );
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
      if (userIds.length === 0) {
        return [];
      }

      const batchSize = 10;
      const allEvents: HealthTimelineEvent[] = [];
      const targetLimit = options.limitCount || 100;

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const indexedConstraints: QueryConstraint[] = [
          where("userId", "in", batch),
        ];
        if (options.startDate) {
          indexedConstraints.push(
            where("timestamp", ">=", Timestamp.fromDate(options.startDate))
          );
        }
        if (options.endDate) {
          indexedConstraints.push(
            where("timestamp", "<=", Timestamp.fromDate(options.endDate))
          );
        }
        indexedConstraints.push(
          orderBy("timestamp", "desc"),
          limit(targetLimit)
        );

        let events: HealthTimelineEvent[] = [];
        try {
          const querySnapshot = await getDocs(
            query(collection(db, TIMELINE_COLLECTION), ...indexedConstraints)
          );
          events = this.mapDocsToEvents(querySnapshot.docs);
        } catch (error) {
          if (!isMissingIndexError(error)) {
            throw error;
          }
          logger.warn(
            "Family timeline index missing, falling back to non-indexed query",
            { batchSize: batch.length },
            "HealthTimeline"
          );

          const fallbackQuery = query(
            collection(db, TIMELINE_COLLECTION),
            where("userId", "in", batch)
          );
          const fallbackSnapshot = await getDocs(fallbackQuery);
          const fallbackEvents = this.mapDocsToEvents(fallbackSnapshot.docs);
          events = this.applyInMemoryFilters(fallbackEvents, options);
        }

        allEvents.push(...events);
      }

      const filteredEvents = this.applyInMemoryFilters(allEvents, options);

      filteredEvents.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      return filteredEvents.slice(0, targetLimit);
    } catch (error) {
      logger.error(
        "Failed to get family timeline events",
        { userIds, error },
        "HealthTimeline"
      );
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
      title: isAbnormal
        ? `Abnormal ${this.formatVitalName(vitalType)}`
        : `${this.formatVitalName(vitalType)} Recorded`,
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
    const eventType =
      action === "taken"
        ? "medication_taken"
        : action === "missed"
          ? "medication_missed"
          : "medication_scheduled";

    return this.addEvent({
      userId,
      familyId,
      eventType,
      title:
        action === "taken"
          ? `${medicationName} Taken`
          : action === "missed"
            ? `${medicationName} Missed`
            : `${medicationName} Scheduled`,
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
    const eventType =
      action === "created"
        ? "alert_created"
        : action === "acknowledged"
          ? "alert_acknowledged"
          : "alert_resolved";

    return this.addEvent({
      userId,
      familyId,
      eventType,
      title:
        action === "created"
          ? `Alert: ${alertType}`
          : action === "acknowledged"
            ? "Alert Acknowledged"
            : "Alert Resolved",
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
    return (
      names[type] ||
      type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
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
