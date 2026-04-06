import { prisma } from "../../config/db";
import { WorkspaceRole } from "@prisma/client";

export class WorkspaceService {
  /**
   * Create a new workspace and assign the creator as the OWNER.
   */
  public async createWorkspace(
    userId: string,
    name: string,
    description?: string,
    template: any = "CUSTOM",
  ) {
    const newWorkspace = await prisma.workspace.create({
      data: {
        name,
        description,
        ownerId: userId,
        template,
        members: {
          create: {
            userId: userId,
            role: WorkspaceRole.OWNER,
          },
        },
      },
      include: {
        members: true,
      },
    });

    return newWorkspace;
  }

  /**
   * Get all workspaces the user has access to.
   */
  public async getUserWorkspaces(userId: string) {
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: userId,
          },
        },
      },
      include: {
        owner: {
          select: { fullName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return workspaces;
  }

  /**
   * Update an existing workspace
   */
  public async updateWorkspace(
    workspaceId: string,
    name: string,
    description?: string,
  ) {
    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name, description },
    });
    return updated;
  }

  /**
   * Delete an existing workspace
   */
  public async deleteWorkspace(workspaceId: string) {
    await prisma.workspace.delete({
      where: { id: workspaceId },
    });
  }
}
