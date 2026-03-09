import { Router } from 'express';
import { WorkspaceController } from './workspace.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();
const workspaceController = new WorkspaceController();

// All workspace routes require an authenticated user
router.use(authenticateToken);

router.post('/', workspaceController.create);
router.get('/', workspaceController.getAll);

export default router;
