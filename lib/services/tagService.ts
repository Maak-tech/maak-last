const VALID_TAG_REGEX = /^[a-z0-9\s\-_]+$/i;

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
      VALID_TAG_REGEX.test(normalized)
    );
  }

  /**
   * Get suggested tags based on existing tags
   */
  getSuggestedTags(
    _userId: string,
    _currentTags: string[] = [],
    _limit = 10
  ): Promise<string[]> {
    // For now, return empty array since we removed the complex tag aggregation
    // This can be implemented later if needed
    return Promise.resolve([]);
  }
}

export const tagService = new TagService();
