import { prisma } from '../../config/db';
import { SourceType } from '@prisma/client';

export class DocumentService {
  /**
   * Create a new document reference in a workspace.
   */
  public async createDocument(
    workspaceId: string,
    userId: string,
    title: string,
    originalFilename: string,
    mimeType: string,
    fileSizeBytes: number,
    sourceType: SourceType,
    storageUrl: string
  ) {
    return prisma.document.create({
      data: {
        workspaceId,
        uploadedById: userId,
        title,
        originalFilename,
        mimeType,
        fileSizeBytes,
        sourceType,
        storageUrl, // GridFS ID
        status: 'QUEUED' // Background worker will pick this up
      },
    });
  }

  /**
   * Get all documents in a workspace
   */
  public async getWorkspaceDocuments(workspaceId: string) {
    return prisma.document.findMany({
      where: {
        workspaceId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }  /**
   * Get single document
   */
  public async getDocument(documentId: string) {
    return prisma.document.findUnique({
      where: { id: documentId },
    });
  }

  /**
   * Delete document
   */
  public async deleteDocument(documentId: string) {
    return prisma.document.delete({
      where: { id: documentId },
    });
  }
}
