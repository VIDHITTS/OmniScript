import { prisma } from "../../config/db";
import { WorkspaceRole } from "@prisma/client";
import { AppError } from "../../utils/AppError";
import { CreateWorkspaceInput, UpdateWorkspaceInput, CursorPagination } from "./workspace.validation";

/**
 * WorkspaceService — Business logic for workspace management.
 *
 * All workspace queries are scoped to the authenticated user's memberships.
 * Never exposes another user's workspace data.
 */
export class WorkspaceService {
  /**
   * Create a new workspace and assign the creator as OWNER.
   * Atomically creates both the workspace and the membership row.
   */
  public async createWorkspace(userId: string, input: CreateWorkspaceInput) {
    const newWorkspace = await prisma.workspace.create({
      data: {
        name: input.name,
        description: input.description,
        ownerId: userId,
        template: input.template as any,
        members: {
          create: {
            userId,
            role: WorkspaceRole.OWNER,
          },
        },
      },
      include: {
        members: {
          select: { userId: true, role: true, joinedAt: true },
        },
      },
    });

    return newWorkspace;
  }

  /**
   * Get all workspaces the user has access to (with cursor pagination).
   */
  public async getUserWorkspaces(userId: string, pagination: CursorPagination) {
    const { cursor, take } = pagination;

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        owner: {
          select: { fullName: true, email: true },
        },
        _count: {
          select: {
            members: true,
            documents: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = workspaces.length > take;
    const results = hasMore ? workspaces.slice(0, take) : workspaces;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return { workspaces: results, nextCursor, hasMore };
  }

  /**
   * Get a single workspace by ID with aggregate counts.
   * Throws if workspace doesn't exist.
   */
  public async getWorkspaceById(workspaceId: string) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: { fullName: true, email: true },
        },
        _count: {
          select: {
            members: true,
            documents: true,
            chatSessions: true,
          },
        },
      },
    });

    if (!workspace) {
      throw AppError.notFound("Workspace not found.");
    }

    return workspace;
  }

  /**
   * Update workspace properties.
   * Only name, description, icon, isPublic, and settings can be updated.
   */
  public async updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput) {
    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
        ...(input.settings !== undefined && { settings: JSON.parse(JSON.stringify(input.settings)) }),
      },
    });
    return updated;
  }

  /**
   * Delete a workspace (cascade deletes all children via Prisma relations).
   * Only the workspace OWNER should be permitted to delete.
   */
  public async deleteWorkspace(workspaceId: string, userId: string) {
    // Verify ownership
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) {
      throw AppError.notFound("Workspace not found.");
    }

    if (workspace.ownerId !== userId) {
      throw AppError.forbidden("Only the workspace owner can delete it.");
    }

    await prisma.workspace.delete({
      where: { id: workspaceId },
    });
  }
}
