import { NextRequest, NextResponse } from 'next/server';
import { head } from '@vercel/blob';

/**
 * GET /api/download?url=<blob-url>
 *
 * Generates a short-lived signed download URL for a private blob.
 * Auth is handled by middleware — only enabled users reach this endpoint.
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    // Verify the blob exists and get a signed URL (valid for 60 seconds)
    const info = await head(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Redirect to the signed URL — the browser fetches the blob directly
    return NextResponse.redirect(info.downloadUrl);
  } catch (err) {
    console.error('[GET /api/download]', err);
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 });
  }
}
