import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100),
  description: z.string().max(500).optional(),
  template: z.enum(['CUSTOM', 'RESEARCH', 'COURSE', 'LEGAL', 'MEETING']).default('CUSTOM'),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  isPublic: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const workspaceIdSchema = z.object({
  id: z.string().uuid('Invalid workspace ID'),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().min(1).max(50).default(20),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;
