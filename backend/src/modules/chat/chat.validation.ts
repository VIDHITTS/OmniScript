import { z } from 'zod';

export const createSessionSchema = z.object({
  title: z.string().min(1, 'Session title is required').max(200).default('New Chat'),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required').max(10000),
});

export const sessionIdSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
});

export const messageListSchema = z.object({
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().min(1).max(50).default(20),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageListInput = z.infer<typeof messageListSchema>;
