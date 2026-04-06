import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth } from "../middleware/requireAuth";
import { genetics } from "../db/schema";
import { runDnaParsingJob } from "../jobs/dnaParsingJob";

const TIGRIS_ACCESS_KEY = process.env.TIGRIS_ACCESS_KEY;
const TIGRIS_SECRET_KEY = process.env.TIGRIS_SECRET_KEY;
if (!TIGRIS_ACCESS_KEY || !TIGRIS_SECRET_KEY) {
  console.error("[genetics] TIGRIS_ACCESS_KEY and TIGRIS_SECRET_KEY must be set — DNA upload will be unavailable");
}

const tigris = new S3Client({
  region: "auto",
  endpoint: process.env.TIGRIS_ENDPOINT ?? "https://fly.storage.tigris.dev",
  credentials: {
    accessKeyId: TIGRIS_ACCESS_KEY ?? "",
    secretAccessKey: TIGRIS_SECRET_KEY ?? "",
  },
});

const TIGRIS_BUCKET = process.env.TIGRIS_BUCKET ?? "nuralix";

export const geneticsRoutes = new Elysia({ prefix: "/api/genetics" })
  .use(requireAuth)

  // Get own genetics profile (owner only, full data)
  .get(
    "/me",
    async ({ db, userId }) => {
      const [result] = await db
        .select()
        .from(genetics)
        .where(eq(genetics.userId, userId))
        .limit(1);
      return result ?? null;
    },
    { detail: { tags: ["genetics"], summary: "Get own genetics profile" } }
  )

  // Get processing status
  .get(
    "/me/status",
    async ({ db, userId }) => {
      const [result] = await db
        .select({ processingStatus: genetics.processingStatus, uploadedAt: genetics.uploadedAt, processedAt: genetics.processedAt })
        .from(genetics)
        .where(eq(genetics.userId, userId))
        .limit(1);
      return result ?? { processingStatus: "none" };
    },
    { detail: { tags: ["genetics"], summary: "Get DNA processing status" } }
  )

  // Initiate upload — returns a presigned Tigris URL for direct upload
  .post(
    "/me/upload",
    async ({ db, userId, body }) => {
      // Mark as pending in DB
      await db
        .insert(genetics)
        .values({
          userId,
          provider: body.provider,
          processingStatus: "pending",
          consentGiven: true,
          consentTimestamp: new Date(),
          uploadedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: genetics.userId,
          set: {
            provider: body.provider,
            processingStatus: "pending",
            consentGiven: true,
            consentTimestamp: new Date(),
            uploadedAt: new Date(),
          },
        });

      // Generate a presigned Tigris PUT URL (valid 15 minutes)
      const ext = body.provider === "raw_vcf" ? "vcf" : "txt";
      const uploadKey = `genetics/${userId}/${Date.now()}-raw.${ext}`;

      const command = new PutObjectCommand({
        Bucket: TIGRIS_BUCKET,
        Key: uploadKey,
        ContentType: "text/plain",
        // Server-side metadata — allows dnaParsingJob to identify the provider
        Metadata: { provider: body.provider, userId },
      });

      const uploadUrl = await getSignedUrl(tigris, command, { expiresIn: 900 }); // 15 min

      return {
        uploadKey,
        uploadUrl,
        expiresInSeconds: 900,
        message: "PUT your raw 23andMe / AncestryDNA file to the signed URL, then call /process",
      };
    },
    {
      body: t.Object({
        provider: t.Union([t.Literal("23andme"), t.Literal("ancestry"), t.Literal("raw_vcf")]),
      }),
      detail: { tags: ["genetics"], summary: "Initiate DNA file upload" },
    }
  )

  // Trigger ML processing after upload
  .post(
    "/me/process",
    async ({ db, userId, body, set }) => {
      // Validate uploadKey belongs to this user.
      // The server generates keys as `genetics/${userId}/...` in /me/upload.
      // Rejecting keys that don't start with the caller's userId prefix prevents
      // one user from supplying a crafted key to download another user's raw DNA file.
      const expectedPrefix = `genetics/${userId}/`;
      if (
        !body.uploadKey.startsWith(expectedPrefix) ||
        body.uploadKey.includes("..") ||
        body.uploadKey.includes("//")
      ) {
        set.status = 400;
        return { error: "Invalid upload key" };
      }

      // Verify that the user has given consent before processing their DNA.
      // Without consent, no genetic data should be extracted or stored.
      const [existing] = await db
        .select({ consentGiven: genetics.consentGiven })
        .from(genetics)
        .where(eq(genetics.userId, userId))
        .limit(1);

      if (!existing?.consentGiven) {
        set.status = 403;
        return { error: "Genetic data processing requires consent. Please give consent before processing." };
      }

      await db
        .update(genetics)
        .set({ processingStatus: "processing" })
        .where(eq(genetics.userId, userId));

      // Run parsing job in the background (non-blocking)
      runDnaParsingJob(userId, body.uploadKey).catch(async (err: unknown) => {
        console.error(`[genetics] DNA parsing job failed for user ${userId}:`, err instanceof Error ? err.message : String(err));
        // Mark processing as failed so the status endpoint reflects reality
        await db.update(genetics).set({ processingStatus: "failed" }).where(eq(genetics.userId, userId)).catch((dbErr: unknown) => {
          // If the DB update fails, processingStatus stays as "processing" — log for visibility
          console.error(`[genetics] Failed to mark processingStatus=failed for user ${userId.slice(0, 8)}…:`, dbErr instanceof Error ? dbErr.message : String(dbErr));
        });
      });
      return { ok: true, message: "DNA processing started. Check /me/status for updates." };
    },
    {
      body: t.Object({ uploadKey: t.String({ maxLength: 500 }) }),
      detail: { tags: ["genetics"], summary: "Trigger DNA processing after upload" },
    }
  )

  // Update family sharing consent
  .patch(
    "/me/consent",
    async ({ db, userId, body, set }) => {
      const [updated] = await db
        .update(genetics)
        .set({
          familySharingConsent: body.familySharingConsent,
          familySharingConsentTimestamp: body.familySharingConsent ? new Date() : undefined,
        })
        .where(eq(genetics.userId, userId))
        .returning({ familySharingConsent: genetics.familySharingConsent });

      if (!updated) {
        set.status = 404;
        return { error: "No genetics record found. Upload DNA data first." };
      }
      return updated;
    },
    {
      body: t.Object({ familySharingConsent: t.Boolean() }),
      detail: { tags: ["genetics"], summary: "Update genetics family sharing consent" },
    }
  );
