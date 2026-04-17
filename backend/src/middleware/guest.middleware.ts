import { Request, Response, NextFunction } from "express";
import { guestSessionService } from "../modules/guest/guest.service";
import { GuestIdentifier } from "../modules/guest/guest.types";

/**
 * Extract IP address from request (handles proxies)
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Extract user agent from request
 */
function getUserAgent(req: Request): string {
  return req.headers["user-agent"] || "unknown";
}

/**
 * Middleware to handle guest sessions
 * Attaches guest session to req.guestSession
 */
export const handleGuestSession = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const identifier: GuestIdentifier = {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    };

    // Get session ID from header if provided by client
    const clientSessionId = req.headers["x-guest-session-id"] as string | undefined;

    // Get or create guest session
    const session = guestSessionService.getOrCreateSession(identifier, clientSessionId);
    
    // Attach to request
    req.guestSession = session;

    // Send session ID back to client in response header
    res.setHeader("X-Guest-Session-Id", session.sessionId);

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check if guest can upload document
 */
export const checkGuestDocumentLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const session = req.guestSession;
  if (!session) {
    res.status(400).json({ error: "Guest session not found" });
    return;
  }

  if (!guestSessionService.canUploadDocument(session.sessionId)) {
    res.status(403).json({
      error: "Document upload limit reached",
      message: "Sign up to upload more documents",
      limits: guestSessionService.getRemainingLimits(session.sessionId),
    });
    return;
  }

  next();
};

/**
 * Middleware to check if guest can make query
 */
export const checkGuestQueryLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const session = req.guestSession;
  if (!session) {
    res.status(400).json({ error: "Guest session not found" });
    return;
  }

  if (!guestSessionService.canMakeQuery(session.sessionId)) {
    res.status(403).json({
      error: "Query limit reached",
      message: "Sign up to continue chatting",
      limits: guestSessionService.getRemainingLimits(session.sessionId),
    });
    return;
  }

  next();
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      guestSession?: import("../modules/guest/guest.types").GuestSession;
    }
  }
}
