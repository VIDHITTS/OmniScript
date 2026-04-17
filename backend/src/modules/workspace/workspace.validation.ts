import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100),
  description: z.string().max(500).optional(),
  template: z.enum(["CUSTOM", "RESEARCH", "COURSE", "LEGAL", "MEETING"]).optional().default("CUSTOM"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
  isPublic: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const workspaceIdSchema = z.object({
  id: z.string().uuid("Invalid workspace ID"),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(20),
});

export type CursorPagination = z.infer<typeof cursorPaginationSchema>;
