import { Request, Response } from 'express';
import { DocumentService } from './document.service';
import { SourceType } from '@prisma/client';
import { gridFsStorage } from '../../lib/storage/GridFsStorageService';
import streamifier from 'streamifier';

export class DocumentController {
  private documentService: DocumentService;

  constructor() {
    this.documentService = new DocumentService();
  }

  /**
   * Post /api/workspaces/:workspaceId/documents
   * Real upload logic streaming to MongoDB GridFS
   */
  public upload = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const workspaceId = req.params.workspaceId as string;

      if (!userId) {
         res.status(401).json({ message: 'Unauthorized' });
         return;
      }

      const { file } = req;
      const { title, sourceType } = req.body;

      if (!title || !sourceType) {
        res.status(400).json({ message: 'Missing title or sourceType.' });
        return;
      }

      if (!file && sourceType !== 'WEB_URL' && sourceType !== 'YOUTUBE') {
        res.status(400).json({ message: 'Missing file upload.' });
        return;
      }

      let storageUrl = '';
      let mimeType = 'application/octet-stream';
      let fileSizeBytes = 0;
      let originalFilename = 'external-source';

      // 1) If it's a file, Stream raw buffer to GridFS
      if (file) {
        const docStream = streamifier.createReadStream(file.buffer);

        storageUrl = await gridFsStorage.upload(docStream, {
          filename: file.originalname,
          contentType: file.mimetype,
          size: file.size
        });

        mimeType = file.mimetype;
        fileSizeBytes = file.size;
        originalFilename = file.originalname;
      } else {
        // If it's a URL or YouTube link, use the URL itself as the "storageUrl" placeholder
        // Background workers will scrape and save text output
        storageUrl = req.body.url || 'pending_creation';
      }

      // 2) Save metadata to Postgres Db
      const document = await this.documentService.createDocument(
        workspaceId,
        userId,
        title,
        originalFilename,
        mimeType,
        fileSizeBytes,
        sourceType as SourceType,
        storageUrl 
      );

      res.status(201).json({ message: 'Document uploaded and queued for processing', document });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };

  /**
   * Get /api/workspaces/:workspaceId/documents
   */
  public list = async (req: Request, res: Response): Promise<void> => {
    try {
      const workspaceId = req.params.workspaceId as string;
      const documents = await this.documentService.getWorkspaceDocuments(workspaceId);
      res.status(200).json({ documents });
    } catch (error: any) {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };

  /**
   * Get /api/workspaces/:workspaceId/documents/:docId
   */
  public getOne = async (req: Request, res: Response): Promise<void> => {
    try {
      const docId = req.params.docId as string;
      const document = await this.documentService.getDocument(docId);

      if (!document) {
        res.status(404).json({ message: 'Document not found' });
        return;
      }
      res.status(200).json({ document });
    } catch (error: any) {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };

  /**
   * Get /api/workspaces/:workspaceId/documents/:docId/download
   * Streams the actual file from GridFS directly back to the client!
   */
  public download = async (req: Request, res: Response): Promise<void> => {
    try {
      const docId = req.params.docId as string;
      const document = await this.documentService.getDocument(docId);

      if (!document || !document.storageUrl) {
         res.status(404).json({ message: 'Document file not found' });
         return;
      }

      // Ensure storage URL is actually a GridFS id hash (and not a naive youtube link)
      if (document.sourceType === 'WEB_URL' || document.sourceType === 'YOUTUBE') {
         res.status(400).json({ message: 'External sources do not have downloadable files.' });
         return;
      }

      res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalFilename}"`);

      const downloadStream = await gridFsStorage.download(document.storageUrl);
      downloadStream.pipe(res);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ message: 'Failed to download file', error: error.message });
    }
  };

  /**
   * Delete /api/workspaces/:workspaceId/documents/:docId
   * Completely removes Postgres row + raw GridFS binary chunk from DB
   */
  public delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const docId = req.params.docId as string;
      
      const doc = await this.documentService.getDocument(docId);
      if (!doc) {
         res.status(404).json({ message: 'Document not found' });
         return;
      }

      // Delete from storage first!
      if (doc.storageUrl && doc.sourceType !== 'WEB_URL' && doc.sourceType !== 'YOUTUBE') {
        try {
          await gridFsStorage.delete(doc.storageUrl);
        } catch (e) {
          console.warn(`GridFS binary missing or could not be deleted for docId: ${docId}`);
        }
      }

      // Delete cascade relations from DB
      await this.documentService.deleteDocument(docId);

      res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };
}
