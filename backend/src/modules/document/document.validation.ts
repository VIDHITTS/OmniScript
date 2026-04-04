import { z } from 'zod';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const uploadDocumentSchema = z.object({
  title: z.string().min(1, 'Document title is required').max(200),
  sourceType: z.enum(['PDF', 'MARKDOWN', 'TEXT', 'YOUTUBE', 'WEB_URL', 'AUDIO', 'IMAGE', 'CODE', 'CSV']),
  url: z.string().url().optional(), // For YOUTUBE and WEB_URL types
});

export const documentIdSchema = z.object({
  docId: z.string().uuid('Invalid document ID'),
});

export const documentListSchema = z.object({
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().min(1).max(50).default(20),
  status: z.enum(['QUEUED', 'PROCESSING', 'CHUNKING', 'EMBEDDING', 'INDEXED', 'FAILED']).optional(),
});

export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE };

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type DocumentListInput = z.infer<typeof documentListSchema>;
