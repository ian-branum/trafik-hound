import { NextRequest, NextResponse } from 'next/server';
import { connection } from 'next/server';
import {
  getMinHops,
  getPathsAtDepth,
  getShortestPath,
  PathQueryTimeoutError,
} from '@/lib/graph/queries';

/**
 * GET /api/path
 *
 * Modes:
 *   ?from=<id>&to=<id>                 → shortest path (legacy, up to 6 hops)
 *   ?from=<id>&to=<id>&mode=minhops    → { minHops: number | null }
 *   ?from=<id>&to=<id>&depth=<n>       → { paths, depth, capped }
 *
 * `depth` mode returns 408 when the query exceeds its 10 second budget.
 */
export async function GET(req: NextRequest) {
  await connection(); // opts out of static prerendering
  try {
    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');
    const mode = req.nextUrl.searchParams.get('mode');
    const depthParam = req.nextUrl.searchParams.get('depth');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Both `from` and `to` query params are required' },
        { status: 400 }
      );
    }

    // Mode A — minimum hops.
    if (mode === 'minhops') {
      const minHops = await getMinHops(from, to);
      return NextResponse.json({ minHops });
    }

    // Mode B — every path at an exact depth.
    if (depthParam !== null) {
      const depth = Number(depthParam);
      if (!Number.isInteger(depth) || depth < 1 || depth > 12) {
        return NextResponse.json(
          { error: '`depth` must be an integer between 1 and 12' },
          { status: 400 }
        );
      }

      try {
        const { paths, capped } = await getPathsAtDepth(from, to, depth);
        return NextResponse.json({ paths, depth, capped });
      } catch (err) {
        if (err instanceof PathQueryTimeoutError) {
          return NextResponse.json({ error: 'timeout' }, { status: 408 });
        }
        throw err;
      }
    }

    // Legacy behaviour — single shortest path.
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
