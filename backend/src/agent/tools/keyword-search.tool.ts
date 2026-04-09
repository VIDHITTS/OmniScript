import { z } from 'zod';
import { buildTool } from '../tool.types';
import { prisma } from '../../config/db';
import { RetrievedChunk } from '../../types';

/**
 * KeywordSearchTool — Full-text search with BM25-style scoring.
 *
 * Best for: exact names, acronyms, IDs, specific terminology.
 * Worst for: conceptual or paraphrased queries.
 *
 * Phase 1: Application-level BM25 scoring.
 * Phase production: Use PostgreSQL's ts_rank_cd with tsvector columns.
 */
export const KeywordSearchTool = buildTool({
  name: 'keyword_search',
  description: 'Search documents using exact keyword matching (BM25 scoring). Best for finding exact names, IDs, acronyms, specific terms, or quoted phrases.',
  inputSchema: z.object({
    query: z.string().describe('The keywords, terms, or phrases to search for'),
    limit: z.number().int().min(1).max(20).optional().default(10),
  }),
  async execute({ query, limit }, ctx) {
    const queryTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    if (queryTerms.length === 0) {
      return { data: [], confidence: 0 };
    }

    // Get indexed documents
    const documents = await prisma.document.findMany({
      where: { workspaceId: ctx.workspaceId, status: 'INDEXED' },
      select: { id: true, title: true },
    });

    if (documents.length === 0) return { data: [], confidence: 0 };

    const docIds = documents.map((d) => d.id);
    const titleMap = new Map(documents.map((d) => [d.id, d.title]));

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
    const avgDocLength = chunks.reduce((s, c) => s + c.content.length, 0) / (chunks.length || 1);

    // BM25 scoring
    const k1 = 1.2;
    const b = 0.75;

    const scored: RetrievedChunk[] = chunks.map((chunk) => {
      const contentLower = (chunk.content + ' ' + (chunk.contextualizedContent || '')).toLowerCase();
      const docLength = chunk.content.length;
      let score = 0;

      for (const term of queryTerms) {
        const tf = (contentLower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (tf > 0) {
          const normalizedTf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)));
          score += normalizedTf;
        }
      }

      // Exact phrase bonus
      if (contentLower.includes(queryLower)) {
        score += 3;
      }

      return {
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
      };
    });

    const results = scored
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const maxScore = results.length > 0 ? results[0].score : 0;

    return {
      data: results,
      confidence: Math.min(1, maxScore / 5),
      metadata: { strategy: 'keyword', matchCount: results.length },
    };
  },
});
