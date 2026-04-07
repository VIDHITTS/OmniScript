import { z } from 'zod';

export interface AgentContext {
  workspaceId: string;
  userId: string;
  // We can add additional context as needed (e.g. sessionId)
}

export type ToolResult<T> = {
  data: T;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  execute(input: TInput, context: AgentContext): Promise<ToolResult<TOutput>>;
  isEnabled?(): boolean;
}

export type ToolDef<TInput, TOutput> = Omit<AgentTool<TInput, TOutput>, 'isEnabled'> & {
  isEnabled?: () => boolean;
};

export function buildTool<TInput, TOutput>(
  def: ToolDef<TInput, TOutput>
): AgentTool<TInput, TOutput> {
  return {
    isEnabled: () => true,
    ...def,
  };
}
