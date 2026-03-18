/**
 * Caregiver Notes Service — Firebase-free replacement.
 *
 * Replaced Firestore subcollection with REST API calls:
 *   POST   /api/family/caregiver-notes            → addNote
 *   GET    /api/family/caregiver-notes?memberId=  → getNotes
 *   DELETE /api/family/caregiver-notes/:noteId    → deleteNote
 */
import { api } from "@/lib/apiClient";

export type CaregiverNote = {
  id: string;
  note: string;
  caregiverId: string;
  caregiverName?: string;
  createdAt: Date;
  tags?: string[];
};

function normalizeNote(raw: Record<string, unknown>): CaregiverNote {
  return {
    id: raw.id as string,
    note: raw.note as string,
    caregiverId: raw.caregiverId as string,
    caregiverName: raw.caregiverName as string | undefined,
    createdAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
    tags: (raw.tags as string[]) ?? [],
  };
}

/** Add a caregiver observation note for a family member */
export async function addNote(
  memberId: string,
  caregiverId: string,
  note: string,
  caregiverName?: string,
  tags?: string[]
): Promise<CaregiverNote> {
  const result = await api.post<Record<string, unknown>>(
    "/api/family/caregiver-notes",
    { memberId, note, caregiverName, tags }
  );
  return normalizeNote(result);
}

/** Get caregiver notes for a family member, newest first */
export async function getNotes(
  memberId: string,
  maxNotes = 20
): Promise<CaregiverNote[]> {
  const raw = await api.get<Record<string, unknown>[]>(
    `/api/family/caregiver-notes?memberId=${memberId}&limit=${maxNotes}`
  );
  return (raw ?? []).map(normalizeNote).reverse();
}

/** Delete a caregiver note */
export async function deleteNote(
  memberId: string,
  noteId: string
): Promise<void> {
  await api.delete(`/api/family/caregiver-notes/${noteId}`);
}

export const caregiverNotesService = {
  addNote,
  getNotes,
  deleteNote,
};
