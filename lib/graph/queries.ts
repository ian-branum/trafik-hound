import neo4j from 'neo4j-driver';
import getDriver from '@/lib/neo4j';

export type GraphNode = Record<string, unknown>;
export type GraphRelationship = {
  type: string;
  direction: 'outgoing' | 'incoming';
  props: Record<string, unknown>;
  otherNode: GraphNode;
};

/**
 * Return the subgraph around a node up to `depth` hops.
 * Returns deduplicated nodes and relationships.
 * Depth is capped at 4 to prevent runaway queries.
 */
export async function getNeighborhood(id: string, depth: number = 1): Promise<{
  nodes: GraphNode[];
  relationships: { from: string; to: string; type: string; props: Record<string, unknown> }[];
}> {
  const safeDep = Math.min(Math.max(1, depth), 4);
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH path = (start {id: $id})-[*1..${safeDep}]-(neighbor)
       RETURN
         [n IN nodes(path) | properties(n)] AS pathNodes,
         [r IN relationships(path) | {
           type: type(r),
           props: properties(r),
           fromId: startNode(r).id,
           toId: endNode(r).id
         }] AS pathRels`,
      { id }
    );

    const nodeMap = new Map<string, GraphNode>();
    const relSet = new Map<string, { from: string; to: string; type: string; props: Record<string, unknown> }>();

    for (const record of result.records) {
      const pathNodes = record.get('pathNodes') as GraphNode[];
      const pathRels = record.get('pathRels') as { type: string; props: Record<string, unknown>; fromId: string; toId: string }[];

      for (const n of pathNodes) {
        const nodeId = n.id as string;
        if (!nodeMap.has(nodeId)) nodeMap.set(nodeId, n);
      }

      for (const r of pathRels) {
        const key = `${r.fromId}__${r.type}__${r.toId}`;
        if (!relSet.has(key)) {
          relSet.set(key, { from: r.fromId, to: r.toId, type: r.type, props: r.props });
        }
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      relationships: Array.from(relSet.values()),
    };
  } finally {
    await session.close();
  }
}

/**
 * Find the shortest path between two nodes (up to 6 hops).
 * Returns the sequence of nodes and relationships along the path,
 * or null if no path exists.
 */
export async function getShortestPath(fromId: string, toId: string): Promise<{
  nodes: GraphNode[];
  relationships: { from: string; to: string; type: string; props: Record<string, unknown> }[];
} | null> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (a {id: $fromId}), (b {id: $toId})
       MATCH path = shortestPath((a)-[*..6]-(b))
       RETURN
         [n IN nodes(path) | properties(n)] AS pathNodes,
         [r IN relationships(path) | {
           type: type(r),
           props: properties(r),
           fromId: startNode(r).id,
           toId: endNode(r).id
         }] AS pathRels`,
      { fromId, toId }
    );

    if (result.records.length === 0) return null;

    const record = result.records[0];
    return {
      nodes: record.get('pathNodes') as GraphNode[],
      relationships: (record.get('pathRels') as { type: string; props: Record<string, unknown>; fromId: string; toId: string }[])
        .map(r => ({ from: r.fromId, to: r.toId, type: r.type, props: r.props })),
    };
  } finally {
    await session.close();
  }
}

/**
 * List all nodes of a given type, with optional pagination.
 */
export async function listByType(type: string, skip: number = 0, limit: number = 50): Promise<GraphNode[]> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (n:${type}) RETURN properties(n) AS props ORDER BY n.createdAt DESC SKIP $skip LIMIT $limit`,
      { skip: neo4j.int(skip), limit: neo4j.int(limit) }
    );
    return result.records.map(r => r.get('props') as GraphNode);
  } finally {
    await session.close();
  }
}
