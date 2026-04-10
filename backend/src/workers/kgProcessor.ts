import { prisma } from '../config/db';
import { groq } from '../lib/groq';
import { logger } from '../utils/logger';
import { EntityType } from '@prisma/client';

export const kgProcessingQueue: string[] = [];
let isProcessingKg = false;

export function enqueueKgProcessing(documentId: string): void {
  kgProcessingQueue.push(documentId);
  logger.info({ documentId, queueLength: kgProcessingQueue.length }, 'Document enqueued for KG extraction');

  if (!isProcessingKg) {
    processNextKgInQueue();
  }
}

async function processNextKgInQueue(): Promise<void> {
  if (kgProcessingQueue.length === 0) {
    isProcessingKg = false;
    return;
  }

  isProcessingKg = true;
  const documentId = kgProcessingQueue.shift()!;

  try {
    await processKnowledgeGraph(documentId);
  } catch (error) {
    logger.error({ documentId, error }, 'Failed to extract KG from document');
  }

  setImmediate(processNextKgInQueue);
}

async function processKnowledgeGraph(documentId: string): Promise<void> {
  logger.info({ documentId }, 'Starting Knowledge Graph extraction');

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { chunks: { orderBy: { chunkIndex: 'asc' }, take: 50 } }, // Limit to 50 chunks for cost
  });

  if (!document || document.chunks.length === 0) return;

  const workspaceId = document.workspaceId;

  for (const chunk of document.chunks) {
    try {
      const extractedData = await extractEntitiesFromChunk(chunk.content);
      await saveKgData(workspaceId, chunk.id, extractedData);
      
      // Sleep for 1.5 seconds to avoid Groq rate limits
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      logger.warn({ chunkId: chunk.id, error: err }, 'Failed to extract KG for chunk');
    }
  }

  logger.info({ documentId }, 'Completed Knowledge Graph extraction');
}

async function extractEntitiesFromChunk(text: string) {
  const prompt = `Extract knowledge graph entities and relationships from the text below.
Return a JSON object conforming EXACTLY to this structure:
{
  "entities": [
    { "name": "Exact Name", "type": "PERSON|ORG|CONCEPT|DATE|LOCATION|EVENT|TERM", "description": "Brief description" }
  ],
  "relationships": [
    { "source": "Exact Name", "target": "Exact Name", "relationship": "action or relation phrase", "confidence": 0.9 }
  ]
}
If no obvious entities, return empty arrays.

TEXT:
${text}`;

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content || '{}';
  return JSON.parse(content) as {
    entities: { name: string; type: keyof typeof EntityType; description: string }[];
    relationships: { source: string; target: string; relationship: string; confidence: number }[];
  };
}

async function saveKgData(
  workspaceId: string, 
  chunkId: string, 
  data: {
    entities: { name: string; type: keyof typeof EntityType; description: string }[];
    relationships: { source: string; target: string; relationship: string; confidence: number }[];
  }
) {
  if (!data.entities || !Array.isArray(data.entities)) return;

  const entityIdMap = new Map<string, string>(); // name lowercased -> entity id

  // 1. Process Entities
  for (const ent of data.entities) {
    if (!ent.name || !ent.type) continue;
    const nameLower = ent.name.toLowerCase();
    
    // Find existing
    let entityRecord = await prisma.kgEntity.findFirst({
      where: {
        workspaceId,
        name: { equals: ent.name, mode: 'insensitive' }
      }
    });

    if (!entityRecord) {
      entityRecord = await prisma.kgEntity.create({
        data: {
          workspaceId,
          name: ent.name,
          entityType: EntityType[ent.type] || EntityType.CONCEPT,
          description: ent.description,
          mentionCount: 1,
        }
      });
    } else {
      await prisma.kgEntity.update({
        where: { id: entityRecord.id },
        data: { mentionCount: { increment: 1 } }
      });
    }
    
    entityIdMap.set(nameLower, entityRecord.id);

    // Link chunk to entity
    await prisma.kgEntityChunk.upsert({
      where: {
        entityId_chunkId: { entityId: entityRecord.id, chunkId }
      },
      update: {},
      create: { entityId: entityRecord.id, chunkId }
    });
  }

  // 2. Process Relationships (Edges)
  if (!data.relationships || !Array.isArray(data.relationships)) return;

  for (const rel of data.relationships) {
    if (!rel.source || !rel.target || !rel.relationship) continue;
    const sourceId = entityIdMap.get(rel.source.toLowerCase());
    const targetId = entityIdMap.get(rel.target.toLowerCase());

    if (sourceId && targetId && sourceId !== targetId) {
      await prisma.kgEdge.create({
        data: {
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          relationship: rel.relationship,
          confidence: rel.confidence || 0.8,
          sourceChunkId: chunkId
        }
      });
    }
  }
}
