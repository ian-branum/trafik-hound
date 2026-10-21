import { randomUUID } from 'crypto';
import getDriver from '@/lib/neo4j';

export type AuditAction =
  | 'auth_login'
  | 'node_create'
  | 'node_edit'
  | 'node_delete'
  | 'edge_create'
  | 'edge_delete'
  | 'graph_query';

export interface AuditEntry {
  id: string;
  timestamp: string; // ISO-8601
  userId: string | null;
  userEmail: string | null;
  action: AuditAction;
  targetId?: string | null;
  targetLabel?: string | null;
  detail?: string | null; // JSON string or short description
}

/**
 * Append an entry to the audit log.
 *
 * Callers should treat this as fire-and-forget: `void writeAuditLog(...)
 * .catch(console.error)` so a logging failure never blocks a response.
 */
export async function writeAuditLog(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  const driver = getDriver();
  const session = driver.session();
  try {
    await session.run(
      `CREATE (a:AuditLog {
        id: $id,
        timestamp: $timestamp,
        userId: $userId,
        userEmail: $userEmail,
        action: $action,
        targetId: $targetId,
        targetLabel: $targetLabel,
        detail: $detail
      })`,
      {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        userId: entry.userId ?? null,
        userEmail: entry.userEmail ?? null,
        action: entry.action,
        targetId: entry.targetId ?? null,
        targetLabel: entry.targetLabel ?? null,
        detail: entry.detail ?? null,
      }
    );
  } finally {
    await session.close();
  }
}

export interface AuditQuery {
  action?: AuditAction;
  search?: string; // matches userEmail, targetLabel or detail (case-insensitive)
  limit?: number;
  skip?: number;
}

export async function queryAuditLog(
  params: AuditQuery
): Promise<{ entries: AuditEntry[]; total: number }> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const limit = Math.min(params.limit ?? 50, 200);
    const skip = Math.max(params.skip ?? 0, 0);

    const conditions: string[] = [];
    const queryParams: Record<string, unknown> = { limit, skip };

    if (params.action) {
      conditions.push('a.action = $action');
      queryParams.action = params.action;
    }
    if (params.search) {
      conditions.push(
        '(toLower(a.userEmail) CONTAINS toLower($search) ' +
          'OR toLower(a.targetLabel) CONTAINS toLower($search) ' +
          'OR toLower(a.detail) CONTAINS toLower($search))'
      );
      queryParams.search = params.search;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // A session runs one query at a time, so these must be sequential.
    const dataResult = await session.run(
      `MATCH (a:AuditLog) ${where}
       RETURN properties(a) AS entry
       ORDER BY entry.timestamp DESC
       SKIP $skip LIMIT $limit`,
      queryParams
    );

    const countResult = await session.run(
      `MATCH (a:AuditLog) ${where} RETURN count(a) AS total`,
      queryParams
    );

    const entries = dataResult.records.map(
      (record) => record.get('entry') as AuditEntry
    );

    const rawTotal = countResult.records[0]?.get('total');
    const total =
      typeof rawTotal === 'number'
        ? rawTotal
        : typeof rawTotal?.toNumber === 'function'
          ? rawTotal.toNumber()
          : Number(rawTotal ?? 0);

    return { entries, total };
  } finally {
    await session.close();
  }
}
