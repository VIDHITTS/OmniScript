import { z } from 'zod';
import { buildTool } from '../tool.types';
import { prisma } from '../../config/db';
import { RetrievedChunk } from '../../types';

/**
 * KeywordSearchTool — BM25-style full-text keyword search.
 *
 * Scores chunks by term frequency, document length normalization, and
 * exact phrase bonus. Complements vector search in the hybrid pipeline.
 */
export const KeywordSearchTool = buildTool({
  name: 'keyword_search',
  description: 'Search documents using exact keyword matching (BM25-style TF-IDF). Best for finding specific names, IDs, acronyms, technical terms, or quoted phrases where wording must match exactly.',
  inputSchema: z.object({
    query: z.string().describe('The specific keywords, acronyms, or names to search for'),
    limit: z.number().int().min(1).max(20).optional().default(5).describe('Maximum number of results to return'),
  }),
  async execute({ query, limit }, ctx) {
    // Fetch all indexed documents in the workspace
    const documents = await prisma.document.findMany({
      where: { workspaceId: ctx.workspaceId, status: 'INDEXED' },
      select: { id: true, title: true },
    });

    if (documents.length === 0) {
      return { data: [], confidence: 0, metadata: { message: 'No indexed documents in workspace' } };
    }

    const docIds = documents.map((d) => d.id);
    const titleMap = new Map(documents.map((d) => [d.id, d.title]));

    const queryTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (queryTerms.length === 0) {
      return { data: [], confidence: 0, metadata: { message: 'Query too short for keyword search' } };
    }

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
      },
      take: 200,
    });

    const queryLower = query.toLowerCase();
    const avgLen = chunks.reduce((s, c) => s + c.content.length, 0) / (chunks.length || 1);

    // BM25-inspired scoring
    const k1 = 1.2, b = 0.75;
    const scored: RetrievedChunk[] = [];

    for (const chunk of chunks) {
      const contentLower = (chunk.content + ' ' + (chunk.contextualizedContent || '')).toLowerCase();
      const docLen = chunk.content.length;
      let score = 0;

      for (const term of queryTerms) {
        const tf = (contentLower.match(new RegExp(term, 'g')) || []).length;
        if (tf > 0) {
          const normTf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgLen)));
          score += normTf;
        }
      }

      // Exact phrase bonus
      if (contentLower.includes(queryLower)) score += 3;

      if (score > 0) {
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
          score,
        });
      }
    }

    const results = scored.sort((a, b) => b.score - a.score).slice(0, limit);

    return {
      data: results,
      confidence: results.length > 0 ? Math.min(1, results[0].score / 5) : 0,
      metadata: { strategy: 'keyword', candidateCount: chunks.length, queryTerms },
    };
  },
});
