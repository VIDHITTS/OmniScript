import { groq } from './groq';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Embedder — Generates vector embeddings for text.
 *
 * Design decision: Since Groq doesn't support embeddings natively,
 * we use a simple approach: call the LLM to generate a compact representation,
 * then use a consistent hashing approach for vector similarity.
 *
 * For Phase 1, we store embeddings as JSON arrays. When upgrading to
 * production, switch to OpenAI's text-embedding-3-small for real vectors.
 *
 * Temporary approach: Use a simple TF-IDF-like numeric representation
 * so the pipeline works end-to-end. The retrieval will rely more on
 * full-text search (BM25) which works without embeddings.
 */
export class Embedder {
  private readonly dimensions = 384; // Smaller dim for mock embeddings

  /**
   * Generate embeddings for a batch of texts.
   * Returns an array of number arrays (vectors).
   */
  public async embedBatch(texts: string[]): Promise<number[][]> {
    // For Phase 1 without OpenAI, generate deterministic pseudo-embeddings
    // based on text content. This allows the pipeline to work end-to-end.
    // Real embeddings will be added when OpenAI key is available.
    return texts.map((text) => this.generatePseudoEmbedding(text));
  }

  /**
   * Generate embedding for a single text.
   */
  public async embed(text: string): Promise<number[]> {
    return this.generatePseudoEmbedding(text);
  }

  /**
   * Generate a deterministic pseudo-embedding from text.
   * Uses a simple hash-based approach to create a consistent vector.
   * 
   * This is NOT a real embedding — it's a placeholder so the pipeline works.
   * Replace with OpenAI text-embedding-3-small for production quality.
   */
  private generatePseudoEmbedding(text: string): number[] {
    const vector = new Array(this.dimensions).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = normalized.split(/\s+/).filter(Boolean);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const idx = (word.charCodeAt(j) * 31 + i * 7 + j * 13) % this.dimensions;
        vector[idx] += 1.0 / Math.sqrt(words.length);
      }
    }

    // L2 normalize
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }
}

/**
 * Contextual Enrichment — Prepend context to chunks before embedding.
 *
 * Per roadmap: "Before embedding each chunk, prepend generated context:
 * document title, section heading, relevant surrounding summary"
 */
export async function enrichChunkContext(
  chunk: string,
  documentTitle: string,
  sectionHeading: string
): Promise<string> {
  try {
    const response = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Given a document title, section heading, and text chunk, provide a 1-2 sentence context that situates this chunk within the broader document. Be concise.',
        },
        {
          role: 'user',
          content: `Document: "${documentTitle}"\nSection: "${sectionHeading}"\n\nChunk:\n${chunk}\n\nProvide 1-2 sentences of context:`,
        },
      ],
      max_tokens: 100,
      temperature: 0.3,
    });

    const context = response.choices[0]?.message?.content?.trim() || '';
    return context ? `${context}\n\n${chunk}` : chunk;
  } catch (error) {
    logger.warn({ error }, 'Failed to generate contextual enrichment, using original chunk');
    return chunk;
  }
}
