/**
 * Observability type definitions — shared across the observability layer.
 *
 * These types are used by eventEmitter.ts, escalationService.ts,
 * healthTimeline.ts, and any service that emits structured health events.
 */

// ── Core event taxonomy ────────────────────────────────────────────────────────

export type ObservabilityDomain =
  | "vitals"
  | "medications"
  | "symptoms"
  | "mood"
  | "activity"
  | "sleep"
  | "alerts"
  | "family"
  | "ai"
  | "sync"
  | "auth"
  | "system";

export type EventSeverity = "info" | "warning" | "error" | "critical";

export type EventStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "acknowledged";

// ── Health event (canonical event model) ──────────────────────────────────────

export interface HealthEvent {
  id: string;
  userId: string;
  familyId?: string;
  domain: ObservabilityDomain;
  eventType: string;
  severity: EventSeverity;
  status: EventStatus;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
}

// ── Observability event (internal telemetry) ──────────────────────────────────

export interface ObservabilityEvent {
  eventId: string;
  userId?: string;
  domain: ObservabilityDomain;
  operation: string;
  severity: EventSeverity;
  durationMs?: number;
  metadata?: Record<string, string | number | boolean | null>;
  error?: string;
  timestamp: Date;
}

// ── Alert event ───────────────────────────────────────────────────────────────

export interface AlertEvent {
  alertId: string;
  userId: string;
  familyId?: string;
  alertType: string;
  severity: EventSeverity;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  dispatchedAt?: Date;
}

// ── Alert audit entry ─────────────────────────────────────────────────────────

export interface AlertAuditEntry {
  id: string;
  alertId: string;
  alertType: string;
  userId: string;
  action: "created" | "dispatched" | "acknowledged" | "resolved" | "escalated" | "dismissed";
  performedBy?: string;
  performedByRole?: "patient" | "caregiver" | "provider" | "system";
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// ── Platform metric ───────────────────────────────────────────────────────────

export interface PlatformMetric {
  metricName: string;
  value: number;
  unit?: string;
  dimensions?: Record<string, string>;
  timestamp: Date;
}

// ── Escalation types ──────────────────────────────────────────────────────────

export type EscalationLevel = 1 | 2 | 3 | 4;

export interface EscalationPolicyLevel {
  level: EscalationLevel;
  delayMinutes: number;
  notifyRoles: Array<"patient" | "caregiver" | "provider" | "emergency">;
  channels: Array<"push" | "sms" | "email" | "call">;
  requireAcknowledgment: boolean;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  alertTypes: string[];
  levels: EscalationPolicyLevel[];
  maxLevel: EscalationLevel;
  autoResolveAfterMinutes?: number;
}
