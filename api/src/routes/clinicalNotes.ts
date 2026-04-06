import { Elysia, t } from "elysia";
import { eq, desc, and, gte, lte, isNull } from "drizzle-orm";
import crypto from "node:crypto";
import { clinicalNotes } from "../db/schema";
import { requireAuth } from "../middleware/requireAuth";
import { noteParseRateLimiter } from "../lib/rateLimiter";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

/** ISO 8601 date pattern — prevents invalid dates from reaching new Date() */
const IsoDateString = t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}" });

// ── Tigris helpers ────────────────────────────────────────────────────────────

async function generateUploadUrl(key: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = new S3Client({
    region: "auto",
    endpoint: process.env.TIGRIS_ENDPOINT ?? "https://fly.storage.tigris.dev",
    credentials: {
      accessKeyId: process.env.TIGRIS_ACCESS_KEY ?? "",
      secretAccessKey: process.env.TIGRIS_SECRET_KEY ?? "",
    },
  });

  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: process.env.TIGRIS_BUCKET ?? "nuralix", Key: key }),
    { expiresIn: 900 } // 15 minutes
  );
}

export const clinicalNotesRoutes = new Elysia({ prefix: "/api/notes" })
  .decorate("db", null as unknown as import("../db").Database)
  .use(requireAuth)

  // ── List notes ──────────────────────────────────────────────────────────────
  .get(
    "/",
    async ({ db, userId, query, set }) => {
      // Validate date strings before passing to the DB driver.
      // new Date("garbage") produces an invalid Date, which Drizzle would
      // silently cast to NULL or throw a cryptic Postgres error.
      if (query.from && isNaN(new Date(query.from).getTime())) {
        set.status = 400;
        return { error: "Invalid 'from' date" };
      }
      if (query.to && isNaN(new Date(query.to).getTime())) {
        set.status = 400;
        return { error: "Invalid 'to' date" };
      }

      let q = db
        .select()
        .from(clinicalNotes)
        .where(and(eq(clinicalNotes.userId, userId), isNull(clinicalNotes.deletedAt)))
        .orderBy(desc(clinicalNotes.noteDate))
        .$dynamic();

      if (query.from) {
        q = q.where(gte(clinicalNotes.noteDate, new Date(query.from))) as typeof q;
      }
      if (query.to) {
        q = q.where(lte(clinicalNotes.noteDate, new Date(query.to))) as typeof q;
      }
      if (query.noteType) {
        q = q.where(eq(clinicalNotes.noteType, query.noteType)) as typeof q;
      }

      const notes = await q.limit(query.limit ?? 50);
      return notes.map(sanitizeNote);
    },
    {
      query: t.Object({
        from: t.Optional(t.String({ minLength: 1, maxLength: 36 })),
        to: t.Optional(t.String({ minLength: 1, maxLength: 36 })),
        noteType: t.Optional(t.String({ minLength: 1, maxLength: 36 })),
        // minimum: 1 prevents LIMIT 0 (returns 0 rows) and LIMIT -5 (Postgres error → 500)
        limit: t.Optional(t.Number({ minimum: 1, maximum: 200 })),
      }),
      detail: { tags: ["health"], summary: "List clinical notes" },
    }
  )

  // ── Get single note ─────────────────────────────────────────────────────────
  .get(
    "/:id",
    async ({ db, userId, params, set }) => {
      const [note] = await db
        .select()
        .from(clinicalNotes)
        .where(and(eq(clinicalNotes.id, params.id), eq(clinicalNotes.userId, userId), isNull(clinicalNotes.deletedAt)))
        .limit(1);

      if (!note) { set.status = 404; return { error: "Note not found" }; }
      return sanitizeNote(note);
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Get a clinical note" },
    }
  )

  // ── Create note ──────────────────────────────────────────────────────────────
  .post(
    "/",
    async ({ db, userId, body }) => {
      const id = crypto.randomUUID();
      let attachmentKey: string | null = null;
      let attachmentUploadUrl: string | undefined;

      if (body.hasAttachment) {
        attachmentKey = `clinical-notes/${userId}/${id}.pdf`;
        if (process.env.TIGRIS_ACCESS_KEY) {
          attachmentUploadUrl = await generateUploadUrl(attachmentKey);
        }
      }

      const [note] = await db
        .insert(clinicalNotes)
        .values({
          id,
          userId,
          noteDate: new Date(body.noteDate),
          source: body.source ?? "manual",
          providerName: body.providerName ?? null,
          specialty: body.specialty ?? null,
          facility: body.facility ?? null,
          noteType: body.noteType ?? "progress",
          soap: body.soap ?? null,
          content: body.content ?? null,
          tags: body.tags ?? null,
          attachmentKey,
          isProcessed: false,
        })
        .returning();

      // Auto-parse if content is provided (non-blocking)
      if (body.content) {
        parseNoteAsync(note).catch((err: unknown) => console.error(`[clinicalNotes] Auto-parse failed for note ${note.id}:`, err instanceof Error ? err.message : String(err)));
      }

      return { ...sanitizeNote(note), attachmentUploadUrl };
    },
    {
      body: t.Object({
        noteDate: IsoDateString,
        source: t.Optional(t.String({ maxLength: 100 })),
        providerName: t.Optional(t.String({ maxLength: 255 })),
        specialty: t.Optional(t.String({ maxLength: 100 })),
        facility: t.Optional(t.String({ maxLength: 255 })),
        noteType: t.Optional(t.String({ maxLength: 50 })),
        soap: t.Optional(
          t.Object({
            subjective: t.Optional(t.String({ maxLength: 20000 })),
            objective: t.Optional(t.String({ maxLength: 20000 })),
            assessment: t.Optional(t.String({ maxLength: 20000 })),
            plan: t.Optional(t.String({ maxLength: 20000 })),
          })
        ),
        content: t.Optional(t.String({ maxLength: 100000 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 50 })),
        hasAttachment: t.Optional(t.Boolean()),
      }),
      detail: { tags: ["health"], summary: "Create a clinical note" },
    }
  )

  // ── Update note ──────────────────────────────────────────────────────────────
  .patch(
    "/:id",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db
        .select({ id: clinicalNotes.id })
        .from(clinicalNotes)
        .where(and(eq(clinicalNotes.id, params.id), eq(clinicalNotes.userId, userId), isNull(clinicalNotes.deletedAt)))
        .limit(1);

      if (!existing) { set.status = 404; return { error: "Note not found" }; }

      const updates: Partial<typeof clinicalNotes.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (body.noteDate !== undefined) updates.noteDate = new Date(body.noteDate);
      if (body.providerName !== undefined) updates.providerName = body.providerName;
      if (body.specialty !== undefined) updates.specialty = body.specialty;
      if (body.facility !== undefined) updates.facility = body.facility;
      if (body.noteType !== undefined) updates.noteType = body.noteType;
      if (body.soap !== undefined) updates.soap = body.soap;
      if (body.content !== undefined) updates.content = body.content;
      if (body.tags !== undefined) updates.tags = body.tags;
      if (body.extractedData !== undefined) updates.extractedData = body.extractedData;

      const [updated] = await db
        .update(clinicalNotes)
        .set(updates)
        .where(and(eq(clinicalNotes.id, params.id), eq(clinicalNotes.userId, userId)))
        .returning();

      return sanitizeNote(updated);
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({
        noteDate: t.Optional(IsoDateString),
        providerName: t.Optional(t.String({ maxLength: 255 })),
        specialty: t.Optional(t.String({ maxLength: 100 })),
        facility: t.Optional(t.String({ maxLength: 255 })),
        noteType: t.Optional(t.String({ maxLength: 50 })),
        soap: t.Optional(
          t.Object({
            subjective: t.Optional(t.String({ maxLength: 20000 })),
            objective: t.Optional(t.String({ maxLength: 20000 })),
            assessment: t.Optional(t.String({ maxLength: 20000 })),
            plan: t.Optional(t.String({ maxLength: 20000 })),
          })
        ),
        content: t.Optional(t.String({ maxLength: 100000 })),
        tags: t.Optional(t.Array(t.String({ maxLength: 50 }), { maxItems: 50 })),
        extractedData: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
      detail: { tags: ["health"], summary: "Update a clinical note" },
    }
  )

  // ── Delete note ──────────────────────────────────────────────────────────────
  .delete(
    "/:id",
    async ({ db, userId, params, set }) => {
      const [existing] = await db
        .select({ id: clinicalNotes.id, attachmentKey: clinicalNotes.attachmentKey })
        .from(clinicalNotes)
        .where(and(eq(clinicalNotes.id, params.id), eq(clinicalNotes.userId, userId), isNull(clinicalNotes.deletedAt)))
        .limit(1);

      if (!existing) { set.status = 404; return { error: "Note not found" }; }

      // Delete attachment from Tigris if present
      if (existing.attachmentKey && process.env.TIGRIS_ACCESS_KEY) {
        const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
        const client = new S3Client({
          region: "auto",
          endpoint: process.env.TIGRIS_ENDPOINT ?? "https://fly.storage.tigris.dev",
          credentials: {
            accessKeyId: process.env.TIGRIS_ACCESS_KEY,
            secretAccessKey: process.env.TIGRIS_SECRET_KEY ?? "",
          },
        });
        await client.send(new DeleteObjectCommand({
          Bucket: process.env.TIGRIS_BUCKET ?? "nuralix",
          Key: existing.attachmentKey,
        })).catch((err: unknown) => console.error(`[clinicalNotes] Tigris delete failed for key ${existing.attachmentKey}:`, err instanceof Error ? err.message : String(err)));
      }

      // Soft-delete: stamp deleted_at instead of removing the row.
      // Include userId in the WHERE clause to prevent TOCTOU race conditions.
      await db
        .update(clinicalNotes)
        .set({ deletedAt: new Date() })
        .where(and(eq(clinicalNotes.id, params.id), eq(clinicalNotes.userId, userId), isNull(clinicalNotes.deletedAt)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Delete a clinical note" },
    }
  )

  // ── Trigger ML parsing for a note ───────────────────────────────────────────
  /**
   * Calls the ML service note_parser endpoint to extract SOAP + structured data
   * from a note's plain-text content or its Tigris-stored PDF attachment.
   * Results are persisted back to the note. Non-blocking — returns immediately.
   */
  .post(
    "/:id/parse",
    async ({ db, userId, params, set }) => {
      // Rate limit: 20 parse requests / user / hour — each parse triggers a
      // 60-second background ML job (MedGemma PDF → SOAP extraction).
      const rl = await noteParseRateLimiter.check(userId);
      if (!rl.allowed) {
        set.status = 429;
        const retryAfterSecs = Math.ceil(rl.resetIn / 1000);
        set.headers = { "Retry-After": String(retryAfterSecs) };
        return { ok: false, error: "Too many parse requests. Please try again later." };
      }

      const [note] = await db
        .select()
        .from(clinicalNotes)
        .where(and(eq(clinicalNotes.id, params.id), eq(clinicalNotes.userId, userId), isNull(clinicalNotes.deletedAt)))
        .limit(1);

      if (!note) { set.status = 404; return { error: "Note not found" }; }

      // Kick off parsing asynchronously — client polls isProcessed or uses WS
      parseNoteAsync(note).catch((err: unknown) =>
        console.error(`[clinicalNotes] Async parse failed for ${params.id}:`, err instanceof Error ? err.message : String(err))
      );

      return { ok: true, message: "Parsing started. Check isProcessed status for completion." };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      detail: { tags: ["health"], summary: "Trigger ML parsing of a clinical note" },
    }
  )

  // ── Mark processed (called by ML service after PDF parsing) ─────────────────
  // Ownership check: the ML service calls this via the same user session that
  // triggered the parse job. Any attempt to update a note the caller doesn't own
  // (i.e. note.userId !== userId) returns 404, preventing data injection.
  .post(
    "/:id/processed",
    async ({ db, userId, params, body, set }) => {
      const [existing] = await db
        .select({ id: clinicalNotes.id })
        .from(clinicalNotes)
        .where(and(eq(clinicalNotes.id, params.id), eq(clinicalNotes.userId, userId), isNull(clinicalNotes.deletedAt)))
        .limit(1);

      if (!existing) {
        set.status = 404;
        return { error: "Note not found" };
      }

      await db
        .update(clinicalNotes)
        .set({
          isProcessed: true,
          extractedData: body.extractedData ?? null,
          soap: body.soap ?? undefined,
          updatedAt: new Date(),
        })
        // Include userId to prevent TOCTOU race conditions (matches ownership check above)
        .where(and(eq(clinicalNotes.id, params.id), eq(clinicalNotes.userId, userId)));
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String({ minLength: 1, maxLength: 36 }) }),
      body: t.Object({
        extractedData: t.Optional(t.Record(t.String(), t.Unknown())),
        soap: t.Optional(
          t.Object({
            subjective: t.Optional(t.String({ maxLength: 20000 })),
            objective: t.Optional(t.String({ maxLength: 20000 })),
            assessment: t.Optional(t.String({ maxLength: 20000 })),
            plan: t.Optional(t.String({ maxLength: 20000 })),
          })
        ),
      }),
      detail: { tags: ["health"], summary: "[Internal] Mark note as ML-processed" },
    }
  );

// ── Async ML parse helper ─────────────────────────────────────────────────────

async function parseNoteAsync(note: typeof clinicalNotes.$inferSelect) {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");

  let pdfBase64: string | undefined;

  // Download PDF from Tigris if attachment exists
  if (note.attachmentKey && process.env.TIGRIS_ACCESS_KEY) {
    try {
      const client = new S3Client({
        region: "auto",
        endpoint: process.env.TIGRIS_ENDPOINT ?? "https://fly.storage.tigris.dev",
        credentials: {
          accessKeyId: process.env.TIGRIS_ACCESS_KEY,
          secretAccessKey: process.env.TIGRIS_SECRET_KEY ?? "",
        },
      });
      const res = await client.send(
        new GetObjectCommand({ Bucket: process.env.TIGRIS_BUCKET ?? "nuralix", Key: note.attachmentKey })
      );
      if (res.Body) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of res.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        pdfBase64 = buf.toString("base64");
      }
    } catch (err: unknown) {
      // Log only the message — S3 error objects may contain the object key which encodes userId
      console.error("[clinicalNotes] Tigris PDF download failed:", err instanceof Error ? err.message : String(err));
    }
  }

  // Nothing to parse
  if (!pdfBase64 && !note.content) return;

  // Call ML service
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000); // 1 min timeout for large PDFs
  try {
    const res = await fetch(`${ML_SERVICE_URL}/api/notes/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteId: note.id,
        content: note.content ?? undefined,
        pdfBase64,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error(`[clinicalNotes] ML parse HTTP ${res.status} for note ${note.id}`);
      return;
    }

    const parsed = await res.json() as {
      soap?: { subjective?: string; objective?: string; assessment?: string; plan?: string };
      extractedData?: Record<string, unknown>;
      noteType?: string;
      providerName?: string;
      specialty?: string;
    };

    // Persist results back to the note
    const { db: importedDb } = await import("../db");
    const updates: Partial<typeof clinicalNotes.$inferInsert> = {
      isProcessed: true,
      updatedAt: new Date(),
    };
    if (parsed.soap) updates.soap = parsed.soap;
    if (parsed.extractedData) updates.extractedData = parsed.extractedData as typeof note.extractedData;
    if (parsed.noteType) updates.noteType = parsed.noteType;
    if (parsed.providerName && !note.providerName) updates.providerName = parsed.providerName;
    if (parsed.specialty && !note.specialty) updates.specialty = parsed.specialty;

    await importedDb.update(clinicalNotes).set(updates).where(
      and(eq(clinicalNotes.id, note.id), eq(clinicalNotes.userId, note.userId))
    );
  } catch (err: unknown) {
    clearTimeout(timer);
    // Log only the message — ML error objects may echo back note content from the response body
    console.error(`[clinicalNotes] ML parse failed for note ${note.id}:`, err instanceof Error ? err.message : String(err));
  }
}

// ── Sanitizer ─────────────────────────────────────────────────────────────────

// Strip attachmentKey from responses (Tigris object keys are internal)
function sanitizeNote(note: typeof clinicalNotes.$inferSelect) {
  const { attachmentKey, ...safe } = note;
  return {
    ...safe,
    hasAttachment: attachmentKey !== null,
  };
}
