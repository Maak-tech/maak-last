import { Elysia, t } from "elysia";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { requireAuth } from "../../middleware/requireAuth.js";
import { logger } from "../../lib/logger.js";
import { vitals, users, familyHealthSummary } from "../../db/schema.js";
import { batchVitalsRateLimiter } from "../../lib/rateLimiter.js";
import { detectAndRecordAnomaly } from "../../lib/anomalyDetector.js";

// Reusable ISO 8601 date-string type.
const IsoDateString = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}" });

const DateRangeQuery = t.Object({
  from: t.Optional(IsoDateString),
  to: t.Optional(IsoDateString),
  limit: t.Optional(t.Numeric({ maximum: 1000 })),
  type: t.Optional(t.String({ maxLength: 64 })),
});

export const vitalsRoutes = new Elysia()
  .use(requireAuth)

  // ── GET /vitals ──────────────────────────────────────────────────────────────
  .get(
    "/vitals",
    async ({ db, userId, query }) => {
      const filters = [eq(vitals.userId, userId)];
      if (query.from) filters.push(gte(vitals.recordedAt, new Date(query.from)));
      if (query.to) filters.push(lte(vitals.recordedAt, new Date(query.to)));
      if (query.type) filters.push(eq(vitals.type, query.type));

      const rows = await db
        .select()
        .from(vitals)
        .where(and(...filters))
        .orderBy(desc(vitals.recordedAt))
        .limit(query.limit ?? 100);

      // Drizzle's numeric() column with the neon-http driver returns string | null
      // at runtime (PostgreSQL's text wire format). Parse to number so that
      // arithmetic on the client (avg, min, max, sparklines) works correctly.
      const data = rows.map((r) => ({
        ...r,
        value: r.value != null ? parseFloat(r.value) : null,
        valueSecondary: r.valueSecondary != null ? parseFloat(r.valueSecondary) : null,
      }));

      // Staleness check: warn if no vitals recorded in last 48 hours
      const latestRecordedAt = data.length > 0
        ? new Date(Math.max(...data.map(r => new Date(r.recordedAt ?? 0).getTime())))
        : null;
      const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;
      const isStale = !latestRecordedAt || (Date.now() - latestRecordedAt.getTime()) > STALE_THRESHOLD_MS;
      const stalenessInfo = {
        isStale,
        lastRecordedAt: latestRecordedAt?.toISOString() ?? null,
        staleThresholdHours: 48,
      };

      return { data, ...stalenessInfo };
    },
    { query: DateRangeQuery, detail: { tags: ["health"], summary: "Get vitals" } }
  )

  // ── POST /vitals ─────────────────────────────────────────────────────────────
  .post(
    "/vitals",
    async ({ db, userId, body }) => {
      const id = crypto.randomUUID();
      try {
        const [created] = await db
          .insert(vitals)
          .values({
            id,
            userId,
            type: body.type,
            value: body.value?.toString(),
            valueSecondary: body.valueSecondary?.toString(),
            unit: body.unit,
            source: body.source,
            metadata: body.metadata,
            recordedAt: new Date(body.recordedAt),
          })
          .returning();
        // Non-blocking VHI recompute trigger — fire-and-forget pg_notify
        db.execute(sql`SELECT pg_notify('vhi_recompute', ${JSON.stringify({ userId, triggeredBy: 'vital_write' })})`)
          .catch((err: unknown) => logger.warn({ err }, 'pg_notify failed — non-fatal'));
        // Also set dirty flag so the 15-min cron picks this user up as a fallback.
        db.update(users).set({ vhiDirty: true }).where(eq(users.id, userId))
          .catch((err: unknown) => logger.warn({ err }, 'vhi_dirty update failed — non-fatal'));
        // Update family health summary — fire-and-forget (non-blocking).
        // Requires the user to have a familyId; skip silently if they don't.
        db.select({ familyId: users.familyId }).from(users).where(eq(users.id, userId)).limit(1)
          .then(([u]) => {
            if (!u?.familyId) return;
            return db.insert(familyHealthSummary)
              .values({
                id: crypto.randomUUID(),
                familyId: u.familyId,
                userId,
                lastVitalAt: new Date(),
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [familyHealthSummary.familyId, familyHealthSummary.userId],
                set: { lastVitalAt: new Date(), updatedAt: new Date() },
              });
          })
          .catch((err: unknown) => logger.warn({ err }, 'family health summary update failed — non-fatal'));
        // Non-blocking anomaly detection — fire-and-forget
        if (body.value != null) {
          setImmediate(() => {
            detectAndRecordAnomaly({
              userId,
              metricType: body.type,
              value: Number(body.value),
              readingId: created.id,
            }).catch((err: unknown) =>
              logger.warn({ err }, '[vitals] Anomaly detection failed — non-fatal'),
            )
          })
        }
        // Parse numeric strings back to numbers for consistent client-side arithmetic.
        return {
          ...created,
          value: created.value != null ? parseFloat(created.value) : null,
          valueSecondary: created.valueSecondary != null ? parseFloat(created.valueSecondary) : null,
        };
      } catch (err: any) {
        if (err?.code === '23505') {
          // Duplicate vital (unique constraint violation) — return the existing row instead of 500.
          const [existing] = await db.select().from(vitals)
            .where(and(
              eq(vitals.userId, userId),
              eq(vitals.type, body.type),
              eq(vitals.recordedAt, new Date(body.recordedAt)),
              eq(vitals.source, body.source ?? 'manual')
            ))
            .limit(1);
          return { ...existing, _duplicate: true };
        }
        throw err;
      }
    },
    {
      body: t.Object({
        // maxLength prevents arbitrarily long strings being stored as vital type names
        type: t.String({ maxLength: 50 }),
        // Plausible numeric bounds cover all known medical vital ranges
        value: t.Optional(t.Number({ minimum: -1000, maximum: 1_000_000 })),
        valueSecondary: t.Optional(t.Number({ minimum: -1000, maximum: 1_000_000 })),
        unit: t.Optional(t.String({ maxLength: 20 })),
        source: t.Optional(t.String({ maxLength: 50 })),
        recordedAt: IsoDateString,
        metadata: t.Optional(t.Record(t.String(), t.Unknown())),
        idempotencyKey: t.Optional(t.String({ maxLength: 128 })),
      }),
      detail: { tags: ["health"], summary: "Log a vital reading" },
    }
  )

  // ── POST /vitals/batch ───────────────────────────────────────────────────────
  .post(
    "/vitals/batch",
    async ({ db, userId, body, set }) => {
      // Guard: body.samples must be a non-empty array
      if (!Array.isArray(body.samples)) {
        set.status = 400;
        return { error: "body.vitals must be an array" };
      }
      if (!body.samples.length) return { saved: 0 };

      // Cap batch size to prevent accidental or malicious oversized requests
      if (body.samples.length > 500) {
        set.status = 400;
        return { error: "Batch size exceeds the 500-item limit. Split into smaller batches." };
      }

      // Rate limit: max 5 batch requests per user per minute
      const rl = await batchVitalsRateLimiter.check(userId);
      if (!rl.allowed) {
        set.status = 429;
        return { error: "Too many batch requests. Please slow down.", retryAfter: Math.ceil(rl.resetIn / 1000) };
      }

      const rows = body.samples.map((s) => ({
        id: crypto.randomUUID(),
        userId,
        type: s.type,
        value: s.value?.toString(),
        valueSecondary: s.valueSecondary?.toString(),
        unit: s.unit,
        source: s.source,
        recordedAt: new Date(s.recordedAt),
        metadata: s.metadata,
      }));

      await db.insert(vitals).values(rows);
      return { saved: rows.length };
    },
    {
      body: t.Object({
        // maxItems: 1000 caps a single sync request — prevents accidental or
        // malicious requests that could saturate the database writer
        samples: t.Array(
          t.Object({
            type: t.String({ maxLength: 50 }),
            value: t.Optional(t.Number({ minimum: -1000, maximum: 1_000_000 })),
            valueSecondary: t.Optional(t.Number({ minimum: -1000, maximum: 1_000_000 })),
            unit: t.Optional(t.String({ maxLength: 20 })),
            source: t.Optional(t.String({ maxLength: 50 })),
            recordedAt: IsoDateString,
            metadata: t.Optional(t.Record(t.String(), t.Unknown())),
          }),
          { maxItems: 1000 }
        ),
      }),
      detail: { tags: ["health"], summary: "Batch-insert vital readings from device sync" },
    }
  );
