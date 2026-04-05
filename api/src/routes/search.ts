/**
 * Search routes — full-text search across user's health records.
 *
 * GET /api/search?q=<query>
 * Returns up to 5 results per category: medications, symptoms, lab results,
 * clinical notes, and allergies.
 * Results are limited to the authenticated user's own data.
 */

import { Elysia, t } from "elysia";
import { and, eq, ilike, or } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import {
  medications,
  symptoms,
  labResults,
  clinicalNotes,
  allergies,
} from "../db/schema";

export const searchRoutes = new Elysia({ prefix: "/api" })
  .use(requireAuth)

  /**
   * GET /api/search?q=<query>
   * Search across medications, symptoms, lab results, clinical notes, and allergies.
   * Returns up to 20 combined results.
   */
  .get(
    "/search",
    async ({ db, userId, query, set }) => {
      const rawQ = (query.q ?? "").trim();
      if (!rawQ || rawQ.length < 1) {
        set.status = 400;
        return { error: "Query parameter 'q' is required" };
      }
      // Limit query length to prevent excessive DB load
      const q = rawQ.slice(0, 100);
      const pattern = `%${q}%`;

      const [
        medicationResults,
        symptomResults,
        labResults_,
        noteResults,
        allergyResults,
      ] = await Promise.all([
        // Medications: search by name, dosage, notes
        db
          .select({ id: medications.id, name: medications.name, dosage: medications.dosage, frequency: medications.frequency })
          .from(medications)
          .where(
            and(
              eq(medications.userId, userId),
              or(
                ilike(medications.name, pattern),
                ilike(medications.dosage, pattern),
                ilike(medications.notes, pattern)
              )
            )
          )
          .limit(5),

        // Symptoms: search by type, location, notes
        db
          .select({ id: symptoms.id, type: symptoms.type, location: symptoms.location, recordedAt: symptoms.recordedAt })
          .from(symptoms)
          .where(
            and(
              eq(symptoms.userId, userId),
              or(
                ilike(symptoms.type, pattern),
                ilike(symptoms.location, pattern),
                ilike(symptoms.notes, pattern)
              )
            )
          )
          .limit(5),

        // Lab results: search by test name and type
        db
          .select({ id: labResults.id, testName: labResults.testName, testType: labResults.testType, testDate: labResults.testDate })
          .from(labResults)
          .where(
            and(
              eq(labResults.userId, userId),
              or(
                ilike(labResults.testName, pattern),
                ilike(labResults.testType, pattern)
              )
            )
          )
          .limit(5),

        // Clinical notes: search by provider name, note content
        db
          .select({ id: clinicalNotes.id, providerName: clinicalNotes.providerName, noteType: clinicalNotes.noteType, noteDate: clinicalNotes.noteDate })
          .from(clinicalNotes)
          .where(
            and(
              eq(clinicalNotes.userId, userId),
              or(
                ilike(clinicalNotes.providerName, pattern),
                ilike(clinicalNotes.content, pattern)
              )
            )
          )
          .limit(5),

        // Allergies: search by substance, reaction
        db
          .select({ id: allergies.id, substance: allergies.substance, reaction: allergies.reaction, severity: allergies.severity })
          .from(allergies)
          .where(
            and(
              eq(allergies.userId, userId),
              or(
                ilike(allergies.substance, pattern),
                ilike(allergies.reaction, pattern)
              )
            )
          )
          .limit(5),
      ]);

      const results: Array<{
        id: string;
        type: "medication" | "symptom" | "vital" | "note" | "condition";
        title: string;
        subtitle?: string;
        date?: string;
      }> = [
        ...medicationResults.map((m) => ({
          id: m.id,
          type: "medication" as const,
          title: m.name,
          subtitle: [m.dosage, m.frequency].filter(Boolean).join(" · ") || undefined,
        })),
        ...symptomResults.map((s) => ({
          id: s.id,
          type: "symptom" as const,
          title: s.type,
          subtitle: s.location ?? undefined,
          date: s.recordedAt ? new Date(s.recordedAt).toLocaleDateString() : undefined,
        })),
        ...labResults_.map((l) => ({
          id: l.id,
          type: "lab" as const,
          title: l.testName,
          subtitle: l.testType ?? undefined,
          date: l.testDate ? new Date(l.testDate).toLocaleDateString() : undefined,
        })),
        ...noteResults.map((n) => ({
          id: n.id,
          type: "note" as const,
          title: n.providerName ?? n.noteType ?? "Clinical Note",
          subtitle: n.noteType ?? undefined,
          date: n.noteDate ? new Date(n.noteDate).toLocaleDateString() : undefined,
        })),
        ...allergyResults.map((a) => ({
          id: a.id,
          type: "condition" as const,
          title: a.substance,
          subtitle: a.reaction ?? a.severity ?? undefined,
        })),
      ];

      return results;
    },
    {
      query: t.Object({
        q: t.Optional(t.String({ maxLength: 100 })),
      }),
      detail: { tags: ["search"], summary: "Search across user health records" },
    }
  );
