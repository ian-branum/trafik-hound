import { NextRequest, NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { auth } from '@/auth';
import { writeAuditLog } from '@/lib/audit/log';
import { createRelationship, deleteRelationship } from '@/lib/graph/relationships';
import { relationshipType } from '@/lib/schemas/relationships';

// POST /api/relationships — create a relationship between two existing nodes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rel = await createRelationship(body);

    const session = await auth();
    const fields = body as Record<string, unknown>;
    void writeAuditLog({
      userId: session?.user?.userId ?? null,
      userEmail: session?.user?.email ?? null,
      action: 'edge_create',
      detail: JSON.stringify({
        type: fields.type ?? null,
        fromId: fields.fromId ?? null,
        toId: fields.toId ?? null,
      }),
    }).catch(console.error);

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

const deleteSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  type: relationshipType,
  role: z.string().optional(),
});

// DELETE /api/relationships — delete a single relationship
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { fromId, toId, type, role } = parsed.data;
    const deleted = await deleteRelationship(fromId, toId, type, role);

    if (!deleted) {
      return NextResponse.json({ error: 'Relationship not found' }, { status: 404 });
    }

    const session = await auth();
    void writeAuditLog({
      userId: session?.user?.userId ?? null,
      userEmail: session?.user?.email ?? null,
      action: 'edge_delete',
      detail: JSON.stringify({ type, fromId, toId }),
    }).catch(console.error);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', issues: err.issues },
        { status: 400 }
      );
    }
    console.error('[DELETE /api/relationships]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
