import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createNote, getNotes } from '@/lib/graph/notes';

const createSchema = z.object({
  content: z.string().trim().min(1, 'Note content is required').max(20000),
});

// GET /api/nodes/[id]/notes — the current user's private notes for this node
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const notes = await getNotes(id, session.user.userId);
    return NextResponse.json({ notes });
  } catch (err) {
    console.error('[GET /api/nodes/[id]/notes]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/nodes/[id]/notes — create a private note
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { id } = await params;
    const note = await createNote(id, session.user.userId, parsed.data.content);
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/nodes/[id]/notes]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
