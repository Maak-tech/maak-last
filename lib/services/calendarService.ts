/* biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: Field-by-field update mapping is intentional. */
/**
 * Calendar Service — Firebase-free replacement.
 *
 * REST API endpoints:
 *   POST   /api/calendar           → addEvent
 *   GET    /api/calendar?from=&to= → getUserEvents
 *   GET    /api/calendar/family/:id?from=&to= → getFamilyEvents
 *   GET    /api/calendar/:id       → getEvent
 *   PATCH  /api/calendar/:id       → updateEvent
 *   DELETE /api/calendar/:id       → deleteEvent
 */
import { api } from "@/lib/apiClient";
import type { CalendarEvent } from "@/types";

function normalizeEvent(raw: Record<string, unknown>): CalendarEvent {
  return {
    id: raw.id as string,
    userId: raw.userId as string,
    familyId: raw.familyId as string | undefined,
    title: raw.title as string,
    type: raw.type as CalendarEvent["type"],
    description: raw.description as string | undefined,
    startDate: raw.startDate ? new Date(raw.startDate as string) : new Date(),
    endDate: raw.endDate ? new Date(raw.endDate as string) : undefined,
    allDay: (raw.allDay as boolean) ?? false,
    location: raw.location as string | undefined,
    recurrencePattern: raw.recurrencePattern as CalendarEvent["recurrencePattern"],
    recurrenceEndDate: raw.recurrenceEndDate
      ? new Date(raw.recurrenceEndDate as string)
      : undefined,
    recurrenceCount: raw.recurrenceCount as number | undefined,
    relatedItemId: raw.relatedItemId as string | undefined,
    relatedItemType: raw.relatedItemType as string | undefined,
    color: raw.color as string | undefined,
    reminders: raw.reminders as CalendarEvent["reminders"],
    tags: (raw.tags as string[]) ?? [],
    attendees: (raw.attendees as string[]) ?? [],
    createdAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt as string) : new Date(),
  } as CalendarEvent;
}

class CalendarService {
  async addEvent(
    userId: string,
    event: Omit<CalendarEvent, "id" | "userId" | "createdAt" | "updatedAt">
  ): Promise<string> {
    try {
      const result = await api.post<{ id: string }>("/api/calendar", {
        title: event.title,
        type: event.type,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate?.toISOString(),
        allDay: event.allDay ?? false,
        description: event.description,
        location: event.location,
        familyId: event.familyId,
        recurrencePattern: event.recurrencePattern,
        recurrenceEndDate: event.recurrenceEndDate?.toISOString(),
        recurrenceCount: event.recurrenceCount,
        relatedItemId: event.relatedItemId,
        relatedItemType: event.relatedItemType,
        color: event.color,
        reminders: event.reminders,
        tags: event.tags,
        attendees: event.attendees,
      });

      if (event.recurrencePattern && event.recurrencePattern !== "none") {
        await this.generateRecurringEvents(result.id, event, userId);
      }

      return result.id;
    } catch (error) {
      throw new Error(`Failed to add calendar event: ${error}`);
    }
  }

  async updateEvent(
    eventId: string,
    updates: Partial<Omit<CalendarEvent, "id" | "userId" | "createdAt">>
  ): Promise<void> {
    try {
      const body: Record<string, unknown> = {};
      if (updates.title !== undefined) body.title = updates.title;
      if (updates.description !== undefined) body.description = updates.description ?? null;
      if (updates.type !== undefined) body.type = updates.type;
      if (updates.startDate !== undefined) body.startDate = updates.startDate.toISOString();
      if (updates.endDate !== undefined) body.endDate = updates.endDate?.toISOString() ?? null;
      if (updates.allDay !== undefined) body.allDay = updates.allDay;
      if (updates.location !== undefined) body.location = updates.location ?? null;
      if (updates.familyId !== undefined) body.familyId = updates.familyId ?? null;
      if (updates.recurrencePattern !== undefined) body.recurrencePattern = updates.recurrencePattern ?? null;
      if (updates.recurrenceEndDate !== undefined) body.recurrenceEndDate = updates.recurrenceEndDate?.toISOString() ?? null;
      if (updates.recurrenceCount !== undefined) body.recurrenceCount = updates.recurrenceCount ?? null;
      if (updates.relatedItemId !== undefined) body.relatedItemId = updates.relatedItemId ?? null;
      if (updates.relatedItemType !== undefined) body.relatedItemType = updates.relatedItemType ?? null;
      if (updates.color !== undefined) body.color = updates.color ?? null;
      if (updates.reminders !== undefined) body.reminders = updates.reminders ?? null;
      if (updates.tags !== undefined) body.tags = updates.tags ?? null;
      if (updates.attendees !== undefined) body.attendees = updates.attendees ?? null;
      await api.patch(`/api/calendar/${eventId}`, body);
    } catch (error) {
      throw new Error(`Failed to update calendar event: ${error}`);
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      await api.delete(`/api/calendar/${eventId}`);
    } catch (_error) {
      throw new Error("Failed to delete calendar event");
    }
  }

  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    try {
      const raw = await api.get<Record<string, unknown> | null>(`/api/calendar/${eventId}`);
      return raw ? normalizeEvent(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  async getUserEvents(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CalendarEvent[]> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("from", startDate.toISOString());
      if (endDate) params.set("to", endDate.toISOString());
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/calendar?${params.toString()}`
      );
      return (raw ?? []).map(normalizeEvent);
    } catch (_error) {
      return [];
    }
  }

  async getFamilyEvents(
    familyId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CalendarEvent[]> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("from", startDate.toISOString());
      if (endDate) params.set("to", endDate.toISOString());
      const raw = await api.get<Record<string, unknown>[]>(
        `/api/calendar/family/${familyId}?${params.toString()}`
      );
      return (raw ?? []).map(normalizeEvent);
    } catch (_error) {
      return [];
    }
  }

  async getEventsForDate(
    userId: string,
    date: Date,
    includeFamily = false,
    familyId?: string
  ): Promise<CalendarEvent[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const userEvents = await this.getUserEvents(userId, startOfDay, endOfDay);

    if (includeFamily && familyId) {
      const familyEvents = await this.getFamilyEvents(familyId, startOfDay, endOfDay);
      return [...userEvents, ...familyEvents];
    }
    return userEvents;
  }

  /* biome-ignore lint/nursery/useMaxParams: API shape is intentionally aligned with sibling methods */
  async getEventsForDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    includeFamily = false,
    familyId?: string
  ): Promise<CalendarEvent[]> {
    const userEvents = await this.getUserEvents(userId, startDate, endDate);

    if (includeFamily && familyId) {
      const familyEvents = await this.getFamilyEvents(familyId, startDate, endDate);
      return [...userEvents, ...familyEvents];
    }
    return userEvents;
  }

  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Recurrence generation handles multiple patterns */
  private async generateRecurringEvents(
    originalEventId: string,
    event: Omit<CalendarEvent, "id" | "userId" | "createdAt" | "updatedAt">,
    userId: string
  ): Promise<void> {
    if (!event.recurrencePattern || event.recurrencePattern === "none") return;

    const events: Omit<CalendarEvent, "id" | "userId" | "createdAt" | "updatedAt">[] = [];
    const startDate = new Date(event.startDate);
    const endDate = event.recurrenceEndDate || new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const currentDate = new Date(startDate);
    let count = 0;
    const maxCount = event.recurrenceCount || 365;

    while (currentDate <= endDate && count < maxCount) {
      if (count > 0) {
        const eventEndDate = event.endDate ? new Date(event.endDate) : undefined;
        if (eventEndDate) {
          const duration = eventEndDate.getTime() - startDate.getTime();
          eventEndDate.setTime(currentDate.getTime() + duration);
        }
        events.push({
          ...event,
          startDate: new Date(currentDate),
          endDate: eventEndDate,
          relatedItemId: originalEventId,
        });
      }

      switch (event.recurrencePattern) {
        case "daily": currentDate.setDate(currentDate.getDate() + 1); break;
        case "weekly": currentDate.setDate(currentDate.getDate() + 7); break;
        case "monthly": currentDate.setMonth(currentDate.getMonth() + 1); break;
        case "yearly": currentDate.setFullYear(currentDate.getFullYear() + 1); break;
        default: return;
      }
      count += 1;
    }

    for (const recurringEvent of events) {
      try {
        await this.addEvent(userId, recurringEvent);
      } catch (_error) {
        // Continue with other events even if one fails
      }
    }
  }

  /* biome-ignore lint/nursery/useMaxParams: Keeping explicit parameters simplifies call sites */
  createEventFromMedication(
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
      color: "#3B82F6",
      reminders: [{ minutesBefore: 15, sent: false }],
    });
  }

  /* biome-ignore lint/nursery/useMaxParams: Signature mirrors appointment domain fields */
  createAppointmentEvent(
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
      color: "#10B981",
      reminders: [
        { minutesBefore: 60, sent: false },
        { minutesBefore: 1440, sent: false },
      ],
    });
  }

  getUpcomingEvents(
    userId: string,
    days = 7,
    includeFamily = false,
    familyId?: string
  ): Promise<CalendarEvent[]> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    return this.getEventsForDateRange(userId, startDate, endDate, includeFamily, familyId);
  }

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
