/* biome-ignore-all lint/performance/useTopLevelRegex: Lightweight markdown parsing keeps regex local for readability. */
export type DocumentSection = {
  id: string;
  title: string;
  content: string;
  level: number;
};

export type ParsedDocument = {
  title: string;
  lastUpdated?: string;
  sections: DocumentSection[];
  fullContent: string;
};

// Import documents as static text
import privacyPolicyContent from "../../assets/docs/privacy-policy.js";
import termsConditionsContent from "../../assets/docs/terms-conditions.js";

class DocumentService {
  private readonly documentCache: Map<string, ParsedDocument> = new Map();

  loadDocument(fileName: string): Promise<ParsedDocument> {
    if (this.documentCache.has(fileName)) {
      const cached = this.documentCache.get(fileName);
      if (cached) {
        return Promise.resolve(cached);
      }
    }

    try {
      let markdownContent: string;

      // Use static imports for document content
      switch (fileName) {
        case "privacy-policy.md":
          markdownContent = privacyPolicyContent;
          break;
        case "terms-conditions.md":
          markdownContent = termsConditionsContent;
          break;
        default:
          throw new Error(`Document ${fileName} not found`);
      }

      const parsed = this.parseMarkdown(markdownContent);
      this.documentCache.set(fileName, parsed);

      return Promise.resolve(parsed);
    } catch (_error) {
      // Silently handle error
      return Promise.reject(new Error(`Failed to load document: ${fileName}`));
    }
  }

  /* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Parser handles title, metadata, headers, and section accumulation in one pass by design. */
  private parseMarkdown(content: string): ParsedDocument {
    const lines = content.split("\n");
    const sections: DocumentSection[] = [];
    let title = "";
    let lastUpdated = "";
    let currentSection: DocumentSection | null = null;
    let sectionCounter = 0;

    for (const lineText of lines) {
      const line = lineText.trim();

      // Extract main title (first # heading)
      if (line.startsWith("# ") && !title) {
        title = line.replace("# ", "").trim();
        continue;
      }

      // Extract last updated date
      if (line.startsWith("*Last Updated:") && line.endsWith("*")) {
        lastUpdated = line
          .replace(/^\*Last Updated:\s*/, "")
          .replace(/\*$/, "")
          .trim();
        continue;
      }

      // Handle section headers (## or ### or ####)
      if (line.startsWith("#") && line.includes(" ")) {
        // Save previous section if it exists
        if (currentSection?.content.trim()) {
          sections.push(currentSection);
        }

        const headerMatch = line.match(/^(#{2,})\s+(.+)$/);
        if (headerMatch) {
          const level = headerMatch[1].length - 1; // Subtract 1 because main title is #
          const sectionTitle = headerMatch[2].trim();

          sectionCounter += 1;
          currentSection = {
            id: `section-${sectionCounter}`,
            title: sectionTitle,
            content: "",
            level,
          };
        }
        continue;
      }

      // Add content to current section
      if (currentSection) {
        currentSection.content += `${line}\n`;
      }
    }

    // Don't forget the last section
    if (currentSection?.content.trim()) {
      sections.push(currentSection);
    }

    // Clean up section content
    for (const section of sections) {
      section.content = this.cleanMarkdownContent(section.content.trim());
    }

    return {
      title: title || "Document",
      lastUpdated,
      sections,
      fullContent: content,
    };
  }

  private cleanMarkdownContent(content: string): string {
    return (
      content
        // Remove markdown formatting for basic display
        .replace(/\*\*(.*?)\*\*/g, "$1") // Bold
        .replace(/\*(.*?)\*/g, "$1") // Italic
        .replace(/`(.*?)`/g, "$1") // Inline code
        .replace(/^\s*[-*+]\s+/gm, "• ") // Convert markdown lists to bullet points
        .replace(/^\s*\d+\.\s+/gm, "• ") // Convert numbered lists to bullet points
        .trim()
    );
  }

  getPrivacyPolicy(): Promise<ParsedDocument> {
    return this.loadDocument("privacy-policy.md");
  }

  getTermsAndConditions(): Promise<ParsedDocument> {
    return this.loadDocument("terms-conditions.md");
  }

  clearCache(): void {
    this.documentCache.clear();
  }
}

export const documentService = new DocumentService();
export default documentService;
