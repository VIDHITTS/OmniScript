import { z } from 'zod';
import { buildTool } from '../tool.types';
import { prisma } from '../../config/db';

/**
 * MetadataFilterTool — Filter chunks by document metadata.
 *
 * Useful when the user specifies a document type, date range, or
 * specific document by name. Narrows the search space before
 * applying vector/keyword search.
 */
export const MetadataFilterTool = buildTool({
  name: 'metadata_filter',
  description: 'Filter documents by metadata (type, title, date). Use this before other search tools to narrow results to specific documents or date ranges.',
  inputSchema: z.object({
    documentTitle: z.string().optional().describe('Partial title match (case-insensitive)'),
    sourceType: z.enum(['PDF', 'MARKDOWN', 'TEXT', 'YOUTUBE', 'WEB_URL', 'AUDIO', 'IMAGE', 'CODE', 'CSV']).optional(),
    createdAfter: z.string().datetime().optional().describe('ISO date — only include documents created after this date'),
    createdBefore: z.string().datetime().optional().describe('ISO date — only include documents created before this date'),
  }),
  async execute(input, ctx) {
    const where: Record<string, unknown> = {
      workspaceId: ctx.workspaceId,
      status: 'INDEXED',
    };

    if (input.documentTitle) {
      where.title = { contains: input.documentTitle, mode: 'insensitive' };
    }
    if (input.sourceType) {
      where.sourceType = input.sourceType;
    }
    if (input.createdAfter || input.createdBefore) {
      const dateFilter: Record<string, Date> = {};
      if (input.createdAfter) dateFilter.gte = new Date(input.createdAfter);
      if (input.createdBefore) dateFilter.lte = new Date(input.createdBefore);
      where.createdAt = dateFilter;
    }

    const documents = await prisma.document.findMany({
      where,
      select: {
        id: true,
        title: true,
        sourceType: true,
        mimeType: true,
        totalChunks: true,
        tokenCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      data: {
        documents,
        documentIds: documents.map((d) => d.id),
      },
      confidence: documents.length > 0 ? 0.9 : 0.2,
      metadata: { filterApplied: input, resultCount: documents.length },
    };
  },
});
