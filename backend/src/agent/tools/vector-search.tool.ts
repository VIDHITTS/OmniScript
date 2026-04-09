import { z } from 'zod';
import { buildTool } from '../tool.types';
import { prisma } from '../../config/db';
import { Embedder } from '../../lib/embedder';
import { RetrievedChunk } from '../../types';

const embedder = new Embedder();

/**
 * VectorSearchTool — Semantic search using embedding cosine similarity.
 *
 * Best for: conceptual queries, thematic questions, natural language.
 * Worst for: exact names, acronyms, specific IDs.
 *
 * Phase 1 uses pseudo-embeddings and app-level similarity.
 * Phase production: switch to pgvector <=> operator for GPU-accelerated search.
 */
export const VectorSearchTool = buildTool({
  name: 'vector_search',
  description: 'Search documents using semantic similarity. Best for conceptual, thematic, or natural language queries where exact keyword matching might miss relevant results.',
  inputSchema: z.object({
    query: z.string().describe('The natural language question or concept to search for'),
    limit: z.number().int().min(1).max(20).optional().default(10),
  }),
  async execute({ query, limit }, ctx) {
    // Generate query embedding
    const queryEmbedding = await embedder.embed(query);

    // Get indexed documents in workspace
    const documents = await prisma.document.findMany({
      where: { workspaceId: ctx.workspaceId, status: 'INDEXED' },
      select: { id: true, title: true },
    });

    if (documents.length === 0) {
      return { data: [], confidence: 0 };
    }

    const docIds = documents.map((d) => d.id);
    const titleMap = new Map(documents.map((d) => [d.id, d.title]));

    // Fetch chunks with embeddings
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: { in: docIds } },
      select: {
        id: true,
        content: true,
        contextualizedContent: true,
        chunkIndex: true,
        sectionHeading: true,
        location: true,
        documentId: true,
        tokenCount: true,
        embedding: true,
      },
      take: 200,
    });

    // Compute cosine similarity
    const scored: RetrievedChunk[] = [];
    for (const chunk of chunks) {
      if (!chunk.embedding) continue;

      let chunkEmbedding: number[];
      try {
        chunkEmbedding = typeof chunk.embedding === 'string'
          ? JSON.parse(chunk.embedding as string)
          : chunk.embedding as number[];
      } catch { continue; }

      const similarity = cosineSimilarity(queryEmbedding, chunkEmbedding);
      
      scored.push({
        id: chunk.id,
        content: chunk.content,
        contextualizedContent: chunk.contextualizedContent,
        chunkIndex: chunk.chunkIndex,
        sectionHeading: chunk.sectionHeading,
        location: chunk.location,
        documentId: chunk.documentId,
        documentTitle: titleMap.get(chunk.documentId) || 'Unknown',
        tokenCount: chunk.tokenCount,
        score: similarity,
      });
    }

    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const avgScore = results.length > 0
      ? results.reduce((s, r) => s + r.score, 0) / results.length
      : 0;

    return {
      data: results,
      confidence: Math.min(1, avgScore * 2),
      metadata: { strategy: 'vector', candidatePool: chunks.length },
    };
  },
});

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
