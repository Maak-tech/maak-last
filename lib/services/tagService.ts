import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Medication, Symptom, MedicalHistory } from "@/types";

export interface TagUsage {
  tag: string;
  count: number;
  type: "medication" | "symptom" | "medicalHistory" | "all";
}

class TagService {
  /**
   * Extract all tags from medications
   */
  async getMedicationTags(userId: string): Promise<string[]> {
    try {
      const q = query(
        collection(db, "medications"),
        where("userId", "==", userId)
      );

      const snapshot = await getDocs(q);
      const tagsSet = new Set<string>();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const tags = data.tags || [];
        tags.forEach((tag: string) => tagsSet.add(tag.toLowerCase().trim()));
      });

      return Array.from(tagsSet).sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract all tags from symptoms
   */
  async getSymptomTags(userId: string): Promise<string[]> {
    try {
      const q = query(
        collection(db, "symptoms"),
        where("userId", "==", userId)
      );

      const snapshot = await getDocs(q);
      const tagsSet = new Set<string>();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const tags = data.tags || [];
        tags.forEach((tag: string) => tagsSet.add(tag.toLowerCase().trim()));
      });

      return Array.from(tagsSet).sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract all tags from medical history
   */
  async getMedicalHistoryTags(userId: string): Promise<string[]> {
    try {
      const q = query(
        collection(db, "medicalHistory"),
        where("userId", "==", userId)
      );

      const snapshot = await getDocs(q);
      const tagsSet = new Set<string>();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const tags = data.tags || [];
        tags.forEach((tag: string) => tagsSet.add(tag.toLowerCase().trim()));
      });

      return Array.from(tagsSet).sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all tags across all data types
   */
  async getAllTags(userId: string): Promise<string[]> {
    const [medTags, symptomTags, historyTags] = await Promise.all([
      this.getMedicationTags(userId),
      this.getSymptomTags(userId),
      this.getMedicalHistoryTags(userId),
    ]);

    const allTagsSet = new Set<string>();
    [...medTags, ...symptomTags, ...historyTags].forEach((tag) =>
      allTagsSet.add(tag)
    );

    return Array.from(allTagsSet).sort();
  }

  /**
   * Get tag usage statistics
   */
  async getTagUsage(
    userId: string,
    type?: "medication" | "symptom" | "medicalHistory" | "all"
  ): Promise<TagUsage[]> {
    const usageMap = new Map<string, { count: number; types: Set<string> }>();

    if (!type || type === "medication" || type === "all") {
      const medTags = await this.getMedicationTags(userId);
      const q = query(
        collection(db, "medications"),
        where("userId", "==", userId)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((doc) => {
        const data = doc.data();
        const tags = data.tags || [];
        tags.forEach((tag: string) => {
          const normalized = tag.toLowerCase().trim();
          const current = usageMap.get(normalized) || {
            count: 0,
            types: new Set<string>(),
          };
          current.count++;
          current.types.add("medication");
          usageMap.set(normalized, current);
        });
      });
    }

    if (!type || type === "symptom" || type === "all") {
      const q = query(
        collection(db, "symptoms"),
        where("userId", "==", userId)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((doc) => {
        const data = doc.data();
        const tags = data.tags || [];
        tags.forEach((tag: string) => {
          const normalized = tag.toLowerCase().trim();
          const current = usageMap.get(normalized) || {
            count: 0,
            types: new Set<string>(),
          };
          current.count++;
          current.types.add("symptom");
          usageMap.set(normalized, current);
        });
      });
    }

    if (!type || type === "medicalHistory" || type === "all") {
      const q = query(
        collection(db, "medicalHistory"),
        where("userId", "==", userId)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((doc) => {
        const data = doc.data();
        const tags = data.tags || [];
        tags.forEach((tag: string) => {
          const normalized = tag.toLowerCase().trim();
          const current = usageMap.get(normalized) || {
            count: 0,
            types: new Set<string>(),
          };
          current.count++;
          current.types.add("medicalHistory");
          usageMap.set(normalized, current);
        });
      });
    }

    const usage: TagUsage[] = Array.from(usageMap.entries()).map(
      ([tag, data]) => ({
        tag,
        count: data.count,
        type:
          data.types.size > 1
            ? "all"
            : (Array.from(data.types)[0] as TagUsage["type"]),
      })
    );

    return usage.sort((a, b) => b.count - a.count);
  }

  /**
   * Normalize tag (lowercase, trim)
   */
  normalizeTag(tag: string): string {
    return tag.toLowerCase().trim();
  }

  /**
   * Validate tag (check if it's a valid tag string)
   */
  isValidTag(tag: string): boolean {
    const normalized = this.normalizeTag(tag);
    return (
      normalized.length > 0 &&
      normalized.length <= 30 &&
      /^[a-z0-9\s\-_]+$/i.test(normalized)
    );
  }

  /**
   * Parse tags from comma-separated string
   */
  parseTags(tagString: string): string[] {
    return tagString
      .split(",")
      .map((tag) => this.normalizeTag(tag))
      .filter((tag) => tag.length > 0 && this.isValidTag(tag));
  }

  /**
   * Format tags array to display string
   */
  formatTags(tags: string[]): string {
    return tags.join(", ");
  }

  /**
   * Get suggested tags based on existing tags
   */
  async getSuggestedTags(
    userId: string,
    currentTags: string[] = [],
    limit: number = 10
  ): Promise<string[]> {
    const allTags = await this.getAllTags(userId);
    const currentTagsSet = new Set(
      currentTags.map((tag) => this.normalizeTag(tag))
    );

    // Return tags that aren't already in currentTags
    return allTags
      .filter((tag) => !currentTagsSet.has(tag))
      .slice(0, limit);
  }
}

export const tagService = new TagService();
