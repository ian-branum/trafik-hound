import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { writeAuditLog } from '@/lib/audit/log';
import { deleteNode, getNodeById, updateNode } from '@/lib/graph/nodes';
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

// PATCH /api/nodes/[id] — update editable node fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // System fields are immutable; drop them (and any _-prefixed property).
    const {
      id: _id,
      type: _type,
      createdAt: _createdAt,
      ...rest
    } = body as Record<string, unknown>;

    const patch = Object.fromEntries(
      Object.entries(rest).filter(([key, value]) => !key.startsWith('_') && value !== undefined)
    );

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
    }

    if ('label' in patch && (typeof patch.label !== 'string' || !patch.label.trim())) {
      return NextResponse.json({ error: 'Label must be a non-empty string' }, { status: 400 });
    }
    for (const field of ['subtype', 'notes'] as const) {
      if (field in patch && patch[field] !== null && typeof patch[field] !== 'string') {
        return NextResponse.json({ error: `${field} must be a string` }, { status: 400 });
      }
    }

    const node = await updateNode(id, patch);
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const session = await auth();
    void writeAuditLog({
      userId: session?.user?.userId ?? null,
      userEmail: session?.user?.email ?? null,
      action: 'node_edit',
      targetId: id,
      targetLabel: (node as Record<string, unknown>).label as string ?? null,
    }).catch(console.error);

    return NextResponse.json(node);
  } catch (err) {
    console.error('[PATCH /api/nodes/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/nodes/[id] — delete the node and all of its relationships
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteNode(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const session = await auth();
    void writeAuditLog({
      userId: session?.user?.userId ?? null,
      userEmail: session?.user?.email ?? null,
      action: 'node_delete',
      targetId: id,
    }).catch(console.error);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/nodes/[id]]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
