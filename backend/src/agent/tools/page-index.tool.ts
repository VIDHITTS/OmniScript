import { z } from 'zod';
import { buildTool } from '../tool.types';
import { prisma } from '../../config/db';

/**
 * PageIndexNavigationTool — Navigate document structure via the PageIndex tree.
 *
 * Instead of searching blindly, the agent can examine a document's table of
 * contents (DOCUMENT_STRUCTURE) and navigate to specific sections.
 *
 * Use cases:
 * - "What's in chapter 3 of the textbook?"
 * - "Find the methodology section of the paper"
 * - User asks about a specific topic → agent browses document structure
 */
export const PageIndexNavigationTool = buildTool({
  name: 'page_index_navigation',
  description: 'Navigate a document\'s structure (table of contents, headings, sections). Use this when the user asks about a specific part of a document, or when you need to locate content by section rather than searching for keywords.',
  inputSchema: z.object({
    documentId: z.string().uuid().optional().describe('Specific document to navigate. If omitted, shows all documents in workspace.'),
    sectionTitle: z.string().optional().describe('Section title to search for (fuzzy match)'),
    level: z.number().int().min(1).max(6).optional().describe('Heading level to filter by'),
  }),
  async execute({ documentId, sectionTitle, level }, ctx) {
    // If no document specified, list all documents with their structure summary
    if (!documentId) {
      const documents = await prisma.document.findMany({
        where: { workspaceId: ctx.workspaceId, status: 'INDEXED' },
        select: {
          id: true,
          title: true,
          _count: { select: { structures: true } },
        },
      });

      return {
        data: {
          type: 'document_list',
          documents: documents.map((d) => ({
            id: d.id,
            title: d.title,
            structureNodeCount: d._count.structures,
          })),
        },
        confidence: 1,
        metadata: { totalDocuments: documents.length },
      };
    }

    // Query document structure
    const whereClause: Record<string, unknown> = { documentId };
    if (level) whereClause.level = level;

    const structures = await prisma.documentStructure.findMany({
      where: whereClause,
      orderBy: { sequence: 'asc' },
      select: {
        id: true,
        title: true,
        level: true,
        sequence: true,
        pageRange: true,
        parentId: true,
      },
    });

    // If sectionTitle provided, fuzzy-match
    let filtered = structures;
    if (sectionTitle) {
      const searchLower = sectionTitle.toLowerCase();
      filtered = structures.filter((s) =>
        s.title.toLowerCase().includes(searchLower),
      );
    }

    // If a specific section is found, also fetch the chunks in that section
    if (filtered.length > 0 && filtered.length <= 3) {
      const sectionTitles = filtered.map((s) => s.title);
      const chunks = await prisma.documentChunk.findMany({
        where: {
          documentId,
          sectionHeading: { in: sectionTitles },
        },
        select: {
          id: true,
          content: true,
          chunkIndex: true,
          sectionHeading: true,
        },
        orderBy: { chunkIndex: 'asc' },
      });

      return {
        data: {
          type: 'section_content',
          sections: filtered,
          chunks: chunks.map((c) => ({
            id: c.id,
            content: c.content.slice(0, 500),
            chunkIndex: c.chunkIndex,
            sectionHeading: c.sectionHeading,
          })),
        },
        confidence: 0.9,
      };
    }

    return {
      data: {
        type: 'structure_tree',
        structure: filtered,
      },
      confidence: filtered.length > 0 ? 0.8 : 0.3,
    };
  },
});
