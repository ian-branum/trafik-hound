import { NextRequest, NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import {
  addAttachment,
  getAttachments,
  getNodeById,
  removeAttachment,
  type AttachmentKind,
} from '@/lib/graph/nodes';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES: Record<AttachmentKind, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  document: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
};

function isAttachmentKind(value: unknown): value is AttachmentKind {
  return value === 'image' || value === 'document';
}

function token(): string {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  return value;
}

/** Keep blob pathnames tidy and prevent path traversal via the filename. */
function safeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
  return cleaned || 'file';
}

/**
 * POST /api/upload — upload a file and attach it to a node.
 * multipart/form-data: file, nodeId, kind ('image' | 'document')
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const file = form.get('file');
    const nodeId = form.get('nodeId');
    const kind = form.get('kind');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (typeof nodeId !== 'string' || !nodeId) {
      return NextResponse.json({ error: 'nodeId is required' }, { status: 400 });
    }
    if (!isAttachmentKind(kind)) {
      return NextResponse.json(
        { error: "kind must be 'image' or 'document'" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES[kind].includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type for ${kind}: ${file.type || 'unknown'}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds the 10MB limit' }, { status: 400 });
    }

    // Don't upload blobs for nodes that don't exist.
    const node = await getNodeById(nodeId);
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const filename = safeFilename(file.name);
    const blob = await put(`trafik-hound/${nodeId}/${kind}/${filename}`, file, {
      access: 'private',
      token: token(),
      // Two files with the same name must not clobber each other.
      addRandomSuffix: true,
    });

    const attachment =
      kind === 'image'
        ? { url: blob.url, name: filename, size: file.size }
        : { url: blob.url, name: filename, size: file.size, mimeType: file.type };

    const updated = await addAttachment(nodeId, kind, attachment);

    // Node vanished between the check and the write — clean up the orphan blob.
    if (!updated) {
      await del(blob.url, { token: token() }).catch(() => undefined);
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    return NextResponse.json(
      { ...attachment, mimeType: file.type },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/upload]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

const DELETE_KINDS: AttachmentKind[] = ['image', 'document'];

/**
 * DELETE /api/upload — remove a file from blob storage and from the node.
 * Body: { nodeId, url, kind }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { nodeId?: unknown; url?: unknown; kind?: unknown }
      | null;

    const nodeId = typeof body?.nodeId === 'string' ? body.nodeId : '';
    const url = typeof body?.url === 'string' ? body.url : '';
    const kind = body?.kind;

    if (!nodeId || !url) {
      return NextResponse.json({ error: 'nodeId and url are required' }, { status: 400 });
    }
    if (!isAttachmentKind(kind) || !DELETE_KINDS.includes(kind)) {
      return NextResponse.json(
        { error: "kind must be 'image' or 'document'" },
        { status: 400 }
      );
    }

    // Only delete blobs that are actually attached to this node.
    const attachments = await getAttachments(nodeId, kind);
    if (!attachments) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    if (!attachments.some((attachment) => attachment.url === url)) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    await del(url, { token: token() }).catch((err) => {
      // A missing blob shouldn't block removing the Neo4j entry.
      console.warn('[DELETE /api/upload] blob delete failed', err);
    });

    await removeAttachment(nodeId, kind, url);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/upload]', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
