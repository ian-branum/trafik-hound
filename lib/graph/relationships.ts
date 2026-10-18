import getDriver from '@/lib/neo4j';
import { relationshipSchema, type Relationship } from '@/lib/schemas';

/**
 * Create a relationship between two existing nodes.
 * Both nodes must exist; throws if either is not found.
 */
export async function createRelationship(input: unknown): Promise<Relationship> {
  const rel = relationshipSchema.parse(input);

  const driver = getDriver();
  const session = driver.session();
  try {
    // Verify both nodes exist
    const check = await session.run(
      `MATCH (a {id: $fromId}), (b {id: $toId}) RETURN a.id AS aid, b.id AS bid`,
      { fromId: rel.fromId, toId: rel.toId }
    );
    if (check.records.length === 0) {
      throw new Error(
        `One or both nodes not found: fromId=${rel.fromId}, toId=${rel.toId}`
      );
    }

    // Build relationship properties (everything except fromId, toId, type)
    const { fromId, toId, type, ...relProps } = rel;
    const props = Object.fromEntries(
      Object.entries(relProps).filter(([, v]) => v !== undefined)
    );

    await session.run(
      `MATCH (a {id: $fromId}), (b {id: $toId})
       CREATE (a)-[r:${type} $props]->(b)`,
      { fromId, toId, props }
    );

    return rel;
  } finally {
    await session.close();
  }
}

/**
 * Fetch all relationships for a node (both directions).
 */
export async function getRelationshipsForNode(id: string): Promise<{
  type: string;
  direction: 'outgoing' | 'incoming';
  otherNode: Record<string, unknown>;
  props: Record<string, unknown>;
}[]> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (n {id: $id})-[r]->(other)
       RETURN type(r) AS type, properties(r) AS props,
              properties(other) AS otherNode, 'outgoing' AS direction
       UNION
       MATCH (n {id: $id})<-[r]-(other)
       RETURN type(r) AS type, properties(r) AS props,
              properties(other) AS otherNode, 'incoming' AS direction`,
      { id }
    );

    return result.records.map(r => ({
      type: r.get('type') as string,
      direction: r.get('direction') as 'outgoing' | 'incoming',
      otherNode: r.get('otherNode') as Record<string, unknown>,
      props: r.get('props') as Record<string, unknown>,
    }));
  } finally {
    await session.close();
  }
}
