/**
 * import-got-images.mjs
 *
 * Downloads character images from the GoT dataset and uploads them to
 * Vercel Blob, then sets marqueeUrl on the matching Neo4j Person nodes.
 *
 * Usage:
 *   NEO4J_URI=... NEO4J_USER=... NEO4J_PASSWORD=... BLOB_READ_WRITE_TOKEN=... node scripts/import-got-images.mjs
 *   --dry-run   Print what would be uploaded, write nothing
 *   --limit N   Only process the first N characters (for testing)
 */

import neo4j from 'neo4j-driver';
import { put } from '@vercel/blob';

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

const DATA_URL = 'https://raw.githubusercontent.com/jeffreylancaster/game-of-thrones/master/data/characters.json';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!BLOB_TOKEN && !DRY_RUN) {
  console.error('❌ BLOB_READ_WRITE_TOKEN is required');
  process.exit(1);
}

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

async function fetchCharacters() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const json = await res.json();
  return json.characters;
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrafikHound/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) throw new Error(`Not an image: ${contentType}`);
  const buffer = await res.arrayBuffer();
  return { buffer, contentType };
}

async function run() {
  console.log('📥 Fetching character data…');
  const characters = await fetchCharacters();

  // Filter to characters with images
  const withImages = characters.filter(c => c.characterImageFull?.startsWith('http'));
  const toProcess = withImages.slice(0, LIMIT);

  console.log(`   ${characters.length} characters total`);
  console.log(`   ${withImages.length} have images`);
  console.log(`   Processing: ${toProcess.length}${LIMIT < Infinity ? ` (limited to ${LIMIT})` : ''}\n`);

  const session = driver.session();
  const now = new Date().toISOString();

  const stats = { uploaded: 0, skipped: 0, notFound: 0, errors: 0 };

  try {
    for (const char of toProcess) {
      const name = char.characterName?.trim();
      const imageUrl = char.characterImageFull;
      if (!name || !imageUrl) continue;

      // Check if node exists and already has a marqueeUrl
      const existing = await session.run(
        `MATCH (n:Person:_GoT {label: $name}) RETURN n.id AS id, n.marqueeUrl AS marqueeUrl LIMIT 1`,
        { name }
      );

      if (existing.records.length === 0) {
        process.stdout.write(`  ⚪ ${name} — not in DB\n`);
        stats.notFound++;
        continue;
      }

      const nodeId = existing.records[0].get('id');
      const existingMarquee = existing.records[0].get('marqueeUrl');

      if (existingMarquee) {
        process.stdout.write(`  ⏭  ${name} — already has marquee\n`);
        stats.skipped++;
        continue;
      }

      if (DRY_RUN) {
        process.stdout.write(`  🔍 ${name} → would upload\n`);
        stats.uploaded++;
        continue;
      }

      try {
        // Download image
        const { buffer, contentType } = await downloadImage(imageUrl);
        const ext = contentType.includes('png') ? 'png' : 'jpg';
        const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const filename = `trafik-hound/${nodeId}/image/${safeName}.${ext}`;

        // Upload to Vercel Blob
        const blob = await put(filename, buffer, {
          access: 'private',
          token: BLOB_TOKEN,
          contentType,
          addRandomSuffix: false,
        });

        // Store as image attachment + set marqueeUrl
        const imageEntry = JSON.stringify({ url: blob.url, name: `${safeName}.${ext}`, size: buffer.byteLength });
        await session.run(
          `MATCH (n:Person:_GoT {id: $id})
           SET n.images = $images,
               n.marqueeUrl = $marqueeUrl,
               n.updatedAt = $now`,
          {
            id: nodeId,
            images: `[${imageEntry}]`,
            marqueeUrl: blob.url,
            now,
          }
        );

        process.stdout.write(`  ✅ ${name}\n`);
        stats.uploaded++;

        // Small delay to avoid hammering source servers
        await new Promise(r => setTimeout(r, 200));

      } catch (err) {
        process.stdout.write(`  ❌ ${name} — ${err.message}\n`);
        stats.errors++;
      }
    }

  } finally {
    await session.close();
    await driver.close();
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Uploaded:  ${stats.uploaded}`);
  console.log(`   Skipped (already has marquee): ${stats.skipped}`);
  console.log(`   Not in DB: ${stats.notFound}`);
  console.log(`   Errors:    ${stats.errors}`);
  console.log(`\n✅ Image import complete${DRY_RUN ? ' (DRY RUN)' : ''}.`);
}

run().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
