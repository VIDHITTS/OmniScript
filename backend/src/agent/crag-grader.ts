import { groq } from '../lib/groq';
import { RetrievedChunk } from '../types';
import { logger } from '../utils/logger';

/**
 * CRAGGrader — Corrective Retrieval Augmented Generation grader.
 *
 * Evaluates whether retrieved chunks are relevant to the query.
 * Returns a verdict: RELEVANT, AMBIGUOUS, or IRRELEVANT.
 *
 * When IRRELEVANT: The agent should rewrite the query and try again.
 * When AMBIGUOUS: The agent should try additional tools (HyDE, PageIndex).
 * When RELEVANT: The agent proceeds to answer generation.
 *
 * Uses a cheap, fast LLM call for cost efficiency.
 */
export type CRAGVerdict = 'RELEVANT' | 'AMBIGUOUS' | 'IRRELEVANT';

export interface CRAGResult {
  verdict: CRAGVerdict;
  score: number;        // 0-1 relevance score
  reasoning: string;    // LLM's explanation
  suggestedRewrite?: string; // Only for IRRELEVANT — suggested query rewrite
}

export class CRAGGrader {
  /**
   * Evaluate retrieval results for relevance to the query.
   *
   * @param query - The user's original query
   * @param chunks - The retrieved chunks to evaluate
   * @param minScore - Minimum score to consider RELEVANT (default: 0.6)
   */
  public async evaluate(
    query: string,
    chunks: RetrievedChunk[],
    minScore: number = 0.6,
  ): Promise<CRAGResult> {
    if (chunks.length === 0) {
      return {
        verdict: 'IRRELEVANT',
        score: 0,
        reasoning: 'No chunks were retrieved.',
        suggestedRewrite: query,
      };
    }

    // Build context summary from top chunks
    const chunkSummary = chunks
      .slice(0, 5)
      .map((c, i) => `[${i + 1}] (Score: ${c.score.toFixed(3)}) ${c.content.slice(0, 200)}...`)
      .join('\n\n');

    try {
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a retrieval quality evaluator. Given a user query and retrieved document chunks, evaluate whether the chunks contain information relevant to answering the query.

Respond in this exact JSON format:
{
  "verdict": "RELEVANT" | "AMBIGUOUS" | "IRRELEVANT",
  "score": <0.0-1.0>,
  "reasoning": "<one sentence explaining your verdict>",
  "suggestedRewrite": "<rewritten query if IRRELEVANT, null otherwise>"
}

Guidelines:
- RELEVANT (score >= 0.6): Chunks directly address the query
- AMBIGUOUS (0.3 <= score < 0.6): Chunks are partially related but may not fully answer
- IRRELEVANT (score < 0.3): Chunks don't contain information to answer the query`,
          },
          {
            role: 'user',
            content: `QUERY: "${query}"\n\nRETRIEVED CHUNKS:\n${chunkSummary}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.1, // Low temp for consistent grading
      });

      const content = response.choices[0]?.message?.content?.trim() || '';

      // Parse the JSON response
      try {
        const parsed = JSON.parse(content);
        const score = Math.min(1, Math.max(0, Number(parsed.score) || 0));
        let verdict: CRAGVerdict;

        if (score >= minScore) verdict = 'RELEVANT';
        else if (score >= 0.3) verdict = 'AMBIGUOUS';
        else verdict = 'IRRELEVANT';

        return {
          verdict,
          score,
          reasoning: parsed.reasoning || 'No reasoning provided',
          suggestedRewrite: verdict !== 'RELEVANT' ? parsed.suggestedRewrite || undefined : undefined,
        };
      } catch {
        // If JSON parsing fails, use heuristic from retrieval scores
        return this.heuristicGrading(chunks, minScore);
      }
    } catch (error) {
      logger.warn({ error }, 'CRAG grading LLM call failed, using heuristic');
      return this.heuristicGrading(chunks, minScore);
    }
  }

  /**
   * Fallback heuristic grading based on retrieval scores.
   */
  private heuristicGrading(chunks: RetrievedChunk[], minScore: number): CRAGResult {
    const avgScore = chunks.reduce((s, c) => s + c.score, 0) / chunks.length;
    const topScore = chunks[0]?.score || 0;

    let verdict: CRAGVerdict;
    if (topScore >= minScore && avgScore >= minScore * 0.5) {
      verdict = 'RELEVANT';
    } else if (topScore >= 0.3) {
      verdict = 'AMBIGUOUS';
    } else {
      verdict = 'IRRELEVANT';
    }

    return {
      verdict,
      score: topScore,
      reasoning: `Heuristic: top score ${topScore.toFixed(3)}, avg ${avgScore.toFixed(3)}`,
    };
  }
}
