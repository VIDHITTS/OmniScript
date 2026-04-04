import pdfParse from 'pdf-parse';
import { Readable } from 'stream';
import { logger } from '../utils/logger';

/**
 * TextExtractor — Extracts raw text from various document formats.
 *
 * Phase 1 supports: PDF and plain text.
 * Future phases: YouTube transcripts, web pages, audio (Whisper), images (Vision).
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
