/* biome-ignore-all lint/suspicious/useAwait: Public API keeps async signatures for compatibility with existing callers. */
/* biome-ignore-all lint/nursery/useMaxParams: Legacy event-recording helpers keep explicit positional params. */
/* biome-ignore-all lint/style/noNestedTernary: Legacy event title/type mapping remains compact in this module. */
/**
 * Health Timeline Service — Firebase-free replacement.
 *
 * Replaced Firestore `health_timeline` collection with REST calls:
 *   POST /api/health/timeline                          → addEvent
 *   GET  /api/health/timeline?limit=&from=&to=&types= → getEventsForUser
 *   GET  /api/health/timeline/family?userIds=&...      → getEventsForFamily
 *
 * The public interface is identical to the old implementation — all callers
 * (offlineService, periodService, medicationService, alertService …) work
 * without changes.
 */
import { api } from "@/lib/apiClient";
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
  // ── VHI enrichment fields (nullable, backward-compatible) ─────────────────
  /** Z-score of the recorded value against the user's personal baseline at ingestion time */
  zScoreAtIngestion?: number | null;
  /** VHI version that was active when this event was ingested */
  vhiVersion?: number | null;
  /** Health domain of the event for VHI cycle correlation */
  domain?: "vitals" | "behavior" | "symptoms" | "twin" | "clinical" | "genetic" | null;
  /** Value normalised to a 0–100 scale for cross-dimension comparison */
  normalizedValue?: number | null;
};

/** Normalize a raw API row back to a HealthTimelineEvent */
function normalizeEvent(raw: Record<string, unknown>): HealthTimelineEvent {
  return {
    id: raw.id as string | undefined,
    userId: raw.userId as string,
    familyId: raw.familyId as string | undefined,
    eventType: raw.eventType as TimelineEventType,
    title: (raw.title as string | undefined) ?? "",
    description: raw.description as string | undefined,
    timestamp: raw.timestamp ? new Date(raw.timestamp as string) : new Date(),
    severity: (raw.severity as HealthTimelineEvent["severity"]) ?? "info",
    icon: raw.icon as string | undefined,
    metadata: raw.metadata as Record<string, unknown> | undefined,
    relatedEntityId: raw.relatedEntityId as string | undefined,
    relatedEntityType: raw.relatedEntityType as string | undefined,
    actorId: raw.actorId as string | undefined,
    actorType: raw.actorType as HealthTimelineEvent["actorType"],
    // VHI enrichment fields
    zScoreAtIngestion: (raw.zScoreAtIngestion as number | null | undefined) ?? null,
    vhiVersion: (raw.vhiVersion as number | null | undefined) ?? null,
    domain: (raw.domain as HealthTimelineEvent["domain"]) ?? null,
    normalizedValue: (raw.normalizedValue as number | null | undefined) ?? null,
  };
}

class HealthTimelineService {
  /** Apply in-memory filters on events that couldn't be filtered server-side */
  private applyInMemoryFilters(
    events: HealthTimelineEvent[],
    options: {
      startDate?: Date;
      endDate?: Date;
      eventTypes?: TimelineEventType[];
    }
  ): HealthTimelineEvent[] {
    let filtered = events;
    if (options.startDate) {
      const start = options.startDate;
      filtered = filtered.filter((e) => e.timestamp >= start);
    }
    if (options.endDate) {
      const end = options.endDate;
      filtered = filtered.filter((e) => e.timestamp <= end);
    }
    if (options.eventTypes && options.eventTypes.length > 0) {
      const types = options.eventTypes;
      filtered = filtered.filter((e) => types.includes(e.eventType));
    }
    return filtered;
  }

  async addEvent(event: Omit<HealthTimelineEvent, "id">): Promise<string> {
    try {
      const result = await api.post<{ id: string }>("/api/health/timeline", {
        userId: event.userId,
        familyId: event.familyId,
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        timestamp: event.timestamp.toISOString(),
        severity: event.severity,
        icon: event.icon,
        metadata: event.metadata,
        relatedEntityId: event.relatedEntityId,
        relatedEntityType: event.relatedEntityType,
        actorId: event.actorId,
        actorType: event.actorType,
      });
      return result.id;
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
      const params = new URLSearchParams({
        limit: String(options.limitCount ?? 50),
      });
      if (options.startDate) params.set("from", options.startDate.toISOString());
      if (options.endDate) params.set("to", options.endDate.toISOString());
      if (options.eventTypes && options.eventTypes.length > 0) {
        params.set("types", options.eventTypes.join(","));
      }

      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/timeline?${params.toString()}`
      );
      return (raw ?? []).map(normalizeEvent);
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
      if (userIds.length === 0) return [];

      const params = new URLSearchParams({
        userIds: userIds.join(","),
        limit: String(options.limitCount ?? 100),
      });
      if (options.startDate) params.set("from", options.startDate.toISOString());
      if (options.endDate) params.set("to", options.endDate.toISOString());

      const raw = await api.get<Record<string, unknown>[]>(
        `/api/health/timeline/family?${params.toString()}`
      );
      const events = (raw ?? []).map(normalizeEvent);

      // Sort client-side since the endpoint may return multiple user batches
      return events.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
    } catch (error) {
      logger.error(
        "Failed to get family timeline events",
        { userIds, error },
        "HealthTimeline"
      );
      return [];
    }
  }

  // ── Convenience wrappers (delegate to addEvent) ────────────────────────────

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
      title: `Nora: ${interactionType}`,
      description: summary,
      timestamp: new Date(),
      severity: "info",
      icon: "Bot",
      metadata: { interactionType },
      relatedEntityType: "ai_session",
      actorType: "ai",
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

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
