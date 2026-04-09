import { z } from 'zod';
import { buildTool } from '../tool.types';
import { prisma } from '../../config/db';
import { groq } from '../../lib/groq';
import { Embedder } from '../../lib/embedder';
import { RetrievedChunk } from '../../types';

const embedder = new Embedder();

/**
 * HyDESearchTool — Hypothetical Document Embedding search.
 *
 * Instead of embedding the query directly, we:
 * 1. Ask the LLM to generate a hypothetical answer
 * 2. Embed that hypothetical answer
 * 3. Use the hypothetical embedding to find similar real chunks
 *
 * This bridges the "query-document mismatch" problem: queries are questions
 * but documents contain statements. The hypothetical answer has the same
 * linguistic form as the actual document chunks.
 */
export const HyDESearchTool = buildTool({
  name: 'hyde_search',
  description: 'Search using Hypothetical Document Embedding. Generates a hypothetical answer first, then finds real documents matching that answer. Best for complex or abstract questions where direct keyword/vector search might miss relevant content.',
  inputSchema: z.object({
    query: z.string().describe('The complex question to search for'),
    limit: z.number().int().min(1).max(15).optional().default(5),
  }),
  async execute({ query, limit }, ctx) {
    // Step 1: Generate hypothetical answer
    const hypoResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Generate a detailed, factual paragraph that would answer the following question. Write as if this paragraph exists in a textbook or document. Do not say "I" or "the question". Just provide the content directly.',
        },
        { role: 'user', content: query },
      ],
      max_tokens: 300,
      temperature: 0.5,
    });

    const hypotheticalAnswer = hypoResponse.choices[0]?.message?.content?.trim() || '';
    if (!hypotheticalAnswer) {
      return { data: [], confidence: 0, metadata: { error: 'Failed to generate hypothetical answer' } };
    }

    // Step 2: Embed the hypothetical answer
    const hypoEmbedding = await embedder.embed(hypotheticalAnswer);

    // Step 3: Find similar chunks
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
        embedding: true,
      },
      take: 200,
    });

    const scored: RetrievedChunk[] = [];
    for (const chunk of chunks) {
      if (!chunk.embedding) continue;
      let chunkEmb: number[];
      try {
        chunkEmb = typeof chunk.embedding === 'string'
          ? JSON.parse(chunk.embedding as string) : chunk.embedding as number[];
      } catch { continue; }

      const sim = cosineSim(hypoEmbedding, chunkEmb);
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
      metadata: { strategy: 'hyde', hypotheticalAnswer: hypotheticalAnswer.slice(0, 100) },
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
