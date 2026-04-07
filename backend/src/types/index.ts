/**
 * Global TypeScript types used across the application.
 * Centralizes shared interfaces so modules don't duplicate definitions.
 */

/**
 * Standard paginated response envelope.
 */
export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

/**
 * Standard API response envelope for single resources.
 */
export interface ApiResponse<T = unknown> {
  message: string;
  data?: T;
  statusCode?: number;
}

/**
 * Standard error response shape.
 */
export interface ApiErrorResponse {
  error: string;
  statusCode: number;
  details?: Array<{ field: string; message: string }>;
}

/**
 * JWT payload decoded from access tokens.
 */
export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Chunk retrieval result used across chat and agent services.
 */
export interface RetrievedChunk {
  id: string;
  content: string;
  contextualizedContent: string | null;
  chunkIndex: number;
  sectionHeading: string | null;
  location: unknown;
  documentId: string;
  documentTitle: string;
  score: number;
  tokenCount?: number;
}

/**
 * Citation attached to AI responses.
 */
export interface Citation {
  index: number;
  chunkId: string;
  documentTitle: string;
  sectionHeading: string | null;
  location: unknown;
  score?: number;
}
