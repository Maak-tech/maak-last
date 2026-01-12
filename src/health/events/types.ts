/**
 * Health Event types and interfaces
 */

export type HealthEventType =
  | "VITAL_ALERT"
  | "FALL_ALERT"
  | "MED_MISSED"
  | "SYMPTOM_SPIKE"
  | "GENERAL_ALERT";

export type HealthEventSeverity = "low" | "medium" | "high" | "critical";

export type HealthEventStatus = "OPEN" | "ACKED" | "ESCALATED" | "RESOLVED";

export type HealthEventSource = "wearable" | "manual" | "clinic" | "system";

export interface HealthEvent {
  id?: string; // Firestore document ID
  userId: string;
  type: HealthEventType;
  severity: HealthEventSeverity;
  reasons: string[];
  status: HealthEventStatus;
  source: HealthEventSource;
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  escalatedAt?: Date;
  acknowledgedBy?: string; // User ID who acknowledged
  resolvedBy?: string; // User ID who resolved
  escalatedBy?: string; // User ID who escalated

  // Additional context
  vitalValues?: {
    heartRate?: number;
    spo2?: number;
    systolic?: number;
    diastolic?: number;
    temp?: number;
    [key: string]: number | undefined;
  };

  metadata?: Record<string, any>; // Additional event-specific data
}

/**
 * Create Health Event input (for creating new events)
 */
export interface CreateHealthEventInput {
  userId: string;
  type: HealthEventType;
  severity: HealthEventSeverity;
  reasons: string[];
  source: HealthEventSource;
  vitalValues?: {
    heartRate?: number;
    spo2?: number;
    systolic?: number;
    diastolic?: number;
    temp?: number;
    [key: string]: number | undefined;
  };
  metadata?: Record<string, any>;
}

/**
 * Update Health Event input (for status changes)
 */
export interface UpdateHealthEventInput {
  status: HealthEventStatus;
  acknowledgedBy?: string;
  resolvedBy?: string;
  escalatedBy?: string;
  metadata?: Record<string, any>;
}

/**
 * Firestore collection paths
 */
export const HEALTH_EVENTS_COLLECTION = "healthEvents";

/**
 * Map severity levels
 */
export const SEVERITY_LEVELS: Record<HealthEventSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Get severity level as number for sorting
 */
export function getSeverityLevel(severity: HealthEventSeverity): number {
  return SEVERITY_LEVELS[severity] || 0;
}

/**
 * Check if event status allows actions
 */
export function canAcknowledgeEvent(status: HealthEventStatus): boolean {
  return status === "OPEN";
}

export function canResolveEvent(status: HealthEventStatus): boolean {
  return status === "OPEN" || status === "ACKED";
}

export function canEscalateEvent(status: HealthEventStatus): boolean {
  return status === "OPEN" || status === "ACKED";
}