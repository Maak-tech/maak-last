/**
 * Caregiver Notes Service
 *
 * Allows caregivers and admins to add observations/notes for family members.
 * Stored at: users/{memberId}/caregiver_notes/{noteId}
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type CaregiverNote = {
  id: string;
  note: string;
  caregiverId: string;
  caregiverName?: string;
  createdAt: Date;
  tags?: string[];
};

/** Add a caregiver observation note for a family member */
export async function addNote(
  memberId: string,
  caregiverId: string,
  note: string,
  caregiverName?: string,
  tags?: string[]
): Promise<CaregiverNote> {
  const notesRef = collection(db, "users", memberId, "caregiver_notes");
  const docRef = await addDoc(notesRef, {
    note,
    caregiverId,
    caregiverName: caregiverName ?? null,
    createdAt: Timestamp.now(),
    tags: tags ?? [],
  });

  return {
    id: docRef.id,
    note,
    caregiverId,
    caregiverName,
    createdAt: new Date(),
    tags,
  };
}

/** Get caregiver notes for a family member, newest first */
export async function getNotes(
  memberId: string,
  maxNotes = 20
): Promise<CaregiverNote[]> {
  const notesRef = collection(db, "users", memberId, "caregiver_notes");
  const snap = await getDocs(
    query(notesRef, orderBy("createdAt", "desc"), limit(maxNotes))
  );

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      note: data.note as string,
      caregiverId: data.caregiverId as string,
      caregiverName: data.caregiverName as string | undefined,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate()
          : new Date(data.createdAt),
      tags: (data.tags as string[]) ?? [],
    };
  });
}

/** Delete a caregiver note */
export async function deleteNote(
  memberId: string,
  noteId: string
): Promise<void> {
  const noteRef = doc(db, "users", memberId, "caregiver_notes", noteId);
  await deleteDoc(noteRef);
}

export const caregiverNotesService = {
  addNote,
  getNotes,
  deleteNote,
};
