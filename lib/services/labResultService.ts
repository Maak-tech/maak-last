/**
 * Lab result service — Firebase-free replacement.
 *
 * Replaced Firestore reads/writes on `labResults` collection with:
 *   POST   /api/health/labs        → addLabResult
 *   GET    /api/health/labs        → getUserLabResults (own)
 *   GET    /api/health/labs/:id    → getLabResult
 *   PATCH  /api/health/labs/:id    → updateLabResult
 *   DELETE /api/health/labs/:id    → deleteLabResult
 */

import { api } from "@/lib/apiClient";
import type { LabResult, LabResultValue } from "@/types";

const REFERENCE_RANGE_REGEX = /(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/;

/** Normalize a raw API lab result row to the client LabResult type */
const normalizeLabResult = (raw: Record<string, unknown>): LabResult => ({
  id: raw.id as string,
  userId: raw.userId as string,
  testName: raw.testName as string,
  testType: (raw.testType ?? "other") as LabResult["testType"],
  testDate: raw.testDate ? new Date(raw.testDate as string) : new Date(),
  orderedBy: raw.orderedBy as string | undefined,
  facility: raw.facility as string | undefined,
  results: (raw.results as LabResultValue[]) ?? [],
  notes: raw.notes as string | undefined,
  attachments: raw.attachments as string[] | undefined,
  tags: raw.tags as string[] | undefined,
});

class LabResultService {
  /**
   * Add a new lab result
   */
  async addLabResult(userId: string, labResult: Omit<LabResult, "id">): Promise<string> {
    if (!labResult.testName?.trim()) throw new Error("Test name is required");
    if (!labResult.results || labResult.results.length === 0) throw new Error("At least one result is required");

    const cleanedResults = labResult.results
      .filter(
        (result) =>
          result.name?.trim() &&
          result.value !== undefined &&
          result.value !== null &&
          result.value !== ""
      )
      .map((result) =>
        Object.fromEntries(Object.entries(result).filter(([_, v]) => v !== undefined))
      );

    if (cleanedResults.length === 0) throw new Error("No valid results found");

    try {
      const created = await api.post<Record<string, unknown>>("/api/health/labs", {
        testName: labResult.testName,
        testType: labResult.testType,
        testDate: labResult.testDate.toISOString(),
        results: cleanedResults,
        ...(labResult.facility && { facility: labResult.facility }),
        ...(labResult.orderedBy && { orderedBy: labResult.orderedBy }),
        ...(labResult.notes && { notes: labResult.notes }),
        ...(labResult.tags?.length && { tags: labResult.tags }),
      });
      return created.id as string;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to add lab result: ${msg}`);
    }
  }

  /**
   * Update an existing lab result
   */
  async updateLabResult(
    labResultId: string,
    updates: Partial<Omit<LabResult, "id" | "userId">>
  ): Promise<void> {
    try {
      await api.patch(`/api/health/labs/${labResultId}`, {
        ...(updates.testName !== undefined && { testName: updates.testName }),
        ...(updates.testType !== undefined && { testType: updates.testType }),
        ...(updates.testDate !== undefined && { testDate: updates.testDate.toISOString() }),
        ...(updates.orderedBy !== undefined && { orderedBy: updates.orderedBy }),
        ...(updates.facility !== undefined && { facility: updates.facility }),
        ...(updates.results !== undefined && { results: updates.results }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.tags !== undefined && { tags: updates.tags }),
      });
    } catch {
      throw new Error("Failed to update lab result");
    }
  }

  /**
   * Delete a lab result
   */
  async deleteLabResult(labResultId: string): Promise<void> {
    try {
      await api.delete(`/api/health/labs/${labResultId}`);
    } catch {
      throw new Error("Failed to delete lab result");
    }
  }

  /**
   * Get a single lab result by ID
   */
  async getLabResult(labResultId: string): Promise<LabResult | null> {
    try {
      const raw = await api.get<Record<string, unknown>>(`/api/health/labs/${labResultId}`);
      if (!raw || (raw as { error?: string }).error) return null;
      return normalizeLabResult(raw);
    } catch {
      return null;
    }
  }

  /**
   * Get all lab results for a user
   */
  async getUserLabResults(userId: string, limitCount?: number): Promise<LabResult[]> {
    try {
      const url = limitCount ? `/api/health/labs?limit=${limitCount}` : "/api/health/labs";
      const raw = await api.get<Record<string, unknown>[]>(url);
      return (raw ?? []).map(normalizeLabResult);
    } catch {
      return [];
    }
  }

  /**
   * Get lab results by test type (client-side filter)
   */
  async getLabResultsByType(userId: string, testType: LabResult["testType"]): Promise<LabResult[]> {
    try {
      const all = await this.getUserLabResults(userId);
      return all.filter((r) => r.testType === testType);
    } catch {
      return [];
    }
  }

  /**
   * Get lab results within a date range (client-side filter)
   */
  async getLabResultsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LabResult[]> {
    try {
      const all = await this.getUserLabResults(userId);
      return all.filter(
        (r) => r.testDate >= startDate && r.testDate <= endDate
      );
    } catch {
      return [];
    }
  }

  /**
   * Get lab results by tag (client-side filter)
   */
  async getLabResultsByTag(userId: string, tag: string): Promise<LabResult[]> {
    try {
      const all = await this.getUserLabResults(userId);
      return all.filter((r) => r.tags?.includes(tag.toLowerCase()));
    } catch {
      return [];
    }
  }

  /**
   * Analyze lab result value against reference range
   */
  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This method intentionally combines numeric and text-based status classification rules. */
  analyzeResultValue(value: LabResultValue, numericValue?: number): LabResultValue["status"] {
    if (value.status) return value.status;

    if (typeof value.value === "number" && value.referenceRange && numericValue !== undefined) {
      const range = this.parseReferenceRange(value.referenceRange);
      if (range) {
        if (numericValue < range.min) return "low";
        if (numericValue > range.max) return "high";
        return "normal";
      }
    }

    if (typeof value.value === "string") {
      const lowerValue = value.value.toLowerCase();
      if (lowerValue.includes("high") || lowerValue.includes("elevated") || lowerValue.includes("positive")) return "high";
      if (lowerValue.includes("low") || lowerValue.includes("decreased") || lowerValue.includes("negative")) return "low";
      if (lowerValue.includes("abnormal") || lowerValue.includes("critical")) return "abnormal";
    }

    return "normal";
  }

  /**
   * Parse reference range string (e.g., "70-100 mg/dL")
   */
  private parseReferenceRange(range: string): { min: number; max: number } | null {
    try {
      const match = range.match(REFERENCE_RANGE_REGEX);
      if (match) {
        return { min: Number.parseFloat(match[1]), max: Number.parseFloat(match[2]) };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get common lab test types
   */
  getCommonTestTypes(): Array<{ name: string; type: LabResult["testType"]; commonTests: string[] }> {
    return [
      {
        name: "Blood Tests",
        type: "blood",
        commonTests: [
          "Complete Blood Count (CBC)",
          "Basic Metabolic Panel (BMP)",
          "Comprehensive Metabolic Panel (CMP)",
          "Lipid Panel",
          "Hemoglobin A1C",
          "Thyroid Function Test",
          "Liver Function Test",
          "Vitamin D",
          "B12",
          "Iron",
        ],
      },
      {
        name: "Urine Tests",
        type: "urine",
        commonTests: ["Urinalysis", "Urine Culture", "Microalbumin", "Pregnancy Test"],
      },
      {
        name: "Imaging",
        type: "imaging",
        commonTests: ["X-Ray", "CT Scan", "MRI", "Ultrasound", "Mammogram", "Bone Density Scan"],
      },
      {
        name: "Other",
        type: "other",
        commonTests: ["EKG/ECG", "Stress Test", "Colonoscopy", "Endoscopy", "Biopsy"],
      },
    ];
  }
}

export const labResultService = new LabResultService();
