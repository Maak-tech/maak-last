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
  | "system"
  | "health_data"
  | "platform";

export type EventSeverity = "info" | "warning" | "warn" | "error" | "critical";

export type EventStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "failure"
  | "acknowledged"
  | "success";

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
  eventId?: string;
  id?: string;
  userId?: string;
  domain: ObservabilityDomain;
  operation?: string;
  eventType?: string;
  severity: EventSeverity;
  status?: EventStatus;
  message?: string;
  source?: string;
  correlationId?: string;
  durationMs?: number;
  metadata?: Record<string, string | number | boolean | null>;
  error?: string | { code?: string; message: string; stack?: string };
  timestamp: Date;
}

// ── Alert event ───────────────────────────────────────────────────────────────

export interface AlertEvent {
  id?: string;
  alertId: string;
  userId?: string;
  familyId?: string;
  alertType?: string;
  eventType?: string;
  severity: EventSeverity;
  status?: EventStatus;
  title?: string;
  body?: string;
  message?: string;
  source?: string;
  escalationLevel?: number;
  acknowledgedBy?: string;
  resolvedBy?: string;
  correlationId?: string;
  domain?: ObservabilityDomain;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  dispatchedAt?: Date;
}

// ── Alert audit entry ─────────────────────────────────────────────────────────

export interface AlertAuditEntry {
  id?: string;
  alertId: string;
  alertType?: string;
  userId?: string;
  action: "created" | "dispatched" | "acknowledged" | "resolved" | "escalated" | "dismissed" | "expired";
  performedBy?: string;
  performedByRole?: "patient" | "caregiver" | "provider" | "system";
  actorId?: string;
  actorType?: "user" | "system" | "ai";
  previousState?: string;
  newState?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// ── Platform metric ───────────────────────────────────────────────────────────

export interface PlatformMetric {
  metricName: string;
  value: number;
  unit?: string;
  domain?: ObservabilityDomain;
  dimensions?: Record<string, string>;
  tags?: Record<string, string>;
  timestamp: Date;
}

// ── Escalation types ──────────────────────────────────────────────────────────

export type EscalationLevel = 1 | 2 | 3 | 4;

export interface EscalationPolicyLevel {
  level: EscalationLevel;
  delayMinutes: number;
  notifyRoles: Array<"patient" | "caregiver" | "provider" | "emergency" | "secondary_contact">;
  channels?: Array<"push" | "sms" | "email" | "call">;
  requireAcknowledgment?: boolean;
  action?: string;
  message?: string;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  alertTypes: string[];
  levels: EscalationPolicyLevel[];
  maxLevel?: EscalationLevel;
  autoResolveAfterMinutes?: number;
}
