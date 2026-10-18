import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createNode, searchNodes } from '@/lib/graph/nodes';

// POST /api/nodes — create a node
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const node = await createNode(body);
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

// GET /api/nodes?type=Person&q=stark&limit=20
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get('type') ?? undefined;
    const q = searchParams.get('q') ?? undefined;
    const limit = searchParams.has('limit')
      ? Math.min(parseInt(searchParams.get('limit')!, 10), 200)
      : 50;

    const nodes = await searchNodes({ type, q, limit });
    return NextResponse.json(nodes);
  } catch (err) {
    console.error('[GET /api/nodes]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
