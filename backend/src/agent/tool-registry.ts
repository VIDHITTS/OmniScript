import { AgentTool } from './tool.types';
import { VectorSearchTool } from './tools/vector-search.tool';
import { KeywordSearchTool } from './tools/keyword-search.tool';
import { HyDESearchTool } from './tools/hyde-search.tool';
import { GraphTraversalTool } from './tools/graph-traverse.tool';
import { PageIndexNavigationTool } from './tools/page-index.tool';
import { SummarizeTool } from './tools/summarize.tool';
import { CompareTool } from './tools/compare.tool';
import { MetadataFilterTool } from './tools/metadata-filter.tool';

/**
 * Tool Registry — Central registry of all available agent tools.
 *
 * Each tool follows the AgentTool interface: { name, description, inputSchema, execute }.
 * Tools are filtered by their isEnabled() guard before being passed to the LLM.
 *
 * Inspired by Claude Code's tools.ts pattern.
 */
export function getAllTools(): AgentTool<any, any>[] {
  const tools: AgentTool<any, any>[] = [
    // Core retrieval tools
    VectorSearchTool,      // Semantic similarity search (cosine on embeddings)
    KeywordSearchTool,     // BM25-style keyword matching
    HyDESearchTool,        // Hypothetical Document Embedding — bridges query/doc mismatch
    GraphTraversalTool,    // Knowledge-graph multi-hop reasoning

    // Document navigation
    PageIndexNavigationTool, // Structure-aware navigation (chapters, sections)

    // Synthesis tools
    SummarizeTool,           // Full-document summarisation
    CompareTool,             // Side-by-side document comparison

    // Filtering
    MetadataFilterTool,      // Filter by source type, date, etc.
  ];

  // Return only enabled tools (each tool can gate itself via isEnabled())
  return tools.filter((tool) => (tool.isEnabled ? tool.isEnabled() : true));
}
