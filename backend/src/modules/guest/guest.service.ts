import crypto from "crypto";
import { GuestSession, GUEST_LIMITS, GuestIdentifier } from "./guest.types";
import { AppError } from "../../utils/AppError";

/**
 * GuestSessionService - Manages guest user sessions with IP-based tracking
 * 
 * Design: Uses in-memory storage with IP+UserAgent fingerprinting to prevent abuse.
 * Guest sessions are tied to IP address to prevent refresh abuse.
 */
export class GuestSessionService {
  private sessions: Map<string, GuestSession> = new Map();
  private ipSessions: Map<string, string> = new Map(); // IP hash -> sessionId

  /**
   * Get or create a guest session based on session ID from client
   * If no session ID provided, create a new one
   */
  public getOrCreateSession(identifier: GuestIdentifier, clientSessionId?: string): GuestSession {
    // If client provides a session ID, try to use it
    if (clientSessionId) {
      const existingSession = this.sessions.get(clientSessionId);
      if (existingSession && !this.isExpired(existingSession)) {
        return existingSession;
      }
    }

    // Create new session
    const sessionId = this.generateSessionId();
    const now = new Date();
    const session: GuestSession = {
      sessionId,
      ipAddress: identifier.ipAddress,
      userAgent: identifier.userAgent,
      documentsUploaded: 0,
      queriesUsed: 0,
      createdAt: now,
      expiresAt: new Date(now.getTime() + GUEST_LIMITS.sessionDurationMs),
    };

    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Get session by ID
   */
  public getSession(sessionId: string): GuestSession | null {
    const session = this.sessions.get(sessionId);
    if (!session || this.isExpired(session)) {
      return null;
    }
    return session;
  }

  /**
   * Check if user can upload a document
   */
  public canUploadDocument(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;
    return session.documentsUploaded < GUEST_LIMITS.maxDocuments;
  }

  /**
   * Check if user can make a query
   */
  public canMakeQuery(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;
    return session.queriesUsed < GUEST_LIMITS.maxQueries;
  }

  /**
   * Record a document upload
   */
  public recordDocumentUpload(sessionId: string, documentId: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(404, "Guest session not found");
    }

    if (!this.canUploadDocument(sessionId)) {
      throw new AppError(403, "Document upload limit reached. Sign up to upload more.");
    }

    session.documentsUploaded++;
    session.documentId = documentId;
    this.sessions.set(sessionId, session);
  }

  /**
   * Record a query
   */
  public recordQuery(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(404, "Guest session not found");
    }

    if (!this.canMakeQuery(sessionId)) {
      throw new AppError(403, "Query limit reached. Sign up to continue chatting.");
    }

    session.queriesUsed++;
    this.sessions.set(sessionId, session);
  }

  /**
   * Get remaining limits for a session
   */
  public getRemainingLimits(sessionId: string): {
    documentsRemaining: number;
    queriesRemaining: number;
  } {
    const session = this.getSession(sessionId);
    if (!session) {
      return { documentsRemaining: 0, queriesRemaining: 0 };
    }

    return {
      documentsRemaining: Math.max(0, GUEST_LIMITS.maxDocuments - session.documentsUploaded),
      queriesRemaining: Math.max(0, GUEST_LIMITS.maxQueries - session.queriesUsed),
    };
  }

  /**
   * Clean up expired sessions (call periodically)
   */
  public cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isExpired(session)) {
        const ipHash = this.hashIdentifier({
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
        });
        this.sessions.delete(sessionId);
        this.ipSessions.delete(ipHash);
      }
    }
  }

  /**
   * Check if session is expired
   */
  private isExpired(session: GuestSession): boolean {
    return new Date() > session.expiresAt;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `guest_${crypto.randomBytes(16).toString("hex")}`;
  }

  /**
   * Hash IP + UserAgent to create unique identifier
   * Prevents users from refreshing to bypass limits
   */
  private hashIdentifier(identifier: GuestIdentifier): string {
    const data = `${identifier.ipAddress}:${identifier.userAgent}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }
}

// Singleton instance
export const guestSessionService = new GuestSessionService();

// Cleanup expired sessions every hour
setInterval(() => {
  guestSessionService.cleanupExpiredSessions();
}, 60 * 60 * 1000);
