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
import { eq } from "drizzle-orm";
import { db } from "../db";
import { genetics, healthTimeline } from "../db/schema";
import crypto from "node:crypto";
import { dispatchWebhookEvent } from "../lib/webhookDispatcher";
import { processUser } from "./vhiCycle";

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
      provider: provider === "raw_vcf" ? "raw_vcf" : provider, // pass through
    }),
    signal: AbortSignal.timeout(120_000), // 2 min timeout for large files
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ML service error ${res.status}: ${text}`);
  }

  return res.json() as Promise<MLParseResult>;
}

// ── Main job entry point ───────────────────────────────────────────────────────

export async function runDnaParsingJob(
  userId: string,
  uploadKey: string
): Promise<{ ok: boolean; error?: string }> {
  console.log(`[dnaParsingJob] Starting for user=${userId} key=${uploadKey}`);

  // Mark as processing
  await db
    .update(genetics)
    .set({ processingStatus: "processing", errorMessage: null })
    .where(eq(genetics.userId, userId));

  try {
    // 1. Get the provider from the DB record
    const [record] = await db
      .select({ provider: genetics.provider })
      .from(genetics)
      .where(eq(genetics.userId, userId))
      .limit(1);

    const provider = record?.provider ?? "23andme";

    // 2. Download raw file from Tigris
    const fileBuffer = await downloadFromTigris(uploadKey);
    console.log(`[dnaParsingJob] Downloaded ${fileBuffer.length} bytes for user=${userId}`);

    // 3. Send to ML service
    const mlResult = await callMLParser(fileBuffer, provider);

    if (!mlResult.success) {
      throw new Error(mlResult.error ?? "ML service returned failure");
    }

    console.log(
      `[dnaParsingJob] ML parsed ${mlResult.snp_count} SNPs, ` +
        `${mlResult.prs_scores?.length ?? 0} PRS conditions, ` +
        `${mlResult.clinvar_variants?.length ?? 0} ClinVar hits, ` +
        `${mlResult.pharmacogenomics?.length ?? 0} PGx alerts`
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
    s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: uploadKey }))
      .then(() => console.log(`[dnaParsingJob] Deleted raw file ${uploadKey}`))
      .catch((err) => console.warn(`[dnaParsingJob] Failed to delete raw file ${uploadKey}:`, err));

    // 7. Dispatch webhooks (non-blocking)
    dispatchWebhookEvent("genetics.processed", userId, {
      snpCount: mlResult.snp_count,
      prsConditions: mlResult.prs_scores?.map((p) => p.condition) ?? [],
    }).catch(console.error);

    // 8. Trigger immediate VHI recompute so genetic baseline appears in the next cycle
    // without waiting up to 15 minutes for the scheduled cron.
    processUser(userId).catch((err) =>
      console.warn(`[dnaParsingJob] VHI recompute after genetics failed for ${userId}:`, err)
    );

    console.log(`[dnaParsingJob] Completed for user=${userId}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[dnaParsingJob] Failed for user=${userId}:`, message);

    await db
      .update(genetics)
      .set({ processingStatus: "failed", errorMessage: message })
      .where(eq(genetics.userId, userId));

    return { ok: false, error: message };
  }
}
