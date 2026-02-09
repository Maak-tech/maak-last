/**
 * Health Events Service
 * Handles querying and managing health events from Firestore
 *
 * Observability: Follows backend patterns with structured logging
 * - Logs include: traceId, userId/patientId, eventId, fn
 * - No PHI logged (only IDs, counts, status)
 * - All errors logged with context
 */

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logger } from "@/lib/utils/logger";
import type { HealthEvent } from "./types";

/**
 * Generate a trace ID for correlation
 */
function createTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get health events for a specific user
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

    const eventsQuery = query(
      collection(db, "healthEvents"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(eventsQuery);
    const events: HealthEvent[] = [];

    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      events.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        acknowledgedAt: data.acknowledgedAt?.toDate(),
        resolvedAt: data.resolvedAt?.toDate(),
        escalatedAt: data.escalatedAt?.toDate(),
      } as HealthEvent);
    }

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
 * Get health events for multiple family members
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
      {
        memberCount: userIds.length,
        limitCount,
      },
      "healthEventsService"
    );

    // Firestore 'in' queries have a limit of 10 items
    // If we have more than 10 users, we need to batch the queries
    const batchSize = 10;
    const batches: string[][] = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      batches.push(userIds.slice(i, i + batchSize));
    }

    const allEvents: HealthEvent[] = [];

    for (const batch of batches) {
      const eventsQuery = query(
        collection(db, "healthEvents"),
        where("userId", "in", batch),
        orderBy("createdAt", "desc"),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(eventsQuery);

      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        allEvents.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          acknowledgedAt: data.acknowledgedAt?.toDate(),
          resolvedAt: data.resolvedAt?.toDate(),
          escalatedAt: data.escalatedAt?.toDate(),
        } as HealthEvent);
      }
    }

    // Sort all events by creation date (most recent first)
    allEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Limit the total number of events returned
    const finalEvents = allEvents.slice(0, limitCount);

    const durationMs = Date.now() - startTime;
    logger.info(
      "Family health events fetched successfully",
      {
        memberCount: userIds.length,
        batchCount: batches.length,
        eventCount: finalEvents.length,
        durationMs,
      },
      "healthEventsService"
    );

    return finalEvents;
  } catch (error) {
    logger.error(
      "Failed to get family health events",
      error,
      "healthEventsService"
    );
    return [];
  }
}
