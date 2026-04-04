import { logger } from '../utils/logger';

/**
 * SemanticChunker — Splits text into semantically meaningful chunks.
 *
 * Design decisions:
 * - Splits by paragraphs and headings first (semantic boundaries)
 * - Falls back to sentence splitting if paragraphs are too large
 * - Target: ~500 tokens per chunk with ~50 token overlap
 * - Preserves heading context: each chunk knows its section heading
 *
 * Note: Using a simple paragraph-based approach for Phase 1.
 * Can upgrade to @langchain/textsplitters later for more sophisticated splitting.
 */
export class SemanticChunker {
  private readonly maxChunkTokens: number;
  private readonly overlapTokens: number;

  constructor(maxChunkTokens = 500, overlapTokens = 50) {
    this.maxChunkTokens = maxChunkTokens;
    this.overlapTokens = overlapTokens;
  }

  /**
   * Chunk a document's text into semantically meaningful segments.
   */
  public chunk(text: string, documentTitle: string): ChunkResult[] {
    const sections = this.extractSections(text);
    const chunks: ChunkResult[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const sectionChunks = this.splitSection(section.content, section.heading);

      for (const content of sectionChunks) {
        const tokenCount = this.estimateTokens(content);
        chunks.push({
          content,
          chunkIndex,
          tokenCount,
          sectionHeading: section.heading,
          location: { section: section.heading },
        });
        chunkIndex++;
      }
    }

    logger.info(
      { documentTitle, totalChunks: chunks.length, totalTokens: chunks.reduce((s, c) => s + c.tokenCount, 0) },
      'Document chunked'
    );

    return chunks;
  }

  /**
   * Extract sections by detecting heading patterns (# Heading, Heading\n===, etc.)
   */
  private extractSections(text: string): Section[] {
    const lines = text.split('\n');
    const sections: Section[] = [];
    let currentHeading = 'Introduction';
    let currentContent: string[] = [];

    for (const line of lines) {
      // Detect markdown-style headings
      const headingMatch = line.match(/^#{1,6}\s+(.+)/);
      // Detect ALL-CAPS headings (common in PDFs)
      const allCapsMatch = line.match(/^[A-Z][A-Z\s]{5,}$/);

      if (headingMatch || allCapsMatch) {
        // Save previous section
        if (currentContent.length > 0) {
          sections.push({
            heading: currentHeading,
            content: currentContent.join('\n').trim(),
          });
        }
        currentHeading = (headingMatch?.[1] || line).trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Push final section
    if (currentContent.length > 0) {
      sections.push({
        heading: currentHeading,
        content: currentContent.join('\n').trim(),
      });
    }

    // If no sections were found, treat entire text as one section
    if (sections.length === 0) {
      sections.push({ heading: 'Document', content: text.trim() });
    }

    return sections.filter((s) => s.content.length > 0);
  }

  /**
   * Split a section's content into chunks respecting token limits.
   * Splits by paragraphs first, then by sentences if paragraphs are too large.
   */
  private splitSection(content: string, _heading: string): string[] {
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokens(paragraph);

      // If a single paragraph exceeds max, split by sentences
      if (paragraphTokens > this.maxChunkTokens) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        const sentenceChunks = this.splitBySentences(paragraph);
        chunks.push(...sentenceChunks);
        continue;
      }

      // If adding this paragraph would exceed max, start a new chunk
      const combinedTokens = this.estimateTokens(currentChunk + '\n\n' + paragraph);
      if (combinedTokens > this.maxChunkTokens && currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        // Overlap: keep last few sentences from previous chunk
        const overlap = this.getOverlap(currentChunk);
        currentChunk = overlap + '\n\n' + paragraph;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [content];
  }

  /**
   * Split text by sentences when paragraphs are too large.
   */
  private splitBySentences(text: string): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const combinedTokens = this.estimateTokens(currentChunk + ' ' + sentence);
      if (combinedTokens > this.maxChunkTokens && currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Get overlap text from the end of a chunk.
   */
  private getOverlap(text: string): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length === 0) return '';

    let overlap = '';
    for (let i = sentences.length - 1; i >= 0; i--) {
      const candidate = sentences[i] + ' ' + overlap;
      if (this.estimateTokens(candidate) > this.overlapTokens) break;
      overlap = candidate.trim();
    }
    return overlap;
  }

  /**
   * Rough token estimation (1 token ≈ 4 characters for English text).
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

interface Section {
  heading: string;
  content: string;
}

export interface ChunkResult {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  sectionHeading: string;
  location: Record<string, unknown>;
}
