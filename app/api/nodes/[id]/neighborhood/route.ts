import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { writeAuditLog } from '@/lib/audit/log';
import { getNeighborhood } from '@/lib/graph/queries';

// GET /api/nodes/[id]/neighborhood?depth=2
// Returns all nodes and relationships within `depth` hops of the given node.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const depth = Number(req.nextUrl.searchParams.get('depth') ?? '1');
    const result = await getNeighborhood(id, depth);

    const session = await auth();
    void writeAuditLog({
      userId: session?.user?.userId ?? null,
      userEmail: session?.user?.email ?? null,
      action: 'graph_query',
      targetId: id,
      detail: JSON.stringify({ endpoint: 'neighborhood', nodeId: id, depth }),
    }).catch(console.error);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/nodes/[id]/neighborhood]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
