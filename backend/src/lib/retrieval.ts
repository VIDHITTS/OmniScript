import { prisma } from "../config/db";
import { Embedder } from "./embedder";
import { logger } from "../utils/logger";
import { RetrievedChunk } from "../types";

/**
 * HybridRetriever — Multi-stage retrieval pipeline.
 *
 * Pipeline:
 * 1. Vector search (cosine similarity on embeddings) → top 25
 * 2. Full-text search (keyword matching → BM25-style scoring) → top 25
 * 3. Reciprocal Rank Fusion (RRF) to merge both lists → top 50
 *
 * Design: Implements the Chain of Responsibility pattern.
 * Each stage filters/improves results before passing to the next.
 *
 * Note: Uses pseudo-embeddings for Phase 1. When real OpenAI embeddings are
 * available, the vector search will produce dramatically better results.
 */
export class HybridRetriever {
  private embedder: Embedder;
  private readonly RRF_K = 60; // Standard RRF constant

  constructor() {
    this.embedder = new Embedder();
  }

  /**
   * Execute hybrid retrieval across a workspace.
   * Returns merged and RRF-scored chunks ready for reranking.
   */
  public async retrieve(
    workspaceId: string,
    query: string,
    topK: number = 50,
  ): Promise<RetrievedChunk[]> {
    // Get all indexed documents in workspace
    const documents = await prisma.document.findMany({
      where: { workspaceId, status: "INDEXED" },
      select: { id: true, title: true },
    });

    if (documents.length === 0) return [];

    const documentIds = documents.map((d) => d.id);
    const titleMap = new Map(documents.map((d) => [d.id, d.title]));

    // Run both search strategies in parallel
    const [vectorResults, textResults] = await Promise.all([
      this.vectorSearch(documentIds, query, 25),
      this.fullTextSearch(documentIds, query, 25),
    ]);

    // Merge via Reciprocal Rank Fusion
    const merged = this.reciprocalRankFusion(vectorResults, textResults);

    // Attach document titles and return top K
    return merged.slice(0, topK).map((chunk) => ({
      ...chunk,
      documentTitle: titleMap.get(chunk.documentId) || "Unknown",
    }));
  }

  /**
   * Vector search — cosine similarity on chunk embeddings.
   *
   * Phase 1: Since we store embeddings as JSON (not pgvector), we compute
   * cosine similarity in application code. With real pgvector, this would
   * be a single SQL query using the <=> operator.
   */
  private async vectorSearch(
    documentIds: string[],
    query: string,
    limit: number,
  ): Promise<ScoredChunk[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.embedder.embed(query);

      // Fetch chunks with embeddings
      const chunks = await prisma.documentChunk.findMany({
        where: { documentId: { in: documentIds } },
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
        take: 200, // Pool of candidates
      });

      // Compute cosine similarity for each chunk
      const scored: ScoredChunk[] = [];
      for (const chunk of chunks) {
        if (!chunk.embedding) continue;

        let chunkEmbedding: number[];
        try {
          chunkEmbedding =
            typeof chunk.embedding === "string"
              ? JSON.parse(chunk.embedding as string)
              : (chunk.embedding as number[]);
        } catch {
          continue;
        }

        const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);
        scored.push({
          id: chunk.id,
          content: chunk.content,
          contextualizedContent: chunk.contextualizedContent,
          chunkIndex: chunk.chunkIndex,
          sectionHeading: chunk.sectionHeading,
          location: chunk.location,
          documentId: chunk.documentId,
          tokenCount: chunk.tokenCount,
          score: similarity,
          documentTitle: "",
        });
      }

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      logger.warn({ error }, "Vector search failed, returning empty results");
      return [];
    }
  }

  /**
   * Full-text search — keyword matching with BM25-style scoring.
   *
   * Phase 1: Uses application-level scoring since we don't have tsvector
   * columns populated yet. Scores based on term frequency, document length,
   * and exact phrase matching.
   */
  private async fullTextSearch(
    documentIds: string[],
    query: string,
    limit: number,
  ): Promise<ScoredChunk[]> {
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (queryTerms.length === 0) return [];

    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: { in: documentIds } },
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
      take: 200,
    });

    const queryLower = query.toLowerCase();
    const avgDocLength =
      chunks.reduce((s, c) => s + c.content.length, 0) / (chunks.length || 1);

    const scored: ScoredChunk[] = chunks.map((chunk) => {
      const contentLower = (
        chunk.content +
        " " +
        (chunk.contextualizedContent || "")
      ).toLowerCase();
      const docLength = chunk.content.length;

      // BM25-inspired scoring
      const k1 = 1.2;
      const b = 0.75;
      let score = 0;

      for (const term of queryTerms) {
        const tf = (contentLower.match(new RegExp(term, "g")) || []).length;
        if (tf > 0) {
          // BM25 term frequency saturation
          const normalizedTf =
            (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)));
          score += normalizedTf;
        }
      }

      // Bonus for exact phrase match
      if (contentLower.includes(queryLower)) {
        score += 3;
      }

      return {
        id: chunk.id,
        content: chunk.content,
        contextualizedContent: chunk.contextualizedContent,
        chunkIndex: chunk.chunkIndex,
        sectionHeading: chunk.sectionHeading,
        location: chunk.location,
        documentId: chunk.documentId,
        tokenCount: chunk.tokenCount,
        score,
        documentTitle: "",
      };
    });

    return scored
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Reciprocal Rank Fusion — merges two ranked lists.
   *
   * Formula: score = Σ 1/(k + rank) where k=60 is standard.
   * This is the recommended approach from the roadmap for combining
   * vector search and BM25 results.
   */
  private reciprocalRankFusion(
    listA: ScoredChunk[],
    listB: ScoredChunk[],
  ): ScoredChunk[] {
    const scoreMap = new Map<string, { chunk: ScoredChunk; rrfScore: number }>();

    // Score list A
    listA.forEach((chunk, rank) => {
      const rrfScore = 1.0 / (this.RRF_K + rank + 1);
      scoreMap.set(chunk.id, { chunk, rrfScore });
    });

    // Score and merge list B
    listB.forEach((chunk, rank) => {
      const rrfScore = 1.0 / (this.RRF_K + rank + 1);
      const existing = scoreMap.get(chunk.id);

      if (existing) {
        existing.rrfScore += rrfScore;
      } else {
        scoreMap.set(chunk.id, { chunk, rrfScore });
      }
    });

    // Sort by combined RRF score
    return Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map(({ chunk, rrfScore }) => ({
        ...chunk,
        score: rrfScore,
      }));
  }

  /**
   * Cosine similarity between two vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

type ScoredChunk = RetrievedChunk;
