import { prisma } from '../config/db';
import { Status } from '@prisma/client';
import { gridFsStorage } from '../lib/storage/GridFsStorageService';
import { TextExtractor, streamToBuffer } from '../lib/textExtractor';
import { SemanticChunker } from '../lib/chunker';
import { Embedder, enrichChunkContext } from '../lib/embedder';
import { StructureExtractor } from '../lib/structureExtractor';
import { logger } from '../utils/logger';

/**
 * DocumentProcessor — Background processing pipeline for uploaded documents.
 *
 * Pipeline: download → extract text → chunk → contextual enrichment → embed → store
 *
 * Design decisions:
 * - In-process queue (no Redis/BullMQ for Phase 1) — simple async processing
 * - Status updates at each stage: QUEUED → PROCESSING → CHUNKING → EMBEDDING → INDEXED
 * - Idempotent: if chunks exist for a document, skip re-processing
 * - Retry up to 3 times with exponential backoff on failure
 * - Stores both original content (for display) and contextualized content (for embedding)
 */

const MAX_RETRIES = 3;
const textExtractor = new TextExtractor();
const chunker = new SemanticChunker(500, 50);
const embedder = new Embedder();
const structureExtractor = new StructureExtractor();

// Simple in-memory processing queue
const processingQueue: string[] = [];
let isProcessing = false;

/**
 * Enqueue a document for processing.
 */
export function enqueueDocumentProcessing(documentId: string): void {
  processingQueue.push(documentId);
  logger.info({ documentId, queueLength: processingQueue.length }, 'Document enqueued for processing');

  // Start processing if not already running
  if (!isProcessing) {
    processNextInQueue();
  }
}

/**
 * Process the next document in the queue.
 */
async function processNextInQueue(): Promise<void> {
  if (processingQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const documentId = processingQueue.shift()!;

  try {
    await processDocument(documentId);
  } catch (error) {
    logger.error({ documentId, error }, 'Failed to process document from queue');
  }

  // Process next item (non-blocking)
  setImmediate(processNextInQueue);
}

/**
 * Main processing function for a single document.
 */
async function processDocument(documentId: string, retryCount = 0): Promise<void> {
  const startTime = Date.now();
  logger.info({ documentId, retryCount }, 'Starting document processing');

  try {
    // 1. Fetch document metadata
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      logger.error({ documentId }, 'Document not found for processing');
      return;
    }

    // Skip if already indexed
    if (document.status === Status.INDEXED) {
      logger.info({ documentId }, 'Document already indexed, skipping');
      return;
    }

    // 2. Update status → PROCESSING
    await updateStatus(documentId, Status.PROCESSING);

    // 3. Download file from storage or fetch URL content
    let text = '';
    let metadata: Record<string, unknown> = {};

    if (document.sourceType === 'YOUTUBE') {
      const result = await textExtractor.extractYoutube(document.storageUrl!);
      text = result.text;
      metadata = result.metadata;
    } else if (document.sourceType === 'WEB_URL') {
      const result = await textExtractor.extractWebUrl(document.storageUrl!);
      text = result.text;
      metadata = result.metadata;
    } else {
      const downloadStream = await gridFsStorage.download(document.storageUrl!);
      const fileBuffer = await streamToBuffer(downloadStream);
      
      const result = await textExtractor.extract(
        fileBuffer,
        document.mimeType || 'application/octet-stream'
      );
      text = result.text;
      metadata = result.metadata;
    }

    if (!text || text.trim().length === 0) {
      await updateStatus(documentId, Status.FAILED, 'No text extracted from document');
      return;
    }

    // 5. Extract document structure (for PageIndex navigation)
    try {
      await structureExtractor.extractAndStore(documentId, text, metadata);
    } catch (structErr) {
      logger.warn({ documentId, error: structErr }, 'Structure extraction failed, continuing with chunking');
    }

    // 6. Update status → CHUNKING
    await updateStatus(documentId, Status.CHUNKING);

    // 6. Semantic chunking
    const chunks = chunker.chunk(text, document.title);

    // 7. Update status → EMBEDDING
    await updateStatus(documentId, Status.EMBEDDING);

    // 8. Contextual enrichment + embedding for each chunk
    const chunkRecords = [];
    for (const chunk of chunks) {
      // Contextual enrichment (call LLM to generate context)
      const contextualizedContent = await enrichChunkContext(
        chunk.content,
        document.title,
        chunk.sectionHeading
      );

      // Generate embedding for contextualized content
      const embedding = await embedder.embed(contextualizedContent);

      chunkRecords.push({
        documentId,
        content: chunk.content,
        contextualizedContent,
        embedding: JSON.stringify(embedding), // Store as JSON for now
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
        sectionHeading: chunk.sectionHeading,
        location: JSON.parse(JSON.stringify(chunk.location)),
      });
    }

    // 9. Batch insert chunks into database
    await prisma.documentChunk.createMany({
      data: chunkRecords,
    });

    // 10. Update document counts and status → INDEXED
    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: Status.INDEXED,
        totalChunks: chunks.length,
        tokenCount: totalTokens,
        processedAt: new Date(),
        metadata: {
          ...(document.metadata as Record<string, unknown> || {}),
          ...metadata,
          processingTimeMs: Date.now() - startTime,
        },
      },
    });

    const elapsed = Date.now() - startTime;
    logger.info(
      { documentId, chunks: chunks.length, tokens: totalTokens, elapsed: `${elapsed}ms` },
      'Document processing complete'
    );

  } catch (error) {
    logger.error({ documentId, error, retryCount }, 'Document processing failed');

    // Retry with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000;
      logger.info({ documentId, retryCount: retryCount + 1, delayMs: delay }, 'Retrying document processing');
      setTimeout(() => processDocument(documentId, retryCount + 1), delay);
    } else {
      await updateStatus(
        documentId,
        Status.FAILED,
        error instanceof Error ? error.message : 'Unknown processing error'
      );
    }
  }
}

async function updateStatus(documentId: string, status: Status, errorMessage?: string): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status,
      ...(errorMessage && { errorMessage }),
    },
  });
  logger.info({ documentId, status }, 'Document status updated');
}
