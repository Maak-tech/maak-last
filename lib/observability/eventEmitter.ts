import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { AppState, type AppStateStatus } from "react-native";
import { db } from "@/lib/firebase";
import { logger } from "@/lib/utils/logger";
import type {
  ObservabilityEvent,
  HealthEvent,
  AlertEvent,
  PlatformMetric,
  AlertAuditEntry,
  ObservabilityDomain,
  EventSeverity,
  EventStatus,
} from "./types";

const EVENTS_COLLECTION = "observability_events";
const METRICS_COLLECTION = "observability_metrics";
const ALERT_AUDITS_COLLECTION = "alert_audits";

const ALLOWED_METADATA_KEYS = new Set([
  "vitalType",
  "unit",
  "isAbnormal",
  "thresholdBreached",
  "recommendedAction",
  "alertType",
  "escalationLevel",
  "policyId",
  "action",
  "serviceName",
  "operationName",
  "status",
  "timeout",
  "failureCount",
  "previousState",
  "interactionType",
  "eventType",
  "source",
  "domain",
  "severity",
  "count",
  "retryCount",
  "latencyMs",
]);

const PHI_PATTERNS = [
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /\b\d{10,}\b/g,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
];

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function redactPHI(text: string): string {
  let redacted = text;
  for (const pattern of PHI_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;
    
    if (typeof value === "string") {
      sanitized[key] = redactPHI(value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeError(error: { code?: string; message: string; stack?: string } | undefined): { code?: string; message: string } | undefined {
  if (!error) return undefined;
  
  return {
    code: error.code,
    message: redactPHI(error.message).substring(0, 200),
  };
}

function sanitizeForFirestore(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (key === "metadata") {
      const sanitizedMeta = sanitizeMetadata(value as Record<string, unknown>);
      if (sanitizedMeta) sanitized[key] = sanitizedMeta;
    } else if (key === "error") {
      const sanitizedErr = sanitizeError(value as any);
      if (sanitizedErr) sanitized[key] = sanitizedErr;
    } else if (key === "message" && typeof value === "string") {
      sanitized[key] = redactPHI(value).substring(0, 500);
    } else if (value instanceof Date) {
      sanitized[key] = Timestamp.fromDate(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeForFirestore(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class ObservabilityEventEmitter {
  private buffer: ObservabilityEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private maxBufferSize = 50;
  private flushIntervalMs = 10000;
  private isEnabled = true;
  private appStateSubscription: { remove: () => void } | null = null;

  constructor() {
    this.startFlushInterval();
    this.setupAppStateListener();
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  private setupAppStateListener(): void {
    try {
      this.appStateSubscription = AppState.addEventListener(
        "change",
        this.handleAppStateChange.bind(this)
      );
    } catch (error) {
      logger.warn("Failed to setup app state listener", error, "ObservabilityEmitter");
    }
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === "background" || nextAppState === "inactive") {
      this.flush();
    }
  }

  private startFlushInterval(): void {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const eventsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      const batch = eventsToFlush.map((event) =>
        addDoc(collection(db, EVENTS_COLLECTION), sanitizeForFirestore(event as any))
      );
      await Promise.allSettled(batch);
    } catch (error) {
      logger.error("Failed to flush observability events", error, "ObservabilityEmitter");
    }
  }

  async emit(event: Omit<ObservabilityEvent, "id" | "timestamp">): Promise<string> {
    if (!this.isEnabled) return "";

    const correlationId = event.correlationId || generateCorrelationId();
    const fullEvent: ObservabilityEvent = {
      ...event,
      timestamp: new Date(),
      correlationId,
    };

    this.buffer.push(fullEvent);

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }

    if (event.severity === "error" || event.severity === "critical") {
      logger.error(`[${event.domain}] ${event.message}`, event.metadata, event.source);
    } else if (event.severity === "warn") {
      logger.warn(`[${event.domain}] ${event.message}`, event.metadata, event.source);
    } else {
      logger.info(`[${event.domain}] ${event.message}`, event.metadata, event.source);
    }

    return correlationId;
  }

  async emitHealthEvent(
    eventType: string,
    message: string,
    options: {
      userId?: string;
      vitalType?: string;
      value?: number;
      unit?: string;
      isAbnormal?: boolean;
      thresholdBreached?: string;
      severity?: EventSeverity;
      status?: EventStatus;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<string> {
    const event: Omit<HealthEvent, "id" | "timestamp"> = {
      eventType,
      domain: "health_data",
      severity: options.severity || "info",
      status: options.status || "success",
      message,
      source: "health_service",
      userId: options.userId,
      vitalType: options.vitalType,
      value: options.value,
      unit: options.unit,
      isAbnormal: options.isAbnormal,
      thresholdBreached: options.thresholdBreached,
      correlationId: options.correlationId,
      metadata: options.metadata,
    };

    return this.emit(event);
  }

  async emitAlertEvent(
    eventType: string,
    alertId: string,
    alertType: string,
    message: string,
    options: {
      userId?: string;
      familyId?: string;
      escalationLevel?: number;
      acknowledgedBy?: string;
      resolvedBy?: string;
      severity?: EventSeverity;
      status?: EventStatus;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<string> {
    const event: Omit<AlertEvent, "id" | "timestamp"> = {
      eventType,
      domain: "alerts",
      severity: options.severity || "warn",
      status: options.status || "pending",
      message,
      source: "alert_service",
      alertId,
      alertType,
      escalationLevel: options.escalationLevel || 0,
      userId: options.userId,
      familyId: options.familyId,
      acknowledgedBy: options.acknowledgedBy,
      resolvedBy: options.resolvedBy,
      correlationId: options.correlationId,
      metadata: options.metadata,
    };

    return this.emit(event);
  }

  async emitPlatformEvent(
    eventType: string,
    message: string,
    options: {
      source: string;
      severity?: EventSeverity;
      status?: EventStatus;
      durationMs?: number;
      error?: { code?: string; message: string; stack?: string };
      correlationId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const event: Omit<ObservabilityEvent, "id" | "timestamp"> = {
      eventType,
      domain: "platform",
      severity: options.severity || "info",
      status: options.status || "success",
      message,
      source: options.source,
      durationMs: options.durationMs,
      error: options.error,
      correlationId: options.correlationId,
      metadata: options.metadata,
    };

    return this.emit(event);
  }

  async recordMetric(
    metricName: string,
    value: number,
    unit: string,
    domain: ObservabilityDomain,
    tags?: Record<string, string>
  ): Promise<void> {
    if (!this.isEnabled) return;

    const metric: PlatformMetric = {
      metricName,
      value,
      unit,
      domain,
      timestamp: new Date(),
      tags,
    };

    try {
      await addDoc(collection(db, METRICS_COLLECTION), sanitizeForFirestore(metric as any));
    } catch (error) {
      logger.error("Failed to record metric", { metricName, error }, "ObservabilityEmitter");
    }
  }

  async recordAlertAudit(
    alertId: string,
    action: AlertAuditEntry["action"],
    newState: string,
    options: {
      actorId?: string;
      actorType?: "user" | "system" | "ai";
      previousState?: string;
      notes?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    if (!this.isEnabled) return;

    const auditEntry: AlertAuditEntry = {
      alertId,
      action,
      timestamp: new Date(),
      actorId: options.actorId,
      actorType: options.actorType || "system",
      previousState: options.previousState,
      newState,
      notes: options.notes,
      metadata: options.metadata,
    };

    try {
      await addDoc(collection(db, ALERT_AUDITS_COLLECTION), sanitizeForFirestore(auditEntry as any));
    } catch (error) {
      logger.error("Failed to record alert audit", { alertId, action, error }, "ObservabilityEmitter");
    }
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.flush();
  }
}

export const observabilityEmitter = new ObservabilityEventEmitter();
