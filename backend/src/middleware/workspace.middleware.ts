import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/db";
import { AppError } from "../utils/AppError";
import { WorkspaceRole } from "@prisma/client";

/**
 * Role hierarchy for comparison.
 * Higher index = more permissions.
 */
const ROLE_HIERARCHY: WorkspaceRole[] = [
  WorkspaceRole.VIEWER,
  WorkspaceRole.COMMENTER,
  WorkspaceRole.EDITOR,
  WorkspaceRole.OWNER,
];

/**
 * Extend Request to carry workspace membership info after middleware runs.
 */
declare global {
  namespace Express {
    interface Request {
      workspaceMember?: {
        workspaceId: string;
        role: WorkspaceRole;
      };
    }
  }
}

/**
 * requireWorkspaceAccess() — Verifies the authenticated user is a member
 * of the workspace specified by :workspaceId or :id in the route params.
 *
 * Attaches req.workspaceMember with { workspaceId, role } for downstream use.
 *
 * Must be used AFTER authenticateToken middleware.
 */
export function requireWorkspaceAccess() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw AppError.unauthorized("Authentication required.");
      }

      const workspaceId = (req.params.workspaceId || req.params.id) as string;
      if (!workspaceId) {
        throw AppError.badRequest("Workspace ID is required.");
      }

      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId },
        select: { role: true, workspaceId: true },
      });

      if (!member) {
        throw AppError.forbidden("You do not have access to this workspace.");
      }

      req.workspaceMember = {
        workspaceId: member.workspaceId,
        role: member.role,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * requireWorkspaceRole() — Verifies the user has at least the specified role
 * in the current workspace.
 *
 * Must be used AFTER requireWorkspaceAccess().
 *
 * @param minRole - Minimum role required (e.g., WorkspaceRole.EDITOR)
 */
export function requireWorkspaceRole(minRole: WorkspaceRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const member = req.workspaceMember;
    if (!member) {
      next(AppError.internal("Workspace access middleware must run first."));
      return;
    }

    const userRoleIndex = ROLE_HIERARCHY.indexOf(member.role);
    const minRoleIndex = ROLE_HIERARCHY.indexOf(minRole);

    if (userRoleIndex < minRoleIndex) {
      next(
        AppError.forbidden(
          `This action requires at least ${minRole} role. You have ${member.role}.`
        )
      );
      return;
    }

    next();
  };
}
