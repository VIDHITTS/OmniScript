import { z } from "zod";

export const createSessionSchema = z.object({
  title: z.string().min(1, "Session title is required").max(200),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message content is required").max(10000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const branchSessionSchema = z.object({
  messageId: z.string().uuid("Valid message ID is required"),
});

export type BranchSessionInput = z.infer<typeof branchSessionSchema>;

export const messageListSchema = z.object({
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
});

export type MessageListInput = z.infer<typeof messageListSchema>;
