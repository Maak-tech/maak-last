export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  level: number;
}

export interface ParsedDocument {
  title: string;
  lastUpdated?: string;
  sections: DocumentSection[];
  fullContent: string;
}

// Import documents as static text
import privacyPolicyContent from "../../assets/docs/privacy-policy.js";
import termsConditionsContent from "../../assets/docs/terms-conditions.js";

class DocumentService {
  private documentCache: Map<string, ParsedDocument> = new Map();

  async loadDocument(fileName: string): Promise<ParsedDocument> {
    if (this.documentCache.has(fileName)) {
      return this.documentCache.get(fileName)!;
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

      return parsed;
    } catch (error) {
      console.error(`Error loading document ${fileName}:`, error);
      throw new Error(`Failed to load document: ${fileName}`);
    }
  }

  private parseMarkdown(content: string): ParsedDocument {
    const lines = content.split("\n");
    const sections: DocumentSection[] = [];
    let title = "";
    let lastUpdated = "";
    let currentSection: DocumentSection | null = null;
    let sectionCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

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
        if (currentSection && currentSection.content.trim()) {
          sections.push(currentSection);
        }

        const headerMatch = line.match(/^(#{2,})\s+(.+)$/);
        if (headerMatch) {
          const level = headerMatch[1].length - 1; // Subtract 1 because main title is #
          const sectionTitle = headerMatch[2].trim();

          sectionCounter++;
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
        currentSection.content += line + "\n";
      }
    }

    // Don't forget the last section
    if (currentSection && currentSection.content.trim()) {
      sections.push(currentSection);
    }

    // Clean up section content
    sections.forEach((section) => {
      section.content = this.cleanMarkdownContent(section.content.trim());
    });

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

  async getPrivacyPolicy(): Promise<ParsedDocument> {
    return this.loadDocument("privacy-policy.md");
  }

  async getTermsAndConditions(): Promise<ParsedDocument> {
    return this.loadDocument("terms-conditions.md");
  }

  clearCache(): void {
    this.documentCache.clear();
  }
}

export const documentService = new DocumentService();
export default documentService;
