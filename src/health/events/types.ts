/**
 * Health event types for the src/health/events layer.
 *
 * These types define the shape of domain events emitted by health-related
 * services (vital ingestion, fall detection, medication adherence, etc.)
 * and consumed by the health events service for downstream processing.
 */

export type HealthEventType =
  | "vital_recorded"
  | "vital_abnormal"
  | "vital_critical"
  | "fall_detected"
  | "fall_suspected"
  | "medication_taken"
  | "medication_missed"
  | "medication_scheduled"
  | "symptom_logged"
  | "mood_logged"
  | "alert_created"
  | "alert_resolved"
  | "alert_acknowledged"
  | "health_sync_completed"
  | "health_sync_failed"
  | "provider_connected"
  | "provider_disconnected"
  | "vhi_updated"
  | "risk_score_changed";

export type HealthEventSeverity = "info" | "warning" | "error" | "critical";

export interface HealthEvent {
  id: string;
  type: HealthEventType;
  userId: string;
  familyId?: string;
  severity: HealthEventSeverity;
  /** Human-readable title (English) */
  title: string;
  /** Optional description with more detail */
  description?: string;
  /**
   * Structured payload specific to the event type.
   * - vital_recorded: { vitalType, value, unit, source }
   * - fall_detected: { confidence, peakAcceleration, duration }
   * - medication_missed: { medicationId, medicationName, scheduledAt }
   * etc.
   */
  payload?: Record<string, unknown>;
  occurredAt: Date;
  processedAt?: Date;
  /** Whether downstream consumers (alerts, VHI, notifications) have processed this event */
  isProcessed: boolean;
}

/** Lightweight reference used in lists and timelines */
export interface HealthEventSummary {
  id: string;
  type: HealthEventType;
  userId: string;
  severity: HealthEventSeverity;
  title: string;
  occurredAt: Date;
}

/** Input for emitting a new health event */
export interface EmitHealthEventInput {
  type: HealthEventType;
  userId: string;
  familyId?: string;
  severity: HealthEventSeverity;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  occurredAt?: Date;
}
