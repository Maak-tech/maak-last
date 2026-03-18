/**
 * Genetics client service — Firebase-free.
 *
 * Wraps the Nuralix API `/api/genetics` endpoints so the mobile app can read
 * and manage the current user's DNA-derived health data without touching Firebase.
 *
 * Endpoints covered:
 *   GET   /api/genetics/me             → getProfile
 *   GET   /api/genetics/me/status      → getStatus
 *   POST  /api/genetics/me/upload      → getUploadUrl
 *   POST  /api/genetics/me/process     → triggerProcessing
 *   PATCH /api/genetics/me/consent     → updateConsent
 */

import { api } from "@/lib/apiClient";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GeneticsProvider = "23andme" | "ancestry" | "raw_vcf" | "manual";

export type ProcessingStatus = "none" | "pending" | "processing" | "processed" | "failed";

export type PRSScore = {
  condition: string;
  prsScore: number;
  percentile: number;
  snpCount: number;
  ancestryGroup: string;
  level: "low" | "average" | "elevated" | "high";
};

export type ClinVarVariant = {
  rsid: string;
  gene: string;
  condition: string;
  pathogenicity: "benign" | "likely_benign" | "vus" | "likely_pathogenic" | "pathogenic";
  clinicalSignificance: string;
  evidenceLevel: "strong" | "moderate" | "exploratory";
};

export type PharmacogenomicEntry = {
  gene: string;
  drug: string;
  interaction: "standard" | "reduced_efficacy" | "increased_toxicity" | "contraindicated";
  clinicalAnnotation: string;
};

export type GeneticsProfile = {
  userId: string;
  provider: GeneticsProvider | null;
  processingStatus: ProcessingStatus;
  prsScores: PRSScore[] | null;
  clinvarVariants: ClinVarVariant[] | null;
  pharmacogenomics: PharmacogenomicEntry[] | null;
  twinRelevantConditions: string[] | null;
  familySharingConsent: boolean;
  consentGiven: boolean;
  uploadedAt: string | null;
  processedAt: string | null;
  errorMessage: string | null;
};

export type GeneticsStatus = {
  processingStatus: ProcessingStatus;
  uploadedAt?: string | null;
  processedAt?: string | null;
};

export type GeneticsUploadUrl = {
  uploadKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  message: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

class GeneticsService {
  /**
   * Fetch the current user's full genetics profile.
   * Returns `null` if no DNA has been uploaded yet.
   */
  async getProfile(): Promise<GeneticsProfile | null> {
    try {
      return await api.get<GeneticsProfile | null>("/api/genetics/me");
    } catch {
      return null;
    }
  }

  /**
   * Fetch only the DNA processing status (lightweight — no variant data).
   * Returns `{ processingStatus: "none" }` if no DNA has been uploaded.
   */
  async getStatus(): Promise<GeneticsStatus> {
    try {
      return (
        (await api.get<GeneticsStatus>("/api/genetics/me/status")) ?? {
          processingStatus: "none",
        }
      );
    } catch {
      return { processingStatus: "none" };
    }
  }

  /**
   * Get a presigned Tigris URL for direct DNA file upload.
   * Call this first, then PUT the raw 23andMe / AncestryDNA file to `uploadUrl`,
   * then call `triggerProcessing(uploadKey)`.
   */
  async getUploadUrl(provider: GeneticsProvider): Promise<GeneticsUploadUrl> {
    return api.post<GeneticsUploadUrl>("/api/genetics/me/upload", { provider });
  }

  /**
   * Trigger the DNA parsing job after the file has been PUT to the presigned URL.
   * Processing is asynchronous — poll `getStatus()` until `processingStatus === "processed"`.
   */
  async triggerProcessing(uploadKey: string): Promise<{ ok: boolean; message: string }> {
    return api.post<{ ok: boolean; message: string }>("/api/genetics/me/process", { uploadKey });
  }

  /**
   * Update whether the user consents to sharing their genetic risk summary
   * (PRS + pharmacogenomics, no raw rsids) with family admins.
   */
  async updateConsent(familySharingConsent: boolean): Promise<{ familySharingConsent: boolean }> {
    return api.patch<{ familySharingConsent: boolean }>("/api/genetics/me/consent", {
      familySharingConsent,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Whether the genetics profile has usable processed data.
   */
  isProcessed(profile: GeneticsProfile | null): boolean {
    return profile?.processingStatus === "processed" && profile.prsScores !== null;
  }

  /**
   * Return the highest-risk PRS conditions (level "high" or "elevated"), sorted by percentile.
   */
  getTopRisks(profile: GeneticsProfile | null, limit = 3): PRSScore[] {
    if (!profile?.prsScores) return [];
    return profile.prsScores
      .filter((p) => p.level === "high" || p.level === "elevated")
      .sort((a, b) => b.percentile - a.percentile)
      .slice(0, limit);
  }

  /**
   * Return pharmacogenomics entries where `interaction !== "standard"` (i.e., active alerts).
   */
  getPharmAlerts(profile: GeneticsProfile | null): PharmacogenomicEntry[] {
    if (!profile?.pharmacogenomics) return [];
    return profile.pharmacogenomics.filter((p) => p.interaction !== "standard");
  }

  /**
   * Human-readable label for a processing status value.
   */
  statusLabel(status: ProcessingStatus, isRTL = false): string {
    if (isRTL) {
      switch (status) {
        case "none":        return "لم يتم رفع الحمض النووي بعد";
        case "pending":     return "في انتظار المعالجة";
        case "processing":  return "قيد المعالجة…";
        case "processed":   return "تمت المعالجة";
        case "failed":      return "فشلت المعالجة";
      }
    }
    switch (status) {
      case "none":        return "No DNA uploaded yet";
      case "pending":     return "Awaiting processing";
      case "processing":  return "Processing…";
      case "processed":   return "Processed";
      case "failed":      return "Processing failed";
    }
  }

  /**
   * Human-readable label for an interaction type.
   */
  interactionLabel(interaction: PharmacogenomicEntry["interaction"], isRTL = false): string {
    if (isRTL) {
      switch (interaction) {
        case "reduced_efficacy":    return "فاعلية منخفضة";
        case "increased_toxicity":  return "سمية مرتفعة";
        case "contraindicated":     return "موانع الاستخدام";
        default:                    return "معتاد";
      }
    }
    switch (interaction) {
      case "reduced_efficacy":    return "Reduced efficacy";
      case "increased_toxicity":  return "Increased toxicity";
      case "contraindicated":     return "Contraindicated";
      default:                    return "Standard";
    }
  }
}

export const geneticsService = new GeneticsService();
export default geneticsService;
