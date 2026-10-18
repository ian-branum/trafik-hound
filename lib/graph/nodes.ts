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
      'MATCH (n {id: $id}) RETURN properties(n) AS props',
      { id }
    );
    if (result.records.length === 0) return null;
    return result.records[0].get('props') as Node;
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
      query = `MATCH (n:${type}) WHERE toLower(n.label) CONTAINS toLower($q) RETURN properties(n) AS props LIMIT $limit`;
      queryParams.q = q;
    } else if (type) {
      query = `MATCH (n:${type}) RETURN properties(n) AS props LIMIT $limit`;
    } else if (q) {
      query = `MATCH (n) WHERE toLower(n.label) CONTAINS toLower($q) RETURN properties(n) AS props LIMIT $limit`;
      queryParams.q = q;
    } else {
      query = `MATCH (n) RETURN properties(n) AS props LIMIT $limit`;
    }

    const result = await session.run(query, queryParams);
    return result.records.map(r => r.get('props') as Node);
  } finally {
    await session.close();
  }
}
