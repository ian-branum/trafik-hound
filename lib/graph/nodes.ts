import { createId } from '@paralleldrive/cuid2';
import neo4j from 'neo4j-driver';
import getDriver from '@/lib/neo4j';
import { nodeSchema, type Node } from '@/lib/schemas';

/**
 * Write a single node to Neo4j.
 * The node's `type` field becomes its Neo4j label.
 * An `id` is assigned if not provided.
 * Returns the fully-formed node as stored.
 */
export async function createNode(input: unknown): Promise<Node> {
  // Validate at the boundary
  const node = nodeSchema.parse(input) as Node;

  const id = node.id ?? createId();
  const now = new Date().toISOString();
  const props = {
    ...node,
    id,
    createdAt: node.createdAt ?? now,
  };

  const label = node.type; // e.g. 'Person', 'Transaction', 'Agreement'

  const driver = getDriver();
  const session = driver.session();
  try {
    await session.run(
      `CREATE (n:${label} $props)`,
      { props }
    );
    return props as Node;
  } finally {
    await session.close();
  }
}

/**
 * Fetch a single node by its id (searches all labels).
 */
export async function getNodeById(id: string): Promise<Node | null> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (n {id: $id}) WHERE NOT n:_System RETURN properties(n) AS props',
      { id }
    );
    if (result.records.length === 0) return null;
    return result.records[0].get('props') as Node;
  } finally {
    await session.close();
  }
}

const SYSTEM_FIELDS = new Set(['id', 'type', 'createdAt', '_System']);

/**
 * Merge `patch` into an existing node's properties.
 *
 * `type`, `id` and `createdAt` are immutable and silently stripped, as is any
 * `_`-prefixed system property. Returns the updated node, or `null` if no
 * matching (non-system) node exists.
 */
export async function updateNode(
  id: string,
  patch: Record<string, unknown>
): Promise<Node | null> {
  const clean = Object.fromEntries(
    Object.entries(patch).filter(
      ([key, value]) =>
        !SYSTEM_FIELDS.has(key) && !key.startsWith('_') && value !== undefined
    )
  );

  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (n {id: $id})
       WHERE NOT n:_System
       SET n += $patch
       RETURN properties(n) AS props`,
      { id, patch: clean }
    );
    if (result.records.length === 0) return null;
    return result.records[0].get('props') as Node;
  } finally {
    await session.close();
  }
}

/**
 * Delete a node and all of its relationships.
 * Returns `true` if a node was deleted, `false` if it didn't exist (or was a
 * protected `:_System` node).
 */
export async function deleteNode(id: string): Promise<boolean> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (n {id: $id})
       WHERE NOT n:_System
       WITH n
       DETACH DELETE n
       RETURN count(*) AS deleted`,
      { id }
    );
    return result.records.length > 0;
  } finally {
    await session.close();
  }
}

/**
 * Search nodes by label and/or a label substring match.
 * Returns up to `limit` results (default 50).
 */
export async function searchNodes(params: {
  type?: string;
  q?: string;
  limit?: number;
}): Promise<Node[]> {
  const { type, q } = params;
  const limit = neo4j.int(params.limit ?? 50);

  const driver = getDriver();
  const session = driver.session();
  try {
    let query: string;
    const queryParams: Record<string, unknown> = { limit };

    if (type && q) {
      query = `MATCH (n:${type}) WHERE NOT n:_System AND toLower(n.label) CONTAINS toLower($q) RETURN properties(n) AS props LIMIT $limit`;
      queryParams.q = q;
    } else if (type) {
      query = `MATCH (n:${type}) WHERE NOT n:_System RETURN properties(n) AS props LIMIT $limit`;
    } else if (q) {
      query = `MATCH (n) WHERE NOT n:_System AND toLower(n.label) CONTAINS toLower($q) RETURN properties(n) AS props LIMIT $limit`;
      queryParams.q = q;
    } else {
      query = `MATCH (n) WHERE NOT n:_System RETURN properties(n) AS props LIMIT $limit`;
    }

    const result = await session.run(query, queryParams);
    return result.records.map(r => r.get('props') as Node);
  } finally {
    await session.close();
  }
}
