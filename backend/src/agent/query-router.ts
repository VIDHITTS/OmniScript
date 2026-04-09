import { groq } from '../lib/groq';
import { logger } from '../utils/logger';

/**
 * QueryRouter — Adaptive query classification and routing.
 *
 * Routes queries to the appropriate retrieval strategy:
 * - FAST: Simple factual queries → hybrid search + reranking (no agent)
 * - AGENTIC: Complex queries → full agent loop with tool selection
 * - PAGEINDEX: Document-specific queries → PageIndex navigation
 *
 * Design: Uses a lightweight LLM call to classify the query type.
 * This is the Strategy Pattern entry point.
 */
export type QueryType = 'FAST' | 'AGENTIC' | 'PAGEINDEX';

export interface RoutingDecision {
  queryType: QueryType;
  confidence: number;
  reasoning: string;
  suggestedTools?: string[];
}

export class QueryRouter {
  /**
   * Classify a query and decide the retrieval strategy.
   *
   * Heuristics applied before LLM:
   * - Very short queries (<5 words) → FAST
   * - Queries mentioning "chapter", "section", "page" → PAGEINDEX
   * - Multi-part queries, comparisons, complex reasoning → AGENTIC
   */
  public async route(
    query: string,
    hasDocuments: boolean = true,
  ): Promise<RoutingDecision> {
    if (!hasDocuments) {
      return {
        queryType: 'FAST',
        confidence: 1,
        reasoning: 'No documents in workspace, using fast path.',
      };
    }

    // Quick heuristics first (avoid LLM call for obvious cases)
    const quickDecision = this.heuristicRoute(query);
    if (quickDecision) return quickDecision;

    // LLM-based classification for ambiguous cases
    try {
      return await this.llmRoute(query);
    } catch (error) {
      logger.warn({ error }, 'LLM routing failed, falling back to FAST path');
      return {
        queryType: 'FAST',
        confidence: 0.5,
        reasoning: 'LLM routing failed, defaulting to fast path.',
      };
    }
  }

  /**
   * Fast heuristic routing (no LLM call needed).
   */
  private heuristicRoute(query: string): RoutingDecision | null {
    const lower = query.toLowerCase();
    const wordCount = query.split(/\s+/).length;

    // PageIndex indicators
    const pageIndexPatterns = [
      /chapter\s+\d/i, /section\s+\d/i, /page\s+\d/i,
      /table\s+of\s+contents/i, /outline/i, /structure/i,
      /heading/i, /part\s+\d/i,
    ];
    if (pageIndexPatterns.some((p) => p.test(query))) {
      return {
        queryType: 'PAGEINDEX',
        confidence: 0.9,
        reasoning: 'Query references document structure.',
        suggestedTools: ['page_index_navigation'],
      };
    }

    // Simple factual queries (very short)
    if (wordCount <= 4) {
      return {
        queryType: 'FAST',
        confidence: 0.8,
        reasoning: 'Short factual query.',
      };
    }

    // Comparison indicators
    if (lower.includes('compare') || lower.includes('difference between') || lower.includes('versus')) {
      return {
        queryType: 'AGENTIC',
        confidence: 0.85,
        reasoning: 'Comparison query requires multi-document analysis.',
        suggestedTools: ['compare_documents', 'vector_search'],
      };
    }

    // Summarization indicators
    if (lower.includes('summarize') || lower.includes('summary') || lower.includes('overview')) {
      return {
        queryType: 'AGENTIC',
        confidence: 0.85,
        reasoning: 'Summarization query requires dedicated tool.',
        suggestedTools: ['summarize'],
      };
    }

    // No clear heuristic match
    return null;
  }

  /**
   * LLM-based query classification.
   */
  private async llmRoute(query: string): Promise<RoutingDecision> {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Classify the user query into one of these types:
- FAST: Simple factual lookup, definition, or specific question that can be answered by searching
- AGENTIC: Complex query requiring reasoning, multi-step analysis, comparison, or synthesis
- PAGEINDEX: Query about document structure, specific chapters/sections/pages

Respond in JSON format:
{"queryType": "FAST|AGENTIC|PAGEINDEX", "confidence": 0.0-1.0, "reasoning": "one sentence", "suggestedTools": ["tool_name"]}

Available tools: vector_search, keyword_search, hyde_search, page_index_navigation, metadata_filter, summarize, compare_documents`,
        },
        { role: 'user', content: query },
      ],
      max_tokens: 150,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content?.trim() || '';

    try {
      const parsed = JSON.parse(content);
      return {
        queryType: parsed.queryType || 'FAST',
        confidence: parsed.confidence || 0.7,
        reasoning: parsed.reasoning || 'LLM classification',
        suggestedTools: parsed.suggestedTools,
      };
    } catch {
      return {
        queryType: 'FAST',
        confidence: 0.6,
        reasoning: 'LLM response unparseable, defaulting to fast path.',
      };
    }
  }
}
