import { Request, Response, NextFunction } from "express";
import { ChatService } from "./chat.service";
import { AppError } from "../../utils/AppError";

/**
 * ChatController — HTTP layer for chat sessions and AI messages.
 *
 * Supports:
 * - Standard request/response for session CRUD
 * - SSE (Server-Sent Events) streaming for real-time AI responses
 * - Conversation branching at any message point
 */
export class ChatController {
  private chatService: ChatService;

  constructor() {
    this.chatService = new ChatService();
  }

  /**
   * POST /api/workspaces/:workspaceId/chat/sessions
   */
  public createSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) throw AppError.unauthorized();

      const workspaceId = req.params.workspaceId as string;
      const session = await this.chatService.createSession(userId, workspaceId, req.body);

      res.status(201).json({ message: "Chat session created", session });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/workspaces/:workspaceId/chat/sessions
   */
  public getSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) throw AppError.unauthorized();

      const workspaceId = req.params.workspaceId as string;
      const sessions = await this.chatService.getSessions(userId, workspaceId);

      res.status(200).json({ sessions });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/workspaces/:workspaceId/chat/sessions/:sessionId/messages
   */
  public getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = req.params.sessionId as string;
      const cursor = req.query.cursor as string | undefined;
      const take = Number(req.query.take) || 50;

      const result = await this.chatService.getMessages(sessionId, { cursor, take });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/workspaces/:workspaceId/chat/sessions/:sessionId/messages
   * Standard (non-streaming) message send.
   */
  public sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) throw AppError.unauthorized();

      const sessionId = req.params.sessionId as string;
      const { content } = req.body;

      const result = await this.chatService.sendMessage(userId, sessionId, content);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/workspaces/:workspaceId/chat/sessions/:sessionId/stream
   * SSE-based streaming message response.
   */
  public streamMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) throw AppError.unauthorized();

      const sessionId = req.params.sessionId as string;
      const { content } = req.body;

      if (!content) {
        throw AppError.badRequest("Message content is required.");
      }

      // SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      await this.chatService.streamMessage(
        userId,
        sessionId,
        content,
        // onChunk: send each token
        (chunk: string) => {
          res.write(`data: ${JSON.stringify({ type: "token", content: chunk })}\n\n`);
        },
        // onDone: send final metadata
        (message) => {
          res.write(`data: ${JSON.stringify({ type: "done", ...message })}\n\n`);
          res.end();
        },
        // onError: send error and close
        (error: Error) => {
          res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
          res.end();
        },
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/workspaces/:workspaceId/chat/sessions/:sessionId/branch
   * Branch a conversation at a specific message.
   */
  public branchSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) throw AppError.unauthorized();

      const sessionId = req.params.sessionId as string;
      const { messageId } = req.body;

      if (!messageId) {
        throw AppError.badRequest("messageId is required to branch.");
      }

      const newSession = await this.chatService.branchSession(userId, sessionId, messageId);
      res.status(201).json({ message: "Session branched", session: newSession });
    } catch (error) {
      next(error);
    }
  };
}
