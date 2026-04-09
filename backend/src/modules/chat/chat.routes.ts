import { Router } from "express";
import { ChatController } from "./chat.controller";
import { validate } from "../../middleware/validate.middleware";
import { createSessionSchema, sendMessageSchema, branchSessionSchema } from "./chat.validation";

/**
 * Chat routes — mounted under /api/workspaces/:workspaceId/chat
 * Authentication and workspace access are handled by parent router.
 */
const router = Router({ mergeParams: true });
const chatController = new ChatController();

// Session CRUD
router.post("/sessions", validate(createSessionSchema), chatController.createSession);
router.get("/sessions", chatController.getSessions);

// Message operations
router.get("/sessions/:sessionId/messages", chatController.getMessages);
router.post("/sessions/:sessionId/messages", validate(sendMessageSchema), chatController.sendMessage);
router.post("/sessions/:sessionId/stream", chatController.streamMessage);

// Conversation branching
router.post("/sessions/:sessionId/branch", validate(branchSessionSchema), chatController.branchSession);

export default router;
