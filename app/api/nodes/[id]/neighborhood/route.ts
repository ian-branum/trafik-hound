import { NextRequest, NextResponse } from 'next/server';
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
    return NextResponse.json(result);
  } catch (err) {
    console.error('[GET /api/nodes/[id]/neighborhood]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
