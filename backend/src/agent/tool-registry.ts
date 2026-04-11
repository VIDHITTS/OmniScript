import { AgentTool } from './tool.types';
import { VectorSearchTool } from './tools/vector-search.tool';
import { KeywordSearchTool } from './tools/keyword-search.tool';

// Core entry point to fetch all available reasoning tools for the Agent
export function getAllTools(): AgentTool<any, any>[] {
  const tools = [
    VectorSearchTool,
    KeywordSearchTool,
    // Future tools (PageIndexNavigationTool, HyDESearchTool, etc.) will be added here
  ];

  // Return only enabled tools
  return tools.filter((tool) => (tool.isEnabled ? tool.isEnabled() : true));
}
