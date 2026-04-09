import { CohereClient } from "cohere-ai";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { RetrievedChunk } from "../types";

/**
 * CrossEncoderReranker — Reranks retrieval results using Cohere Rerank API.
 *
 * Design: The single highest-impact retrieval improvement per the roadmap.
 * Takes the top-50 hybrid search candidates and reranks them using a
 * cross-attention model, returning the top-K most relevant chunks.
 *
 * The cross-encoder sees both the query and the document simultaneously,
 * unlike bi-encoders which embed them separately. This dramatically
 * improves precision.
 */
export class CrossEncoderReranker {
  private client: CohereClient;

  constructor() {
    this.client = new CohereClient({ token: env.COHERE_API_KEY });
  }

  /**
   * Rerank chunks using Cohere's cross-encoder model.
   *
   * @param query - The user's search query
   * @param chunks - Candidate chunks from hybrid search
   * @param topK - Number of top results to return (default: 5)
   * @returns Reranked chunks sorted by relevance
   */
  public async rerank(
    query: string,
    chunks: RetrievedChunk[],
    topK: number = 5,
  ): Promise<RetrievedChunk[]> {
    if (chunks.length === 0) return [];
    if (chunks.length <= topK) return chunks;

    try {
      const documents = chunks.map((c) =>
        c.contextualizedContent || c.content,
      );

      const response = await this.client.v2.rerank({
        model: "rerank-v3.5",
        query,
        documents,
        topN: topK,
      });

      // Map reranked results back to our chunk format
      const reranked: RetrievedChunk[] = response.results.map((result) => {
        const originalChunk = chunks[result.index];
        return {
          ...originalChunk,
          score: result.relevanceScore,
        };
      });

      logger.info(
        {
          query: query.slice(0, 50),
          candidateCount: chunks.length,
          rerankTopK: topK,
          topScore: reranked[0]?.score,
        },
        "Chunks reranked via Cohere",
      );

      return reranked;
    } catch (error) {
      // Graceful fallback: if reranking fails, return original top-K
      logger.warn(
        { error },
        "Cohere reranking failed, falling back to hybrid search scores",
      );
      return chunks.slice(0, topK);
    }
  }
}
