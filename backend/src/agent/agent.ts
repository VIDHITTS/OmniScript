import { groq } from '../lib/groq';
import { getAllTools, getToolByName, getToolDescriptions } from './tool-registry';
import { CRAGGrader, CRAGResult } from './crag-grader';
import { AgentContext, AgentTool, ToolResult } from './tool.types';
import { RetrievedChunk, Citation } from '../types';
import { logger } from '../utils/logger';

export interface AgentResponse {
  answer: string;
  citations: Citation[];
  tokenUsage: number;
  toolCalls: Record<string, unknown>[];
}

class TokenBudgetTracker {
  private totalTokens = 0;
  private readonly maxBudget: number;

  constructor(maxBudget = 10000) {
    this.maxBudget = maxBudget;
  }

  public add(tokens: number) {
    this.totalTokens += tokens;
  }

  public getTotal(): number {
    return this.totalTokens;
  }

  public shouldStop(): boolean {
    return this.totalTokens >= this.maxBudget;
  }
}

/**
 * Agent Orchestrator — The core intelligence layer.
 * 
 * Implements the plan -> execute -> evaluate -> retry loop.
 */
export class Agent {
  private grader: CRAGGrader;
  private readonly MAX_ITERATIONS = 4;

  constructor() {
    this.grader = new CRAGGrader();
  }

  public async run(
    query: string,
    context: AgentContext,
    previousMessages: { role: string; content: string }[],
    onChunk?: (chunk: string) => void
  ): Promise<AgentResponse> {
    const budgetTracker = new TokenBudgetTracker();
    let currentQuery = query;
    let iteration = 0;
    
    let bestChunks: RetrievedChunk[] = [];
    let bestCrag: CRAGResult | null = null;
    const toolCallsRecord: Record<string, unknown>[] = [];
    
    // The Execution Loop
    while (iteration < this.MAX_ITERATIONS && !budgetTracker.shouldStop()) {
      iteration++;
      logger.info({ iteration, query: currentQuery }, 'Agent starting iteration');
      
      // Step 1: Plan (Choose Tools)
      const selectedToolsData = await this.planTools(currentQuery, previousMessages, budgetTracker);
      
      if (!selectedToolsData || selectedToolsData.length === 0) {
        break; // No tools selected, fallback or break
      }

      // Step 2: Execute Tools
      const chunksFound: RetrievedChunk[] = [];
      for (const t of selectedToolsData) {
        const tool = getToolByName(t.name);
        if (!tool) continue;
        
        try {
          const result = await tool.execute(t.input, context);
          toolCallsRecord.push({ name: t.name, input: t.input, success: true });
          
          if (result.data && Array.isArray(result.data)) {
             // For retrieval tools that return an array of chunks
             chunksFound.push(...(result.data as RetrievedChunk[]));
          } else if (result.data && typeof result.data === 'object' && 'chunks' in result.data) {
             // For page index or others
             chunksFound.push(...((result.data as any).chunks as RetrievedChunk[] || []));
          } else if (result.data && typeof result.data === 'object' && 'comparison' in result.data) {
             // Fallback for summarize/compare returning objects
             chunksFound.push({
               id: `gen_${iteration}`,
               content: JSON.stringify(result.data),
               contextualizedContent: null,
               chunkIndex: 0,
               sectionHeading: 'Generated Tool Output',
               location: {},
               documentId: 'agent',
               documentTitle: 'Tool Execution',
               score: result.confidence || 1.0
             });
          }
        } catch (e) {
          logger.warn({ tool: t.name, error: e }, 'Tool execution failed');
          toolCallsRecord.push({ name: t.name, input: t.input, success: false });
        }
      }
      
      // If no chunks, try refining the query on the next iteration
      if (chunksFound.length === 0) {
        currentQuery = `Try to find any general information about: ${currentQuery}`;
        continue;
      }

      // De-duplicate chunks
      const uniqueChunks = Array.from(new Map(chunksFound.map(c => [c.id, c])).values());

      // Step 3: Evaluate (CRAG)
      const cragResult = await this.grader.evaluate(currentQuery, uniqueChunks);
      
      logger.info({ verdict: cragResult.verdict, score: cragResult.score }, 'CRAG Evaluation');

      if (!bestCrag || cragResult.score > bestCrag.score) {
        bestCrag = cragResult;
        bestChunks = uniqueChunks;
      }
      
      // Step 4: Branch on Verdict
      if (cragResult.verdict === 'RELEVANT') {
        break; // We have what we need
      } else if (cragResult.verdict === 'AMBIGUOUS' && iteration < this.MAX_ITERATIONS - 1) {
        // We might want to try one more time to improve it
        currentQuery = cragResult.suggestedRewrite || `${currentQuery} more details`;
      } else if (cragResult.verdict === 'IRRELEVANT' && iteration < this.MAX_ITERATIONS) {
        // Rewrite and retry completely
        currentQuery = cragResult.suggestedRewrite || `Different formulation of: ${currentQuery}`;
      } else {
        break; // we hit the max iterations or are satisfied with ambiguity
      }
    }
    
    // Step 5: Synthesize (Generate Answer)
    const { answer, citations, tokensUsed } = await this.synthesize(
      query,
      bestChunks,
      previousMessages,
      onChunk
    );
    budgetTracker.add(tokensUsed);
    
    return {
      answer,
      citations,
      tokenUsage: budgetTracker.getTotal(),
      toolCalls: toolCallsRecord
    };
  }
  
  private async planTools(
    query: string,
    previousMessages: { role: string; content: string }[],
    budget: TokenBudgetTracker
  ): Promise<Array<{ name: string; input: any }>> {
    const descriptions = getToolDescriptions();
    
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are an AI planner. Select the best tools to answer the user's query.

Available tools:
${descriptions}

Respond in this exact JSON format. Return an array of tools to execute:
[
  {
    "name": "tool_name",
    "input": { ... }
  }
]
If the query is simple, pick just one. If complex, you can pick up to 2 parallel tools. Always provide valid JSON.`
        },
        ...previousMessages.slice(-5).map(m => ({
          role: m.role.toLowerCase() as 'user'|'assistant',
          content: m.content
        })),
        { role: 'user', content: query }
      ],
      temperature: 0.1,
      max_tokens: 300
    });
    
    budget.add(response.usage?.total_tokens || 0);
    
    try {
      const content = response.choices[0]?.message?.content || '[]';
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [{ name: 'vector_search', input: { query } }]; // Fallback
    }
  }

  private async synthesize(
    query: string,
    chunks: RetrievedChunk[],
    previousMessages: { role: string; content: string }[],
    onChunk?: (chunk: string) => void
  ) {
    const contextText = chunks.slice(0, 5).map((c, i) =>
      `[${i + 1}] (${c.sectionHeading || 'Unknown Section'} - ${c.documentTitle}):\n${c.content}`,
    ).join('\n\n---\n\n');

    const systemPrompt = `You are OmniScript, an AI knowledge assistant. Answer questions based on the provided context from the user's documents.
RULES:
1. Cite your sources using [1], [2], etc. corresponding to the numbered context chunks.
2. If context doesn't contain the answer, say so.
3. Be concise but thorough.

CONTEXT:
${contextText}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...previousMessages.map((m) => ({
        role: m.role.toLowerCase() as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: query },
    ];

    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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
        if (onChunk) onChunk(delta);
      }
      
      const chunkAny = chunk as unknown as Record<string, unknown>;
      if (chunkAny.x_groq && typeof chunkAny.x_groq === 'object') {
        const xGroq = chunkAny.x_groq as Record<string, unknown>;
        if (xGroq.usage && typeof xGroq.usage === 'object') {
          const usage = xGroq.usage as Record<string, number>;
          totalTokens = usage.total_tokens || 0;
        }
      }
    }

    const citations: Citation[] = chunks.slice(0, 5).map((c, i) => ({
      index: i + 1,
      chunkId: c.id,
      documentTitle: c.documentTitle,
      sectionHeading: c.sectionHeading,
      location: c.location,
      score: c.score,
    }));

    return {
      answer: fullResponse,
      citations,
      tokensUsed: totalTokens || 100 // Fallback
    };
  }
}
