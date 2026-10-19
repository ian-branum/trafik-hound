/**
 * import-got-images-fandom.mjs
 *
 * Fetches marquee images from the Game of Thrones Fandom wiki for characters
 * that don't yet have a marqueeUrl, uploads to Vercel Blob, sets marqueeUrl.
 *
 * Uses the MediaWiki API (same structure as Wikipedia, different base URL).
 *
 * Usage:
 *   NEO4J_URI=... NEO4J_USER=... NEO4J_PASSWORD=... BLOB_READ_WRITE_TOKEN=... \
 *     node scripts/import-got-images-fandom.mjs
 *   --dry-run   Fetch image URLs only, upload nothing
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

const FANDOM_API = 'https://gameofthrones.fandom.com/api.php';
const UA = 'TrafikHound/1.0 (research/fan tool; github.com/ian-branum/trafik-hound)';

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

/**
 * Find the best image for a character via the Fandom MediaWiki API.
 * Strategy:
 *   1. Search for the page by character name
 *   2. Get the page images list
 *   3. Pick the first image that looks like a character portrait
 *      (not a sigil, map, banner, icon, etc.)
 */
async function fetchFandomImage(name) {
  // Step 1: Find the page title
  const searchUrl = new URL(FANDOM_API);
  searchUrl.search = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: name,
    srlimit: '3',
    format: 'json',
    origin: '*',
  }).toString();

  const searchRes = await fetch(searchUrl, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10000),
  });
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();

  const results = searchData?.query?.search ?? [];
  // Find the best matching page — prefer exact or close title match
  const page = results.find(r =>
    r.title.toLowerCase() === name.toLowerCase() ||
    r.title.toLowerCase().startsWith(name.toLowerCase())
  ) ?? results[0];

  if (!page) return null;

  // Step 2: Get images on that page
  const imagesUrl = new URL(FANDOM_API);
  imagesUrl.search = new URLSearchParams({
    action: 'query',
    titles: page.title,
    prop: 'images',
    imlimit: '20',
    format: 'json',
    origin: '*',
  }).toString();

  const imagesRes = await fetch(imagesUrl, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10000),
  });
  if (!imagesRes.ok) return null;
  const imagesData = await imagesRes.json();

  const pages = Object.values(imagesData?.query?.pages ?? {});
  const images = pages[0]?.images ?? [];

  // Filter out sigils, icons, banners, maps, logos
  const SKIP_PATTERNS = /sigil|banner|map|icon|logo|shield|flag|crest|symbol|placeholder/i;
  const PREFER_PATTERNS = /portrait|profile|infobox|character|profile/i;

  const candidates = images
    .map(img => img.title)
    .filter(t => t && !SKIP_PATTERNS.test(t) && /\.(jpg|jpeg|png|webp)/i.test(t));

  if (candidates.length === 0) return null;

  // Prefer portraits/infobox images, fall back to first candidate
  const preferred = candidates.find(t => PREFER_PATTERNS.test(t)) ?? candidates[0];

  // Step 3: Get the actual URL for that image file
  const fileUrl = new URL(FANDOM_API);
  fileUrl.search = new URLSearchParams({
    action: 'query',
    titles: preferred,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '400', // request a 400px-wide thumbnail
    format: 'json',
    origin: '*',
  }).toString();

  const fileRes = await fetch(fileUrl, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10000),
  });
  if (!fileRes.ok) return null;
  const fileData = await fileRes.json();

  const filePages = Object.values(fileData?.query?.pages ?? {});
  const imageInfo = filePages[0]?.imageinfo?.[0];

  return imageInfo?.thumburl ?? imageInfo?.url ?? null;
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20000),
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
      // Be polite — 400ms between requests
      await new Promise(r => setTimeout(r, 400));

      let imageUrl;
      try {
        imageUrl = await fetchFandomImage(char.label);
      } catch (err) {
        process.stdout.write(`  ❌ ${char.label} — API error: ${err.message}\n`);
        stats.errors++;
        continue;
      }

      if (!imageUrl) {
        process.stdout.write(`  ⚪ ${char.label} — not found on Fandom\n`);
        stats.notFound++;
        continue;
      }

      stats.found++;

      if (DRY_RUN) {
        process.stdout.write(`  🔍 ${char.label} → ${imageUrl.slice(0, 80)}…\n`);
        continue;
      }

      try {
        const { buffer, contentType } = await downloadImage(imageUrl);
        const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : 'jpg';
        const safeName = char.label.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const filename = `trafik-hound/${char.id}/image/fandom-${safeName}.${ext}`;

        const blob = await put(filename, buffer, {
          access: 'private',
          token: BLOB_TOKEN,
          contentType,
          addRandomSuffix: false,
        });

        const entry = { url: blob.url, name: `fandom-${safeName}.${ext}`, size: buffer.byteLength };
        await session.run(
          `MATCH (n:Person:_GoT {id: $id})
           SET n.images = CASE
             WHEN n.images IS NULL THEN $newImages
             ELSE n.images + ',' + $entry
           END,
           n.marqueeUrl = $marqueeUrl,
           n.updatedAt = $now`,
          {
            id: char.id,
            newImages: JSON.stringify([entry]),
            entry: JSON.stringify(entry),
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
    console.log(`   Found on Fandom:    ${stats.found}`);
    console.log(`   Uploaded to Blob:   ${stats.uploaded}`);
    console.log(`   Not found:          ${stats.notFound}`);
    console.log(`   Errors:             ${stats.errors}`);
    console.log(`\n✅ Fandom image import complete${DRY_RUN ? ' (DRY RUN)' : ''}.`);

  } finally {
    await session.close();
    await driver.close();
  }
}

run().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
