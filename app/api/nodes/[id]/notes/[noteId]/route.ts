import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { deleteNote, updateNote } from '@/lib/graph/notes';

const patchSchema = z
  .object({
    content: z.string().trim().min(1).max(20000).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((value) => value.content !== undefined || value.pinned !== undefined, {
    message: 'Provide `content` or `pinned`',
  });

// PATCH /api/nodes/[id]/notes/[noteId] — edit content / toggle pin (author only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { noteId } = await params;
    const note = await updateNote(noteId, session.user.userId, parsed.data);
    if (!note) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ note });
  } catch (err) {
    console.error('[PATCH /api/nodes/[id]/notes/[noteId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/nodes/[id]/notes/[noteId] — delete a note (author only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { noteId } = await params;
    const deleted = await deleteNote(noteId, session.user.userId);
    if (!deleted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/nodes/[id]/notes/[noteId]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
