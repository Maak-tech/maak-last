export type ObservabilityDomain =
  | "health_data"
  | "alerts"
  | "ai_assistant"
  | "platform"
  | "auth"
  | "sync"
  | "notifications"
  | "payments";

export type EventSeverity = "debug" | "info" | "warn" | "error" | "critical";

export type EventStatus =
  | "pending"
  | "success"
  | "failure"
  | "timeout"
  | "cancelled";

export type ObservabilityEvent = {
  id?: string;
  eventType: string;
  domain: ObservabilityDomain;
  severity: EventSeverity;
  status: EventStatus;
  message: string;
  timestamp: Date;
  correlationId?: string;
  userId?: string;
  familyId?: string;
  source: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  error?: {
    code?: string;
    message: string;
    stack?: string;
  };
};

export type HealthEvent = ObservabilityEvent & {
  domain: "health_data";
  vitalType?: string;
  value?: number;
  unit?: string;
  isAbnormal?: boolean;
  thresholdBreached?: string;
};

export type AlertEvent = ObservabilityEvent & {
  domain: "alerts";
  alertId: string;
  alertType: string;
  escalationLevel: number;
  acknowledgedBy?: string;
  resolvedBy?: string;
};

export type PlatformMetric = {
  id?: string;
  metricName: string;
  value: number;
  unit: string;
  timestamp: Date;
  domain: ObservabilityDomain;
  tags?: Record<string, string>;
};

export type SLODefinition = {
  id: string;
  name: string;
  target: number;
  window: "hourly" | "daily" | "weekly" | "monthly";
  metricName: string;
  comparator: "gte" | "lte" | "gt" | "lt";
};

export type SLOStatus = {
  sloId: string;
  currentValue: number;
  target: number;
  isMet: boolean;
  lastUpdated: Date;
  window: string;
};

export type Incident = {
  id?: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "resolved";
  createdAt: Date;
  resolvedAt?: Date;
  affectedServices: string[];
  correlatedEventIds: string[];
  timeline: IncidentTimelineEntry[];
};

export type IncidentTimelineEntry = {
  timestamp: Date;
  action: string;
  actor?: string;
  details?: string;
};

export type AlertAuditEntry = {
  id?: string;
  alertId: string;
  action:
    | "created"
    | "acknowledged"
    | "escalated"
    | "resolved"
    | "expired"
    | "snoozed";
  timestamp: Date;
  actorId?: string;
  actorType: "user" | "system" | "ai";
  previousState?: string;
  newState: string;
  notes?: string;
  metadata?: Record<string, unknown>;
};

export type HealthThreshold = {
  vitalType: string;
  min?: number;
  max?: number;
  unit: string;
  severity: EventSeverity;
  ageRanges?: {
    minAge?: number;
    maxAge?: number;
    min?: number;
    max?: number;
  }[];
};

export type EscalationPolicy = {
  id: string;
  name: string;
  alertTypes: string[];
  levels: EscalationLevel[];
};

export type EscalationLevel = {
  level: number;
  delayMinutes: number;
  notifyRoles: ("caregiver" | "secondary_contact" | "emergency")[];
  action: "notify" | "call" | "seek_care_guidance";
  message: string;
};

export type CircuitBreakerState = {
  serviceName: string;
  state: "closed" | "open" | "half_open";
  failureCount: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  nextRetryAt?: Date;
};
