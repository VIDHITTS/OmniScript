import { AgentTool } from './tool.types';
import { VectorSearchTool } from './tools/vector-search.tool';
import { KeywordSearchTool } from './tools/keyword-search.tool';
import { PageIndexNavigationTool } from './tools/page-index.tool';
import { HyDESearchTool } from './tools/hyde-search.tool';
import { MetadataFilterTool } from './tools/metadata-filter.tool';
import { SummarizeTool } from './tools/summarize.tool';
import { CompareTool } from './tools/compare.tool';

/**
 * Tool Registry — Single source of truth for all agent tools.
 *
 * Registry Pattern: New tools are added here and automatically
 * become available to the Agent orchestrator. Each tool self-describes
 * via name, description, and inputSchema for the LLM to select from.
 */

/** All registered tools. */
const TOOL_REGISTRY: AgentTool<any, any>[] = [
  // Core retrieval
  VectorSearchTool,
  KeywordSearchTool,
  HyDESearchTool,

  // Navigation
  PageIndexNavigationTool,
  MetadataFilterTool,

  // Synthesis
  SummarizeTool,
  CompareTool,
];

/**
 * Get all currently enabled tools.
 * Each tool can optionally implement isEnabled() to self-disable.
 */
export function getAllTools(): AgentTool<any, any>[] {
  return TOOL_REGISTRY.filter((tool) =>
    tool.isEnabled ? tool.isEnabled() : true,
  );
}

/**
 * Get a specific tool by name.
 */
export function getToolByName(name: string): AgentTool<any, any> | undefined {
  return TOOL_REGISTRY.find((tool) => tool.name === name);
}

/**
 * Get tool descriptions formatted for LLM tool selection.
 */
export function getToolDescriptions(): string {
  return getAllTools()
    .map((t) => `- ${t.name}: ${t.description}`)
    .join('\n');
}
