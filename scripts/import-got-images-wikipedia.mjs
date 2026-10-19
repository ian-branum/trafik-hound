/**
 * import-got-images-wikipedia.mjs
 *
 * Fetches marquee images from Wikipedia for GoT characters that don't
 * yet have one, then uploads to Vercel Blob and sets marqueeUrl.
 *
 * Only processes nodes that already exist in Neo4j and have no marqueeUrl.
 *
 * Usage:
 *   NEO4J_URI=... NEO4J_USER=... NEO4J_PASSWORD=... BLOB_READ_WRITE_TOKEN=... \
 *     node scripts/import-got-images-wikipedia.mjs
 *   --dry-run   Fetch Wikipedia thumbnails only, upload nothing
 *   --limit N   Only process first N missing characters
 */

import neo4j from 'neo4j-driver';
import { put } from '@vercel/blob';

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!BLOB_TOKEN && !DRY_RUN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN is required');
  process.exit(1);
}

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

// Wikipedia REST API — returns page summary with thumbnail
async function fetchWikipediaThumbnail(name) {
  // Try the exact name first, then common variations
  const candidates = [
    name,
    `${name} (Game of Thrones)`,
    // Strip house name for common characters: "Eddard Stark" → also try as-is
  ];

  for (const title of candidates) {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TrafikHound/1.0 (research tool; contact via github.com/ian-branum)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      // Must be a real article (not disambiguation) with a thumbnail
      if (data.type === 'disambiguation') continue;
      if (!data.thumbnail?.source) continue;
      return data.thumbnail.source;
    } catch {
      continue;
    }
  }
  return null;
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TrafikHound/1.0 (research tool)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) throw new Error(`Not an image: ${contentType}`);
  const buffer = await res.arrayBuffer();
  return { buffer, contentType };
}

async function run() {
  const session = driver.session();
  const now = new Date().toISOString();

  try {
    // Fetch all GoT Person nodes without a marqueeUrl
    console.log('🔍 Finding characters without marquee images…');
    const result = await session.run(
      `MATCH (n:Person:_GoT)
       WHERE n.marqueeUrl IS NULL
       RETURN n.id AS id, n.label AS label
       ORDER BY n.label`
    );

    const missing = result.records.map(r => ({
      id: r.get('id'),
      label: r.get('label'),
    }));

    const toProcess = missing.slice(0, LIMIT);
    console.log(`   ${missing.length} characters missing images`);
    console.log(`   Processing: ${toProcess.length}${LIMIT < Infinity ? ` (limited to ${LIMIT})` : ''}\n`);

    const stats = { found: 0, uploaded: 0, notFound: 0, errors: 0 };

    for (const char of toProcess) {
      // Rate limit: be polite to Wikipedia
      await new Promise(r => setTimeout(r, 300));

      const thumbUrl = await fetchWikipediaThumbnail(char.label);

      if (!thumbUrl) {
        process.stdout.write(`  ⚪ ${char.label} — not on Wikipedia\n`);
        stats.notFound++;
        continue;
      }

      stats.found++;

      if (DRY_RUN) {
        process.stdout.write(`  🔍 ${char.label} → ${thumbUrl.slice(0, 80)}…\n`);
        continue;
      }

      try {
        const { buffer, contentType } = await downloadImage(thumbUrl);
        const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';
        const safeName = char.label.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const filename = `trafik-hound/${char.id}/image/wiki-${safeName}.${ext}`;

        const blob = await put(filename, buffer, {
          access: 'private',
          token: BLOB_TOKEN,
          contentType,
          addRandomSuffix: false,
        });

        // Append to images array and set marqueeUrl
        await session.run(
          `MATCH (n:Person:_GoT {id: $id})
           SET n.images = CASE
             WHEN n.images IS NULL THEN $newEntry
             ELSE n.images + ',' + $entry
           END,
           n.marqueeUrl = $marqueeUrl,
           n.updatedAt = $now`,
          {
            id: char.id,
            newEntry: `[{"url":"${blob.url}","name":"wiki-${safeName}.${ext}","size":${buffer.byteLength}}]`,
            entry: `{"url":"${blob.url}","name":"wiki-${safeName}.${ext}","size":${buffer.byteLength}}`,
            marqueeUrl: blob.url,
            now,
          }
        );

        process.stdout.write(`  ✅ ${char.label}\n`);
        stats.uploaded++;

      } catch (err) {
        process.stdout.write(`  ❌ ${char.label} — ${err.message}\n`);
        stats.errors++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Found on Wikipedia:  ${stats.found}`);
    console.log(`   Uploaded to Blob:    ${stats.uploaded}`);
    console.log(`   Not on Wikipedia:    ${stats.notFound}`);
    console.log(`   Upload errors:       ${stats.errors}`);
    console.log(`\n✅ Wikipedia image import complete${DRY_RUN ? ' (DRY RUN)' : ''}.`);

  } finally {
    await session.close();
    await driver.close();
  }
}

run().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
