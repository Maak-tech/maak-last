import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// ── Genetics ───────────────────────────────────────────────────────────────────

export const genetics = pgTable("genetics", {
  userId: text("user_id").primaryKey(),
  provider: text("provider"), // '23andme' | 'ancestry' | 'raw_vcf' | 'manual'
  processingStatus: text("processing_status").default("pending"), // 'pending' | 'processing' | 'processed' | 'failed'
  prsScores: jsonb("prs_scores").$type<
    Array<{
      condition: string;
      prsScore: number;
      percentile: number;
      snpCount: number;
      ancestryGroup: string;
      level: "low" | "average" | "elevated" | "high";
    }>
  >(),
  clinvarVariants: jsonb("clinvar_variants").$type<
    Array<{
      rsid: string;
      gene: string;
      condition: string;
      pathogenicity: "benign" | "likely_benign" | "vus" | "likely_pathogenic" | "pathogenic";
      clinicalSignificance: string;
      evidenceLevel: "strong" | "moderate" | "exploratory";
    }>
  >(),
  pharmacogenomics: jsonb("pharmacogenomics").$type<
    Array<{
      gene: string;
      drug: string;
      interaction: "standard" | "reduced_efficacy" | "increased_toxicity" | "contraindicated";
      clinicalAnnotation: string;
    }>
  >(),
  twinRelevantConditions: text("twin_relevant_conditions").array(),
  familySharingConsent: boolean("family_sharing_consent").default(false),
  familySharingConsentTimestamp: timestamp("family_sharing_consent_timestamp"),
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  uploadedAt: timestamp("uploaded_at"),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
});

// ── DNA Parsing Queue ──────────────────────────────────────────────────────────
// Tracks DNA file parsing jobs so failures are visible and retryable.
// When a user uploads a DNA file, a row is inserted here with status='pending'.
// dnaParsingJob picks up pending rows, processes them, and updates status.
// If the Railway service restarts mid-parse, the row stays 'processing' and
// the job retries it on next run (if it has been processing for >30 minutes).
export const dnaParsingQueue = pgTable(
  "dna_parsing_queue",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    fileKey: text("file_key").notNull(), // Tigris object key
    provider: text("provider"), // '23andme' | 'ancestry' | 'raw_vcf'
    status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'processed' | 'failed'
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at"),
    processingStartedAt: timestamp("processing_started_at"),
    completedAt: timestamp("completed_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("dna_parsing_queue_user_idx").on(t.userId),
    index("dna_parsing_queue_status_idx").on(t.status, t.createdAt),
  ]
);
