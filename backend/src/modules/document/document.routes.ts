import { Router } from 'express';
import { DocumentController } from './document.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

// We map this router to /api/workspaces/:workspaceId/documents
const router = Router({ mergeParams: true });
const documentController = new DocumentController();

router.use(authenticateToken);

router.post('/', documentController.upload);
router.get('/', documentController.list);

export default router;
