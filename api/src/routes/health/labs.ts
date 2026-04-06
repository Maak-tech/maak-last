import { Elysia, t } from "elysia";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../../middleware/requireAuth.js";
import { logger } from "../../lib/logger.js";
import { labResults, alerts, healthTimeline } from "../../db/schema.js";
import { pushToUserAndFamilyAdmins } from "../../lib/push.js";
import { assertFamilyAccess } from "../../services/familyAccessService.js";

// Reusable ISO 8601 date-string type.
const IsoDateString = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}" });

const LabResultItem = t.Object({
  test:  t.String({ minLength: 1, maxLength: 100 }),
  value: t.Number(),
  unit:  t.Optional(t.String({ maxLength: 20 })),
  flag:  t.Optional(t.Union([
    t.Literal('H'),
    t.Literal('L'),
    t.Literal('HH'),
    t.Literal('LL'),
    t.Literal('N'),
    t.Literal('A'),
  ])),
  referenceRange: t.Optional(t.Object({
    low:  t.Number(),
    high: t.Number(),
  })),
})

function safeLabResults(raw: unknown): Array<{ test: string; value: number; unit?: string; flag?: string }> {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is { test: string; value: number; unit?: string; flag?: string } =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).test === 'string' &&
      typeof (item as Record<string, unknown>).value === 'number',
  )
}

export const labsRoutes = new Elysia()
  .use(requireAuth)

  // ── GET /labs ────────────────────────────────────────────────────────────────
  .get(
    "/labs",
    async ({ db, userId, query, set }) => {
      // Optional ?userId param allows family admins to fetch a member's labs
      const targetId = query.userId ?? userId;
      if (targetId !== userId) {
        const authErr = await assertFamilyAccess(db, userId, targetId, "labs");
        if (authErr) { set.status = 403; return authErr; }
      }
      const filters = [eq(labResults.userId, targetId)];
      if (query.from) filters.push(gte(labResults.testDate, new Date(query.from)));
      if (query.to) filters.push(lte(labResults.testDate, new Date(query.to)));
      return db
        .select()
        .from(labResults)
        .where(and(...filters))
        .orderBy(desc(labResults.testDate))
        .limit(query.limit ?? 50);
    },
    {
      query: t.Object({
        userId: t.Optional(t.String({ minLength: 1, maxLength: 36 })),
        from: t.Optional(IsoDateString),
        to: t.Optional(IsoDateString),
        // Cap at 500 to prevent a caller passing limit=9999999 to dump the full table.
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 500 })),
      }),
      detail: { tags: ["health"], summary: "Get lab results (own or family member's with admin access)" },
    }
  )

  // ── POST /labs ───────────────────────────────────────────────────────────────
  .post(
    "/labs",
    async ({ db, userId, body }) => {
      const id = crypto.randomUUID();
      const [created] = await db
        .insert(labResults)
        .values({
          id,
          userId,
          testName: body.testName,
          testType: body.testType,
          testDate: new Date(body.testDate),
          orderedBy: body.orderedBy,
          facility: body.facility,
          results: body.results,
          notes: body.notes,
          tags: body.tags,
        })
        .returning();

      // After insert, check for critical flags and fire an immediate alert
      const results = safeLabResults(body.results ?? []);
      const criticalResult = results.find((r) => r.flag === 'critical');
      if (criticalResult) {
        // Fire an alert immediately for critical lab values — don't wait for VHI cycle
        const alertId = crypto.randomUUID();
        await db.insert(alerts).values({
          id: alertId,
          userId: created.userId,
          type: 'critical_lab_value',
          severity: 'critical',
          title: 'Critical Lab Result',
          body: `A critical lab result has been recorded. Open Nuralix to review.`,
          isAcknowledged: false,
          metadata: { labResultId: created.id, testName: body.testName },
        });
        // Push to patient and family admins without awaiting (non-blocking)
        pushToUserAndFamilyAdmins(
          created.userId,
          { title: '🔴 Critical Lab Result', body: 'A critical lab result requires your attention.', data: { screen: 'health', tab: 'labs' }, priority: 'high' },
          { title: `🔴 Critical Lab — ${created.userId}`, body: 'A critical lab result was recorded for a family member.', data: { screen: 'family', userId: created.userId }, priority: 'high' }
        ).catch((err: unknown) => logger.error({ err }, '[labs] Critical alert push failed'));
      }

      return created;
    },
    {
      body: t.Object({
        testName: t.String({ maxLength: 255 }),
        testType: t.Optional(t.String({ maxLength: 100 })),
        testDate: IsoDateString,
        orderedBy: t.Optional(t.String({ maxLength: 255 })),
        facility: t.Optional(t.String({ maxLength: 255 })),
        results: t.Optional(t.Array(LabResultItem, { minItems: 1, maxItems: 100 })),
        notes: t.Optional(t.String({ maxLength: 5000 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 30 })),
      }),
      detail: { tags: ["health"], summary: "Add a lab result" },
    }
  )

  // ── GET /labs/:id ────────────────────────────────────────────────────────────
  .get(
    "/labs/:id",
    async ({ db, userId, params, set }) => {
      const [lab] = await db.select().from(labResults).where(eq(labResults.id, params.id)).limit(1);
      if (!lab) { set.status = 404; return { error: "Lab result not found" }; }
      const authErr = await assertFamilyAccess(db, userId, lab.userId, "labs");
      if (authErr) { set.status = 403; return authErr; }
      return lab;
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Get a lab result by ID" },
    }
  )

  // ── PATCH /labs/:id ──────────────────────────────────────────────────────────
  .patch(
    "/labs/:id",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db.select({ id: labResults.id, userId: labResults.userId }).from(labResults).where(eq(labResults.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Lab result not found" }; }
      const [updated] = await db
        .update(labResults)
        .set({
          ...(body.testName !== undefined && { testName: body.testName }),
          ...(body.testType !== undefined && { testType: body.testType }),
          ...(body.testDate !== undefined && { testDate: new Date(body.testDate) }),
          ...(body.orderedBy !== undefined && { orderedBy: body.orderedBy }),
          ...(body.facility !== undefined && { facility: body.facility }),
          ...(body.results !== undefined && { results: body.results }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.tags !== undefined && { tags: body.tags }),
        })
        .where(and(eq(labResults.id, params.id), eq(labResults.userId, userId)))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({
        testName: t.Optional(t.String({ maxLength: 255 })),
        testType: t.Optional(t.String({ maxLength: 100 })),
        testDate: t.Optional(IsoDateString),
        orderedBy: t.Optional(t.String({ maxLength: 255 })),
        facility: t.Optional(t.String({ maxLength: 255 })),
        results: t.Optional(t.Array(LabResultItem, { minItems: 1, maxItems: 100 })),
        notes: t.Optional(t.String({ maxLength: 5000 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 50 })),
      }),
      detail: { tags: ["health"], summary: "Update a lab result" },
    }
  )

  // ── DELETE /labs/:id ─────────────────────────────────────────────────────────
  .delete(
    "/labs/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db.select({ id: labResults.id, userId: labResults.userId }).from(labResults).where(eq(labResults.id, params.id)).limit(1);
      if (!existing || existing.userId !== userId) { set.status = 404; return { error: "Lab result not found" }; }
      await db.delete(labResults).where(and(eq(labResults.id, params.id), eq(labResults.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Delete a lab result" },
    }
  )

  // ── POST /lab-insights/cache ─────────────────────────────────────────────────
  .post(
    "/lab-insights/cache",
    async ({ db, userId, body }) => {
      await db.insert(healthTimeline).values({
        id: crypto.randomUUID(),
        userId,
        occurredAt: new Date(),
        source: "lab_insights_cache",
        domain: "clinical",
        metadata: structuredClone(body) as Record<string, unknown>,
      });
      return { ok: true };
    },
    {
      body: t.Record(t.String(), t.Unknown()),
      detail: { tags: ["health"], summary: "Cache lab insight results (best-effort)" },
    }
  );
