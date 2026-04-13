import { prisma } from "../../config/db";
import { guestSessionService } from "./guest.service";
import { AppError } from "../../utils/AppError";

/**
 * GuestChatService - Handles chat operations for guest users
 * 
 * Design: Creates temporary chat sessions for guest document queries
 */
export class GuestChatService {
  /**
   * Create or get guest chat session
   */
  public async getOrCreateChatSession(sessionId: string, workspaceId: string, userId: string) {
    // Find existing chat session for this guest
    let chatSession = await prisma.chatSession.findFirst({
      where: {
        workspaceId,
        userId,
        title: `Guest Session ${sessionId}`,
      },
    });

    if (!chatSession) {
      chatSession = await prisma.chatSession.create({
        data: {
          title: `Guest Session ${sessionId}`,
          workspaceId,
          userId,
        },
      });
    }

    return chatSession;
  }

  /**
   * Send message as guest
   */
  public async sendMessage(
    sessionId: string,
    workspaceId: string,
    userId: string,
    content: string
  ) {
    // Check if guest can make query
    if (!guestSessionService.canMakeQuery(sessionId)) {
      throw new AppError(403, "Query limit reached. Sign up to continue chatting.");
    }

    // Get or create chat session
    const chatSession = await this.getOrCreateChatSession(sessionId, workspaceId, userId);

    // Create user message
    const userMessage = await prisma.message.create({
      data: {
        sessionId: chatSession.id,
        userId,
        role: "USER",
        content,
      },
    });

    // Record query in guest session
    guestSessionService.recordQuery(sessionId);

    // Create AI response (simplified for now)
    const aiMessage = await prisma.message.create({
      data: {
        sessionId: chatSession.id,
        role: "ASSISTANT",
        content: `This is a demo response. Your query: "${content}". Sign up to get full AI-powered responses with document retrieval.`,
      },
    });

    return {
      userMessage,
      aiMessage,
      chatSession,
    };
  }

  /**
   * Get chat messages for guest
   */
  public async getMessages(sessionId: string, chatSessionId: string) {
    const messages = await prisma.message.findMany({
      where: { sessionId: chatSessionId },
      orderBy: { createdAt: "asc" },
    });

    return messages;
  }
}

export const guestChatService = new GuestChatService();
