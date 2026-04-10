import { prisma } from '../../config/db';
import { groq } from '../../lib/groq';
import { HybridRetriever } from '../../lib/retrieval';
import { CrossEncoderReranker } from '../../lib/reranker';
import { Agent } from '../../agent/agent';
import { QueryRouter } from '../../agent/query-router';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { RetrievedChunk, Citation } from '../../types';
import { CreateSessionInput, MessageListInput } from './chat.validation';

/**
 * ChatService — Business logic for chat sessions and AI-powered interaction.
 *
 * Routing Pipeline:
 * 1. QueryRouter classifies query (FAST | AGENTIC | PAGEINDEX)
 * 2. FAST path: Hybrid Search (vector + BM25 + RRF) → Cohere Reranking → LLM Generation
 * 3. AGENTIC / PAGEINDEX path: Delegates to Agent orchestrator (Plan → Execute Tools → Evaluate CRAG → Synthesize)
 * 4. Responses are stored in PG with tool calls and citations attached.
 */
export class ChatService {
  private retriever: HybridRetriever;
  private reranker: CrossEncoderReranker;
  private queryRouter: QueryRouter;
  private agent: Agent;

  constructor() {
    this.retriever = new HybridRetriever();
    this.reranker = new CrossEncoderReranker();
    this.queryRouter = new QueryRouter();
    this.agent = new Agent();
  }

  /**
   * Create a new chat session in a workspace.
   */
  public async createSession(userId: string, workspaceId: string, input: CreateSessionInput) {
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
        toolCalls: true,
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
   */
  public async sendMessage(userId: string, sessionId: string, content: string) {
    const session = await this.getSessionOrThrow(sessionId);

    // Filter to ensure only workspace members can send messages
    const isMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: session.workspaceId, userId },
    });
    if (!isMember) throw AppError.forbidden('You do not have access to this workspace.');

    // Store user message
    const userMessage = await prisma.message.create({
      data: { sessionId, userId, role: 'USER', content },
    });

    const previousMessages = await this.getPreviousMessages(sessionId);
    
    // Check if workspace has documents
    const docCount = await prisma.document.count({
      where: { workspaceId: session.workspaceId, status: 'INDEXED' }
    });
    
    // Route Query
    const routeDecision = await this.queryRouter.route(content, docCount > 0);
    logger.info({ routeDecision }, 'Query routed');

    let answer: string;
    let citations: Citation[] = [];
    let tokenUsage = 0;
    let toolCalls: Record<string, unknown>[] | undefined;

    if (routeDecision.queryType === 'FAST' && docCount > 0) {
      // FAST Path: Hybrid Search + Reranker + LLM
      const rawChunks = await this.retriever.retrieve(session.workspaceId, content, 50);
      const chunks = await this.reranker.rerank(content, rawChunks, 5);
      
      const generationResult = await this.generateAnswer(content, chunks, previousMessages);
      answer = generationResult.answer;
      citations = generationResult.citations;
      tokenUsage = generationResult.tokenUsage;
      
    } else if (docCount > 0) {
      // AGENTIC Path: Orchestrate Tools
      const agentResult = await this.agent.run(
        content,
        { workspaceId: session.workspaceId, userId },
        previousMessages
      );
      answer = agentResult.answer;
      citations = agentResult.citations;
      tokenUsage = agentResult.tokenUsage;
      toolCalls = agentResult.toolCalls;
    } else {
      // Empty Workspace
      answer = "The workspace is empty. Please upload some documents first so I can answer your questions based on them.";
    }

    const aiMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: answer,
        citations: citations.length > 0 ? JSON.parse(JSON.stringify(citations)) : undefined,
        toolCalls: toolCalls && toolCalls.length > 0 ? JSON.parse(JSON.stringify(toolCalls)) : undefined,
        tokenUsage,
      },
    });

    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { lastActiveAt: new Date() },
    });

    return { userMessage, aiMessage, routing: routeDecision };
  }

  /**
   * Stream a message response via SSE.
   */
  public async streamMessage(
    userId: string,
    sessionId: string,
    content: string,
    onChunk: (chunk: string) => void,
    onDone: (message: { id: string; citations: unknown; toolCalls: unknown; suggestedFollowups?: unknown; routing: unknown }) => void,
    onError: (error: Error) => void,
  ): Promise<void> {
    try {
      const session = await this.getSessionOrThrow(sessionId);

      await prisma.message.create({
        data: { sessionId, userId, role: 'USER', content },
      });

      const previousMessages = await this.getPreviousMessages(sessionId);
      
      const docCount = await prisma.document.count({
        where: { workspaceId: session.workspaceId, status: 'INDEXED' }
      });
      
      const routeDecision = await this.queryRouter.route(content, docCount > 0);
      
      let finalAnswer = '';
      let citations: Citation[] = [];
      let totalTokens = 0;
      let toolCalls: Record<string, unknown>[] | undefined;

      if (routeDecision.queryType === 'FAST' && docCount > 0) {
        // FAST Path Stream
        const rawChunks = await this.retriever.retrieve(session.workspaceId, content, 50);
        const chunks = await this.reranker.rerank(content, rawChunks, 5);
        citations = this.buildCitations(chunks);
        
        const contextText = this.buildContextText(chunks);
        const systemPrompt = this.buildSystemPrompt(contextText);
        const messages = this.buildLLMMessages(systemPrompt, previousMessages, content);

        const stream = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages,
          max_tokens: 2000,
          temperature: 0.7,
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || '';
          if (delta) {
            finalAnswer += delta;
            onChunk(delta);
          }
          const chunkAny = chunk as any;
          if (chunkAny.x_groq?.usage?.total_tokens) {
            totalTokens = chunkAny.x_groq.usage.total_tokens;
          }
        }
      } else if (docCount > 0) {
        // AGENTIC Path Stream
        // Send a temporary typing indicator or agent system message here if desired
        const agentResult = await this.agent.run(
          content,
          { workspaceId: session.workspaceId, userId },
          previousMessages,
          onChunk
        );
        finalAnswer = agentResult.answer;
        citations = agentResult.citations;
        totalTokens = agentResult.tokenUsage;
        toolCalls = agentResult.toolCalls;
      } else {
        finalAnswer = "The workspace is empty. Please upload some documents first.";
        onChunk(finalAnswer);
      }

      const suggestedFollowups = await this.generateFollowups(content, finalAnswer);

      const aiMessage = await prisma.message.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: finalAnswer,
          citations: citations.length > 0 ? JSON.parse(JSON.stringify(citations)) : undefined,
          toolCalls: toolCalls && toolCalls.length > 0 ? JSON.parse(JSON.stringify(toolCalls)) : undefined,
          suggestedFollowups: suggestedFollowups ? JSON.parse(JSON.stringify(suggestedFollowups)) : undefined,
          tokenUsage: totalTokens,
        },
      });

      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { lastActiveAt: new Date() },
      });

      onDone({
        id: aiMessage.id,
        citations: citations.length > 0 ? citations : undefined,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        suggestedFollowups,
        routing: routeDecision
      });
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Stream failed'));
    }
  }

  // Same branchSession untouched
  public async branchSession(userId: string, sessionId: string, atMessageId: string) {
    const originalSession = await this.getSessionOrThrow(sessionId);

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

    const newSession = await prisma.chatSession.create({
      data: {
        workspaceId: originalSession.workspaceId,
        userId,
        title: `${originalSession.title} (branch)`,
        parentSessionId: sessionId,
        branchPointMessageId: atMessageId,
      },
    });

    if (messagesToCopy.length > 0) {
      await prisma.message.createMany({
        data: messagesToCopy.map((m) => ({
          sessionId: newSession.id,
          userId: m.userId,
          role: m.role,
          content: m.content,
          citations: m.citations ? JSON.parse(JSON.stringify(m.citations)) : undefined,
          toolCalls: m.toolCalls ? JSON.parse(JSON.stringify(m.toolCalls)) : undefined,
        })),
      });
    }

    return newSession;
  }

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
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 3);
      }
      return null;
    } catch {
      return null;
    }
  }

  private buildSystemPrompt(contextText: string): string {
    if (!contextText) {
      return `You are OmniScript, an AI knowledge assistant. The user's workspace has no indexed documents yet. Let them know they need to upload documents first, then you can answer questions about them.`;
    }

    return `You are OmniScript, an AI knowledge assistant. Answer questions based on the provided context from the user's documents.
RULES:
1. Cite your sources using [1], [2], etc. corresponding to the numbered context chunks.
2. If the context doesn't contain enough information, say so honestly.
3. Be concise but thorough.
CONTEXT:
${contextText}`;
  }
}
