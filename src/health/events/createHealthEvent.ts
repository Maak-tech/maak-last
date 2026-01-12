/**
 * Health Event creation and management service
 */

import { addDoc, collection, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  HealthEvent,
  CreateHealthEventInput,
  UpdateHealthEventInput,
  HealthEventSeverity,
} from "./types";

const HEALTH_EVENTS_COLLECTION = "healthEvents";

/**
 * Create a new health event in Firestore
 */
export async function createHealthEvent(input: CreateHealthEventInput): Promise<string> {
  try {
    const eventData: Omit<HealthEvent, "id"> = {
      ...input,
      status: "OPEN",
      createdAt: new Date(),
    };

    const docRef = await addDoc(collection(db, HEALTH_EVENTS_COLLECTION), {
      ...eventData,
      createdAt: Timestamp.fromDate(eventData.createdAt),
    });

    return docRef.id;
  } catch (error) {
    console.error("Failed to create health event:", error);
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
  try {
    const updateData: any = {
      status: updates.status,
    };

    // Add timestamps based on status changes
    const now = Timestamp.now();

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

    await updateDoc(doc(db, HEALTH_EVENTS_COLLECTION, eventId), updateData);
  } catch (error) {
    console.error("Failed to update health event:", error);
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
  // Only create events for abnormal vitals
  if (evaluation.severity === "normal") {
    return null;
  }

  // Map severity levels
  const severityMap: Record<string, HealthEventSeverity> = {
    attention: "medium",
    urgent: "high",
  };

  const eventSeverity = severityMap[evaluation.severity] || "medium";

  return await createHealthEvent({
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
}