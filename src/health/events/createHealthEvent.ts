/**
 * Health Event creation and management service
 *
 * Observability: Follows backend patterns with structured logging
 * - Logs include: traceId, userId/patientId, eventId, fn
 * - No PHI logged (only IDs, status, severity)
 * - All errors logged with context
 */

import { api } from "@/lib/apiClient";
import { logger } from "@/lib/utils/logger";
import type {
  CreateHealthEventInput,
  HealthEvent,
  HealthEventSeverity,
  UpdateHealthEventInput,
} from "./types";

/**
 * Generate a trace ID for correlation
 */
function createTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new health timeline event.
 */
export async function createHealthEvent(
  input: CreateHealthEventInput
): Promise<string> {
  const traceId = createTraceId();
  const startTime = Date.now();

  try {
    logger.info(
      "Creating health event",
      {
        traceId,
        userId: input.userId,
        type: input.type,
        severity: input.severity,
        source: input.source,
      },
      "createHealthEvent"
    );

    const response = await api.post<{ id: string }>("/api/health/timeline", {
      eventType: input.type,
      userId: input.userId,
      metadata: {
        severity: input.severity,
        reasons: input.reasons,
        source: input.source,
        vitalValues: input.vitalValues,
        status: "OPEN",
        ...input.metadata,
      },
      recordedAt: new Date().toISOString(),
    });

    const durationMs = Date.now() - startTime;
    logger.info(
      "Health event created successfully",
      {
        traceId,
        eventId: response.id,
        userId: input.userId,
        type: input.type,
        severity: input.severity,
        durationMs,
      },
      "createHealthEvent"
    );

    return response.id;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error(
      "Failed to create health event",
      {
        error,
        traceId,
        durationMs,
      },
      "createHealthEvent"
    );
    throw new Error("Failed to create health event");
  }
}

/**
 * Update an existing health event
 */
export async function updateHealthEvent(
  eventId: string,
  updates: UpdateHealthEventInput
): Promise<void> {
  const traceId = createTraceId();
  const startTime = Date.now();

  try {
    logger.info(
      "Updating health event",
      {
        traceId,
        eventId,
        status: updates.status,
        acknowledgedBy: updates.acknowledgedBy,
        resolvedBy: updates.resolvedBy,
        escalatedBy: updates.escalatedBy,
      },
      "updateHealthEvent"
    );

    const updateData: {
      status: UpdateHealthEventInput["status"];
      acknowledgedAt?: string;
      acknowledgedBy?: string;
      resolvedAt?: string;
      resolvedBy?: string;
      escalatedAt?: string;
      escalatedBy?: string;
      metadata?: HealthEvent["metadata"];
    } = {
      status: updates.status,
    };

    // Add timestamps based on status changes
    const now = new Date().toISOString();

    if (updates.status === "ACKED" && !updateData.acknowledgedAt) {
      updateData.acknowledgedAt = now;
      if (updates.acknowledgedBy) {
        updateData.acknowledgedBy = updates.acknowledgedBy;
      }
    }

    if (updates.status === "RESOLVED" && !updateData.resolvedAt) {
      updateData.resolvedAt = now;
      if (updates.resolvedBy) {
        updateData.resolvedBy = updates.resolvedBy;
      }
    }

    if (updates.status === "ESCALATED" && !updateData.escalatedAt) {
      updateData.escalatedAt = now;
      if (updates.escalatedBy) {
        updateData.escalatedBy = updates.escalatedBy;
      }
    }

    if (updates.metadata) {
      updateData.metadata = updates.metadata;
    }

    await api.patch<void>(`/api/health/timeline/${eventId}`, updateData);

    const durationMs = Date.now() - startTime;
    logger.info(
      "Health event updated successfully",
      {
        traceId,
        eventId,
        status: updates.status,
        durationMs,
      },
      "updateHealthEvent"
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error(
      "Failed to update health event",
      {
        error,
        traceId,
        durationMs,
      },
      "updateHealthEvent"
    );
    throw new Error("Failed to update health event");
  }
}

/**
 * Acknowledge a health event
 */
export async function acknowledgeHealthEvent(
  eventId: string,
  acknowledgedBy: string
): Promise<void> {
  logger.debug(
    "Acknowledging health event",
    {
      eventId,
      acknowledgedBy,
    },
    "acknowledgeHealthEvent"
  );

  await updateHealthEvent(eventId, {
    status: "ACKED",
    acknowledgedBy,
  });
}

/**
 * Resolve a health event
 */
export async function resolveHealthEvent(
  eventId: string,
  resolvedBy: string
): Promise<void> {
  logger.debug(
    "Resolving health event",
    {
      eventId,
      resolvedBy,
    },
    "resolveHealthEvent"
  );

  await updateHealthEvent(eventId, {
    status: "RESOLVED",
    resolvedBy,
  });
}

/**
 * Escalate a health event
 */
export async function escalateHealthEvent(
  eventId: string,
  escalatedBy: string,
  reason?: string
): Promise<void> {
  logger.info(
    "Escalating health event",
    {
      eventId,
      escalatedBy,
      hasReason: !!reason,
    },
    "escalateHealthEvent"
  );

  await updateHealthEvent(eventId, {
    status: "ESCALATED",
    escalatedBy,
    metadata: reason ? { escalationReason: reason } : undefined,
  });
}

/**
 * Create a vital alert health event from evaluation results
 */
export async function createVitalAlertEvent(
  userId: string,
  evaluation: {
    severity: "normal" | "attention" | "urgent";
    reasons: string[];
    timestamp: Date;
  },
  vitalValues: {
    heartRate?: number;
    spo2?: number;
    systolic?: number;
    diastolic?: number;
    temp?: number;
  },
  source: "wearable" | "manual" | "clinic" = "wearable"
): Promise<string | null> {
  const traceId = createTraceId();

  // Only create events for abnormal vitals
  if (evaluation.severity === "normal") {
    logger.debug(
      "Skipping vital alert event - severity is normal",
      {
        traceId,
        userId,
      },
      "createVitalAlertEvent"
    );
    return null;
  }

  logger.info(
    "Creating vital alert event",
    {
      traceId,
      userId,
      evaluationSeverity: evaluation.severity,
      reasonCount: evaluation.reasons.length,
      source,
    },
    "createVitalAlertEvent"
  );

  // Map severity levels
  const severityMap: Record<string, HealthEventSeverity> = {
    attention: "medium",
    urgent: "high",
  };

  const eventSeverity = severityMap[evaluation.severity] || "medium";

  try {
    const eventId = await createHealthEvent({
      userId,
      type: "VITAL_ALERT",
      severity: eventSeverity,
      reasons: evaluation.reasons,
      source,
      vitalValues,
      metadata: {
        evaluationTimestamp: evaluation.timestamp,
      },
    });

    logger.info(
      "Vital alert event created",
      {
        traceId,
        eventId,
        userId,
        severity: eventSeverity,
      },
      "createVitalAlertEvent"
    );

    return eventId;
  } catch (error) {
    logger.error(
      "Failed to create vital alert event",
      {
        error,
        traceId,
      },
      "createVitalAlertEvent"
    );
    throw error;
  }
}
