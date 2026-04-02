/**
 * Medical history service — Firebase-free replacement.
 *
 * Replaced Firestore reads/writes on `medicalHistory` collection with:
 *   POST   /api/health/medical-history        → addMedicalHistory
 *   GET    /api/health/medical-history        → getUserMedicalHistory (own)
 *   GET    /api/health/medical-history/:id    → getMedicalHistoryById
 *   PATCH  /api/health/medical-history/:id    → updateMedicalHistory
 *   DELETE /api/health/medical-history/:id    → deleteMedicalHistory
 */

import { api } from "@/lib/apiClient";
import type { MedicalHistory } from "@/types";

const _medHistoryCache = new Map<string, { history: MedicalHistory[]; timestamp: number }>();
const MED_HISTORY_CACHE_TTL = 120_000; // 2 minutes

/** Normalize a raw API medical history row to the client MedicalHistory type */
const normalizeMedicalHistory = (raw: Record<string, unknown>): MedicalHistory => ({
  id: raw.id as string,
  userId: raw.userId as string,
  condition: raw.condition as string,
  diagnosedDate: raw.diagnosedDate ? new Date(raw.diagnosedDate as string) : undefined,
  severity: raw.severity as MedicalHistory["severity"] | undefined,
  notes: raw.notes as string | undefined,
  isFamily: (raw.isFamily as boolean | undefined) ?? false,
  relation: raw.relation as string | undefined,
  familyMemberId: raw.familyMemberId as string | undefined,
  familyMemberName: raw.familyMemberName as string | undefined,
  tags: raw.tags as string[] | undefined,
});

export const medicalHistoryService = {
  async getUserMedicalHistory(userId: string, limitCount?: number): Promise<MedicalHistory[]> {
    const cached = _medHistoryCache.get(userId);
    if (cached && Date.now() - cached.timestamp < MED_HISTORY_CACHE_TTL) {
      return cached.history;
    }

    const url = limitCount
      ? `/api/health/medical-history?limit=${limitCount}`
      : "/api/health/medical-history";

    const raw = await api.get<Record<string, unknown>[]>(url);
    const history = (raw ?? []).map(normalizeMedicalHistory);

    _medHistoryCache.set(userId, { history, timestamp: Date.now() });
    return history;
  },

  // Returns own medical history entries that are marked as family history
  async getFamilyMedicalHistory(userId: string): Promise<MedicalHistory[]> {
    const all = await this.getUserMedicalHistory(userId);
    return all.filter((h) => h.isFamily);
  },

  // Add new medical history entry
  async addMedicalHistory(
    userId: string,
    data: Omit<MedicalHistory, "id" | "userId">
  ): Promise<string> {
    const created = await api.post<Record<string, unknown>>("/api/health/medical-history", {
      condition: data.condition,
      severity: data.severity,
      diagnosedDate: data.diagnosedDate?.toISOString(),
      notes: data.notes?.trim() || undefined,
      isFamily: data.isFamily,
      relation: data.relation?.trim() || undefined,
      familyMemberId: data.familyMemberId?.trim() || undefined,
      familyMemberName: data.familyMemberName?.trim() || undefined,
      tags: data.tags,
    });
    _medHistoryCache.delete(userId);
    return created.id as string;
  },

  // Update medical history entry
  async updateMedicalHistory(
    historyId: string,
    updates: Partial<Omit<MedicalHistory, 'id' | 'userId'>>
  ): Promise<void> {
    const body: Record<string, unknown> = {};

    if (updates.condition !== undefined) body.condition = updates.condition;
    if (updates.severity !== undefined) body.severity = updates.severity;
    if (updates.isFamily !== undefined) body.isFamily = updates.isFamily;
    if (updates.diagnosedDate !== undefined) {
      body.diagnosedDate = updates.diagnosedDate ? updates.diagnosedDate.toISOString() : null;
    }
    if (updates.notes !== undefined) {
      body.notes = updates.notes?.trim() || null;
    }
    if (updates.relation !== undefined) {
      body.relation = updates.relation?.trim() || null;
    }
    if (updates.familyMemberId !== undefined) {
      body.familyMemberId = updates.familyMemberId?.trim() || null;
    }
    if (updates.familyMemberName !== undefined) {
      body.familyMemberName = updates.familyMemberName?.trim() || null;
    }
    if (updates.tags !== undefined) body.tags = updates.tags;

    await api.patch(`/api/health/medical-history/${historyId}`, body);
  },

  // Delete medical history entry
  async deleteMedicalHistory(historyId: string): Promise<void> {
    await api.delete(`/api/health/medical-history/${historyId}`);
    _medHistoryCache.clear();
  },

  async getMedicalHistoryById(historyId: string): Promise<MedicalHistory | null> {
    try {
      const raw = await api.get<Record<string, unknown>>(`/api/health/medical-history/${historyId}`);
      if (!raw || (raw as { error?: string }).error) return null;
      return normalizeMedicalHistory(raw);
    } catch {
      return null;
    }
  },

  // Get medical conditions by severity
  async getMedicalHistoryBySeverity(
    userId: string,
    severity: 'mild' | 'moderate' | 'severe'
  ): Promise<MedicalHistory[]> {
    const all = await this.getUserMedicalHistory(userId);
    return all.filter((h) => h.severity === severity);
  },

  async searchMedicalHistory(userId: string, searchTerm: string): Promise<MedicalHistory[]> {
    const all = await this.getUserMedicalHistory(userId);
    return all.filter(
      (h) =>
        h.condition.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  },

  // Get summary statistics
  async getMedicalHistorySummary(userId: string) {
    const all = await this.getUserMedicalHistory(userId);
    const familyHistory = all.filter((h) => h.isFamily);
    const personalHistory = all.filter((h) => !h.isFamily);

    const severityCounts = {
      mild: all.filter((h) => h.severity === "mild").length,
      moderate: all.filter((h) => h.severity === "moderate").length,
      severe: all.filter((h) => h.severity === "severe").length,
    };

    return {
      totalEntries: all.length,
      personalEntries: personalHistory.length,
      familyEntries: familyHistory.length,
      severityCounts,
      conditions: all.map((h) => h.condition),
    };
  },
};
