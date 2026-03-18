/**
 * Genetics types — canonical type definitions for the Nuralix DNA / genetics layer.
 *
 * These types are used by:
 *   - `lib/services/geneticsService.ts`     — client API wrapper
 *   - `api/src/routes/genetics.ts`          — server API routes
 *   - `api/src/jobs/vhiCycle.ts`            — VHI computation
 *   - `components/GeneticRiskSummaryCard.tsx` — UI
 *
 * Raw variant data (rsids, nucleotide sequences) is NEVER returned to the
 * client. All client-facing types expose only condition-level summaries.
 */

// ── Processing ────────────────────────────────────────────────────────────────

/**
 * Source of the DNA file upload.
 */
export type GeneticsProvider = "23andme" | "ancestry" | "raw_vcf" | "manual";

/**
 * Lifecycle state of the DNA parsing job for a user.
 */
export type ProcessingStatus =
  | "none"       // No DNA uploaded
  | "pending"    // File uploaded, job not yet started
  | "processing" // DNA parsing job is running
  | "processed"  // Parsing complete — PRS scores available
  | "failed";    // Parsing failed

// ── PRS (Polygenic Risk Score) ────────────────────────────────────────────────

/**
 * Polygenic Risk Score for a single condition.
 * Computed by LDpred2 using GWAS summary statistics + user SNPs.
 */
export type PRSScore = {
  /** e.g. "cardiovascular", "type2_diabetes", "obesity", "alzheimers" */
  condition: string;
  /** Raw LDpred2 PRS value */
  prsScore: number;
  /** Population percentile vs same-ancestry reference panel (0-100) */
  percentile: number;
  /** Number of SNPs used in computation */
  snpCount: number;
  /** Ancestry group used for calibration */
  ancestryGroup: string;
  /** Risk level bucket */
  level: "low" | "average" | "elevated" | "high";
};

// ── ClinVar Variants ──────────────────────────────────────────────────────────

/**
 * A ClinVar-annotated variant in the user's DNA.
 * Raw rsids are returned to the record OWNER via GET /api/genetics/me (their own data).
 * They are NEVER returned to family admins or SDK consumers — those paths return only
 * condition-level PRS summaries and pharmacogenomics (see VHIGeneticBaseline).
 */
export type ClinVarVariant = {
  /** NCBI rsid — visible to the record owner only; stripped from all family/SDK responses */
  rsid: string;
  /** Gene symbol, e.g. "APOE", "BRCA1", "CYP2C9" */
  gene: string;
  /** Associated condition or phenotype */
  condition: string;
  /** ClinVar pathogenicity classification */
  pathogenicity:
    | "benign"
    | "likely_benign"
    | "vus"           // variant of uncertain significance
    | "likely_pathogenic"
    | "pathogenic";
  /** Plain-language clinical significance description */
  clinicalSignificance: string;
  /** Evidence tier */
  evidenceLevel: "strong" | "moderate" | "exploratory";
};

// ── Pharmacogenomics ──────────────────────────────────────────────────────────

/**
 * Drug-gene interaction entry from PharmGKB.
 * Describes how a genetic variant affects a specific drug.
 */
export type PharmacogenomicEntry = {
  /** Gene involved (e.g. "CYP2C9", "TPMT", "DPYD") */
  gene: string;
  /** Drug name (e.g. "Warfarin", "Simvastatin", "5-Fluorouracil") */
  drug: string;
  /** Clinical interaction type */
  interaction:
    | "standard"            // Normal response expected
    | "reduced_efficacy"    // Drug may be less effective
    | "increased_toxicity"  // Increased risk of adverse effects
    | "contraindicated";    // Drug should be avoided
  /** Short PharmGKB clinical annotation */
  clinicalAnnotation: string;
};

// ── Full Profile ──────────────────────────────────────────────────────────────

/**
 * The user's full genetics profile as stored in the `genetics` table.
 * Returned by `GET /api/genetics/me`.
 */
export type GeneticsProfile = {
  userId: string;
  provider: GeneticsProvider | null;
  processingStatus: ProcessingStatus;
  prsScores: PRSScore[] | null;
  clinvarVariants: ClinVarVariant[] | null;
  pharmacogenomics: PharmacogenomicEntry[] | null;
  /** Health conditions relevant to the digital twin (from twinRelevantConditions column) */
  twinRelevantConditions: string[] | null;
  /** Whether user consents to family admins seeing their PRS + pharmacogenomics summary */
  familySharingConsent: boolean;
  /** Whether user consented to DNA processing and storage */
  consentGiven: boolean;
  uploadedAt: string | null;
  processedAt: string | null;
  errorMessage: string | null;
};

/**
 * Lightweight processing status — returned by `GET /api/genetics/me/status`.
 * Does not include variant data.
 */
export type GeneticsStatus = {
  processingStatus: ProcessingStatus;
  uploadedAt?: string | null;
  processedAt?: string | null;
};

/**
 * Presigned upload URL response — returned by `POST /api/genetics/me/upload`.
 */
export type GeneticsUploadUrl = {
  uploadKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  message: string;
};

// ── VHI Genetic Baseline ──────────────────────────────────────────────────────

/**
 * The genetics summary stored inside a user's VHI document.
 * This is a projection of `GeneticsProfile` that omits raw rsids.
 * Suitable for family admin visibility when `familySharingConsent = true`.
 */
export type VHIGeneticBaseline = {
  hasGeneticData: boolean;
  prsScores: Array<{
    condition: string;
    percentile: number;
    level: "low" | "average" | "elevated" | "high";
  }>;
  protectiveVariants: string[];
  riskVariants: string[];
  pharmacogenomics: Array<{
    drug: string;
    interaction:
      | "standard"
      | "reduced_efficacy"
      | "increased_toxicity"
      | "contraindicated";
    gene: string;
  }>;
  ancestryGroup: string;
};
