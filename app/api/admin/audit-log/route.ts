import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { queryAuditLog, type AuditAction } from '@/lib/audit/log';

const ACTIONS: AuditAction[] = [
  'auth_login',
  'node_create',
  'node_edit',
  'node_delete',
  'edge_create',
  'edge_delete',
  'graph_query',
];

// GET /api/admin/audit-log?action=&search=&limit=&skip=
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const rawAction = searchParams.get('action');
  const action =
    rawAction && ACTIONS.includes(rawAction as AuditAction)
      ? (rawAction as AuditAction)
      : undefined;
  const search = searchParams.get('search') ?? undefined;
  const limit = searchParams.has('limit')
    ? Math.min(parseInt(searchParams.get('limit')!, 10), 200)
    : 50;
  const skip = searchParams.has('skip')
    ? Math.max(0, parseInt(searchParams.get('skip')!, 10))
    : 0;

  try {
    const result = await queryAuditLog({
      action,
      search,
      limit: Number.isFinite(limit) ? limit : 50,
      skip: Number.isFinite(skip) ? skip : 0,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/admin/audit-log]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
