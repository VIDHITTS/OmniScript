import { groq } from '../lib/groq';
import { getAllTools } from './tool-registry';
import { AgentContext } from './tool.types';
import { QueryRouter } from './query-router';
import { CRAGGrader } from './crag-grader';
import { HybridRetriever } from '../lib/retrieval';
import { CrossEncoderReranker } from '../lib/reranker';
import { ContextCompressor } from '../lib/contextCompressor';
import { prisma } from '../config/db';
import { logger } from '../utils/logger';

const ITERATION_LIMIT = 5;

/**
 * Agent — Agentic RAG orchestrator.
 *
 * Implements the plan → execute → evaluate → retry loop:
 * 1. QueryRouter classifies the query (FAST / AGENTIC / PAGEINDEX)
 * 2. FAST path: hybrid retrieval + Cohere reranking → direct LLM answer
 * 3. AGENTIC path: iterative function-calling loop with tool selection
 * 4. After each retrieval, CRAGGrader evaluates relevance:
 *    - RELEVANT  → synthesize answer
 *    - AMBIGUOUS → add HyDE fallback, continue
 *    - IRRELEVANT → retry with different tools, up to ITERATION_LIMIT
 *
 * Inspired by Claude Code's coordinator pattern.
 */
export class Agent {
  private tools = getAllTools();
  private router = new QueryRouter();
  private crag = new CRAGGrader();
  private compressor = new ContextCompressor();
  private retriever = new HybridRetriever();
  private reranker = new CrossEncoderReranker();

  constructor(private context: AgentContext) {}

  public async evaluate(
    query: string,
    chatHistory: { role: 'user' | 'assistant' | 'system'; content: string }[] = []
  ): Promise<{ answer: string; tokensUsed: number; toolCallsMade: string[] }> {
    let tokensUsed = 0;
    const toolCallsMade: string[] = [];

    // ─── Step 1: Classify the query ───────────────────────────────────────────
    const hasDocuments = await this.workspaceHasDocuments();
    const routing = await this.router.route(query, hasDocuments);
    logger.info({ queryType: routing.queryType, confidence: routing.confidence, reasoning: routing.reasoning }, 'Query routed');

    // ─── Step 2: FAST PATH — hybrid retrieval + rerank + direct LLM answer ───
    if (routing.queryType === 'FAST') {
      return this.fastPath(query, chatHistory, tokensUsed, toolCallsMade);
    }

    // ─── Step 3: AGENTIC PATH — iterative tool-calling loop ──────────────────
    return this.agenticPath(query, chatHistory, tokensUsed, toolCallsMade, routing.suggestedTools);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FAST PATH: hybrid retrieval → reranking → direct LLM answer
  // ─────────────────────────────────────────────────────────────────────────────
  private async fastPath(
    query: string,
    chatHistory: { role: 'user' | 'assistant' | 'system'; content: string }[],
    tokensUsed: number,
    toolCallsMade: string[]
  ): Promise<{ answer: string; tokensUsed: number; toolCallsMade: string[] }> {
    toolCallsMade.push('hybrid_retrieval', 'cohere_rerank');

    // Retrieve + rerank
    const candidates = await this.retriever.retrieve(this.context.workspaceId, query, 50);
    const topChunks = await this.reranker.rerank(query, candidates, 5);

    // Compress context to reduce token usage
    const compressedChunks = await this.compressor.smartCompress(
      query,
      topChunks.map((c) => ({ id: c.id, content: c.content, sectionHeading: c.sectionHeading, documentTitle: c.documentTitle })),
      3000 // Target token budget for context
    );
    toolCallsMade.push('context_compression');

    // Grade relevance
    const grade = await this.crag.evaluateRetrieval(query, compressedChunks.map((c) => ({ id: c.id, content: c.content })));
    logger.info({ grade }, 'CRAG grade for fast path');

    const contextText = compressedChunks.map((c, i) =>
      `[${i + 1}] (${c.sectionHeading || 'Section'} — ${c.documentTitle}):\n${c.content}`
    ).join('\n\n---\n\n');

    const systemPrompt = grade === 'IRRELEVANT'
      ? `You are OmniScript, an AI knowledge assistant. The retrieved context does not appear relevant to the query. Be honest and suggest the user uploads more relevant documents.`
      : `You are OmniScript, an AI knowledge assistant. Answer questions based on the provided context from the user's documents.

RULES:
1. Use the provided context to answer accurately.
2. Cite sources using [1], [2], etc. matching the numbered context chunks.
3. If the context is insufficient, say so honestly.
4. Be concise but thorough.

CONTEXT FROM USER'S DOCUMENTS:
${contextText}`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-5), // Reduced from 10 to 5
      { role: 'user', content: query },
    ];

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 2000,
      temperature: 0.5,
    });

    tokensUsed += response.usage?.total_tokens || 0;
    const answer = response.choices[0]?.message?.content || 'Could not generate a response.';

    return { answer, tokensUsed, toolCallsMade };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AGENTIC PATH: iterative tool-calling with CRAG evaluation + retry
  // ─────────────────────────────────────────────────────────────────────────────
  private async agenticPath(
    query: string,
    chatHistory: { role: 'user' | 'assistant' | 'system'; content: string }[],
    tokensUsed: number,
    toolCallsMade: string[],
    suggestedTools?: string[]
  ): Promise<{ answer: string; tokensUsed: number; toolCallsMade: string[] }> {
    // Build OpenAI-compatible function schemas for Groq function calling
    const groqTools = this.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query or question' },
            limit: { type: 'number', description: 'Max results to return (1-20)' },
            entityName: { type: 'string', description: 'Entity name for graph traversal' },
            maxHops: { type: 'number', description: 'Graph traversal depth (1-2)' },
            documentId: { type: 'string', description: 'Document UUID for targeted search' },
            sourceType: { type: 'string', description: 'Filter by source type (PDF, YOUTUBE, WEB_URL, etc.)' },
          },
          required: ['query'],
        },
      },
    }));

    const toolHint = suggestedTools?.length
      ? `Suggested tools for this query: ${suggestedTools.join(', ')}.`
      : '';

    const messages: any[] = [
      {
        role: 'system',
        content: `You are OmniScript Agent, an intelligent knowledge assistant. Use tools to retrieve information from the user's document workspace, then synthesize a comprehensive answer with citations [1], [2], etc.

${toolHint}

Strategy:
- Start with vector_search for conceptual questions
- Use keyword_search for exact terms, names, or IDs
- Use hyde_search for complex or abstract questions
- Use graph_traverse to find entity relationships
- Use page_index_navigate for structure-specific questions
- Cite all sources. Do not hallucinate.`,
      },
      ...chatHistory.slice(-5),
      { role: 'user', content: query },
    ];

    let collectedChunks: Array<{ id: string; content: string }> = [];

    for (let i = 0; i < ITERATION_LIMIT; i++) {
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        tools: groqTools,
        tool_choice: 'auto',
        max_tokens: 2000,
      });

      const msg = response.choices[0]?.message;
      if (!msg) break;

      tokensUsed += response.usage?.total_tokens || 0;
      messages.push(msg);

      // Agent decided it has enough info — evaluate and finalize
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        // Final CRAG evaluation
        if (collectedChunks.length > 0) {
          const grade = await this.crag.evaluateRetrieval(query, collectedChunks.slice(0, 5));
          logger.info({ grade, iteration: i + 1 }, 'CRAG final grade');

          if (grade === 'IRRELEVANT' && i < ITERATION_LIMIT - 1) {
            // Push agent to try harder
            messages.push({
              role: 'user',
              content: 'The retrieved context does not seem relevant. Please try different search strategies — use hyde_search or graph_traverse — to find more relevant information.',
            });
            continue;
          }
        }
        return { answer: msg.content || '', tokensUsed, toolCallsMade };
      }

      // Execute tool calls
      for (const toolCall of msg.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, unknown>;
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = { query };
        }

        toolCallsMade.push(fnName);
        logger.info({ fnName, fnArgs }, 'Agent executing tool');

        const tool = this.tools.find((t) => t.name === fnName);
        let toolOutput = '';

        if (tool) {
          try {
            const result = await tool.execute(fnArgs, this.context);
            
            // Truncate chunk content in tool output to prevent context overflow
            let truncatedResult = result.data;
            if (Array.isArray(truncatedResult)) {
              truncatedResult = truncatedResult.map((item: any) => {
                if (item.content && typeof item.content === 'string') {
                  // Limit each chunk to 500 characters in the tool output
                  return {
                    ...item,
                    content: item.content.length > 500 
                      ? item.content.substring(0, 500) + '...[truncated]'
                      : item.content
                  };
                }
                return item;
              });
            }
            
            toolOutput = JSON.stringify({ ...result, data: truncatedResult });

            // Collect chunks for CRAG evaluation (use full content for evaluation)
            const data = result.data as any;
            if (Array.isArray(data)) {
              collectedChunks = [...collectedChunks, ...data.map((r: any) => ({ id: r.id || '', content: r.content || '' }))];
            }
          } catch (error) {
            toolOutput = JSON.stringify({ error: String(error) });
            logger.warn({ fnName, error }, 'Tool execution failed');
          }
        } else {
          toolOutput = `Tool "${fnName}" not found in registry.`;
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: fnName,
          content: toolOutput,
        });
      }
    }

    // Force final answer after iteration limit
    messages.push({
      role: 'user',
      content: 'Based on all the information you have gathered, please provide a comprehensive, well-cited final answer.',
    });

    const finalResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: 2000,
      temperature: 0.5,
    });

    tokensUsed += finalResponse.usage?.total_tokens || 0;

    return {
      answer: finalResponse.choices[0]?.message?.content || 'Could not generate a final response.',
      tokensUsed,
      toolCallsMade,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  private async workspaceHasDocuments(): Promise<boolean> {
    const count = await prisma.document.count({
      where: { workspaceId: this.context.workspaceId, status: 'INDEXED' },
    });
    return count > 0;
  }
}
