import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { writeAuditLog } from '@/lib/audit/log';
import { getNeighborhood } from '@/lib/graph/queries';
import { getNodeById } from '@/lib/graph/nodes';

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
    // Prefer the root node from the result; fall back to a direct DB lookup
    // so isolated nodes (no neighbors) still get a label.
    const rootNodeFromResult = result.nodes.find(
      (n: Record<string, unknown>) => n.id === id
    );
    const targetLabel = rootNodeFromResult
      ? (rootNodeFromResult.label as string)
      : ((await getNodeById(id))?.label as string | undefined) ?? null;
    void writeAuditLog({
      userId: session?.user?.userId ?? null,
      userEmail: session?.user?.email ?? null,
      action: 'graph_query',
      targetId: id,
      targetLabel,
      detail: JSON.stringify({ endpoint: 'neighborhood', nodeId: id, depth }),
    }).catch(console.error);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/nodes/[id]/neighborhood]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
