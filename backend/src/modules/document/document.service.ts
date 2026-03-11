import { prisma } from '../../config/db';
import { SourceType } from '@prisma/client';

export class DocumentService {
  /**
   * Create a new document reference in a workspace.
   */
  public async createDocument(workspaceId: string, userId: string, title: string, originalFilename: string, mimeType: string, fileSizeBytes: number, sourceType: SourceType) {
    const document = await prisma.document.create({
      data: {
        workspaceId,
        uploadedById: userId,
        title,
        originalFilename,
        mimeType,
        fileSizeBytes,
        sourceType,
      },
    });
    return document;
  }

  /**
   * Get all documents in a workspace
   */
  public async getWorkspaceDocuments(workspaceId: string) {
    const documents = await prisma.document.findMany({
      where: {
        workspaceId,
      },
      orderBy: { createdAt: 'desc' },
    });
    return documents;
  }
}
