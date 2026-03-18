/**
 * Health Events Service
 * Handles querying and managing health timeline events via the Nuralix REST API.
 *
 * Observability: Follows backend patterns with structured logging
 * - Logs include: traceId, userId/patientId, eventId, fn
 * - No PHI logged (only IDs, counts, status)
 * - All errors logged with context
 */

import { api } from "@/lib/apiClient";
import { logger } from "@/lib/utils/logger";
import type { HealthEvent } from "./types";

/**
 * Generate a trace ID for correlation
 */
function createTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get health timeline events for the current authenticated user.
 * The `userId` parameter is accepted for call-site compatibility but the server
 * always returns the session user's own events — it does not accept a userId
 * override. Use `getFamilyHealthEvents()` to read another family member's events.
 */
export async function getUserHealthEvents(
  userId: string,
  limitCount = 50
): Promise<HealthEvent[]> {
  const _traceId = createTraceId();
  const startTime = Date.now();

  try {
    logger.debug(
      "Fetching user health events",
      { userId, limitCount },
      "healthEventsService"
    );

    // Note: the server ignores any userId query param and always scopes to the
    // session user.  Pass only the limit.
    const rawEvents = await api.get<Record<string, unknown>[]>(
      `/api/health/timeline?limit=${limitCount}`
    );

    const events: HealthEvent[] = rawEvents.map((data) => ({
      id: data.id as string,
      userId: data.userId as string,
      type: (data.eventType ?? data.type) as HealthEvent["type"],
      severity: data.severity as HealthEvent["severity"],
      reasons: (data.reasons as string[]) ?? [],
      status: (data.status as HealthEvent["status"]) ?? "OPEN",
      source: data.source as HealthEvent["source"],
      vitalValues: data.vitalValues as HealthEvent["vitalValues"],
      metadata: data.metadata as HealthEvent["metadata"],
      createdAt: data.recordedAt
        ? new Date(data.recordedAt as string)
        : new Date(),
      acknowledgedAt: data.acknowledgedAt
        ? new Date(data.acknowledgedAt as string)
        : undefined,
      resolvedAt: data.resolvedAt
        ? new Date(data.resolvedAt as string)
        : undefined,
      escalatedAt: data.escalatedAt
        ? new Date(data.escalatedAt as string)
        : undefined,
      acknowledgedBy: data.acknowledgedBy as string | undefined,
      resolvedBy: data.resolvedBy as string | undefined,
      escalatedBy: data.escalatedBy as string | undefined,
    }));

    const durationMs = Date.now() - startTime;
    logger.info(
      "User health events fetched successfully",
      {
        userId,
        eventCount: events.length,
        durationMs,
      },
      "healthEventsService"
    );

    return events;
  } catch (error) {
    logger.error(
      "Failed to get user health events",
      error,
      "healthEventsService"
    );
    // Return empty array to show real data only
    return [];
  }
}

/**
 * Get active (unresolved) health events for a user
 */
export async function getActiveHealthEvents(
  userId: string
): Promise<HealthEvent[]> {
  const _traceId = createTraceId();

  try {
    logger.debug(
      "Fetching active health events",
      { userId },
      "healthEventsService"
    );

    const events = await getUserHealthEvents(userId, 100);
    const activeEvents = events.filter(
      (event) =>
        event.status === "OPEN" ||
        event.status === "ACKED" ||
        event.status === "ESCALATED"
    );

    logger.info(
      "Active health events fetched",
      {
        userId,
        totalEvents: events.length,
        activeCount: activeEvents.length,
      },
      "healthEventsService"
    );

    return activeEvents;
  } catch (error) {
    logger.error(
      "Failed to get active health events",
      error,
      "healthEventsService"
    );
    return [];
  }
}

/**
 * Get health events by status
 */
export async function getHealthEventsByStatus(
  userId: string,
  status: HealthEvent["status"]
): Promise<HealthEvent[]> {
  const _traceId = createTraceId();

  try {
    logger.debug(
      "Fetching health events by status",
      { userId, status },
      "healthEventsService"
    );

    const events = await getUserHealthEvents(userId, 200);
    const filteredEvents = events.filter((event) => event.status === status);

    logger.info(
      "Health events by status fetched",
      {
        userId,
        status,
        totalEvents: events.length,
        filteredCount: filteredEvents.length,
      },
      "healthEventsService"
    );

    return filteredEvents;
  } catch (error) {
    logger.error(
      "Failed to get health events by status",
      error,
      "healthEventsService"
    );
    return [];
  }
}

/**
 * Get health timeline events for multiple family members.
 * Uses GET /api/health/timeline/family which verifies that all requested userIds
 * are confirmed members of the caller's family before returning their data.
 */
export async function getFamilyHealthEvents(
  userIds: string[],
  limitCount = 100
): Promise<HealthEvent[]> {
  const _traceId = createTraceId();
  const startTime = Date.now();

  try {
    if (userIds.length === 0) {
      logger.debug(
        "No user IDs provided for family health events",
        {},
        "healthEventsService"
      );
      return [];
    }

    logger.info(
      "Fetching family health events",
      { memberCount: userIds.length, limitCount },
      "healthEventsService"
    );

    // Use the dedicated family endpoint — it verifies family membership server-side
    // and returns events for all requested userIds in a single query.
    const rawEvents = await api.get<Record<string, unknown>[]>(
      `/api/health/timeline/family?userIds=${userIds.map(encodeURIComponent).join(",")}&limit=${limitCount}`
    );

    const allEvents: HealthEvent[] = rawEvents.map((data) => ({
      id: data.id as string,
      userId: data.userId as string,
      type: (data.eventType ?? data.type) as HealthEvent["type"],
      severity: data.severity as HealthEvent["severity"],
      reasons: (data.reasons as string[]) ?? [],
      status: (data.status as HealthEvent["status"]) ?? "OPEN",
      source: data.source as HealthEvent["source"],
      vitalValues: data.vitalValues as HealthEvent["vitalValues"],
      metadata: data.metadata as HealthEvent["metadata"],
      createdAt: data.recordedAt
        ? new Date(data.recordedAt as string)
        : new Date(),
      acknowledgedAt: data.acknowledgedAt
        ? new Date(data.acknowledgedAt as string)
        : undefined,
      resolvedAt: data.resolvedAt
        ? new Date(data.resolvedAt as string)
        : undefined,
      escalatedAt: data.escalatedAt
        ? new Date(data.escalatedAt as string)
        : undefined,
      acknowledgedBy: data.acknowledgedBy as string | undefined,
      resolvedBy: data.resolvedBy as string | undefined,
      escalatedBy: data.escalatedBy as string | undefined,
    }));

    // Server already sorts by occurredAt DESC and honours the limit,
    // but re-sort here to guarantee ordering after the response mapping.
    allEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const durationMs = Date.now() - startTime;
    logger.info(
      "Family health events fetched successfully",
      { memberCount: userIds.length, eventCount: allEvents.length, durationMs },
      "healthEventsService"
    );

    return allEvents;
  } catch (error) {
    logger.error(
      "Failed to get family health events",
      error,
      "healthEventsService"
    );
    return [];
  }
}
