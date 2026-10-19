import getDriver from '@/lib/neo4j';
import { relationshipSchema, relationshipType, type Relationship } from '@/lib/schemas';

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
       WHERE NOT n:_System AND NOT other:_System
       RETURN type(r) AS type, properties(r) AS props,
              properties(other) AS otherNode, 'outgoing' AS direction
       UNION
       MATCH (n {id: $id})<-[r]-(other)
       WHERE NOT n:_System AND NOT other:_System
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

/**
 * Delete a single relationship.
 *
 * Neo4j has no stable relationship id in this schema, so edges are identified
 * by (fromId, toId, type). `role` optionally disambiguates parallel edges —
 * when provided, only an edge with that exact role is removed.
 *
 * The relationship type cannot be parameterised in Cypher, so it is inlined
 * after being validated against the `relationshipType` enum.
 *
 * Returns `true` if an edge was deleted, `false` if none matched.
 */
export async function deleteRelationship(
  fromId: string,
  toId: string,
  type: string,
  role?: string
): Promise<boolean> {
  const relType = relationshipType.parse(type);
  const roleClause = role !== undefined ? ' AND r.role = $role' : '';

  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (a {id: $fromId})-[r:${relType}]->(b {id: $toId})
       WHERE NOT a:_System AND NOT b:_System${roleClause}
       WITH r LIMIT 1
       DELETE r
       RETURN 1 AS deleted`,
      role !== undefined ? { fromId, toId, role } : { fromId, toId }
    );
    return result.records.length > 0;
  } finally {
    await session.close();
  }
}
