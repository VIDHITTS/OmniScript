import { z } from 'zod';
import { buildTool } from '../tool.types';

export const KeywordSearchTool = buildTool({
  name: 'keyword_search',
  description: 'Search documents using exact keyword matching (BM25 / tsvector). Best for finding exact names, IDs, acronyms, or specific terminology.',
  inputSchema: z.object({
    query: z.string().describe('The specific keywords, acronyms, or names to search for'),
    limit: z.number().int().min(1).max(20).optional().default(5).describe('Maximum number of results to return'),
  }),
  async execute({ query, limit }, ctx) {
    // TODO: Wire up actual tsvector search using Prisma
    return {
      data: {
        message: `Simulated Keyword Search for "${query}" in workspace ${ctx.workspaceId} with limit ${limit}`,
        results: []
      }
    };
  }
});
