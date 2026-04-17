import { z } from 'zod';
import { buildTool } from '../tool.types';
import { prisma } from '../../config/db';
import { Embedder } from '../../lib/embedder';
import { RetrievedChunk } from '../../types';

const embedder = new Embedder();

/**
 * VectorSearchTool — Semantic similarity search using stored chunk embeddings.
 *
 * Embeds the query, then computes cosine similarity against all chunks
 * in the current workspace. Returns highest-scoring chunks.
 */
export const VectorSearchTool = buildTool({
  name: 'vector_search',
  description: 'Search documents using semantic similarity (embedding cosine distance). Best for conceptual, thematic, or natural language queries where meaning matters more than exact words.',
  inputSchema: z.object({
    query: z.string().describe('The natural language question or concept to search for'),
    limit: z.number().int().min(1).max(20).optional().default(5).describe('Maximum number of results to return'),
  }),
  async execute({ query, limit }, ctx) {
    // 1. Embed the query
    const queryEmbedding = await embedder.embed(query);

    // 2. Fetch all indexed documents in the workspace
    const documents = await prisma.document.findMany({
      where: { workspaceId: ctx.workspaceId, status: 'INDEXED' },
      select: { id: true, title: true },
    });

    if (documents.length === 0) {
      return { data: [], confidence: 0, metadata: { message: 'No indexed documents in workspace' } };
    }

    const docIds = documents.map((d) => d.id);
    const titleMap = new Map(documents.map((d) => [d.id, d.title]));

    // 3. Fetch chunks with embeddings
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

    // 4. Score by cosine similarity
    const scored: RetrievedChunk[] = [];
    for (const chunk of chunks) {
      if (!chunk.embedding) continue;
      let chunkEmb: number[];
      try {
        chunkEmb = typeof chunk.embedding === 'string'
          ? JSON.parse(chunk.embedding as string)
          : (chunk.embedding as number[]);
      } catch { continue; }

      const sim = cosineSim(queryEmbedding, chunkEmb);
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
        score: sim,
      });
    }

    const results = scored.sort((a, b) => b.score - a.score).slice(0, limit);

    return {
      data: results,
      confidence: results.length > 0 ? Math.min(1, results[0].score * 2) : 0,
      metadata: { strategy: 'vector', candidateCount: chunks.length },
    };
  },
});

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; nA += a[i] ** 2; nB += b[i] ** 2;
  }
  const d = Math.sqrt(nA) * Math.sqrt(nB);
  return d === 0 ? 0 : dot / d;
}
