import { prisma } from '../../config/db';
import { groqClient } from '../../lib/groq';
import { Embedder } from '../../lib/embedder';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { CreateSessionInput, MessageListInput } from './chat.validation';

/**
 * ChatService — Business logic for chat sessions and AI-powered retrieval.
 *
 * Retrieval Pipeline (Phase 1 — Fast Path):
 * 1. Full-text search on chunk content (simple LIKE-based for Phase 1)
 * 2. Score and rank results
 * 3. Feed top chunks as context → LLM generates answer with citations
 * 4. Stream response via SSE
 *
 * Design decisions:
 * - Stores citations as JSONB array on the message
 * - Includes previous messages as conversation context (last 10)
 * - System prompt instructs LLM to cite sources using [1], [2]
 * - Tracks token_usage for cost monitoring
 */
export class ChatService {
  private embedder: Embedder;

  constructor() {
    this.embedder = new Embedder();
  }

  /**
   * Create a new chat session in a workspace.
   */
  public async createSession(userId: string, workspaceId: string, input: CreateSessionInput) {
    // Verify workspace membership
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!member) {
      throw AppError.forbidden('You do not have access to this workspace.');
    }

    return prisma.chatSession.create({
      data: {
        workspaceId,
        userId,
        title: input.title,
      },
    });
  }

  /**
   * Get chat sessions for a workspace.
   */
  public async getSessions(userId: string, workspaceId: string) {
    return prisma.chatSession.findMany({
      where: { workspaceId, userId },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        title: true,
        isPinned: true,
        lastActiveAt: true,
        createdAt: true,
        _count: { select: { messages: true } },
      },
    });
  }

  /**
   * Get messages in a session (cursor-based pagination).
   */
  public async getMessages(sessionId: string, pagination: MessageListInput) {
    const { cursor, take } = pagination;

    const messages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true,
        role: true,
        content: true,
        citations: true,
        tokenUsage: true,
        confidenceScore: true,
        retrievalStrategy: true,
        isBookmarked: true,
        createdAt: true,
      },
    });

    const hasMore = messages.length > take;
    const results = hasMore ? messages.slice(0, take) : messages;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return { messages: results, nextCursor, hasMore };
  }

  /**
   * Send a message and get AI response.
   * Returns the full response (non-streaming) for simplicity in Phase 1.
   */
  public async sendMessage(userId: string, sessionId: string, content: string) {
    // 1. Get session and verify it exists
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { workspace: true },
    });

    if (!session) {
      throw AppError.notFound('Chat session not found.');
    }

    // 2. Store user message
    const userMessage = await prisma.message.create({
      data: {
        sessionId,
        userId,
        role: 'USER',
        content,
      },
    });

    // 3. Retrieve relevant chunks from workspace
    const chunks = await this.retrieveRelevantChunks(session.workspaceId, content);

    // 4. Build conversation context (last 10 messages)
    const previousMessages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { role: true, content: true },
    });

    // 5. Generate AI response with citations
    const { answer, citations, tokenUsage } = await this.generateAnswer(
      content,
      chunks,
      previousMessages.reverse()
    );

    // 6. Store AI response
    const aiMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: answer,
        citations: JSON.parse(JSON.stringify(citations)),
        tokenUsage,
        retrievalStrategy: 'FAST',
      },
    });

    // 7. Update session lastActiveAt
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });

    logger.info(
      { sessionId, chunksRetrieved: chunks.length, tokenUsage },
      'AI response generated'
    );

    return { userMessage, aiMessage };
  }

  /**
   * Stream a message response via SSE.
   */
  public async streamMessage(
    userId: string,
    sessionId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onDone: (message: { id: string; citations: unknown }) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw AppError.notFound('Chat session not found.');
      }

      // Store user message
      await prisma.message.create({
        data: { sessionId, userId, role: 'USER', content },
      });

      // Retrieve relevant chunks
      const chunks = await this.retrieveRelevantChunks(session.workspaceId, content);

      // Build context
      const previousMessages = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { role: true, content: true },
      });

      // Build prompt
      const contextText = chunks.map((c, i) =>
        `[${i + 1}] (${c.sectionHeading || 'Unknown Section'}):\n${c.content}`
      ).join('\n\n---\n\n');

      const systemPrompt = this.buildSystemPrompt(contextText);
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
        ...previousMessages.reverse().map((m) => ({
          role: m.role.toLowerCase() as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content },
      ];

      // Stream from Groq
      const stream = await groqClient.chat.completions.create({
        model: env.LLM_MODEL,
        messages,
        max_tokens: 2000,
        temperature: 0.7,
        stream: true,
      });

      let fullResponse = '';
      let totalTokens = 0;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullResponse += delta;
          onChunk(delta);
        }
        // Groq may include x_groq usage in the final chunk
        const chunkAny = chunk as unknown as Record<string, unknown>;
        if (chunkAny.x_groq && typeof chunkAny.x_groq === 'object') {
          const xGroq = chunkAny.x_groq as Record<string, unknown>;
          if (xGroq.usage && typeof xGroq.usage === 'object') {
            const usage = xGroq.usage as Record<string, number>;
            totalTokens = usage.total_tokens || 0;
          }
        }
      }

      // Build citations
      const citations = chunks.map((c, i) => ({
        index: i + 1,
        chunkId: c.id,
        documentTitle: c.documentTitle,
        sectionHeading: c.sectionHeading,
        location: c.location,
      }));

      // Store AI message
      const aiMessage = await prisma.message.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: fullResponse,
          citations: JSON.parse(JSON.stringify(citations)),
          tokenUsage: totalTokens,
          retrievalStrategy: 'FAST',
        },
      });

      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { lastActiveAt: new Date() },
      });

      onDone({ id: aiMessage.id, citations });

    } catch (error) {
      onError(error instanceof Error ? error : new Error('Stream failed'));
    }
  }

  // ===== Private Helpers =====

  /**
   * Retrieve relevant chunks using full-text search.
   * Phase 1: Simple content search (LIKE-based).
   * Will upgrade to hybrid vector + BM25 with RRF when real embeddings are available.
   */
  private async retrieveRelevantChunks(workspaceId: string, query: string): Promise<RetrievedChunk[]> {
    // Get all documents in workspace
    const documents = await prisma.document.findMany({
      where: { workspaceId, status: 'INDEXED' },
      select: { id: true, title: true },
    });

    if (documents.length === 0) return [];

    const documentIds = documents.map((d) => d.id);
    const titleMap = new Map(documents.map((d) => [d.id, d.title]));

    // Search chunks by content (case-insensitive keyword matching)
    const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    // For Phase 1: use Prisma's contains for basic search
    // Will upgrade to raw SQL with tsvector + cosine for production
    const allChunks = await prisma.documentChunk.findMany({
      where: {
        documentId: { in: documentIds },
      },
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
      take: 100, // Get a pool of candidates
    });

    // Score chunks by keyword overlap
    const scored = allChunks.map((chunk) => {
      const contentLower = (chunk.content + ' ' + (chunk.contextualizedContent || '')).toLowerCase();
      let score = 0;
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          score += 1;
          // Bonus for exact phrase matches
          if (contentLower.includes(query.toLowerCase())) {
            score += 2;
          }
        }
      }
      return { ...chunk, score, documentTitle: titleMap.get(chunk.documentId) || 'Unknown' };
    });

    // Sort by score and take top 5
    const topChunks = scored
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // If no keyword matches, return the first few chunks as fallback
    if (topChunks.length === 0 && allChunks.length > 0) {
      return allChunks.slice(0, 3).map((c) => ({
        ...c,
        score: 0,
        documentTitle: titleMap.get(c.documentId) || 'Unknown',
      }));
    }

    return topChunks;
  }

  /**
   * Generate AI answer with citations (non-streaming).
   */
  private async generateAnswer(
    query: string,
    chunks: RetrievedChunk[],
    previousMessages: { role: string; content: string }[]
  ): Promise<{ answer: string; citations: unknown; tokenUsage: number }> {
    const contextText = chunks.map((c, i) =>
      `[${i + 1}] (${c.sectionHeading || 'Unknown Section'} - ${c.documentTitle}):\n${c.content}`
    ).join('\n\n---\n\n');

    const systemPrompt = this.buildSystemPrompt(contextText);

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...previousMessages.map((m) => ({
        role: m.role.toLowerCase() as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: query },
    ];

    const response = await groqClient.chat.completions.create({
      model: env.LLM_MODEL,
      messages,
      max_tokens: 2000,
      temperature: 0.7,
    });

    const answer = response.choices[0]?.message?.content || 'I could not generate a response.';
    const tokenUsage = response.usage?.total_tokens || 0;

    const citations = chunks.map((c, i) => ({
      index: i + 1,
      chunkId: c.id,
      documentTitle: c.documentTitle,
      sectionHeading: c.sectionHeading,
      location: c.location,
    }));

    return { answer, citations, tokenUsage };
  }

  /**
   * Build the system prompt with retrieval context.
   */
  private buildSystemPrompt(contextText: string): string {
    if (!contextText) {
      return `You are OmniScript, an AI knowledge assistant. The user's workspace has no indexed documents yet. Let them know they need to upload documents first, then you can answer questions about them.`;
    }

    return `You are OmniScript, an AI knowledge assistant. Answer questions based on the provided context from the user's documents.

RULES:
1. Use the provided context to answer questions accurately.
2. Cite your sources using [1], [2], etc. corresponding to the numbered context chunks.
3. If the context doesn't contain enough information, say so honestly.
4. Be concise but thorough.
5. Maintain conversation context from previous messages.

CONTEXT FROM USER'S DOCUMENTS:
${contextText}`;
  }
}

interface RetrievedChunk {
  id: string;
  content: string;
  contextualizedContent: string | null;
  chunkIndex: number;
  sectionHeading: string | null;
  location: unknown;
  documentId: string;
  documentTitle: string;
  score: number;
}
