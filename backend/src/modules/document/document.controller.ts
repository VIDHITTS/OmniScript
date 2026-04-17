import { Request, Response, NextFunction } from "express";
import { DocumentService } from "./document.service";
import { SourceType, Status } from "@prisma/client";
import { gridFsStorage } from "../../lib/storage/GridFsStorageService";
import { enqueueDocumentProcessing } from "../../workers/documentProcessor";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import streamifier from "streamifier";

/**
 * DocumentController — HTTP layer for document management.
 *
 * Design: Upload → store file in GridFS → save metadata in Postgres
 * → enqueue for background processing → return immediately with status: QUEUED.
 */
export class DocumentController {
  private documentService: DocumentService;

  constructor() {
    this.documentService = new DocumentService();
  }

  /**
   * POST /api/workspaces/:workspaceId/documents
   * Upload a file, store in GridFS, save metadata, trigger async processing.
   */
  public upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const workspaceId = req.params.workspaceId as string;

      if (!userId) throw AppError.unauthorized();

      const { file } = req;
      const { title, sourceType, url } = req.body;

      if (!title || !sourceType) {
        throw AppError.badRequest("Missing title or sourceType.");
      }

      if (!file && sourceType !== "WEB_URL" && sourceType !== "YOUTUBE") {
        throw AppError.badRequest("File upload required for this source type.");
      }

      let storageUrl = "";
      let mimeType = "application/octet-stream";
      let fileSizeBytes = 0;
      let originalFilename = "external-source";

      // Stream file buffer to GridFS for file-based sources
      if (file) {
        const docStream = streamifier.createReadStream(file.buffer);

        storageUrl = await gridFsStorage.upload(docStream, {
          filename: file.originalname,
          contentType: file.mimetype,
          size: file.size,
        });

        mimeType = file.mimetype;
        fileSizeBytes = file.size;
        originalFilename = file.originalname;
      } else {
        // URL-based sources store the URL; workers will fetch content
        storageUrl = url || "pending_creation";
      }

      // Save metadata to Postgres
      const document = await this.documentService.createDocument(
        workspaceId,
        userId,
        title,
        originalFilename,
        mimeType,
        fileSizeBytes,
        sourceType as SourceType,
        storageUrl,
      );

      // Trigger async background processing
      enqueueDocumentProcessing(document.id);

      logger.info(
        { documentId: document.id, workspaceId, sourceType },
        "Document uploaded and queued for processing",
      );

      res.status(201).json({
        message: "Document uploaded and queued for processing",
        document: {
          ...document,
          fileSizeBytes: document.fileSizeBytes !== null && document.fileSizeBytes !== undefined
            ? Number(document.fileSizeBytes)
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/workspaces/:workspaceId/documents
   */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workspaceId = req.params.workspaceId as string;
      const cursor = req.query.cursor as string | undefined;
      const take = Number(req.query.take) || 20;
      const status = req.query.status as Status | undefined;

      const result = await this.documentService.getWorkspaceDocuments(
        workspaceId,
        { cursor, take, status },
      );

      // Convert BigInt fields to numbers for JSON serialization
      const serializedResult = {
        ...result,
        documents: result.documents.map(doc => ({
          ...doc,
          fileSizeBytes: Number(doc.fileSizeBytes),
          tokenCount: doc.tokenCount ? Number(doc.tokenCount) : 0,
          totalChunks: doc.totalChunks ? Number(doc.totalChunks) : 0,
        })),
      };

      res.status(200).json(serializedResult);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/workspaces/:workspaceId/documents/:docId
   */
  public getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const document = await this.documentService.getDocument(req.params.docId as string);
      // Convert BigInt fields to numbers for JSON serialization
      const serializedDoc = {
        ...document,
        fileSizeBytes: Number(document.fileSizeBytes),
        tokenCount: document.tokenCount ? Number(document.tokenCount) : 0,
        totalChunks: document.totalChunks ? Number(document.totalChunks) : 0,
      };
      res.status(200).json({ document: serializedDoc });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/workspaces/:workspaceId/documents/:docId/download
   * Streams the actual file from GridFS back to the client.
   */
  public download = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const document = await this.documentService.getDocument(req.params.docId as string);

      if (!document.storageUrl) {
        throw AppError.notFound("Document file not found.");
      }

      // External sources don't have downloadable files
      if (document.sourceType === "WEB_URL" || document.sourceType === "YOUTUBE") {
        throw AppError.badRequest("External sources do not have downloadable files.");
      }

      res.setHeader(
        "Content-Type",
        document.mimeType || "application/octet-stream",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${document.originalFilename}"`,
      );

      const downloadStream = await gridFsStorage.download(document.storageUrl);
      downloadStream.pipe(res);
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/workspaces/:workspaceId/documents/:docId
   * Removes both the GridFS binary and the Postgres metadata.
   */
  public delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doc = await this.documentService.getDocument(req.params.docId as string);

      // Delete from storage first
      if (
        doc.storageUrl &&
        doc.sourceType !== "WEB_URL" &&
        doc.sourceType !== "YOUTUBE"
      ) {
        try {
          await gridFsStorage.delete(doc.storageUrl);
        } catch (e) {
          logger.warn(
            { documentId: doc.id, err: e },
            "GridFS binary could not be deleted (may already be removed)",
          );
        }
      }

      // Delete from database (cascade deletes chunks + structures)
      await this.documentService.deleteDocument(doc.id);

      res.status(200).json({ message: "Document deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}
