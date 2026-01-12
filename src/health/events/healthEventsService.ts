/**
 * Health Events Service
 * Handles querying and managing health events from Firestore
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { HealthEvent } from "./types";

/**
 * Get health events for a specific user
 */
export async function getUserHealthEvents(
  userId: string,
  limitCount = 50
): Promise<HealthEvent[]> {
  try {
    const eventsQuery = query(
      collection(db, "healthEvents"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(eventsQuery);
    const events: HealthEvent[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      events.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        acknowledgedAt: data.acknowledgedAt?.toDate(),
        resolvedAt: data.resolvedAt?.toDate(),
        escalatedAt: data.escalatedAt?.toDate(),
      } as HealthEvent);
    });

    return events;
  } catch (error) {
    console.error("Failed to get user health events:", error);
    // Return mock data for development if Firestore fails
    return getMockHealthEvents(userId);
  }
}

/**
 * Get active (unresolved) health events for a user
 */
export async function getActiveHealthEvents(userId: string): Promise<HealthEvent[]> {
  try {
    const events = await getUserHealthEvents(userId, 100);
    return events.filter(event =>
      event.status === "OPEN" || event.status === "ACKED" || event.status === "ESCALATED"
    );
  } catch (error) {
    console.error("Failed to get active health events:", error);
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
  try {
    const events = await getUserHealthEvents(userId, 200);
    return events.filter(event => event.status === status);
  } catch (error) {
    console.error("Failed to get health events by status:", error);
    return [];
  }
}

/**
 * Mock data for development and testing
 */
function getMockHealthEvents(userId: string): HealthEvent[] {
  return [
    {
      id: "mock-1",
      userId,
      type: "VITAL_ALERT",
      severity: "high",
      reasons: ["Heart rate: 120 bpm (attention)", "Systolic BP: 160 mmHg (urgent)"],
      status: "OPEN",
      source: "wearable",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      vitalValues: { heartRate: 120, systolic: 160, diastolic: 95 },
    },
    {
      id: "mock-2",
      userId,
      type: "VITAL_ALERT",
      severity: "medium",
      reasons: ["Oxygen saturation: 92% (attention)"],
      status: "ACKED",
      source: "wearable",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      acknowledgedAt: new Date(Date.now() - 20 * 60 * 60 * 1000), // 20 hours ago
      vitalValues: { spo2: 92 },
    },
    {
      id: "mock-3",
      userId,
      type: "VITAL_ALERT",
      severity: "critical",
      reasons: ["Body temperature: 39.5°C (urgent)", "Heart rate: 45 bpm (urgent)"],
      status: "RESOLVED",
      source: "manual",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      acknowledgedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 min later
      resolvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours later
      vitalValues: { temp: 39.5, heartRate: 45 },
    },
  ];
}