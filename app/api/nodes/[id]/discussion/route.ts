import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDiscussion } from '@/lib/graph/notes';

// GET /api/nodes/[id]/discussion — shared, published discussion entries (oldest first)
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
    const entries = await getDiscussion(id);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('[GET /api/nodes/[id]/discussion]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
