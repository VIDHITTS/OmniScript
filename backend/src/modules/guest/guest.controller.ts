import { Request, Response, NextFunction } from "express";
import { guestSessionService } from "./guest.service";
import { GUEST_LIMITS } from "./guest.types";

/**
 * GuestController - HTTP layer for guest user endpoints
 * 
 * Design: Handles guest session info and limits
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
}
