import { Router } from "express";
import { WorkspaceController } from "./workspace.controller";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { requireWorkspaceAccess, requireWorkspaceRole } from "../../middleware/workspace.middleware";
import { createWorkspaceSchema, updateWorkspaceSchema, workspaceIdSchema } from "./workspace.validation";
import { WorkspaceRole } from "@prisma/client";

import documentRoutes from "../document/document.routes";
import chatRoutes from "../chat/chat.routes";

const router = Router();
const workspaceController = new WorkspaceController();

// All workspace routes require authentication
router.use(authenticateToken);

// Workspace CRUD
router.post("/", validate(createWorkspaceSchema), workspaceController.create);
router.get("/", workspaceController.getAll);

// Single workspace routes — require membership access
router.get("/:id", validate(workspaceIdSchema, "params"), requireWorkspaceAccess(), workspaceController.getOne);
router.patch("/:id", validate(workspaceIdSchema, "params"), requireWorkspaceAccess(), requireWorkspaceRole(WorkspaceRole.EDITOR), validate(updateWorkspaceSchema), workspaceController.update);
router.delete("/:id", validate(workspaceIdSchema, "params"), requireWorkspaceAccess(), requireWorkspaceRole(WorkspaceRole.OWNER), workspaceController.delete);

// Nested resource routes
router.use("/:workspaceId/documents", requireWorkspaceAccess(), documentRoutes);
router.use("/:workspaceId/chat", requireWorkspaceAccess(), chatRoutes);

export default router;
