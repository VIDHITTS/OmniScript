import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { EntityType } from '@prisma/client';

export class WorkspaceKgController {
  /**
   * GET /api/workspaces/:workspaceId/knowledge-graph
   * 
   * Fetches the knowledge graph nodes and edges for rendering in a 
   * force-directed visualizer (like D3 or Cytoscape).
   * 
   * Query Params:
   *  - entityType: Filter by a specific EntityType (e.g. PERSON, CONCEPT)
   */
  public getKnowledgeGraph = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.params.workspaceId;
      const entityType = req.query.entityType as string;

      const whereClause: any = { workspaceId };
      if (entityType && Object.keys(EntityType).includes(entityType)) {
        whereClause.entityType = entityType;
      }

      // Fetch top 100 entities to avoid overwhelming the frontend UI
      const entities = await prisma.kgEntity.findMany({
        where: whereClause,
        orderBy: { mentionCount: 'desc' },
        take: 100,
        select: {
          id: true,
          name: true,
          entityType: true,
          mentionCount: true,
        }
      });

      const entityIds = entities.map(e => e.id);

      // Fetch edges that exclusively connect the entities we fetched
      const edges = await prisma.kgEdge.findMany({
        where: {
          sourceEntityId: { in: entityIds },
          targetEntityId: { in: entityIds }
        },
        select: {
          sourceEntityId: true,
          targetEntityId: true,
          relationship: true,
          confidence: true,
        }
      });

      res.status(200).json({
        nodes: entities.map(e => ({
          id: e.id,
          label: e.name,
          group: e.entityType,
          value: e.mentionCount
        })),
        links: edges.map(e => ({
          source: e.sourceEntityId,
          target: e.targetEntityId,
          label: e.relationship,
          weight: e.confidence
        }))
      });
    } catch (error) {
      next(error);
    }
  }
}

export const workspaceKgController = new WorkspaceKgController();
