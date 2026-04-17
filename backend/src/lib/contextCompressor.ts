import { groq } from './groq';
import { logger } from '../utils/logger';

/**
 * ContextCompressor — Reduces token usage by compressing retrieved context.
 * 
 * Strategies:
 * 1. Extract only relevant sentences from chunks
 * 2. Summarize long chunks before passing to main LLM
 * 3. Remove redundant information
 */
export class ContextCompressor {
  /**
   * Extract only the most relevant sentences from chunks based on the query.
   * Uses a smaller, faster model to reduce costs.
   */
  public async extractRelevantSentences(
    query: string,
    chunks: Array<{ id: string; content: string; [key: string]: any }>,
    maxSentencesPerChunk: number = 3
  ): Promise<Array<{ id: string; content: string; [key: string]: any }>> {
    const compressed = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          // Use a smaller, faster model for extraction
          const response = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant', // Faster, cheaper model
            messages: [
              {
                role: 'system',
                content: `Extract the ${maxSentencesPerChunk} most relevant sentences from the text that help answer the query. Return ONLY the extracted sentences, nothing else.`,
              },
              {
                role: 'user',
                content: `Query: ${query}\n\nText: ${chunk.content}`,
              },
            ],
            max_tokens: 500,
            temperature: 0,
          });

          const extractedContent = response.choices[0]?.message?.content || chunk.content;

          return {
            ...chunk,
            content: extractedContent,
            originalLength: chunk.content.length,
            compressedLength: extractedContent.length,
          };
        } catch (error) {
          logger.warn({ chunkId: chunk.id, error }, 'Failed to extract sentences, using original');
          return chunk;
        }
      })
    );

    const totalOriginal = compressed.reduce((sum, c) => sum + (c.originalLength || 0), 0);
    const totalCompressed = compressed.reduce((sum, c) => sum + (c.compressedLength || 0), 0);
    const compressionRatio = totalOriginal > 0 ? (1 - totalCompressed / totalOriginal) * 100 : 0;

    logger.info(
      {
        originalChars: totalOriginal,
        compressedChars: totalCompressed,
        compressionRatio: compressionRatio.toFixed(1) + '%',
      },
      'Context compressed'
    );

    return compressed;
  }

  /**
   * Filter chunks to only include those relevant to the query.
   * Uses a fast binary classification approach.
   */
  public async filterRelevantChunks(
    query: string,
    chunks: Array<{ id: string; content: string; [key: string]: any }>
  ): Promise<Array<{ id: string; content: string; [key: string]: any }>> {
    const filtered = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          // Quick relevance check using smaller model
          const response = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: 'Determine if the text is relevant to answering the query. Reply with only "YES" or "NO".',
              },
              {
                role: 'user',
                content: `Query: ${query}\n\nText: ${chunk.content.substring(0, 500)}`,
              },
            ],
            max_tokens: 10,
            temperature: 0,
          });

          const decision = response.choices[0]?.message?.content?.trim().toUpperCase();
          return decision === 'YES' ? chunk : null;
        } catch (error) {
          logger.warn({ chunkId: chunk.id, error }, 'Failed to filter chunk, keeping it');
          return chunk;
        }
      })
    );

    const relevantChunks = filtered.filter((c) => c !== null) as typeof chunks;
    
    logger.info(
      {
        originalCount: chunks.length,
        filteredCount: relevantChunks.length,
        removedCount: chunks.length - relevantChunks.length,
      },
      'Chunks filtered'
    );

    return relevantChunks;
  }

  /**
   * Summarize chunks using a smaller model before passing to main LLM.
   * Useful for very long chunks.
   */
  public async summarizeChunks(
    chunks: Array<{ id: string; content: string; [key: string]: any }>,
    maxLength: number = 200
  ): Promise<Array<{ id: string; content: string; [key: string]: any }>> {
    const summarized = await Promise.all(
      chunks.map(async (chunk) => {
        // Only summarize if chunk is longer than maxLength
        if (chunk.content.length <= maxLength) {
          return chunk;
        }

        try {
          const response = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: `Summarize the text concisely in ${maxLength} characters or less, preserving key facts and details.`,
              },
              {
                role: 'user',
                content: chunk.content,
              },
            ],
            max_tokens: 150,
            temperature: 0,
          });

          const summary = response.choices[0]?.message?.content || chunk.content;

          return {
            ...chunk,
            content: summary,
            originalContent: chunk.content,
            isSummarized: true,
          };
        } catch (error) {
          logger.warn({ chunkId: chunk.id, error }, 'Failed to summarize chunk, using original');
          return chunk;
        }
      })
    );

    return summarized;
  }

  /**
   * Smart compression: Combines multiple strategies based on context size.
   * - If chunks are already small: no compression
   * - If moderate size: extract relevant sentences
   * - If large size: filter + extract + summarize
   */
  public async smartCompress(
    query: string,
    chunks: Array<{ id: string; content: string; [key: string]: any }>,
    targetTokenBudget: number = 4000
  ): Promise<Array<{ id: string; content: string; [key: string]: any }>> {
    // Estimate tokens (rough: 1 token ≈ 4 characters)
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);
    const totalTokens = chunks.reduce((sum, c) => sum + estimateTokens(c.content), 0);

    logger.info({ totalTokens, targetTokenBudget, chunkCount: chunks.length }, 'Starting smart compression');

    // If already under budget, return as-is
    if (totalTokens <= targetTokenBudget) {
      logger.info('Context already within budget, no compression needed');
      return chunks;
    }

    let compressed = chunks;

    // Strategy 1: Limit number of chunks (already done by reranking, but enforce here)
    if (compressed.length > 5) {
      compressed = compressed.slice(0, 5);
      logger.info({ newCount: compressed.length }, 'Limited to top 5 chunks');
    }

    // Strategy 2: Extract relevant sentences
    compressed = await this.extractRelevantSentences(query, compressed, 3);

    // Check if we're under budget now
    const tokensAfterExtraction = compressed.reduce((sum, c) => sum + estimateTokens(c.content), 0);
    if (tokensAfterExtraction <= targetTokenBudget) {
      logger.info({ tokensAfterExtraction }, 'Context within budget after extraction');
      return compressed;
    }

    // Strategy 3: Summarize remaining long chunks
    compressed = await this.summarizeChunks(compressed, 200);

    const finalTokens = compressed.reduce((sum, c) => sum + estimateTokens(c.content), 0);
    logger.info({ finalTokens, compressionRatio: ((1 - finalTokens / totalTokens) * 100).toFixed(1) + '%' }, 'Smart compression complete');

    return compressed;
  }
}
