import { Router } from "express";
import { DocumentController } from "./document.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import multer from "multer";

// For phase 1, we use memory storage (keep file in buffer, stream directly to GridFS)
const uploadMiddleware = multer({ storage: multer.memoryStorage() });

// We map this router to /api/workspaces/:workspaceId/documents
const router = Router({ mergeParams: true });
const documentController = new DocumentController();

router.use(authenticateToken);

// Accept file upload for multiple formats
router.post("/", uploadMiddleware.single("file"), documentController.upload);
router.get("/", documentController.list);
router.get("/:docId", documentController.getOne);
router.delete("/:docId", documentController.delete);
router.get("/:docId/download", documentController.download); // New endpoint to download from GridFS

export default router;
