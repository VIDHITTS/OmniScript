import { PDFParse } from 'pdf-parse';
import { Readable } from 'stream';
import { logger } from '../utils/logger';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

/**
 * TextExtractor — Extracts raw text from various document formats.
 *
 * Supports: PDF, Plain Text/Markdown, YouTube transcripts, and Web Pages.
 */
export class TextExtractor {

  /**
   * Extract text from a file buffer based on MIME type.
   */
  public async extract(buffer: Buffer, mimeType: string): Promise<ExtractedText> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractPdf(buffer);
      case 'text/plain':
      case 'text/markdown':
        return this.extractPlainText(buffer);
      case 'text/csv':
      case 'application/csv':
        return this.extractCsv(buffer);
      case 'application/json':
        return this.extractJson(buffer);
      // Code files — treat as plain text with language metadata
      case 'text/x-python':
      case 'text/javascript':
      case 'text/typescript':
      case 'text/x-typescript':
      case 'text/html':
      case 'text/css':
      case 'text/x-yaml':
      case 'application/x-yaml':
      case 'application/yaml':
      case 'text/x-go':
      case 'text/x-java-source':
      case 'text/x-c':
      case 'text/x-c++':
      case 'text/x-rust':
        return this.extractCode(buffer, mimeType);
      default:
        // Unknown MIME — attempt plain text extraction (works for most text-based files)
        logger.warn({ mimeType }, 'Unknown MIME type — attempting plain text extraction');
        return this.extractPlainText(buffer);
    }
  }

  /**
   * Extract text from a YouTube video URL using transcripts.
   */
  public async extractYoutube(url: string): Promise<ExtractedText> {
    try {
      // Dynamic import to avoid ESM/CJS conflict at startup
      const { YoutubeTranscript } = await import('youtube-transcript');
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      const text = transcript.map((t: { text: string }) => t.text).join(' ');
      
      return {
        text,
        metadata: {
          sourceType: 'YOUTUBE',
          url,
          duration: transcript.reduce((acc: number, t: { duration: number }) => acc + t.duration, 0)
        }
      };
    } catch (error) {
      logger.error({ url, error }, 'Failed to extract YouTube transcript');
      throw new Error(`Failed to extract YouTube transcript for ${url}`);
    }
  }

  /**
   * Extract main article text from a Web URL.
   */
  public async extractWebUrl(url: string): Promise<ExtractedText> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      
      const doc = new JSDOM(html, { url });
      const reader = new Readability(doc.window.document);
      const article = reader.parse();
      
      if (!article) {
         throw new Error('Readability failed to parse the page content');
      }

      return {
        text: article.textContent || '',
        metadata: {
          sourceType: 'WEB_URL',
          url,
          title: article.title || '',
          excerpt: article.excerpt || '',
          siteName: article.siteName || ''
        }
      };
    } catch (error) {
      logger.error({ url, error }, 'Failed to extract web URL content');
      throw new Error(`Failed to extract web page content for ${url}`);
    }
  }

  private async extractPdf(buffer: Buffer): Promise<ExtractedText> {
    try {
      // pdf-parse v2 uses class-based API with 'data' parameter for buffer
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy(); // Always destroy to free memory

      return {
        text: result.text,
        metadata: {
          pageCount: result.total || 0,
          mimeType: 'application/pdf',
        },
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'PDF parsing failed');
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractPlainText(buffer: Buffer): Promise<ExtractedText> {
    return {
      text: buffer.toString('utf-8'),
      metadata: { mimeType: 'text/plain' },
    };
  }

  /**
   * Extract CSV — converts rows into readable prose for the LLM.
   * Preserves headers and first 500 rows.
   */
  private async extractCsv(buffer: Buffer): Promise<ExtractedText> {
    const raw = buffer.toString('utf-8');
    const lines = raw.split('\n').filter(l => l.trim());
    const headers = lines[0]?.split(',').map(h => h.trim().replace(/"|'/g, '')) || [];
    const rowCount = lines.length - 1;

    // Build human-readable representation
    let text = `CSV Dataset with ${rowCount} rows and ${headers.length} columns.\n`;
    text += `Columns: ${headers.join(', ')}\n\n`;
    // Include all rows (or up to 500 for embedding)
    const dataLines = lines.slice(1, 501);
    text += dataLines.join('\n');

    if (rowCount > 500) {
      text += `\n\n[Truncated to first 500 rows of ${rowCount} total]`;
    }

    return {
      text,
      metadata: { mimeType: 'text/csv', rowCount, columns: headers },
    };
  }

  /**
   * Extract JSON — pretty-prints the structure for readability.
   * Handles nested objects and arrays gracefully.
   */
  private async extractJson(buffer: Buffer): Promise<ExtractedText> {
    const raw = buffer.toString('utf-8');
    try {
      const parsed = JSON.parse(raw);
      const isArray = Array.isArray(parsed);
      const count = isArray ? parsed.length : Object.keys(parsed).length;
      const typeName = isArray ? `array with ${count} items` : `object with ${count} keys`;

      const text = `JSON Document (${typeName}):\n\n${JSON.stringify(parsed, null, 2)}`;
      return {
        text,
        metadata: { mimeType: 'application/json', type: typeName },
      };
    } catch {
      // Malformed JSON — extract as plain text
      return { text: raw, metadata: { mimeType: 'application/json', parseError: true } };
    }
  }

  /**
   * Extract code files — plain text with language metadata attached.
   */
  private async extractCode(buffer: Buffer, mimeType: string): Promise<ExtractedText> {
    const langMap: Record<string, string> = {
      'text/x-python': 'Python', 'text/javascript': 'JavaScript',
      'text/typescript': 'TypeScript', 'text/x-typescript': 'TypeScript',
      'text/html': 'HTML', 'text/css': 'CSS',
      'text/x-yaml': 'YAML', 'application/x-yaml': 'YAML', 'application/yaml': 'YAML',
      'text/x-go': 'Go', 'text/x-java-source': 'Java',
      'text/x-c': 'C', 'text/x-c++': 'C++', 'text/x-rust': 'Rust',
    };
    const language = langMap[mimeType] || 'Code';
    const code = buffer.toString('utf-8');
    const lineCount = code.split('\n').length;

    return {
      text: `${language} source file (${lineCount} lines):\n\n${code}`,
      metadata: { mimeType, language, lineCount },
    };
  }
}

export interface ExtractedText {
  text: string;
  metadata: Record<string, unknown>;
}

/**
 * Helper: Convert a Readable stream to a Buffer.
 */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
