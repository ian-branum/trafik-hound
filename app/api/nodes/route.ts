import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { auth } from '@/auth';
import { writeAuditLog } from '@/lib/audit/log';
import { createNode, searchNodes } from '@/lib/graph/nodes';

// POST /api/nodes — create a node
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const node = await createNode(body);

    const session = await auth();
    void writeAuditLog({
      userId: session?.user?.userId ?? null,
      userEmail: session?.user?.email ?? null,
      action: 'node_create',
      targetId: (node as Record<string, unknown>).id as string ?? null,
      targetLabel: (node as Record<string, unknown>).label as string ?? null,
    }).catch(console.error);

    return NextResponse.json(node, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: err.issues },
        { status: 400 }
      );
    }
    console.error('[POST /api/nodes]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/nodes?type=Person&q=stark&limit=50&skip=0
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get('type') ?? undefined;
    const q = searchParams.get('q') ?? undefined;
    const limit = searchParams.has('limit')
      ? Math.min(parseInt(searchParams.get('limit')!, 10), 200)
      : 50;
    const skip = searchParams.has('skip')
      ? Math.max(0, parseInt(searchParams.get('skip')!, 10))
      : 0;

    const { nodes, total } = await searchNodes({ type, q, limit, skip });

    // Only log real searches — bare "load the explore page" requests would be noise.
    if (type || q) {
      const session = await auth();
      void writeAuditLog({
        userId: session?.user?.userId ?? null,
        userEmail: session?.user?.email ?? null,
        action: 'graph_query',
        detail: JSON.stringify({
          endpoint: 'explore',
          type: type ?? null,
          q: q ?? null,
          total,
        }),
      }).catch(console.error);
    }

    return NextResponse.json({ nodes, total, limit, skip });
  } catch (err) {
    console.error('[GET /api/nodes]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
