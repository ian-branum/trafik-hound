import { NextRequest, NextResponse } from 'next/server';
import { getNodeById } from '@/lib/graph/nodes';
import { getRelationshipsForNode } from '@/lib/graph/relationships';

// GET /api/nodes/[id] — node detail + its immediate relationships
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const node = await getNodeById(id);
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const relationships = await getRelationshipsForNode(id);
    return NextResponse.json({ node, relationships });
  } catch (err) {
    console.error('[GET /api/nodes/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
