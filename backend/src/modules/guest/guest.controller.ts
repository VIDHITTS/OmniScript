import { Request, Response, NextFunction } from "express";
import { guestSessionService } from "./guest.service";
import { guestDocumentService } from "./guest-document.service";
import { guestChatService } from "./guest-chat.service";
import { GUEST_LIMITS } from "./guest.types";

/**
 * GuestController - HTTP layer for guest user endpoints
 * 
 * Design: Handles guest session info, document upload, and chat
 */
export class GuestController {
  /**
   * GET /api/guest/session
   * Get current guest session info and remaining limits
   */
  public getSession = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const session = req.guestSession;
      if (!session) {
        res.status(400).json({ error: "Guest session not found" });
        return;
      }

      const limits = guestSessionService.getRemainingLimits(session.sessionId);

      res.status(200).json({
        sessionId: session.sessionId,
        limits: {
          maxDocuments: GUEST_LIMITS.maxDocuments,
          maxQueries: GUEST_LIMITS.maxQueries,
          documentsRemaining: limits.documentsRemaining,
          queriesRemaining: limits.queriesRemaining,
          documentsUploaded: session.documentsUploaded,
          queriesUsed: session.queriesUsed,
        },
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/guest/upload
   * Upload document as guest
   */
  public uploadDocument = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const session = req.guestSession;
      if (!session) {
        res.status(400).json({ error: "Guest session not found" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const { title, sourceType } = req.body;

      const result = await guestDocumentService.uploadDocument(
        session.sessionId,
        file,
        title || file.originalname,
        sourceType || "PDF"
      );

      const limits = guestSessionService.getRemainingLimits(session.sessionId);

      res.status(201).json({
        message: "Document uploaded successfully",
        document: result.document,
        workspaceId: result.workspaceId,
        limits,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/guest/chat
   * Send chat message as guest
   */
  public sendMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const session = req.guestSession;
      if (!session) {
        res.status(400).json({ error: "Guest session not found" });
        return;
      }

      const { content, workspaceId, userId } = req.body;

      if (!content || !workspaceId || !userId) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const result = await guestChatService.sendMessage(
        session.sessionId,
        workspaceId,
        userId,
        content
      );

      const limits = guestSessionService.getRemainingLimits(session.sessionId);

      res.status(200).json({
        userMessage: result.userMessage,
        aiMessage: result.aiMessage,
        chatSession: result.chatSession,
        limits,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/guest/messages/:chatSessionId
   * Get chat messages for guest
   */
  public getMessages = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const session = req.guestSession;
      if (!session) {
        res.status(400).json({ error: "Guest session not found" });
        return;
      }

      const { chatSessionId } = req.params;

      const messages = await guestChatService.getMessages(
        session.sessionId,
        chatSessionId
      );

      res.status(200).json({ messages });
    } catch (error) {
      next(error);
    }
  };
}
