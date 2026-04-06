import { Elysia, t } from "elysia";
import { and, eq, isNull } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../../middleware/requireAuth.js";
import { allergies } from "../../db/schema.js";
import { assertFamilyWriteAccess } from "../../services/familyAccessService.js";

// Reusable ISO 8601 date-string type.
const IsoDateString = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}" });

export const allergiesRoutes = new Elysia()
  .use(requireAuth)

  // ── GET /allergies ───────────────────────────────────────────────────────────
  .get(
    "/allergies",
    async ({ db, userId }) => {
      // Cap at 200 — patients rarely have more than a handful of documented allergies,
      // and an unbounded SELECT would serialize every row on a large migrated dataset.
      return db.select().from(allergies).where(and(eq(allergies.userId, userId), isNull(allergies.deletedAt))).limit(200);
    },
    { detail: { tags: ["health"], summary: "Get allergies" } }
  )

  // ── POST /allergies ──────────────────────────────────────────────────────────
  .post(
    "/allergies",
    async ({ db, userId, body, set }) => {
      const targetUserId = body.userId ?? userId;
      if (targetUserId !== userId) {
        const authErr = await assertFamilyWriteAccess(db, userId, targetUserId);
        if (authErr) { set.status = 403; return authErr; }
      }
      const id = crypto.randomUUID();
      const [created] = await db
        .insert(allergies)
        .values({
          id,
          userId: targetUserId,
          substance: body.name,
          reaction: body.reaction,
          severity: body.severity,
          diagnosedDate: body.discoveredDate ? new Date(body.discoveredDate) : undefined,
          notes: body.notes,
        })
        .returning();
      return created;
    },
    {
      body: t.Object({
        name: t.String({ maxLength: 255 }),
        userId: t.Optional(t.String({ maxLength: 36 })),
        severity: t.Optional(t.String({ maxLength: 50 })),
        reaction: t.Optional(t.String({ maxLength: 1000 })),
        discoveredDate: t.Optional(IsoDateString),
        notes: t.Optional(t.String({ maxLength: 2000 })),
      }),
      detail: { tags: ["health"], summary: "Add an allergy" },
    }
  )

  // ── PATCH /allergies/:id ─────────────────────────────────────────────────────
  .patch(
    "/allergies/:id",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db.select({ id: allergies.id, userId: allergies.userId }).from(allergies).where(and(eq(allergies.id, params.id), isNull(allergies.deletedAt))).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Allergy not found" }; }
      const [updated] = await db
        .update(allergies)
        .set({
          ...(body.name !== undefined && { substance: body.name }),
          ...(body.reaction !== undefined && { reaction: body.reaction }),
          ...(body.severity !== undefined && { severity: body.severity }),
          ...(body.discoveredDate !== undefined && { diagnosedDate: body.discoveredDate ? new Date(body.discoveredDate) : null }),
          ...(body.notes !== undefined && { notes: body.notes }),
        })
        .where(and(eq(allergies.id, params.id), eq(allergies.userId, userId), isNull(allergies.deletedAt)))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 255 })),
        reaction: t.Optional(t.String({ maxLength: 1000 })),
        severity: t.Optional(t.String({ maxLength: 50 })),
        discoveredDate: t.Optional(t.Nullable(IsoDateString)),
        notes: t.Optional(t.String({ maxLength: 2000 })),
      }),
      detail: { tags: ["health"], summary: "Update an allergy" },
    }
  )

  // ── DELETE /allergies/:id ────────────────────────────────────────────────────
  .delete(
    "/allergies/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: allergies.id, userId: allergies.userId }).from(allergies).where(and(eq(allergies.id, params.id), isNull(allergies.deletedAt))).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Allergy not found" }; }
      await db
        .update(allergies)
        .set({ deletedAt: new Date() })
        .where(and(eq(allergies.id, params.id), eq(allergies.userId, userId), isNull(allergies.deletedAt)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Delete an allergy" },
    }
  );
