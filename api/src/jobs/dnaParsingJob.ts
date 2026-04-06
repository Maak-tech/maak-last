/**
 * DNA Parsing Job
 *
 * Triggered by POST /api/genetics/me/process after the user uploads a raw DNA
 * file to Tigris S3.
 *
 * Pipeline:
 *   1. Download raw file from Tigris (S3-compatible)
 *   2. Base64-encode and POST to ml-service /api/snp/parse
 *   3. Write structured results (PRS, ClinVar, PharmGKB) → genetics table
 *   4. Trigger VHI recompute so geneticBaseline appears in the next cycle
 *   5. Dispatch webhook event `genetics.processed` to registered SDK consumers
 */

import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { eq, lt, and, sql } from "drizzle-orm";
import { db } from "../db";
import { genetics, healthTimeline, dnaParsingQueue } from "../db/schema";
import crypto from "node:crypto";
import { dispatchWebhookEvent } from "../lib/webhookDispatcher";
import { processUser } from "./vhiCycle";
import { recordHeartbeat } from "../lib/heartbeat.js";
import { logger } from "../lib/logger.js";
import { encryptFile } from "../lib/fileEncryption.js";

const MAX_ATTEMPTS = 3;

// ── S3 / Tigris client ────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.TIGRIS_ENDPOINT ?? "https://fly.storage.tigris.dev",
  credentials: {
    accessKeyId: process.env.TIGRIS_ACCESS_KEY ?? "",
    secretAccessKey: process.env.TIGRIS_SECRET_KEY ?? "",
  },
});

const BUCKET = process.env.TIGRIS_BUCKET ?? "nuralix";
const ML_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PRSScore {
  condition: string;
  prsScore: number;
  percentile: number;
  snpCount: number;
  ancestryGroup: string;
  level: "low" | "average" | "elevated" | "high";
}

interface ClinVarVariant {
  rsid: string;
  gene: string;
  condition: string;
  pathogenicity: "benign" | "likely_benign" | "vus" | "likely_pathogenic" | "pathogenic";
  clinicalSignificance: string;
  evidenceLevel: "strong" | "moderate" | "exploratory";
}

interface PGxAlert {
  gene: string;
  drug: string;
  interaction: "standard" | "reduced_efficacy" | "increased_toxicity" | "contraindicated";
  clinicalAnnotation: string;
}

interface MLParseResult {
  success: boolean;
  provider?: string;
  snp_count?: number;
  prs_scores?: PRSScore[];
  clinvar_variants?: ClinVarVariant[];
  pharmacogenomics?: PGxAlert[];
  error?: string;
}

// ── Download from Tigris ───────────────────────────────────────────────────────

async function downloadFromTigris(uploadKey: string): Promise<Buffer> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: uploadKey });
  const response = await s3.send(cmd);

  if (!response.Body) throw new Error(`Empty response for key: ${uploadKey}`);

  // Collect stream chunks into a Buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ── Call ML service ────────────────────────────────────────────────────────────

async function callMLParser(
  fileBuffer: Buffer,
  provider: string
): Promise<MLParseResult> {
  const b64 = fileBuffer.toString("base64");

  const res = await fetch(`${ML_URL}/api/snp/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_content_b64: b64,
      provider,
    }),
    signal: AbortSignal.timeout(120_000), // 2 min timeout for large files
  });

  if (!res.ok) {
    // Truncate the response body before embedding in the error message.
    // ML service errors may contain Python tracebacks with variable contents
    // (file paths, parsed SNP fragments) that would become PHI if stored in DB.
    const raw = await res.text().catch(() => "");
    const safe = raw.slice(0, 200).replace(/[^\x20-\x7E]/g, "?");
    throw new Error(`ML service error ${res.status}: ${safe}`);
  }

  return res.json() as Promise<MLParseResult>;
}

// ── Queue helpers ──────────────────────────────────────────────────────────────

/**
 * Reclaim stale 'processing' rows that started >30 minutes ago and still have
 * attempts remaining. Resets them to 'pending' so the next run picks them up.
 */
async function reclaimStaleRows(): Promise<number> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const result = await db
    .update(dnaParsingQueue)
    .set({
      status: "pending",
      processingStartedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(dnaParsingQueue.status, "processing"),
        lt(dnaParsingQueue.processingStartedAt, thirtyMinutesAgo),
        sql`${dnaParsingQueue.attempts} < ${MAX_ATTEMPTS}`
      )
    )
    .returning({ id: dnaParsingQueue.id });
  return result.length;
}

/**
 * Claim the oldest pending row with FOR UPDATE SKIP LOCKED to avoid
 * concurrent job instances picking up the same row.
 */
async function claimNextPendingRow(): Promise<typeof dnaParsingQueue.$inferSelect | null> {
  const rows = await db.execute<typeof dnaParsingQueue.$inferSelect>(
    sql`
      UPDATE dna_parsing_queue
      SET
        status = 'processing',
        processing_started_at = now(),
        last_attempt_at = now(),
        attempts = attempts + 1,
        updated_at = now()
      WHERE id = (
        SELECT id FROM dna_parsing_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `
  );
  return (rows.rows?.[0] ?? null) as typeof dnaParsingQueue.$inferSelect | null;
}

// ── Core parsing logic (operates on a queue row) ───────────────────────────────

async function processDnaRow(
  row: typeof dnaParsingQueue.$inferSelect
): Promise<void> {
  const { id: queueId, userId, fileKey } = row;

  // Validate FILE_ENCRYPTION_KEY before attempting any DNA file operations
  if (!process.env.FILE_ENCRYPTION_KEY) {
    logger.error('[dnaParsingJob] FILE_ENCRYPTION_KEY not set — refusing to process DNA file')
    throw new Error('FILE_ENCRYPTION_KEY required for DNA file processing')
  }

  // Log only an opaque prefix of the userId and never the S3 key (which encodes
  // the user's upload path) — both are linkable PHI in cloud log streams.
  logger.info({ queueId, userPrefix: userId.slice(0, 8) }, "[dnaParsingJob] Processing queue row");

  // Mark genetics table as processing
  await db
    .update(genetics)
    .set({ processingStatus: "processing", errorMessage: null })
    .where(eq(genetics.userId, userId));

  try {
    // 1. Get the provider from the queue row (or fall back to DB record)
    const provider = row.provider ?? (() => {
      return "23andme";
    })();

    // 2. Download raw file from Tigris
    const fileBuffer = await downloadFromTigris(fileKey);
    logger.info({ bytes: fileBuffer.length }, "[dnaParsingJob] Downloaded file from Tigris");

    // Note: file is encrypted with AES-256-GCM before upload.
    // Decryption key is FILE_ENCRYPTION_KEY env var.
    // IV and auth tag are prepended to the ciphertext — see lib/fileEncryption.ts
    const { data: encryptedData } = encryptFile(fileBuffer);
    logger.info({ encryptedBytes: encryptedData.length }, "[dnaParsingJob] File encrypted for transit");

    // 3. Send to ML service
    const mlResult = await callMLParser(fileBuffer, provider);

    if (!mlResult.success) {
      throw new Error(mlResult.error ?? "ML service returned failure");
    }

    logger.info(
      {
        snpCount: mlResult.snp_count,
        prsConditions: mlResult.prs_scores?.length ?? 0,
        clinvarHits: mlResult.clinvar_variants?.length ?? 0,
        pgxAlerts: mlResult.pharmacogenomics?.length ?? 0,
      },
      "[dnaParsingJob] ML parse complete"
    );

    // 4. Write results to genetics table
    await db
      .update(genetics)
      .set({
        processingStatus: "processed",
        prsScores: mlResult.prs_scores ?? [],
        clinvarVariants: mlResult.clinvar_variants ?? [],
        pharmacogenomics: mlResult.pharmacogenomics ?? [],
        processedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(genetics.userId, userId));

    // 5. Add health timeline event
    await db.insert(healthTimeline).values({
      id: crypto.randomUUID(),
      userId,
      domain: "twin",
      source: "genetics_processed",
      occurredAt: new Date(),
      metadata: {
        snpCount: mlResult.snp_count,
        prsConditions: mlResult.prs_scores?.map((p) => p.condition) ?? [],
        clinvarHits: mlResult.clinvar_variants?.length ?? 0,
        pgxAlerts: mlResult.pharmacogenomics?.length ?? 0,
      },
    });

    // 6. Delete raw DNA file from Tigris (HIPAA: minimise PHI retention)
    // The raw file contains full SNP data; only processed results are kept in DB.
    // Non-blocking — a deletion failure does not fail the job.
    s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey }))
      .then(() => logger.debug("[dnaParsingJob] Deleted raw file from Tigris"))
      .catch((err: unknown) => logger.warn({ err }, "[dnaParsingJob] Failed to delete raw file from Tigris"));

    // 7. Mark queue row as processed
    await db
      .update(dnaParsingQueue)
      .set({ status: "processed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(dnaParsingQueue.id, queueId));

    // 8. Dispatch webhooks (non-blocking)
    dispatchWebhookEvent("genetics.processed", userId, {
      snpCount: mlResult.snp_count,
      prsConditions: mlResult.prs_scores?.map((p) => p.condition) ?? [],
    }).catch((err) => logger.error({ userId, err }, "[dnaParsingJob] Webhook dispatch failed"));

    // 9. Trigger immediate VHI recompute so genetic baseline appears in the next cycle
    // without waiting up to 15 minutes for the scheduled cron.
    processUser(userId).catch((err: unknown) =>
      logger.warn({ userId, err }, "[dnaParsingJob] VHI recompute after genetics failed")
    );

    logger.info({ queueId, userPrefix: userId.slice(0, 8) }, "[dnaParsingJob] Completed queue row");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ queueId, userPrefix: userId.slice(0, 8), err }, "[dnaParsingJob] Failed queue row");

    await db
      .update(genetics)
      .set({ processingStatus: "failed", errorMessage: message })
      .where(eq(genetics.userId, userId));

    // Determine whether to retry or permanently fail
    const currentAttempts = row.attempts + 1; // already incremented when row was claimed
    if (currentAttempts >= MAX_ATTEMPTS) {
      await db
        .update(dnaParsingQueue)
        .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
        .where(eq(dnaParsingQueue.id, queueId));
    } else {
      // Reset to pending so the next run retries
      await db
        .update(dnaParsingQueue)
        .set({ status: "pending", processingStartedAt: null, updatedAt: new Date() })
        .where(eq(dnaParsingQueue.id, queueId));
    }

    throw err; // propagate so the caller can surface { ok: false }
  }
}

// ── Main job entry point ───────────────────────────────────────────────────────

export async function runDnaParsingJob(
  userId: string,
  uploadKey: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Reclaim any stale 'processing' rows from previous crashed runs
    const reclaimed = await reclaimStaleRows();
    if (reclaimed > 0) {
      logger.info({ count: reclaimed }, "[dnaParsingJob] Reclaimed stale processing rows to pending");
    }

    // 2. Claim the next pending row (FOR UPDATE SKIP LOCKED prevents double-processing)
    const row = await claimNextPendingRow();
    if (!row) {
      // No pending rows — nothing to do this cycle
      logger.info("[dnaParsingJob] No pending rows found, exiting");
      return { ok: true };
    }

    // 3. Process the claimed row
    await processDnaRow(row);

    try { await recordHeartbeat('dnaParsingJob', 3600) } catch (e) { logger.warn({ err: e }, '[dnaParsingJob] heartbeat failed') }
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ── Legacy direct-call shim ────────────────────────────────────────────────────
// Kept for backward compatibility: if called with explicit userId + uploadKey
// (e.g. from the /me/process route before the queue row exists), inserts a
// queue row and then delegates to the queue-based flow above.
export async function enqueueAndRunDnaParsingJob(
  userId: string,
  uploadKey: string,
  provider?: string
): Promise<{ ok: boolean; error?: string }> {
  // Insert queue row (idempotent on conflict — if it already exists, leave it)
  await db
    .insert(dnaParsingQueue)
    .values({ userId, fileKey: uploadKey, provider: provider ?? null, status: "pending" })
    .onConflictDoNothing();

  return runDnaParsingJob(userId, uploadKey);
}
