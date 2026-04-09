import { prisma } from '../../config/db';
import { groq } from '../../lib/groq';
import { HybridRetriever } from '../../lib/retrieval';
import { CrossEncoderReranker } from '../../lib/reranker';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { RetrievedChunk, Citation } from '../../types';
import { CreateSessionInput, MessageListInput } from './chat.validation';

/**
 * ChatService — Business logic for chat sessions and AI-powered retrieval.
 *
 * Retrieval Pipeline:
 * 1. Hybrid Search (vector + BM25 + RRF) → top 50
 * 2. Cross-Encoder Reranking (Cohere) → top 5
 * 3. Feed top 5 chunks as context → LLM generates answer with citations
 * 4. Stream response via SSE
 *
 * Design decisions:
 * - Stores citations as JSONB array on the message
 * - Includes previous messages as conversation context (last 10)
 * - System prompt instructs LLM to cite sources using [1], [2]
 * - Tracks token_usage for cost monitoring
 */
export class ChatService {
  private retriever: HybridRetriever;
  private reranker: CrossEncoderReranker;

  constructor() {
    this.retriever = new HybridRetriever();
    this.reranker = new CrossEncoderReranker();
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
        suggestedFollowups: true,
        tokenUsage: true,
        confidenceScore: true,
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
   * Send a message and get AI response (non-streaming).
   * Uses hybrid retrieval + Cohere reranking.
   */
  public async sendMessage(userId: string, sessionId: string, content: string) {
    const session = await this.getSessionOrThrow(sessionId);

    // Store user message
    const userMessage = await prisma.message.create({
      data: { sessionId, userId, role: 'USER', content },
    });

    // Retrieve relevant chunks: hybrid search + reranking
    const rawChunks = await this.retriever.retrieve(session.workspaceId, content, 50);
    const chunks = await this.reranker.rerank(content, rawChunks, 5);

    // Build conversation context (last 10 messages)
    const previousMessages = await this.getPreviousMessages(sessionId);

    // Generate AI response with citations
    const { answer, citations, tokenUsage } = await this.generateAnswer(
      content, chunks, previousMessages,
    );

    // Store AI response
    const aiMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: answer,
        citations: JSON.parse(JSON.stringify(citations)),
        tokenUsage,
      },
    });

    // Update session lastActiveAt
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });

    logger.info(
      { sessionId, chunksRetrieved: rawChunks.length, chunksAfterRerank: chunks.length, tokenUsage },
      'AI response generated',
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
    onDone: (message: { id: string; citations: unknown; suggestedFollowups?: unknown }) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    try {
      const session = await this.getSessionOrThrow(sessionId);

      // Store user message
      await prisma.message.create({
        data: { sessionId, userId, role: 'USER', content },
      });

      // Retrieve relevant chunks: hybrid search + reranking
      const rawChunks = await this.retriever.retrieve(session.workspaceId, content, 50);
      const chunks = await this.reranker.rerank(content, rawChunks, 5);

      // Build context
      const previousMessages = await this.getPreviousMessages(sessionId);

      // Build prompt
      const contextText = this.buildContextText(chunks);
      const systemPrompt = this.buildSystemPrompt(contextText);
      const messages = this.buildLLMMessages(systemPrompt, previousMessages, content);

      // Stream from Groq
      const stream = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
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
      const citations = this.buildCitations(chunks);

      // Generate follow-up suggestions
      const suggestedFollowups = await this.generateFollowups(content, fullResponse);

      // Store AI message
      const aiMessage = await prisma.message.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: fullResponse,
          citations: JSON.parse(JSON.stringify(citations)),
          suggestedFollowups: suggestedFollowups ? JSON.parse(JSON.stringify(suggestedFollowups)) : undefined,
          tokenUsage: totalTokens,
        },
      });

      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { lastActiveAt: new Date() },
      });

      onDone({ id: aiMessage.id, citations, suggestedFollowups });
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Stream failed'));
    }
  }

  /**
   * Branch a conversation at a specific message.
   * Creates a new session copying messages up to the branch point.
   */
  public async branchSession(
    userId: string,
    sessionId: string,
    atMessageId: string,
  ) {
    const originalSession = await this.getSessionOrThrow(sessionId);

    // Get messages up to the branch point
    const branchMessage = await prisma.message.findUnique({
      where: { id: atMessageId },
      select: { createdAt: true },
    });

    if (!branchMessage) {
      throw AppError.notFound('Branch point message not found.');
    }

    const messagesToCopy = await prisma.message.findMany({
      where: {
        sessionId,
        createdAt: { lte: branchMessage.createdAt },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Create new session with reference to parent
    const newSession = await prisma.chatSession.create({
      data: {
        workspaceId: originalSession.workspaceId,
        userId,
        title: `${originalSession.title} (branch)`,
        parentSessionId: sessionId,
        branchPointMessageId: atMessageId,
      },
    });

    // Copy messages to new session
    if (messagesToCopy.length > 0) {
      await prisma.message.createMany({
        data: messagesToCopy.map((m) => ({
          sessionId: newSession.id,
          userId: m.userId,
          role: m.role,
          content: m.content,
          citations: m.citations ? JSON.parse(JSON.stringify(m.citations)) : undefined,
        })),
      });
    }

    return newSession;
  }

  // ===== Private Helpers =====

  private async getSessionOrThrow(sessionId: string) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { workspace: true },
    });

    if (!session) {
      throw AppError.notFound('Chat session not found.');
    }

    return session;
  }

  private async getPreviousMessages(sessionId: string) {
    return prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { role: true, content: true },
    });
  }

  private buildContextText(chunks: RetrievedChunk[]): string {
    return chunks.map((c, i) =>
      `[${i + 1}] (${c.sectionHeading || 'Unknown Section'} - ${c.documentTitle}):\n${c.content}`,
    ).join('\n\n---\n\n');
  }

  private buildCitations(chunks: RetrievedChunk[]): Citation[] {
    return chunks.map((c, i) => ({
      index: i + 1,
      chunkId: c.id,
      documentTitle: c.documentTitle,
      sectionHeading: c.sectionHeading,
      location: c.location,
      score: c.score,
    }));
  }

  private buildLLMMessages(
    systemPrompt: string,
    previousMessages: { role: string; content: string }[],
    userContent: string,
  ) {
    return [
      { role: 'system' as const, content: systemPrompt },
      ...previousMessages.reverse().map((m) => ({
        role: m.role.toLowerCase() as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userContent },
    ];
  }

  /**
   * Generate AI answer with citations (non-streaming).
   */
  private async generateAnswer(
    query: string,
    chunks: RetrievedChunk[],
    previousMessages: { role: string; content: string }[],
  ): Promise<{ answer: string; citations: Citation[]; tokenUsage: number }> {
    const contextText = this.buildContextText(chunks);
    const systemPrompt = this.buildSystemPrompt(contextText);
    const messages = this.buildLLMMessages(systemPrompt, previousMessages, query);

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 2000,
      temperature: 0.7,
    });

    const answer = response.choices[0]?.message?.content || 'I could not generate a response.';
    const tokenUsage = response.usage?.total_tokens || 0;
    const citations = this.buildCitations(chunks);

    return { answer, citations, tokenUsage };
  }

  /**
   * Generate 3 follow-up questions after an AI response.
   * Uses a lightweight LLM call for cost efficiency.
   */
  private async generateFollowups(
    userQuery: string,
    aiResponse: string,
  ): Promise<string[] | null> {
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: 'system',
            content: 'Generate exactly 3 follow-up questions based on the conversation. Return them as a JSON array of strings. Only return the JSON array, nothing else.',
          },
          {
            role: 'user',
            content: `User asked: "${userQuery}"\n\nAI answered: "${aiResponse.slice(0, 500)}"\n\nGenerate 3 follow-up questions:`,
          },
        ],
        max_tokens: 200,
        temperature: 0.8,
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      // Try to parse as JSON array
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 3);
      }
      return null;
    } catch {
      logger.warn('Failed to generate follow-up questions');
      return null;
    }
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
