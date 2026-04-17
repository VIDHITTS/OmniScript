import { z } from 'zod';
import { buildTool } from '../tool.types';
import { prisma } from '../../config/db';
import { groq } from '../../lib/groq';

/**
 * SummarizeTool — Generate summaries of documents or sections.
 *
 * Uses the stored chunks to build context and asks the LLM to
 * produce a concise summary. Supports full-document and section-level summaries.
 */
export const SummarizeTool = buildTool({
  name: 'summarize',
  description: 'Summarize an entire document or a specific section. Use when the user asks for an overview, summary, abstract, or key points.',
  inputSchema: z.object({
    documentId: z.string().uuid().describe('Document to summarize'),
    sectionHeading: z.string().optional().describe('Specific section to summarize. If omitted, summarizes the entire document.'),
    maxLength: z.enum(['brief', 'medium', 'detailed']).optional().default('medium'),
  }),
  async execute({ documentId, sectionHeading, maxLength }, _ctx) {
    const where: Record<string, unknown> = { documentId };
    if (sectionHeading) {
      where.sectionHeading = sectionHeading;
    }

    const chunks = await prisma.documentChunk.findMany({
      where,
      orderBy: { chunkIndex: 'asc' },
      select: { content: true, sectionHeading: true, chunkIndex: true },
    });

    if (chunks.length === 0) {
      return {
        data: {
          summary: 'No content found for the specified document/section.',
          documentTitle: '',
          sectionHeading: undefined,
          chunksProcessed: 0,
        },
        confidence: 0,
      };
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { title: true },
    });

    // Build content for summarization (limit to ~4000 tokens)
    let contentText = '';
    for (const chunk of chunks) {
      if (contentText.length > 16000) break; // ~4000 tokens
      contentText += `[${chunk.sectionHeading || 'Section'}]\n${chunk.content}\n\n`;
    }

    const maxLengthKey = maxLength || 'medium';
    const maxTokenMap = { brief: 150, medium: 400, detailed: 800 };

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Summarize the following document content. Provide a ${maxLengthKey} summary that captures the key points, findings, and conclusions. Use clear, structured formatting.`,
        },
        {
          role: 'user',
          content: `Document: "${doc?.title || 'Untitled'}"\n${sectionHeading ? `Section: "${sectionHeading}"\n` : ''}\n\n${contentText}`,
        },
      ],
      max_tokens: maxTokenMap[maxLengthKey],
      temperature: 0.3,
    });

    const summary = response.choices[0]?.message?.content?.trim() || 'Unable to generate summary.';

    return {
      data: {
        summary,
        documentTitle: doc?.title || '',
        sectionHeading: sectionHeading || undefined,
        chunksProcessed: chunks.length,
      },
      confidence: 0.85,
    };
  },
});
