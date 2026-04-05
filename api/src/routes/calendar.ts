import { Elysia, t } from "elysia";
import { and, eq, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { calendarEvents, familyMembers } from "../db/schema";

export const calendarRoutes = new Elysia({ prefix: "/api/calendar" })
  .use(requireAuth)

  // Create a calendar event.
  // If familyId is provided, the requesting user must be a member of that family.
  .post(
    "/",
    async ({ db, userId, body, set }) => {
      // When attaching an event to a family, verify the caller is a member
      if (body.familyId) {
        const [membership] = await db
          .select({ role: familyMembers.role })
          .from(familyMembers)
          .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, body.familyId)))
          .limit(1);

        if (!membership) {
          set.status = 403;
          return { error: "You are not a member of this family" };
        }
      }

      // Validate date fields before passing to Postgres
      if (isNaN(new Date(body.startDate).getTime())) {
        set.status = 400;
        return { error: "Invalid startDate — use ISO 8601 format" };
      }
      if (body.endDate && isNaN(new Date(body.endDate).getTime())) {
        set.status = 400;
        return { error: "Invalid endDate — use ISO 8601 format" };
      }
      if (body.recurrenceEndDate && isNaN(new Date(body.recurrenceEndDate).getTime())) {
        set.status = 400;
        return { error: "Invalid recurrenceEndDate — use ISO 8601 format" };
      }

      const [event] = await db
        .insert(calendarEvents)
        .values({
          userId,
          familyId: body.familyId,
          title: body.title,
          type: body.type,
          description: body.description,
          startDate: new Date(body.startDate),
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          allDay: body.allDay ?? false,
          location: body.location,
          recurrencePattern: body.recurrencePattern,
          recurrenceEndDate: body.recurrenceEndDate ? new Date(body.recurrenceEndDate) : undefined,
          recurrenceCount: body.recurrenceCount,
          relatedItemId: body.relatedItemId,
          relatedItemType: body.relatedItemType,
          color: body.color,
          reminders: body.reminders,
          tags: body.tags,
          attendees: body.attendees,
        })
        .returning({ id: calendarEvents.id });
      return { id: event.id };
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 255 }),
        type: t.String({ maxLength: 50 }),
        startDate: t.String({ maxLength: 50 }),
        endDate: t.Optional(t.String({ maxLength: 50 })),
        allDay: t.Optional(t.Boolean()),
        description: t.Optional(t.String({ maxLength: 5000 })),
        location: t.Optional(t.String({ maxLength: 500 })),
        familyId: t.Optional(t.String()),
        recurrencePattern: t.Optional(t.String({ maxLength: 100 })),
        recurrenceEndDate: t.Optional(t.String({ maxLength: 50 })),
        recurrenceCount: t.Optional(t.Number({ minimum: 1, maximum: 1000 })),
        relatedItemId: t.Optional(t.String()),
        relatedItemType: t.Optional(t.String({ maxLength: 100 })),
        color: t.Optional(t.String({ maxLength: 20 })),
        reminders: t.Optional(t.Array(t.Object({ minutesBefore: t.Number({ minimum: 0, maximum: 43200 }), sent: t.Boolean() }), { maxItems: 10 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 20 })),
        attendees: t.Optional(t.Array(t.String(), { maxItems: 100 })),
      }),
      detail: { tags: ["calendar"], summary: "Add a calendar event" },
    }
  )

  // List the requesting user's own events
  .get(
    "/",
    async ({ db, userId, query, set }) => {
      if (query.from && isNaN(new Date(query.from).getTime())) {
        set.status = 400;
        return { error: "Invalid 'from' date — use ISO 8601 format" };
      }
      if (query.to && isNaN(new Date(query.to).getTime())) {
        set.status = 400;
        return { error: "Invalid 'to' date — use ISO 8601 format" };
      }
      const conditions = [eq(calendarEvents.userId, userId)];
      if (query.from) conditions.push(gte(calendarEvents.startDate, new Date(query.from)));
      if (query.to) conditions.push(lte(calendarEvents.startDate, new Date(query.to)));
      return db.select().from(calendarEvents).where(and(...conditions)).orderBy(calendarEvents.startDate);
    },
    {
      query: t.Object({
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
      }),
      detail: { tags: ["calendar"], summary: "Get user calendar events" },
    }
  )

  // List events for a family — requesting user must be a member of that family
  .get(
    "/family/:familyId",
    async ({ db, userId, params, query, set }) => {
      const [membership] = await db
        .select({ role: familyMembers.role })
        .from(familyMembers)
        .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, params.familyId)))
        .limit(1);

      if (!membership) {
        set.status = 403;
        return { error: "You are not a member of this family" };
      }

      if (query.from && isNaN(new Date(query.from).getTime())) {
        set.status = 400;
        return { error: "Invalid 'from' date — use ISO 8601 format" };
      }
      if (query.to && isNaN(new Date(query.to).getTime())) {
        set.status = 400;
        return { error: "Invalid 'to' date — use ISO 8601 format" };
      }
      const conditions = [eq(calendarEvents.familyId, params.familyId)];
      if (query.from) conditions.push(gte(calendarEvents.startDate, new Date(query.from)));
      if (query.to) conditions.push(lte(calendarEvents.startDate, new Date(query.to)));
      return db.select().from(calendarEvents).where(and(...conditions)).orderBy(calendarEvents.startDate);
    },
    {
      params: t.Object({ familyId: t.String() }),
      query: t.Object({ from: t.Optional(t.String()), to: t.Optional(t.String()) }),
      detail: { tags: ["calendar"], summary: "Get family calendar events (family member)" },
    }
  )

  // Get a single event — must be owner or a member of the event's family
  .get(
    "/:id",
    async ({ db, userId, params, set }) => {
      const [event] = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, params.id))
        .limit(1);

      if (!event) {
        set.status = 404;
        return { error: "Event not found" };
      }

      // Owner access
      if (event.userId === userId) return event;

      // Family event: any family member may read it
      if (event.familyId) {
        const [membership] = await db
          .select({ role: familyMembers.role })
          .from(familyMembers)
          .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, event.familyId)))
          .limit(1);

        if (membership) return event;
      }

      set.status = 403;
      return { error: "Access denied" };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["calendar"], summary: "Get a calendar event by ID" },
    }
  )

  // Update an event — must be owner or a member of the event's family
  .patch(
    "/:id",
    async ({ db, userId, body, params, set }) => {
      const [event] = await db
        .select({ id: calendarEvents.id, userId: calendarEvents.userId, familyId: calendarEvents.familyId })
        .from(calendarEvents)
        .where(eq(calendarEvents.id, params.id))
        .limit(1);

      if (!event) {
        set.status = 404;
        return { error: "Event not found" };
      }

      // Owner access
      let authorized = event.userId === userId;

      // Family event: any family member may update it
      if (!authorized && event.familyId) {
        const [membership] = await db
          .select({ role: familyMembers.role })
          .from(familyMembers)
          .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, event.familyId)))
          .limit(1);

        if (membership) authorized = true;
      }

      if (!authorized) {
        set.status = 403;
        return { error: "Access denied" };
      }

      // When reassigning to a new familyId, verify the caller is a member of that family.
      // Without this check, a user could share an event with a family they don't belong to.
      if (body.familyId !== undefined && body.familyId !== event.familyId) {
        if (body.familyId === null) {
          // Removing family association is always allowed by the event owner
          if (event.userId !== userId) {
            set.status = 403;
            return { error: "Only the event owner can remove the family association" };
          }
        } else {
          const [newFamilyMembership] = await db
            .select({ role: familyMembers.role })
            .from(familyMembers)
            .where(and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, body.familyId)))
            .limit(1);
          if (!newFamilyMembership) {
            set.status = 403;
            return { error: "You are not a member of the target family" };
          }
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.title !== undefined) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;
      if (body.type !== undefined) updates.type = body.type;
      if (body.startDate !== undefined) {
        const d = new Date(body.startDate);
        if (Number.isNaN(d.getTime())) { set.status = 400; return { error: "Invalid startDate" }; }
        updates.startDate = d;
      }
      if (body.endDate !== undefined) updates.endDate = body.endDate ? new Date(body.endDate) : null;
      if (body.allDay !== undefined) updates.allDay = body.allDay;
      if (body.location !== undefined) updates.location = body.location;
      if (body.familyId !== undefined) updates.familyId = body.familyId;
      if (body.recurrencePattern !== undefined) updates.recurrencePattern = body.recurrencePattern;
      if (body.recurrenceEndDate !== undefined) {
        if (body.recurrenceEndDate) {
          const rd = new Date(body.recurrenceEndDate);
          if (Number.isNaN(rd.getTime())) { set.status = 400; return { error: "Invalid recurrenceEndDate" }; }
          updates.recurrenceEndDate = rd;
        } else {
          updates.recurrenceEndDate = null;
        }
      }
      if (body.recurrenceCount !== undefined) updates.recurrenceCount = body.recurrenceCount;
      if (body.relatedItemId !== undefined) updates.relatedItemId = body.relatedItemId;
      if (body.relatedItemType !== undefined) updates.relatedItemType = body.relatedItemType;
      if (body.color !== undefined) updates.color = body.color;
      if (body.reminders !== undefined) updates.reminders = body.reminders;
      if (body.tags !== undefined) updates.tags = body.tags;
      if (body.attendees !== undefined) updates.attendees = body.attendees;

      await db.update(calendarEvents).set(updates).where(
        and(eq(calendarEvents.id, params.id), eq(calendarEvents.userId, event.userId))
      );
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Partial(t.Object({
        title: t.String({ minLength: 1, maxLength: 255 }),
        description: t.String({ maxLength: 5000 }),
        type: t.String({ maxLength: 50 }),
        startDate: t.String({ maxLength: 50 }),
        endDate: t.Union([t.String({ maxLength: 50 }), t.Null()]),
        allDay: t.Boolean(),
        location: t.String({ maxLength: 500 }),
        familyId: t.Union([t.String({ maxLength: 36 }), t.Null()]),
        recurrencePattern: t.String({ maxLength: 100 }),
        recurrenceEndDate: t.Union([t.String({ maxLength: 50 }), t.Null()]),
        recurrenceCount: t.Union([t.Number({ minimum: 1, maximum: 1000 }), t.Null()]),
        relatedItemId: t.String({ maxLength: 36 }),
        relatedItemType: t.String({ maxLength: 100 }),
        color: t.String({ maxLength: 20 }),
        reminders: t.Array(t.Object({ minutesBefore: t.Number({ minimum: 0, maximum: 43200 }), sent: t.Boolean() }), { maxItems: 10 }),
        tags: t.Array(t.String({ maxLength: 50 }), { maxItems: 20 }),
        attendees: t.Array(t.String(), { maxItems: 100 }),
      })),
      detail: { tags: ["calendar"], summary: "Update a calendar event" },
    }
  )

  // Delete an event — must be owner; family members may not delete others' events
  .delete(
    "/:id",
    async ({ db, userId, params, set }) => {
      const [event] = await db
        .select({ id: calendarEvents.id, userId: calendarEvents.userId })
        .from(calendarEvents)
        .where(eq(calendarEvents.id, params.id))
        .limit(1);

      if (!event) {
        set.status = 404;
        return { error: "Event not found" };
      }

      if (event.userId !== userId) {
        set.status = 403;
        return { error: "Only the event creator can delete it" };
      }

      // Include userId in WHERE to close the TOCTOU window between the
      // ownership check above and this mutation.
      await db.delete(calendarEvents).where(and(eq(calendarEvents.id, params.id), eq(calendarEvents.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["calendar"], summary: "Delete a calendar event (owner only)" },
    }
  );
