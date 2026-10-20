import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { NoteAccessError, publishNote } from '@/lib/graph/notes';

// POST /api/nodes/[id]/notes/[noteId]/publish — publish a note to the discussion
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { noteId } = await params;
    const entry = await publishNote(noteId, session.user.userId);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    if (err instanceof NoteAccessError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[POST /api/nodes/[id]/notes/[noteId]/publish]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
