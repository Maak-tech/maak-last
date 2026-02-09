import { safeFormatDate } from "@/utils/dateFormat";
import { medicationService } from "./medicationService";
import { moodService } from "./moodService";
import { symptomService } from "./symptomService";
import { userService } from "./userService";

export type SearchResult = {
  id: string;
  type: "medication" | "symptom" | "mood" | "family" | "note";
  title: string;
  subtitle: string;
  description: string;
  timestamp: Date;
  relevance: number;
  action?: {
    label: string;
    route: string;
    params?: unknown;
  };
};

export type SearchFilters = {
  types?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  severity?: number[];
  categories?: string[];
};

class GlobalSearchService {
  /**
   * Perform global search across all health data
   */
  async search(
    userId: string,
    query: string,
    filters?: SearchFilters,
    limit = 50
  ): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const results: SearchResult[] = [];

    try {
      // Search medications
      const medicationResults = await this.searchMedications(
        userId,
        query,
        filters
      );
      results.push(...medicationResults);

      // Search symptoms
      const symptomResults = await this.searchSymptoms(userId, query, filters);
      results.push(...symptomResults);

      // Search moods
      const moodResults = await this.searchMoods(userId, query, filters);
      results.push(...moodResults);

      // Search family members
      const familyResults = await this.searchFamily(userId, query);
      results.push(...familyResults);

      // Sort by relevance and apply filters
      const filteredResults = results
        .filter((result) => this.matchesFilters(result, filters))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

      return filteredResults;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Search medications
   */
  private async searchMedications(
    userId: string,
    query: string,
    _filters?: SearchFilters
  ): Promise<SearchResult[]> {
    try {
      const medications = await medicationService.getUserMedications(userId);
      const results: SearchResult[] = [];

      for (const medication of medications) {
        const relevance = this.calculateRelevance(query, [
          medication.name,
          medication.dosage,
          medication.frequency,
          medication.notes || "",
        ]);

        if (relevance > 0) {
          results.push({
            id: medication.id,
            type: "medication",
            title: medication.name,
            subtitle: `${medication.dosage} • ${medication.frequency}`,
            description: medication.notes || "No additional notes",
            timestamp: medication.startDate,
            relevance,
            action: {
              label: "View Medication",
              route: "/(tabs)/medications",
              params: { medicationId: medication.id },
            },
          });
        }
      }

      return results;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Search symptoms
   */
  private async searchSymptoms(
    userId: string,
    query: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]> {
    try {
      const symptoms = await symptomService.getUserSymptoms(userId, 365); // Last year
      const results: SearchResult[] = [];

      for (const symptom of symptoms) {
        const relevance = this.calculateRelevance(query, [
          symptom.type,
          symptom.description || "",
        ]);

        if (
          relevance > 0 &&
          this.matchesSeverityFilter(symptom.severity, filters)
        ) {
          results.push({
            id: symptom.id,
            type: "symptom",
            title: symptom.type,
            subtitle: `Severity: ${symptom.severity}/5 • ${safeFormatDate(symptom.timestamp)}`,
            description: symptom.description || "No description",
            timestamp: symptom.timestamp,
            relevance,
            action: {
              label: "View Symptom",
              route: "/(tabs)/symptoms",
              params: { symptomId: symptom.id },
            },
          });
        }
      }

      return results;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Search moods
   */
  private async searchMoods(
    userId: string,
    query: string,
    _filters?: SearchFilters
  ): Promise<SearchResult[]> {
    try {
      const moods = await moodService.getUserMoods(userId, 365); // Last year
      const results: SearchResult[] = [];

      for (const mood of moods) {
        const relevance = this.calculateRelevance(query, [
          this.getMoodLabel(mood.intensity),
          mood.mood,
          mood.notes || "",
          ...(mood.activities || []),
        ]);

        if (relevance > 0) {
          results.push({
            id: mood.id,
            type: "mood",
            title: this.getMoodLabel(mood.intensity),
            subtitle: `${safeFormatDate(mood.timestamp)} • ${mood.mood}`,
            description: mood.notes || "No notes",
            timestamp: mood.timestamp,
            relevance,
            action: {
              label: "View Mood Entry",
              route: "/(tabs)/moods",
              params: { moodId: mood.id },
            },
          });
        }
      }

      return results;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Search family members
   */
  private async searchFamily(
    userId: string,
    query: string
  ): Promise<SearchResult[]> {
    try {
      const familyMembers = await userService.getFamilyMembers(userId);
      const results: SearchResult[] = [];

      for (const member of familyMembers) {
        const relevance = this.calculateRelevance(query, [
          member.firstName || "",
          member.lastName || "",
          member.email || "",
          member.phoneNumber || "",
        ]);

        if (relevance > 0) {
          results.push({
            id: member.id,
            type: "family",
            title: `${member.firstName} ${member.lastName}`,
            subtitle: member.role || "Family Member",
            description:
              member.email || member.phoneNumber || "No contact info",
            timestamp: member.createdAt,
            relevance,
            action: {
              label: "View Profile",
              route: "/family/[memberId]",
              params: { memberId: member.id },
            },
          });
        }
      }

      return results;
    } catch (_error) {
      return [];
    }
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevance(query: string, fields: string[]): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    for (const field of fields) {
      const fieldLower = field.toLowerCase();

      // Exact match gets highest score
      if (fieldLower === queryLower) {
        score += 100;
      }
      // Starts with query gets high score
      else if (fieldLower.startsWith(queryLower)) {
        score += 50;
      }
      // Contains query gets medium score
      else if (fieldLower.includes(queryLower)) {
        score += 25;
      }
      // Word-level matching
      else {
        const queryWords = queryLower.split(" ");
        for (const word of queryWords) {
          if (fieldLower.includes(word)) {
            score += 10;
          }
        }
      }
    }

    return score;
  }

  /**
   * Check if result matches filters
   */
  private matchesFilters(
    result: SearchResult,
    filters?: SearchFilters
  ): boolean {
    if (!filters) {
      return true;
    }

    // Type filter
    if (
      filters.types &&
      filters.types.length > 0 &&
      !filters.types.includes(result.type)
    ) {
      return false;
    }

    // Date range filter
    if (
      filters.dateRange &&
      (result.timestamp < filters.dateRange.start ||
        result.timestamp > filters.dateRange.end)
    ) {
      return false;
    }

    // Category filter (for symptoms)
    if (filters.categories && filters.categories.length > 0) {
      // This would need to be implemented based on specific categories
      // For now, we'll skip this as categories are not consistently defined across all data types
    }

    return true;
  }

  /**
   * Check if symptom severity matches filter
   */
  private matchesSeverityFilter(
    severity: number,
    filters?: SearchFilters
  ): boolean {
    if (!filters?.severity || filters.severity.length === 0) {
      return true;
    }
    return filters.severity.includes(severity);
  }

  /**
   * Get mood label from rating
   */
  private getMoodLabel(rating: number): string {
    const labels = {
      1: "Very Sad",
      2: "Sad",
      3: "Neutral",
      4: "Happy",
      5: "Very Happy",
    };
    return labels[rating as keyof typeof labels] || "Unknown";
  }

  /**
   * Get search suggestions based on user data
   */
  async getSearchSuggestions(userId: string): Promise<string[]> {
    try {
      const suggestions: string[] = [];

      // Get recent medications
      const medications = await medicationService.getUserMedications(userId);
      for (const med of medications.slice(0, 5)) {
        suggestions.push(med.name);
      }

      // Get common symptoms
      const symptoms = await symptomService.getUserSymptoms(userId, 30);
      const symptomTypes = [...new Set(symptoms.map((s) => s.type))];
      for (const type of symptomTypes.slice(0, 5)) {
        suggestions.push(type);
      }

      // Get family member names
      const familyMembers = await userService.getFamilyMembers(userId);
      for (const member of familyMembers.slice(0, 3)) {
        suggestions.push(`${member.firstName} ${member.lastName}`);
      }

      return [...new Set(suggestions)]; // Remove duplicates
    } catch (_error) {
      return [];
    }
  }

  /**
   * Get search analytics for user behavior insights
   */
  getSearchAnalytics(_userId: string): {
    popularSearches: string[];
    searchFrequency: Record<string, number>;
    noResultsQueries: string[];
  } {
    // This would track search analytics in a real implementation
    // For now, return empty analytics
    return {
      popularSearches: [],
      searchFrequency: {},
      noResultsQueries: [],
    };
  }
}

export const globalSearchService = new GlobalSearchService();
