
class TagService {

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
   * Get suggested tags based on existing tags
   */
  async getSuggestedTags(
    userId: string,
    currentTags: string[] = [],
    limit: number = 10
  ): Promise<string[]> {
    // For now, return empty array since we removed the complex tag aggregation
    // This can be implemented later if needed
    return [];
  }
}

export const tagService = new TagService();
