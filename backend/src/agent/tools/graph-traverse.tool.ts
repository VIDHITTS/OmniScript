import { z } from 'zod';
import { buildTool } from '../tool.types';
import { prisma } from '../../config/db';
import { logger } from '../../utils/logger';

export const GraphTraversalTool = buildTool({
  name: 'graph_traverse',
  description: 'Traverse the knowledge graph to discover multi-hop relationships around a specific entity (person, concept, organization, etc.). Use this when trying to understand how different concepts connect or finding indirect associations that are not obvious in text search.',
  inputSchema: z.object({
    entityName: z.string().describe('The name of the target entity to start traversal from.'),
    maxHops: z.number().min(1).max(2).default(1).describe('The depth of traversal. Use 1 for direct connections, 2 for indirect connections.'),
  }),
  async execute({ entityName, maxHops }, ctx) {
    try {
      // Find starting entities matching the name
      const startingEntities = await prisma.kgEntity.findMany({
        where: { 
          workspaceId: ctx.workspaceId,
          name: { contains: entityName, mode: 'insensitive' }
        },
        take: 3,
        include: {
          sourceEdges: {
            include: {
              targetEntity: true,
              sourceChunk: { select: { content: true } }
            }
          },
          targetEdges: {
            include: {
              sourceEntity: true,
              sourceChunk: { select: { content: true } }
            }
          }
        }
      });

      if (startingEntities.length === 0) {
        return { data: { message: `No entities found matching '${entityName}' in the knowledge graph. Expand your search or try searching raw text using keyword_search.` } };
      }

      // Format output cleanly to send back to the Agent
      const graphResult: any = [];

      for (const entity of startingEntities) {
        const node: any = {
          entity: entity.name,
          type: entity.entityType,
          description: entity.description,
          connections: []
        };

        // Outbound edges (Entity -> Target)
        for (const edge of entity.sourceEdges) {
          node.connections.push({
            direction: 'outbound',
            relationship: edge.relationship,
            target: edge.targetEntity.name,
            targetType: edge.targetEntity.entityType,
            context: edge.sourceChunk?.content?.substring(0, 200) || 'Unknown context'
          });
        }

        // Inbound edges (Source -> Entity)
        for (const edge of entity.targetEdges) {
          node.connections.push({
            direction: 'inbound',
            relationship: edge.relationship,
            source: edge.sourceEntity.name,
            sourceType: edge.sourceEntity.entityType,
            context: edge.sourceChunk?.content?.substring(0, 200) || 'Unknown context'
          });
        }

        graphResult.push(node);
        
        // Hop 2
        if (maxHops && maxHops > 1) {
          node.hop2_connections = [];
          
          for (const edge of entity.sourceEdges) {
             const hop2 = await prisma.kgEntity.findUnique({
                where: { id: edge.targetEntity.id },
                include: { sourceEdges: { include: { targetEntity: true } } }
             });
             
             if (hop2 && hop2.sourceEdges.length > 0) {
               node.hop2_connections.push({
                 from: edge.targetEntity.name,
                 connections: hop2.sourceEdges.map(e => ({ relationship: e.relationship, target: e.targetEntity.name }))
               });
             }
          }
        }
      }

      return {
        data: graphResult,
        metadata: { entitiesProcessed: startingEntities.length }
      };

    } catch (error) {
      logger.error({ entityName, error }, 'Graph traversal failed');
      throw error;
    }
  }
});
