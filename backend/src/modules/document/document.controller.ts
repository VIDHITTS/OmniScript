import { Request, Response } from 'express';
import { DocumentService } from './document.service';
import { SourceType } from '@prisma/client';

export class DocumentController {
  private documentService: DocumentService;

  constructor() {
    this.documentService = new DocumentService();
  }

  /**
   * Post /api/workspaces/:workspaceId/documents
   * Stubbed upload logic for phase 1
   */
  public upload = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const workspaceId = req.params.workspaceId as string;

      if (!userId) {
         res.status(401).json({ message: 'Unauthorized' });
         return;
      }

      const { title, originalFilename, mimeType, fileSizeBytes, sourceType } = req.body;

      if (!title || !originalFilename || !sourceType) {
        res.status(400).json({ message: 'Missing required document fields.' });
        return;
      }

      const document = await this.documentService.createDocument(
        workspaceId,
        userId,
        title,
        originalFilename,
        mimeType || 'application/octet-stream',
        fileSizeBytes || 0,
        sourceType as SourceType
      );

      res.status(201).json({ message: 'Document uploaded metadata', document });
    } catch (error: any) {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };

  /**
   * Get /api/workspaces/:workspaceId/documents
   * List all documents in a workspace
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
}
