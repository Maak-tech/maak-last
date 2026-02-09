import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LabResult, LabResultValue } from "@/types";

class LabResultService {
  /**
   * Add a new lab result
   */
  async addLabResult(
    userId: string,
    labResult: Omit<LabResult, "id">
  ): Promise<string> {
    try {
      // Validate required fields
      if (!(labResult.testName && labResult.testName.trim())) {
        throw new Error("Test name is required");
      }
      if (!labResult.results || labResult.results.length === 0) {
        throw new Error("At least one result is required");
      }

      // Clean nested results array - remove undefined values from each result object
      const cleanedResults = labResult.results
        .filter(
          (result) =>
            result.name &&
            result.name.trim() &&
            result.value !== undefined &&
            result.value !== null &&
            result.value !== ""
        )
        .map((result) =>
          Object.fromEntries(
            Object.entries(result).filter(([_, value]) => value !== undefined)
          )
        );

      if (cleanedResults.length === 0) {
        throw new Error("No valid results found");
      }

      // Filter out undefined values to prevent Firebase errors
      const cleanedData = Object.fromEntries(
        Object.entries({
          userId,
          testName: labResult.testName,
          testType: labResult.testType,
          testDate: Timestamp.fromDate(labResult.testDate),
          results: cleanedResults,
          ...(labResult.facility && { facility: labResult.facility }),
          ...(labResult.orderedBy && { orderedBy: labResult.orderedBy }),
          ...(labResult.notes && { notes: labResult.notes }),
          ...(labResult.tags &&
            labResult.tags.length > 0 && { tags: labResult.tags }),
          ...(labResult.attachments &&
            labResult.attachments.length > 0 && {
              attachments: labResult.attachments,
            }),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }).filter(([_, value]) => value !== undefined)
      );

      const docRef = await addDoc(collection(db, "labResults"), cleanedData);

      return docRef.id;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to add lab result: ${errorMessage}`);
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
      const docRef = doc(db, "labResults", labResultId);
      const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      if (updates.testDate) {
        updateData.testDate = Timestamp.fromDate(updates.testDate);
      }

      await updateDoc(docRef, updateData);
    } catch (_error) {
      throw new Error("Failed to update lab result");
    }
  }

  /**
   * Delete a lab result
   */
  async deleteLabResult(labResultId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "labResults", labResultId));
    } catch (_error) {
      throw new Error("Failed to delete lab result");
    }
  }

  /**
   * Get a single lab result by ID
   */
  async getLabResult(labResultId: string): Promise<LabResult | null> {
    try {
      const docSnap = await getDoc(doc(db, "labResults", labResultId));

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        testDate: data.testDate?.toDate() || new Date(),
      } as LabResult;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Get all lab results for a user
   */
  async getUserLabResults(
    userId: string,
    limitCount?: number
  ): Promise<LabResult[]> {
    try {
      let q = query(
        collection(db, "labResults"),
        where("userId", "==", userId),
        orderBy("testDate", "desc")
      );

      if (limitCount) {
        q = query(q, limit(limitCount));
      }

      const snapshot = await getDocs(q);
      const results: LabResult[] = [];

      snapshot.forEach((resultDoc) => {
        const data = resultDoc.data();
        results.push({
          id: resultDoc.id,
          ...data,
          testDate: data.testDate?.toDate() || new Date(),
        } as LabResult);
      });

      return results;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get lab results by test type
   */
  async getLabResultsByType(
    userId: string,
    testType: LabResult["testType"]
  ): Promise<LabResult[]> {
    try {
      const q = query(
        collection(db, "labResults"),
        where("userId", "==", userId),
        where("testType", "==", testType),
        orderBy("testDate", "desc")
      );

      const snapshot = await getDocs(q);
      const results: LabResult[] = [];

      snapshot.forEach((resultDoc) => {
        const data = resultDoc.data();
        results.push({
          id: resultDoc.id,
          ...data,
          testDate: data.testDate?.toDate() || new Date(),
        } as LabResult);
      });

      return results;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get lab results within a date range
   */
  async getLabResultsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LabResult[]> {
    try {
      const q = query(
        collection(db, "labResults"),
        where("userId", "==", userId),
        where("testDate", ">=", Timestamp.fromDate(startDate)),
        where("testDate", "<=", Timestamp.fromDate(endDate)),
        orderBy("testDate", "desc")
      );

      const snapshot = await getDocs(q);
      const results: LabResult[] = [];

      snapshot.forEach((resultDoc) => {
        const data = resultDoc.data();
        results.push({
          id: resultDoc.id,
          ...data,
          testDate: data.testDate?.toDate() || new Date(),
        } as LabResult);
      });

      return results;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get lab results by tag
   */
  async getLabResultsByTag(userId: string, tag: string): Promise<LabResult[]> {
    try {
      const allResults = await this.getUserLabResults(userId);
      return allResults.filter(
        (result) => result.tags && result.tags.includes(tag.toLowerCase())
      );
    } catch (_error) {
      return [];
    }
  }

  /**
   * Analyze lab result value against reference range
   */
  analyzeResultValue(
    value: LabResultValue,
    numericValue?: number
  ): LabResultValue["status"] {
    if (value.status) {
      return value.status;
    }

    // If value is numeric and we have a reference range, analyze it
    if (
      typeof value.value === "number" &&
      value.referenceRange &&
      numericValue !== undefined
    ) {
      const range = this.parseReferenceRange(value.referenceRange);
      if (range) {
        if (numericValue < range.min) {
          return "low";
        }
        if (numericValue > range.max) {
          return "high";
        }
        return "normal";
      }
    }

    // Check for text-based abnormal values
    if (typeof value.value === "string") {
      const lowerValue = value.value.toLowerCase();
      if (
        lowerValue.includes("high") ||
        lowerValue.includes("elevated") ||
        lowerValue.includes("positive")
      ) {
        return "high";
      }
      if (
        lowerValue.includes("low") ||
        lowerValue.includes("decreased") ||
        lowerValue.includes("negative")
      ) {
        return "low";
      }
      if (lowerValue.includes("abnormal") || lowerValue.includes("critical")) {
        return "abnormal";
      }
    }

    return "normal";
  }

  /**
   * Parse reference range string (e.g., "70-100 mg/dL")
   */
  private parseReferenceRange(
    range: string
  ): { min: number; max: number } | null {
    try {
      // Remove units and extract numbers
      const match = range.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
      if (match) {
        return {
          min: Number.parseFloat(match[1]),
          max: Number.parseFloat(match[2]),
        };
      }
      return null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Get common lab test types
   */
  getCommonTestTypes(): Array<{
    name: string;
    type: LabResult["testType"];
    commonTests: string[];
  }> {
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
        commonTests: [
          "Urinalysis",
          "Urine Culture",
          "Microalbumin",
          "Pregnancy Test",
        ],
      },
      {
        name: "Imaging",
        type: "imaging",
        commonTests: [
          "X-Ray",
          "CT Scan",
          "MRI",
          "Ultrasound",
          "Mammogram",
          "Bone Density Scan",
        ],
      },
      {
        name: "Other",
        type: "other",
        commonTests: [
          "EKG/ECG",
          "Stress Test",
          "Colonoscopy",
          "Endoscopy",
          "Biopsy",
        ],
      },
    ];
  }
}

export const labResultService = new LabResultService();

