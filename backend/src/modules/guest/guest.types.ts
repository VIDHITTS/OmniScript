export interface GuestSession {
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  documentsUploaded: number;
  queriesUsed: number;
  documentId?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface GuestLimits {
  maxDocuments: number;
  maxQueries: number;
  sessionDurationMs: number;
}

export const GUEST_LIMITS: GuestLimits = {
  maxDocuments: 1,
  maxQueries: 2,
  sessionDurationMs: 24 * 60 * 60 * 1000, // 24 hours
};

export interface GuestIdentifier {
  ipAddress: string;
  userAgent: string;
}
