import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createRelationship } from '@/lib/graph/relationships';

// POST /api/relationships — create a relationship between two existing nodes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rel = await createRelationship(body);
    return NextResponse.json(rel, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: err.issues },
        { status: 400 }
      );
    }
    if (err instanceof Error && err.message.includes('not found')) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error('[POST /api/relationships]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
