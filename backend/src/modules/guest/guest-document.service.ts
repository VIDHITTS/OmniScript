import { prisma } from "../../config/db";
import { guestSessionService } from "./guest.service";
import { AppError } from "../../utils/AppError";

/**
 * GuestDocumentService - Handles document operations for guest users
 * 
 * Design: Creates temporary documents without workspace association
 * Documents are stored with a special "guest" marker for cleanup
 */
export class GuestDocumentService {
  /**
   * Upload document for guest user
   * Creates a temporary document without workspace
   */
  public async uploadDocument(
    sessionId: string,
    file: Express.Multer.File,
    title: string,
    sourceType: string
  ) {
    try {
      // Check if guest can upload
      if (!guestSessionService.canUploadDocument(sessionId)) {
        throw new AppError(403, "Document upload limit reached. Sign up to upload more.");
      }

      // Create a temporary "guest" user if not exists
      let guestUser = await prisma.user.findUnique({
        where: { email: "guest@omniscript.temp" },
      });

      if (!guestUser) {
        guestUser = await prisma.user.create({
          data: {
            email: "guest@omniscript.temp",
            fullName: "Guest User",
            passwordHash: null,
          },
        });
      }

      // Create a temporary workspace for guest
      let guestWorkspace = await prisma.workspace.findFirst({
        where: {
          ownerId: guestUser.id,
          name: `Guest Session ${sessionId}`,
        },
      });

      if (!guestWorkspace) {
        guestWorkspace = await prisma.workspace.create({
          data: {
            name: `Guest Session ${sessionId}`,
            description: "Temporary workspace for guest user",
            ownerId: guestUser.id,
            template: "CUSTOM",
          },
        });
      }

      // Create document
      const document = await prisma.document.create({
        data: {
          title,
          originalFilename: file.originalname,
          workspaceId: guestWorkspace.id,
          uploadedById: guestUser.id,
          sourceType: sourceType as any,
          status: "QUEUED",
          mimeType: file.mimetype,
          fileSizeBytes: BigInt(file.size),
          storageUrl: file.filename, // Use filename instead of path
        },
      });

      // Record upload in guest session
      guestSessionService.recordDocumentUpload(sessionId, document.id);

      return {
        document,
        workspaceId: guestWorkspace.id,
      };
    } catch (error) {
      console.error("Guest document upload error:", error);
      throw error;
    }
  }

  /**
   * Get guest document
   */
  public async getDocument(sessionId: string, documentId: string) {
    const session = guestSessionService.getSession(sessionId);
    if (!session || session.documentId !== documentId) {
      throw new AppError(403, "Access denied to this document");
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new AppError(404, "Document not found");
    }

    return document;
  }
}

export const guestDocumentService = new GuestDocumentService();
