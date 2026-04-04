import { Request, Response, NextFunction } from 'express';
import { ChatService } from './chat.service';
import {
  createSessionSchema,
  sendMessageSchema,
  sessionIdSchema,
  messageListSchema,
} from './chat.validation';
import { AppError } from '../../utils/AppError';

/**
 * ChatController — HTTP layer for chat sessions and AI responses.
 *
 * Supports both standard JSON responses and SSE streaming.
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
      const input = createSessionSchema.parse(req.body);
      const session = await this.chatService.createSession(userId, workspaceId, input);

      res.status(201).json({ message: 'Chat session created', session });
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
   * GET /api/chat/sessions/:sessionId/messages
   */
  public getMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionIdSchema.parse(req.params);
      const pagination = messageListSchema.parse(req.query);
      const result = await this.chatService.getMessages(sessionId, pagination);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/chat/sessions/:sessionId/messages
   * Standard JSON response (non-streaming).
   */
  public sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) throw AppError.unauthorized();

      const { sessionId } = sessionIdSchema.parse(req.params);
      const { content } = sendMessageSchema.parse(req.body);
      const result = await this.chatService.sendMessage(userId, sessionId, content);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/chat/sessions/:sessionId/messages/stream
   * SSE streaming response.
   */
  public streamMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) throw AppError.unauthorized();

      const { sessionId } = sessionIdSchema.parse(req.params);
      const { content } = sendMessageSchema.parse(req.body);

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      await this.chatService.streamMessage(
        userId,
        sessionId,
        content,
        // onChunk — stream each token to client
        (chunk: string) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        },
        // onDone — signal completion with metadata
        (message) => {
          res.write(`data: ${JSON.stringify({ type: 'done', ...message })}\n\n`);
          res.end();
        },
        // onError — signal error
        (error: Error) => {
          res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
          res.end();
        }
      );
    } catch (error) {
      next(error);
    }
  };
}
