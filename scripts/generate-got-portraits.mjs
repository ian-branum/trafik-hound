/**
 * generate-got-portraits.mjs
 *
 * Generates AI portrait images for GoT characters without marquee images
 * using gpt-image-1-mini, uploads to Vercel Blob, sets marqueeUrl.
 *
 * Usage:
 *   NEO4J_URI=... NEO4J_USER=... NEO4J_PASSWORD=... \
 *   BLOB_READ_WRITE_TOKEN=... OPENAI_API_KEY=... \
 *     node scripts/generate-got-portraits.mjs
 *   --dry-run   Print prompts only, generate nothing
 *   --limit N   Only process first N characters
 */

import neo4j from 'neo4j-driver';
import { put } from '@vercel/blob';

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

if (!OPENAI_KEY && !DRY_RUN) { console.error('❌ OPENAI_API_KEY required'); process.exit(1); }
if (!BLOB_TOKEN && !DRY_RUN) { console.error('❌ BLOB_READ_WRITE_TOKEN required'); process.exit(1); }

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

// Character → brief description for better prompts
// For well-known characters, adds context so the model generates something accurate
const CHARACTER_HINTS = {
  'Jon Snow': 'young man, dark hair, black Night\'s Watch cloak',
  'Daenerys Targaryen': 'young woman, silver-white hair, Targaryen queen',
  'Cersei Lannister': 'noble woman, golden hair, queen of Westeros',
  'Tyrion Lannister': 'dwarf, sharp intelligent eyes, Lannister gold',
  'Jaime Lannister': 'handsome knight, golden hair, golden hand',
  'Arya Stark': 'young girl, brown hair, fierce expression',
  'Sansa Stark': 'young woman, auburn hair, noble Stark',
  'Ned Eddard Stark': 'stern lord, brown hair, fur-lined cloak',
  'Robb Stark': 'young lord, auburn hair, Northern lord',
  'Bran Stark': 'young boy, brown hair, intense gaze',
  'Catelyn Stark': 'noble woman, auburn hair, Lady of Winterfell',
  'Joffrey Baratheon': 'young king, blonde hair, cruel expression',
  'Tywin Lannister': 'older man, grey hair, commanding lord',
  'Petyr Baelish': 'cunning man, dark hair, well-dressed',
  'Varys': 'bald man, eunuch, Spider of the Small Council',
  'Samwell Tarly': 'heavyset young man, dark hair, Night\'s Watch',
  'Brienne of Tarth': 'tall warrior woman, blonde hair, armor',
  'Melisandre': 'red-haired woman, red robes, Red Priestess',
  'Stannis Baratheon': 'stern king, short hair, rigid expression',
  'Davos Seaworth': 'weathered sailor, missing fingers, Onion Knight',
};

function buildPrompt(name) {
  const hint = CHARACTER_HINTS[name];
  const desc = hint ? `, ${hint}` : '';
  return `Classical oil painting portrait of ${name}${desc}, Game of Thrones character. ` +
    `Renaissance style, dark moody background. ` +
    `Close face and head crop, face fills most of the frame, top of head fully visible with space above, ` +
    `chin at lower quarter of frame, no nameplate, no text, no labels. ` +
    `Dramatic lighting, painterly detail, three-quarter view.`;
}

async function generateImage(prompt, retryWithSafePrompt = false) {
  const finalPrompt = retryWithSafePrompt
    ? prompt.replace(/Game of Thrones character/g, 'medieval fantasy character')
    : prompt;

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: finalPrompt,
      n: 1,
      size: '1024x1024',
      output_format: 'jpeg',
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message ?? `HTTP ${res.status}`;
    // Safety rejection — retry once with softened prompt
    if (!retryWithSafePrompt && (msg.includes('safety') || msg.includes('rejected'))) {
      return generateImage(prompt, true);
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data in response');

  return Buffer.from(b64, 'base64');
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
    const estimatedCost = (toProcess.length * 0.011).toFixed(2);
    console.log(`   ${missing.length} characters missing images`);
    console.log(`   Processing: ${toProcess.length}${LIMIT < Infinity ? ` (limited to ${LIMIT})` : ''}`);
    console.log(`   Estimated cost: ~$${estimatedCost}\n`);

    const stats = { generated: 0, uploaded: 0, errors: 0 };

    for (let i = 0; i < toProcess.length; i++) {
      const char = toProcess[i];
      const prompt = buildPrompt(char.label);

      if (DRY_RUN) {
        process.stdout.write(`  🔍 [${i+1}/${toProcess.length}] ${char.label}\n     ${prompt.slice(0, 80)}…\n`);
        continue;
      }

      process.stdout.write(`  🎨 [${i+1}/${toProcess.length}] ${char.label}… `);

      try {
        const imageBuffer = await generateImage(prompt);
        stats.generated++;

        const safeName = char.label.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const filename = `trafik-hound/${char.id}/image/ai-portrait-${safeName}.jpg`;

        const blob = await put(filename, imageBuffer, {
          access: 'private',
          token: BLOB_TOKEN,
          contentType: 'image/jpeg',
          addRandomSuffix: false,
          allowOverwrite: true,
        });

        const entry = { url: blob.url, name: `ai-portrait-${safeName}.jpg`, size: imageBuffer.length };
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

        process.stdout.write(`✅\n`);
        stats.uploaded++;

        // Small delay between API calls
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        process.stdout.write(`❌ ${err.message}\n`);
        stats.errors++;
        // Back off on errors
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Generated: ${stats.generated}`);
    console.log(`   Uploaded:  ${stats.uploaded}`);
    console.log(`   Errors:    ${stats.errors}`);
    console.log(`   ~Cost:     $${(stats.generated * 0.011).toFixed(2)}`);
    console.log(`\n✅ Portrait generation complete${DRY_RUN ? ' (DRY RUN)' : ''}.`);

  } finally {
    await session.close();
    await driver.close();
  }
}

run().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
