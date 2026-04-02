/**
 * Clinical note types — doctor notes, SOAP notes, progress notes,
 * discharge summaries, and referral letters.
 */

export type ClinicalNoteType =
  | "soap"
  | "progress"
  | "discharge"
  | "referral"
  | "other";

export type ClinicalNoteSource =
  | "manual"
  | "fhir_import"
  | "pdf_upload"
  | "provider_typed";

export interface SOAPNote {
  /** Patient complaints, symptoms, and history as reported */
  subjective: string;
  /** Exam findings, observed vitals, and lab results */
  objective: string;
  /** Diagnosis and clinical reasoning */
  assessment: string;
  /** Treatment plan, prescriptions, referrals, and follow-ups */
  plan: string;
}

export interface ClinicalNoteProvider {
  name: string;
  specialty?: string;
  facility?: string;
}

export interface ClinicalNoteExtractedData {
  /** Medical conditions or diagnoses mentioned in the note */
  mentionedConditions: string[];
  /** Medications mentioned or prescribed */
  mentionedMedications: string[];
  /** Allergies mentioned */
  mentionedAllergies: string[];
  /** Actions recommended by the clinician */
  recommendedActions: string[];
  /** Scheduled or suggested follow-up date */
  followUpDate?: Date;
  /** Risk factors or concerns mentioned */
  riskMentions: string[];
}

export interface ClinicalNote {
  id: string;
  userId: string;
  createdAt: Date;
  /** Date of the actual clinical encounter or note */
  noteDate: Date;
  source: ClinicalNoteSource;
  provider: ClinicalNoteProvider;
  noteType: ClinicalNoteType;
  /**
   * Structured SOAP fields — populated when noteType is "soap" or
   * when AI parsing successfully identifies SOAP structure.
   */
  soap?: SOAPNote;
  /**
   * Free-text fallback for non-SOAP notes or when SOAP parsing fails.
   */
  content?: string;
  /**
   * Structured data extracted by AI parsing from the note content.
   * Populated asynchronously after the note is created.
   */
  extractedData: ClinicalNoteExtractedData;
  /**
   * Tigris object key for the original uploaded document (PDF, image).
   * Not a public URL — served via signed CDN URLs.
   */
  attachmentKey?: string;
  /** True once AI parsing has completed and extractedData is populated */
  isProcessed: boolean;
  tags: string[];
}

/** Lightweight summary used in VHI careContext and Nora context blocks */
export interface ClinicalNoteSummary {
  noteId: string;
  noteDate: Date;
  providerName: string;
  specialty?: string;
  noteType: ClinicalNoteType;
  keyPoints: string[];
  followUpDate?: Date;
}

/** Input shape for creating a new clinical note manually */
export interface CreateClinicalNoteInput {
  noteDate: Date;
  source: ClinicalNoteSource;
  provider: ClinicalNoteProvider;
  noteType: ClinicalNoteType;
  soap?: SOAPNote;
  content?: string;
  tags?: string[];
}

/** Input shape for updating an existing clinical note */
export interface UpdateClinicalNoteInput {
  noteDate?: Date;
  provider?: Partial<ClinicalNoteProvider>;
  noteType?: ClinicalNoteType;
  soap?: Partial<SOAPNote>;
  content?: string;
  tags?: string[];
}
