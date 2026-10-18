import { NextRequest, NextResponse } from 'next/server';
import { connection } from 'next/server';
import { getShortestPath } from '@/lib/graph/queries';

// GET /api/path?from=<id>&to=<id>
// Returns the shortest path between two nodes (up to 6 hops), or 404 if none exists.
export async function GET(req: NextRequest) {
  await connection(); // opts out of static prerendering
  try {
    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Both `from` and `to` query params are required' },
        { status: 400 }
      );
    }

    const path = await getShortestPath(from, to);
    if (!path) {
      return NextResponse.json(
        { error: 'No path found between these nodes' },
        { status: 404 }
      );
    }

    return NextResponse.json(path);
  } catch (err) {
    console.error('[GET /api/path]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
