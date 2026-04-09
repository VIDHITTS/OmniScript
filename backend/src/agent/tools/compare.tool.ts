import { z } from 'zod';
import { buildTool } from '../tool.types';
import { prisma } from '../../config/db';
import { groq } from '../../lib/groq';

/**
 * CompareTool — Side-by-side comparison of two documents.
 *
 * Fetches chunks from both documents, feeds them to the LLM,
 * and generates a structured comparison highlighting similarities
 * and differences.
 */
export const CompareTool = buildTool({
  name: 'compare_documents',
  description: 'Compare two documents side by side. Highlights similarities, differences, and key distinctions. Use when the user asks to compare, contrast, or differentiate between documents.',
  inputSchema: z.object({
    documentId1: z.string().uuid().describe('First document ID'),
    documentId2: z.string().uuid().describe('Second document ID'),
    focusArea: z.string().optional().describe('Specific aspect to focus the comparison on'),
  }),
  async execute({ documentId1, documentId2, focusArea }, _ctx) {
    // Fetch both documents with their top chunks
    const [doc1, doc2] = await Promise.all([
      prisma.document.findUnique({
        where: { id: documentId1 },
        select: { title: true },
      }),
      prisma.document.findUnique({
        where: { id: documentId2 },
        select: { title: true },
      }),
    ]);

    if (!doc1 || !doc2) {
      return {
        data: { comparison: 'One or both documents not found.' },
        confidence: 0,
      };
    }

    // Get representative chunks from each (first ~3000 chars each)
    const getChunks = async (docId: string) => {
      const chunks = await prisma.documentChunk.findMany({
        where: { documentId: docId },
        orderBy: { chunkIndex: 'asc' },
        select: { content: true, sectionHeading: true },
        take: 15,
      });

      let text = '';
      for (const c of chunks) {
        if (text.length > 12000) break;
        text += `[${c.sectionHeading}] ${c.content}\n\n`;
      }
      return text;
    };

    const [content1, content2] = await Promise.all([
      getChunks(documentId1),
      getChunks(documentId2),
    ]);

    const focusPrompt = focusArea ? `\nFocus the comparison on: "${focusArea}"` : '';

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Compare the following two documents. Provide a structured comparison with:
1. Key Similarities
2. Key Differences
3. Unique to Document A
4. Unique to Document B
5. Overall Assessment${focusPrompt}`,
        },
        {
          role: 'user',
          content: `DOCUMENT A: "${doc1.title}"\n${content1}\n\n---\n\nDOCUMENT B: "${doc2.title}"\n${content2}`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.4,
    });

    const comparison = response.choices[0]?.message?.content?.trim() || 'Unable to generate comparison.';

    return {
      data: {
        comparison,
        documentA: doc1.title,
        documentB: doc2.title,
        focusArea: focusArea || null,
      },
      confidence: 0.8,
    };
  },
});
