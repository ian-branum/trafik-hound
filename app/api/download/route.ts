import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/download?url=<blob-url>
 *
 * Server-side proxy for private blobs — fetches the blob using the store
 * token and streams it to the client. Never exposes the raw blob URL.
 *
 * Auth is handled by middleware — only enabled users reach this endpoint.
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const upstream = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: 'File not found' }, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    };
    if (contentLength) headers['Content-Length'] = contentLength;

    return new NextResponse(upstream.body, { headers });
  } catch (err) {
    console.error('[GET /api/download]', err);
    return NextResponse.json({ error: 'Could not fetch file' }, { status: 500 });
  }
}
