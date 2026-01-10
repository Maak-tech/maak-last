import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Medication,
  Symptom,
  MedicalHistory,
  Allergy,
  Mood,
  VitalSign,
} from "@/types";

export type SearchResultType =
  | "medication"
  | "symptom"
  | "medicalHistory"
  | "allergy"
  | "mood"
  | "vital";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  timestamp: Date;
  data: any; // Original data object
  relevanceScore?: number;
}

export interface SearchFilters {
  types?: SearchResultType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  severity?: number[]; // For symptoms
  isActive?: boolean; // For medications
  tags?: string[]; // Filter by tags (items must have at least one matching tag)
}

export interface SearchOptions {
  limit?: number;
  sortBy?: "relevance" | "date" | "title";
  filters?: SearchFilters;
}

class GlobalSearchService {
  /**
   * Normalize search query for better matching
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim();
  }

  /**
   * Calculate relevance score for a search result
   */
  private calculateRelevanceScore(
    item: any,
    searchQuery: string,
    type: SearchResultType
  ): number {
    const normalizedQuery = this.normalizeQuery(searchQuery);
    let score = 0;

    // Title matches get highest score
    const title = item.name || item.type || item.condition || "";
    if (title.toLowerCase().includes(normalizedQuery)) {
      score += 10;
      if (title.toLowerCase().startsWith(normalizedQuery)) {
        score += 5; // Exact start match gets bonus
      }
    }

    // Subtitle/description matches
    const subtitle =
      item.description ||
      item.notes ||
      item.dosage ||
      item.reaction ||
      item.notes ||
      "";
    if (subtitle.toLowerCase().includes(normalizedQuery)) {
      score += 5;
    }

    // Type-specific scoring
    switch (type) {
      case "medication":
        if (item.dosage?.toLowerCase().includes(normalizedQuery)) {
          score += 3;
        }
        if (item.frequency?.toLowerCase().includes(normalizedQuery)) {
          score += 2;
        }
        break;
      case "symptom":
        if (item.location?.toLowerCase().includes(normalizedQuery)) {
          score += 3;
        }
        if (item.triggers?.some((t: string) =>
          t.toLowerCase().includes(normalizedQuery)
        )) {
          score += 2;
        }
        break;
    }

    return score;
  }

  /**
   * Search medications
   */
  private async searchMedications(
    userId: string,
    searchQuery: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    try {
      let q = query(
        collection(db, "medications"),
        where("userId", "==", userId)
      );

      if (filters?.isActive !== undefined) {
        q = query(q, where("isActive", "==", filters.isActive));
      }

      const snapshot = await getDocs(q);
      const results: SearchResult[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const medication = {
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate(),
          endDate: data.endDate?.toDate(),
        } as Medication;

        // Filter by search query
        const normalizedQuery = this.normalizeQuery(searchQuery);
        const matches =
          medication.name.toLowerCase().includes(normalizedQuery) ||
          medication.dosage?.toLowerCase().includes(normalizedQuery) ||
          medication.frequency?.toLowerCase().includes(normalizedQuery) ||
          medication.notes?.toLowerCase().includes(normalizedQuery) ||
          medication.tags?.some((tag) =>
            tag.toLowerCase().includes(normalizedQuery)
          );

        // Filter by tags if specified
        const tagMatches =
          !filters?.tags ||
          filters.tags.length === 0 ||
          (medication.tags &&
            medication.tags.some((tag) =>
              filters.tags!.some((filterTag) =>
                tag.toLowerCase() === filterTag.toLowerCase()
              )
            ));

        if (matches && tagMatches) {
          const relevanceScore = this.calculateRelevanceScore(
            medication,
            searchQuery,
            "medication"
          );

          results.push({
            id: doc.id,
            type: "medication",
            title: medication.name,
            subtitle: `${medication.dosage} • ${medication.frequency}`,
            timestamp: medication.startDate,
            data: medication,
            relevanceScore,
          });
        }
      });

      return results;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search symptoms
   */
  private async searchSymptoms(
    userId: string,
    searchQuery: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    try {
      let q = query(
        collection(db, "symptoms"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc")
      );

      const snapshot = await getDocs(q);
      const results: SearchResult[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const symptom = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate(),
        } as Symptom;

        // Filter by search query
        const normalizedQuery = this.normalizeQuery(searchQuery);
        const matches =
          symptom.type.toLowerCase().includes(normalizedQuery) ||
          symptom.description?.toLowerCase().includes(normalizedQuery) ||
          symptom.location?.toLowerCase().includes(normalizedQuery) ||
          symptom.triggers?.some((t) =>
            t.toLowerCase().includes(normalizedQuery)
          ) ||
          symptom.tags?.some((tag) =>
            tag.toLowerCase().includes(normalizedQuery)
          );

        // Filter by severity if specified
        if (filters?.severity && !filters.severity.includes(symptom.severity)) {
          return;
        }

        // Filter by tags if specified
        const tagMatches =
          !filters?.tags ||
          filters.tags.length === 0 ||
          (symptom.tags &&
            symptom.tags.some((tag) =>
              filters.tags!.some((filterTag) =>
                tag.toLowerCase() === filterTag.toLowerCase()
              )
            ));

        if (matches && tagMatches) {
          const relevanceScore = this.calculateRelevanceScore(
            symptom,
            searchQuery,
            "symptom"
          );

          results.push({
            id: doc.id,
            type: "symptom",
            title: symptom.type,
            subtitle: symptom.description || symptom.location || "",
            timestamp: symptom.timestamp,
            data: symptom,
            relevanceScore,
          });
        }
      });

      return results;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search medical history
   */
  private async searchMedicalHistory(
    userId: string,
    searchQuery: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    try {
      const q = query(
        collection(db, "medicalHistory"),
        where("userId", "==", userId)
      );

      const snapshot = await getDocs(q);
      const results: SearchResult[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const history = {
          id: doc.id,
          ...data,
          diagnosedDate: data.diagnosedDate?.toDate(),
        } as MedicalHistory;

        const normalizedQuery = this.normalizeQuery(searchQuery);
        const matches =
          history.condition.toLowerCase().includes(normalizedQuery) ||
          history.notes?.toLowerCase().includes(normalizedQuery) ||
          history.tags?.some((tag) =>
            tag.toLowerCase().includes(normalizedQuery)
          );

        // Filter by tags if specified
        const tagMatches =
          !filters?.tags ||
          filters.tags.length === 0 ||
          (history.tags &&
            history.tags.some((tag) =>
              filters.tags!.some((filterTag) =>
                tag.toLowerCase() === filterTag.toLowerCase()
              )
            ));

        if (matches && tagMatches) {
          const relevanceScore = this.calculateRelevanceScore(
            history,
            searchQuery,
            "medicalHistory"
          );

          results.push({
            id: doc.id,
            type: "medicalHistory",
            title: history.condition,
            subtitle: history.notes || history.severity || "",
            timestamp: history.diagnosedDate || new Date(),
            data: history,
            relevanceScore,
          });
        }
      });

      return results;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search allergies
   */
  private async searchAllergies(
    userId: string,
    searchQuery: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    try {
      const q = query(collection(db, "allergies"), where("userId", "==", userId));

      const snapshot = await getDocs(q);
      const results: SearchResult[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const allergy = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate(),
          discoveredDate: data.discoveredDate?.toDate(),
        } as Allergy;

        const normalizedQuery = this.normalizeQuery(searchQuery);
        const matches =
          allergy.name.toLowerCase().includes(normalizedQuery) ||
          allergy.reaction?.toLowerCase().includes(normalizedQuery) ||
          allergy.notes?.toLowerCase().includes(normalizedQuery);

        if (matches) {
          const relevanceScore = this.calculateRelevanceScore(
            allergy,
            searchQuery,
            "allergy"
          );

          results.push({
            id: doc.id,
            type: "allergy",
            title: allergy.name,
            subtitle: allergy.reaction || allergy.severity || "",
            timestamp: allergy.timestamp,
            data: allergy,
            relevanceScore,
          });
        }
      });

      return results;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search moods
   */
  private async searchMoods(
    userId: string,
    searchQuery: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    try {
      const q = query(
        collection(db, "moods"),
        where("userId", "==", userId),
        orderBy("timestamp", "desc")
      );

      const snapshot = await getDocs(q);
      const results: SearchResult[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const mood = {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate(),
        } as Mood;

        const normalizedQuery = this.normalizeQuery(searchQuery);
        const matches =
          mood.mood.toLowerCase().includes(normalizedQuery) ||
          mood.notes?.toLowerCase().includes(normalizedQuery) ||
          mood.activities?.some((a) =>
            a.toLowerCase().includes(normalizedQuery)
          );

        if (matches) {
          const relevanceScore = this.calculateRelevanceScore(
            mood,
            searchQuery,
            "mood"
          );

          results.push({
            id: doc.id,
            type: "mood",
            title: mood.mood,
            subtitle: mood.notes || "",
            timestamp: mood.timestamp,
            data: mood,
            relevanceScore,
          });
        }
      });

      return results;
    } catch (error) {
      return [];
    }
  }

  /**
   * Global search across all health data
   */
  async search(
    userId: string,
    searchQuery: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!searchQuery.trim()) {
      return [];
    }

    const { limit: resultLimit = 50, sortBy = "relevance", filters } = options;

    // Determine which types to search
    const typesToSearch =
      filters?.types || [
        "medication",
        "symptom",
        "medicalHistory",
        "allergy",
        "mood",
      ];

    // Search all specified types in parallel
    const searchPromises: Promise<SearchResult[]>[] = [];

    if (typesToSearch.includes("medication")) {
      searchPromises.push(this.searchMedications(userId, searchQuery, filters));
    }
    if (typesToSearch.includes("symptom")) {
      searchPromises.push(this.searchSymptoms(userId, searchQuery, filters));
    }
    if (typesToSearch.includes("medicalHistory")) {
      searchPromises.push(
        this.searchMedicalHistory(userId, searchQuery, filters)
      );
    }
    if (typesToSearch.includes("allergy")) {
      searchPromises.push(this.searchAllergies(userId, searchQuery, filters));
    }
    if (typesToSearch.includes("mood")) {
      searchPromises.push(this.searchMoods(userId, searchQuery, filters));
    }

    const results = await Promise.all(searchPromises);
    let allResults = results.flat();

    // Apply date range filter if specified
    if (filters?.dateRange) {
      allResults = allResults.filter((result) => {
        const resultDate = result.timestamp;
        return (
          resultDate >= filters.dateRange!.start &&
          resultDate <= filters.dateRange!.end
        );
      });
    }

    // Sort results
    if (sortBy === "relevance") {
      allResults.sort((a, b) => {
        const scoreA = a.relevanceScore || 0;
        const scoreB = b.relevanceScore || 0;
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // Higher score first
        }
        return b.timestamp.getTime() - a.timestamp.getTime(); // Newer first
      });
    } else if (sortBy === "date") {
      allResults.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
    } else if (sortBy === "title") {
      allResults.sort((a, b) => a.title.localeCompare(b.title));
    }

    // Apply limit
    return allResults.slice(0, resultLimit);
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async getSuggestions(
    userId: string,
    searchQuery: string,
    limit: number = 10
  ): Promise<string[]> {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return [];
    }

    const results = await this.search(userId, searchQuery, {
      limit: limit * 2, // Get more results to extract unique suggestions
    });

    // Extract unique titles
    const suggestions = new Set<string>();
    results.forEach((result) => {
      if (result.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        suggestions.add(result.title);
      }
    });

    return Array.from(suggestions).slice(0, limit);
  }
}

export const globalSearchService = new GlobalSearchService();
