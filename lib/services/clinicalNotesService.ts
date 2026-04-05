/**
 * Clinical Notes Service — mobile client for doctor notes, SOAP notes,
 * progress notes, discharge summaries, and referral letters.
 *
 * API:  POST/GET/PATCH/DELETE /api/notes  (Elysia on Railway)
 * Auth: Better-auth session token (attached automatically by apiClient)
 */

import { api } from "@/lib/apiClient";
import type {
  ClinicalNote,
  ClinicalNoteSummary,
  CreateClinicalNoteInput,
  UpdateClinicalNoteInput,
} from "@/types/clinicalNote";

// ── API response shape (server strips attachmentKey, adds hasAttachment) ──────

type NoteApiRecord = Omit<ClinicalNote, "createdAt" | "noteDate" | "attachmentKey"> & {
  createdAt: string;
  noteDate: string;
  hasAttachment?: boolean;
  attachmentUploadUrl?: string;
  provider?: {
    name: string;
    specialty?: string;
    facility?: string;
  };
  providerName?: string;
  specialty?: string;
  facility?: string;
  updatedAt?: string;
};

// ── Date coercion ─────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date();
}

function mapNote(raw: NoteApiRecord): ClinicalNote {
  return {
    id: raw.id,
    userId: raw.userId,
    createdAt: toDate(raw.createdAt),
    noteDate: toDate(raw.noteDate),
    source: raw.source ?? "manual",
    provider: raw.provider ?? {
      name: raw.providerName ?? "",
      specialty: raw.specialty,
      facility: raw.facility,
    },
    noteType: raw.noteType,
    soap: raw.soap,
    content: raw.content,
    extractedData: raw.extractedData ?? {
      mentionedConditions: [],
      mentionedMedications: [],
      mentionedAllergies: [],
      recommendedActions: [],
      riskMentions: [],
    },
    isProcessed: raw.isProcessed ?? false,
    tags: raw.tags ?? [],
  };
}

// ── List / filter params ──────────────────────────────────────────────────────

export interface ClinicalNoteFilterOptions {
  from?: Date;
  to?: Date;
  noteType?: string;
  limit?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

class ClinicalNotesService {
  // ── CRUD ───────────────────────────────────────────────────────────────────

  /**
   * List the authenticated user's clinical notes.
   * Returns newest-first, up to `limit` (default 50, max 200).
   */
  async listNotes(options: ClinicalNoteFilterOptions = {}): Promise<ClinicalNote[]> {
    const params = new URLSearchParams();
    if (options.from) params.set("from", options.from.toISOString());
    if (options.to) params.set("to", options.to.toISOString());
    if (options.noteType) params.set("noteType", options.noteType);
    if (options.limit !== undefined) params.set("limit", String(options.limit));

    const qs = params.toString();
    const rows = await api.get<NoteApiRecord[]>(`/api/notes${qs ? `?${qs}` : ""}`);
    return (Array.isArray(rows) ? rows : []).map(mapNote);
  }

  /** Fetch a single clinical note by ID. */
  async getNote(noteId: string): Promise<ClinicalNote | null> {
    try {
      const raw = await api.get<NoteApiRecord>(`/api/notes/${noteId}`);
      return raw ? mapNote(raw) : null;
    } catch (err: unknown) {
      console.warn('[clinicalNotes] getNote failed:', err);
      return null;
    }
  }

  /**
   * Create a new clinical note.
   * If `hasAttachment` is true (default when the input has no content),
   * the response will include a `attachmentUploadUrl` — a presigned Tigris URL
   * valid for 15 minutes. Upload the PDF directly to that URL, then call
   * `triggerParsing()` to start ML extraction.
   */
  async createNote(
    input: CreateClinicalNoteInput & { hasAttachment?: boolean }
  ): Promise<ClinicalNote & { attachmentUploadUrl?: string }> {
    const body = {
      noteDate: input.noteDate.toISOString(),
      source: input.source,
      providerName: input.provider.name,
      specialty: input.provider.specialty,
      facility: input.provider.facility,
      noteType: input.noteType,
      soap: input.soap,
      content: input.content,
      tags: input.tags,
      hasAttachment: input.hasAttachment ?? false,
    };

    const raw = await api.post<NoteApiRecord & { attachmentUploadUrl?: string }>(
      "/api/notes",
      body
    );

    return { ...mapNote(raw), attachmentUploadUrl: raw.attachmentUploadUrl };
  }

  /** Update mutable fields on an existing clinical note. */
  async updateNote(noteId: string, updates: UpdateClinicalNoteInput): Promise<ClinicalNote> {
    const body: Record<string, unknown> = {};
    if (updates.noteDate !== undefined) body.noteDate = updates.noteDate.toISOString();
    if (updates.provider?.name !== undefined) body.providerName = updates.provider.name;
    if (updates.provider?.specialty !== undefined) body.specialty = updates.provider.specialty;
    if (updates.provider?.facility !== undefined) body.facility = updates.provider.facility;
    if (updates.noteType !== undefined) body.noteType = updates.noteType;
    if (updates.soap !== undefined) body.soap = updates.soap;
    if (updates.content !== undefined) body.content = updates.content;
    if (updates.tags !== undefined) body.tags = updates.tags;

    const raw = await api.patch<NoteApiRecord>(`/api/notes/${noteId}`, body);
    return mapNote(raw);
  }

  /** Delete a clinical note (also removes the Tigris attachment if present). */
  async deleteNote(noteId: string): Promise<void> {
    await api.delete(`/api/notes/${noteId}`);
  }

  // ── ML Parsing ─────────────────────────────────────────────────────────────

  /**
   * Trigger async ML parsing of an existing note.
   * The server calls `note_parser.py` which extracts SOAP structure +
   * `extractedData` fields.  Poll `getNote()` for `isProcessed = true`
   * to confirm completion.
   */
  async triggerParsing(noteId: string): Promise<void> {
    await api.post(`/api/notes/${noteId}/parse`, {});
  }

  // ── PDF upload flow ─────────────────────────────────────────────────────────

  /**
   * High-level helper: create a note record, upload the PDF to Tigris,
   * and kick off ML parsing — all in one call.
   *
   * @param input   Note metadata (providerName, noteDate, etc.)
   * @param pdfUri  A local file URI (e.g. from expo-document-picker)
   */
  async createNoteFromPdf(
    input: CreateClinicalNoteInput,
    pdfUri: string
  ): Promise<ClinicalNote> {
    // 1. Create the DB record and get a presigned upload URL
    const { attachmentUploadUrl, ...note } = await this.createNote({
      ...input,
      hasAttachment: true,
    });

    if (!attachmentUploadUrl) {
      // Storage not configured — note is created without attachment
      return note;
    }

    // 2. Upload the PDF to Tigris
    try {
      const response = await fetch(pdfUri, { signal: AbortSignal.timeout(30_000) });
      const blob = await response.blob();

      await fetch(attachmentUploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: blob,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err: unknown) {
      console.warn("[clinicalNotesService] PDF upload failed:", err);
      return note;
    }

    // 3. Trigger async ML parsing
    await this.triggerParsing(note.id);

    return note;
  }

  // ── Summary helpers ────────────────────────────────────────────────────────

  /**
   * Return lightweight summaries of recent clinical notes for use in
   * the VHI careContext and Nora context blocks.
   */
  async getRecentSummaries(
    options: { limit?: number; daysBack?: number } = {}
  ): Promise<ClinicalNoteSummary[]> {
    const { limit = 10, daysBack = 90 } = options;
    const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const notes = await this.listNotes({ from, limit });

    return notes
      .filter((n) => n.isProcessed || n.content || n.soap)
      .map((n): ClinicalNoteSummary => ({
        noteId: n.id,
        noteDate: n.noteDate,
        providerName: n.provider.name,
        specialty: n.provider.specialty,
        noteType: n.noteType,
        keyPoints: n.extractedData.recommendedActions.length > 0
          ? n.extractedData.recommendedActions
          : n.extractedData.mentionedConditions,
        followUpDate: n.extractedData.followUpDate,
      }));
  }

  /**
   * Returns true if the user has at least one unprocessed note with an attachment
   * (i.e. a PDF awaiting ML parsing).
   */
  async hasPendingParsing(): Promise<boolean> {
    const notes = await this.listNotes({ limit: 20 });
    return notes.some((n) => !n.isProcessed && n.tags?.includes("has_attachment"));
  }

  /**
   * Search notes by keyword across content and provider name.
   * Client-side filter — fetches recent notes and filters locally.
   */
  async searchNotes(keyword: string, limit = 20): Promise<ClinicalNote[]> {
    const notes = await this.listNotes({ limit: 200 });
    const q = keyword.toLowerCase();
    return notes
      .filter((n) =>
        n.content?.toLowerCase().includes(q) ||
        n.provider.name.toLowerCase().includes(q) ||
        n.tags?.some((t) => t.toLowerCase().includes(q)) ||
        n.extractedData.mentionedConditions.some((c) => c.toLowerCase().includes(q)) ||
        n.extractedData.mentionedMedications.some((m) => m.toLowerCase().includes(q))
      )
      .slice(0, limit);
  }

  /**
   * Returns pending follow-up dates from all processed notes.
   * Useful for calendar integration and Nora reminders.
   */
  async getPendingFollowUps(): Promise<Array<{ noteId: string; followUpDate: Date; provider: string }>> {
    const notes = await this.listNotes({ limit: 100 });
    const now = new Date();

    return notes
      .filter((n) => n.extractedData.followUpDate && n.extractedData.followUpDate > now)
      .map((n) => ({
        noteId: n.id,
        followUpDate: n.extractedData.followUpDate as Date,
        provider: n.provider.name,
      }))
      .sort((a, b) => a.followUpDate.getTime() - b.followUpDate.getTime());
  }
}

export const clinicalNotesService = new ClinicalNotesService();
