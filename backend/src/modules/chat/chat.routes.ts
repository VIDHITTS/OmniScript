import { Router } from 'express';
import { ChatController } from './chat.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router({ mergeParams: true });
const chatController = new ChatController();

// All chat routes require authentication
router.use(authenticateToken);

// Workspace-scoped session routes (mounted under /api/workspaces/:workspaceId/chat)
router.post('/sessions', chatController.createSession);
router.get('/sessions', chatController.getSessions);

// Session-scoped message routes
router.get('/sessions/:sessionId/messages', chatController.getMessages);
router.post('/sessions/:sessionId/messages', chatController.sendMessage);
router.post('/sessions/:sessionId/messages/stream', chatController.streamMessage);

export default router;
