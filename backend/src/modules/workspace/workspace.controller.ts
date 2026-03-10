import { Request, Response } from 'express';
import { WorkspaceService } from './workspace.service';

export class WorkspaceController {
  private workspaceService: WorkspaceService;

  constructor() {
    this.workspaceService = new WorkspaceService();
  }

  /**
   * Post /api/workspaces
   * Create a new workspace.
   */
  public create = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const { name, description, template } = req.body;

      if (!name) {
        res.status(400).json({ message: 'Workspace name is required.' });
        return;
      }

      const workspace = await this.workspaceService.createWorkspace(userId, name, description, template);

      res.status(201).json({
        message: 'Workspace created successfully',
        workspace,
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };

  /**
   * Get /api/workspaces
   * Get all workspaces for the authenticated user.
   */
  public getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const workspaces = await this.workspaceService.getUserWorkspaces(userId);

      res.status(200).json({
        workspaces,
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };

  /**
   * Put /api/workspaces/:id
   * Update a workspace.
   */
  public update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { name, description } = req.body;

      if (!name) {
        res.status(400).json({ message: 'Workspace name is required.' });
        return;
      }

      const updatedWorkspace = await this.workspaceService.updateWorkspace(id, name, description);
      res.status(200).json({ message: 'Workspace updated', workspace: updatedWorkspace });
    } catch (error: any) {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };

  /**
   * Delete /api/workspaces/:id
   * Delete a workspace.
   */
  public delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;

      await this.workspaceService.deleteWorkspace(id);
      res.status(200).json({ message: 'Workspace deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  };
}
