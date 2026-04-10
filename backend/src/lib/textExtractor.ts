import pdfParse from 'pdf-parse';
import { Readable } from 'stream';
import { logger } from '../utils/logger';
import { YoutubeTranscript } from 'youtube-transcript';
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
      default:
        logger.warn({ mimeType }, 'Unsupported MIME type for text extraction, treating as plain text');
        return this.extractPlainText(buffer);
    }
  }

  /**
   * Extract text from a YouTube video URL using transcripts.
   */
  public async extractYoutube(url: string): Promise<ExtractedText> {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      const text = transcript.map(t => t.text).join(' ');
      
      return {
        text,
        metadata: {
          sourceType: 'YOUTUBE',
          url,
          duration: transcript.reduce((acc, t) => acc + t.duration, 0)
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
    // pdf-parse has inconsistent types between versions; cast to any for safe invocation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parse = (pdfParse as any).default || pdfParse;
    const result = await parse(buffer);

    return {
      text: result.text,
      metadata: {
        pageCount: result.numpages,
        info: result.info,
      },
    };
  }

  private async extractPlainText(buffer: Buffer): Promise<ExtractedText> {
    return {
      text: buffer.toString('utf-8'),
      metadata: {},
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
