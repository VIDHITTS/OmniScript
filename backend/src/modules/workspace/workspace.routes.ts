import { Router } from 'express';
import { WorkspaceController } from './workspace.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

import documentRoutes from '../document/document.routes';

const router = Router();
const workspaceController = new WorkspaceController();

// All workspace routes require an authenticated user
router.use(authenticateToken);

router.post('/', workspaceController.create);
router.get('/', workspaceController.getAll);
router.put('/:id', workspaceController.update);
router.delete('/:id', workspaceController.delete);

// Attach nested document routes under workspaces
router.use('/:workspaceId/documents', documentRoutes);

export default router;
