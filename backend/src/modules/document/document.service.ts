import { prisma } from "../../config/db";
import { SourceType, Status } from "@prisma/client";
import { AppError } from "../../utils/AppError";

/**
 * DocumentService — Business logic for document management.
 *
 * Handles CRUD for document metadata. Actual file storage is managed
 * via the StorageService interface (GridFS/S3). Processing is async
 * via the document processing worker.
 */
export class DocumentService {
  /**
   * Create a new document reference in a workspace.
   * Returns the document with status: QUEUED for background processing.
   */
  public async createDocument(
    workspaceId: string,
    userId: string,
    title: string,
    originalFilename: string,
    mimeType: string,
    fileSizeBytes: number,
    sourceType: SourceType,
    storageUrl: string,
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
        storageUrl,
        status: Status.QUEUED,
      },
    });
  }

  /**
   * Get all documents in a workspace (cursor-based pagination + status filter).
   */
  public async getWorkspaceDocuments(
    workspaceId: string,
    options: { cursor?: string; take?: number; status?: Status } = {},
  ) {
    const { cursor, take = 20, status } = options;

    const documents = await prisma.document.findMany({
      where: {
        workspaceId,
        ...(status && { status }),
      },
      select: {
        id: true,
        title: true,
        originalFilename: true,
        mimeType: true,
        sourceType: true,
        status: true,
        totalChunks: true,
        tokenCount: true,
        fileSizeBytes: true,
        createdAt: true,
        processedAt: true,
        errorMessage: true,
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = documents.length > take;
    const results = hasMore ? documents.slice(0, take) : documents;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return { documents: results, nextCursor, hasMore };
  }

  /**
   * Get a single document by ID.
   */
  public async getDocument(documentId: string) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        _count: {
          select: { chunks: true, structures: true },
        },
      },
    });

    if (!doc) {
      throw AppError.notFound("Document not found.");
    }

    return doc;
  }

  /**
   * Delete document from database (cascade deletes chunks and structures).
   */
  public async deleteDocument(documentId: string) {
    return prisma.document.delete({
      where: { id: documentId },
    });
  }
}
