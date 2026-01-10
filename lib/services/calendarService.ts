import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CalendarEvent, RecurrencePattern } from "@/types";

class CalendarService {
  /**
   * Add a new calendar event
   */
  async addEvent(
    userId: string,
    event: Omit<CalendarEvent, "id" | "userId" | "createdAt" | "updatedAt">
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, "calendarEvents"), {
        ...event,
        userId,
        startDate: Timestamp.fromDate(event.startDate),
        endDate: event.endDate ? Timestamp.fromDate(event.endDate) : null,
        recurrenceEndDate: event.recurrenceEndDate
          ? Timestamp.fromDate(event.recurrenceEndDate)
          : null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Generate recurring events if needed
      if (event.recurrencePattern && event.recurrencePattern !== "none") {
        await this.generateRecurringEvents(docRef.id, event);
      }

      return docRef.id;
    } catch (error) {
      throw new Error("Failed to add calendar event");
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<Omit<CalendarEvent, "id" | "userId" | "createdAt">>
  ): Promise<void> {
    try {
      const docRef = doc(db, "calendarEvents", eventId);
      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      if (updates.startDate) {
        updateData.startDate = Timestamp.fromDate(updates.startDate);
      }
      if (updates.endDate) {
        updateData.endDate = Timestamp.fromDate(updates.endDate);
      }
      if (updates.recurrenceEndDate) {
        updateData.recurrenceEndDate = Timestamp.fromDate(
          updates.recurrenceEndDate
        );
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      throw new Error("Failed to update calendar event");
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "calendarEvents", eventId));
    } catch (error) {
      throw new Error("Failed to delete calendar event");
    }
  }

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    try {
      const docSnap = await getDoc(doc(db, "calendarEvents", eventId));

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        startDate: data.startDate?.toDate() || new Date(),
        endDate: data.endDate?.toDate(),
        recurrenceEndDate: data.recurrenceEndDate?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as CalendarEvent;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get events for a user
   */
  async getUserEvents(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CalendarEvent[]> {
    try {
      let q = query(
        collection(db, "calendarEvents"),
        where("userId", "==", userId),
        orderBy("startDate", "asc")
      );

      if (startDate) {
        q = query(q, where("startDate", ">=", Timestamp.fromDate(startDate)));
      }
      if (endDate) {
        q = query(q, where("startDate", "<=", Timestamp.fromDate(endDate)));
      }

      const snapshot = await getDocs(q);
      const events: CalendarEvent[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        events.push({
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate(),
          recurrenceEndDate: data.recurrenceEndDate?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as CalendarEvent);
      });

      return events;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get family events (shared events)
   */
  async getFamilyEvents(
    familyId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CalendarEvent[]> {
    try {
      let q = query(
        collection(db, "calendarEvents"),
        where("familyId", "==", familyId),
        orderBy("startDate", "asc")
      );

      if (startDate) {
        q = query(q, where("startDate", ">=", Timestamp.fromDate(startDate)));
      }
      if (endDate) {
        q = query(q, where("startDate", "<=", Timestamp.fromDate(endDate)));
      }

      const snapshot = await getDocs(q);
      const events: CalendarEvent[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        events.push({
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate(),
          recurrenceEndDate: data.recurrenceEndDate?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as CalendarEvent);
      });

      return events;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get events for a specific date
   */
  async getEventsForDate(
    userId: string,
    date: Date,
    includeFamily: boolean = false,
    familyId?: string
  ): Promise<CalendarEvent[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const userEvents = await this.getUserEvents(userId, startOfDay, endOfDay);

    if (includeFamily && familyId) {
      const familyEvents = await this.getFamilyEvents(
        familyId,
        startOfDay,
        endOfDay
      );
      return [...userEvents, ...familyEvents];
    }

    return userEvents;
  }

  /**
   * Get events for a date range
   */
  async getEventsForDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    includeFamily: boolean = false,
    familyId?: string
  ): Promise<CalendarEvent[]> {
    const userEvents = await this.getUserEvents(userId, startDate, endDate);

    if (includeFamily && familyId) {
      const familyEvents = await this.getFamilyEvents(
        familyId,
        startDate,
        endDate
      );
      return [...userEvents, ...familyEvents];
    }

    return userEvents;
  }

  /**
   * Generate recurring events
   */
  private async generateRecurringEvents(
    originalEventId: string,
    event: Omit<CalendarEvent, "id" | "userId" | "createdAt" | "updatedAt">
  ): Promise<void> {
    if (!event.recurrencePattern || event.recurrencePattern === "none") {
      return;
    }

    const events: Array<Omit<CalendarEvent, "id" | "userId" | "createdAt" | "updatedAt">> = [];
    const startDate = new Date(event.startDate);
    const endDate = event.recurrenceEndDate || new Date();
    endDate.setFullYear(endDate.getFullYear() + 1); // Default to 1 year ahead

    let currentDate = new Date(startDate);
    let count = 0;
    const maxCount = event.recurrenceCount || 365; // Safety limit

    while (currentDate <= endDate && count < maxCount) {
      if (count > 0) {
        // Skip the original event
        const eventEndDate = event.endDate
          ? new Date(event.endDate)
          : undefined;
        if (eventEndDate) {
          const duration = eventEndDate.getTime() - startDate.getTime();
          eventEndDate.setTime(currentDate.getTime() + duration);
        }

        events.push({
          ...event,
          startDate: new Date(currentDate),
          endDate: eventEndDate,
          relatedItemId: originalEventId, // Link to original
        });
      }

      // Calculate next occurrence
      switch (event.recurrencePattern) {
        case "daily":
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case "weekly":
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case "monthly":
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case "yearly":
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
        default:
          return; // Unknown pattern
      }

      count++;
    }

    // Add recurring events in batch (simplified - in production, use batch writes)
    // Note: This is a simplified implementation. In production, consider using Firestore batch writes
    // or a cloud function to generate recurring events more efficiently
    const userId = (event as any).userId;
    if (userId) {
      for (const recurringEvent of events) {
        try {
          await this.addEvent(userId, recurringEvent);
        } catch (error) {
          // Continue with other events even if one fails
        }
      }
    }
  }

  /**
   * Create event from medication
   */
  async createEventFromMedication(
    userId: string,
    medicationId: string,
    medicationName: string,
    reminderTime: string,
    familyId?: string
  ): Promise<string> {
    const [hours, minutes] = reminderTime.split(":").map(Number);
    const eventDate = new Date();
    eventDate.setHours(hours, minutes, 0, 0);

    return this.addEvent(userId, {
      title: `${medicationName} - Medication`,
      type: "medication",
      startDate: eventDate,
      allDay: false,
      relatedItemId: medicationId,
      relatedItemType: "medication",
      recurrencePattern: "daily",
      familyId,
      color: "#3B82F6", // Blue
      reminders: [
        {
          minutesBefore: 15,
          sent: false,
        },
      ],
    });
  }

  /**
   * Create event from appointment
   */
  async createAppointmentEvent(
    userId: string,
    title: string,
    startDate: Date,
    endDate: Date,
    location?: string,
    familyId?: string
  ): Promise<string> {
    return this.addEvent(userId, {
      title,
      type: "appointment",
      startDate,
      endDate,
      allDay: false,
      location,
      familyId,
      color: "#10B981", // Green
      reminders: [
        {
          minutesBefore: 60, // 1 hour before
          sent: false,
        },
        {
          minutesBefore: 1440, // 1 day before
          sent: false,
        },
      ],
    });
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(
    userId: string,
    days: number = 7,
    includeFamily: boolean = false,
    familyId?: string
  ): Promise<CalendarEvent[]> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.getEventsForDateRange(
      userId,
      startDate,
      endDate,
      includeFamily,
      familyId
    );
  }

  /**
   * Get events by type
   */
  async getEventsByType(
    userId: string,
    type: CalendarEvent["type"],
    startDate?: Date,
    endDate?: Date
  ): Promise<CalendarEvent[]> {
    const events = await this.getUserEvents(userId, startDate, endDate);
    return events.filter((event) => event.type === type);
  }
}

export const calendarService = new CalendarService();
