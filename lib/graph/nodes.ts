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

export type AttachmentKind = 'image' | 'document';

export interface Attachment {
  url: string;
  name: string;
  size: number;
  mimeType?: string;
}

const ATTACHMENT_PROPERTY: Record<AttachmentKind, string> = {
  image: 'images',
  document: 'documents',
};

/** Attachments are stored on the node as a JSON string array. */
function parseAttachmentList(raw: unknown): Attachment[] {
  if (Array.isArray(raw)) return raw as Attachment[];
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Attachment[]) : [];
  } catch {
    return [];
  }
}

/**
 * Read a node's attachment list for `kind`.
 * Returns `null` when the node doesn't exist (or is a `:_System` node).
 */
export async function getAttachments(
  nodeId: string,
  kind: AttachmentKind
): Promise<Attachment[] | null> {
  const prop = ATTACHMENT_PROPERTY[kind];
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (n {id: $id})
       WHERE NOT n:_System
       RETURN coalesce(n.${prop}, '[]') AS raw`,
      { id: nodeId }
    );
    if (result.records.length === 0) return null;
    return parseAttachmentList(result.records[0].get('raw'));
  } finally {
    await session.close();
  }
}

/**
 * Append an attachment to a node's `images` or `documents` list.
 * Returns the updated list, or `null` if the node doesn't exist.
 */
export async function addAttachment(
  nodeId: string,
  kind: AttachmentKind,
  attachment: Attachment
): Promise<Attachment[] | null> {
  const prop = ATTACHMENT_PROPERTY[kind];
  const driver = getDriver();
  const session = driver.session();
  try {
    const read = await session.run(
      `MATCH (n {id: $id})
       WHERE NOT n:_System
       RETURN coalesce(n.${prop}, '[]') AS raw`,
      { id: nodeId }
    );
    if (read.records.length === 0) return null;

    const next = [...parseAttachmentList(read.records[0].get('raw')), attachment];

    await session.run(
      `MATCH (n {id: $id})
       WHERE NOT n:_System
       SET n.${prop} = $json`,
      { id: nodeId, json: JSON.stringify(next) }
    );

    return next;
  } finally {
    await session.close();
  }
}

/**
 * Remove the attachment with the given url from a node's list.
 * Returns the updated list, or `null` if the node doesn't exist.
 */
export async function removeAttachment(
  nodeId: string,
  kind: AttachmentKind,
  url: string
): Promise<Attachment[] | null> {
  const prop = ATTACHMENT_PROPERTY[kind];
  const driver = getDriver();
  const session = driver.session();
  try {
    const read = await session.run(
      `MATCH (n {id: $id})
       WHERE NOT n:_System
       RETURN coalesce(n.${prop}, '[]') AS raw`,
      { id: nodeId }
    );
    if (read.records.length === 0) return null;

    const next = parseAttachmentList(read.records[0].get('raw')).filter(
      (attachment) => attachment.url !== url
    );

    await session.run(
      `MATCH (n {id: $id})
       WHERE NOT n:_System
       SET n.${prop} = $json`,
      { id: nodeId, json: JSON.stringify(next) }
    );

    return next;
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
