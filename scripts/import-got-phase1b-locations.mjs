/**
 * import-got-phase1b-locations.mjs
 *
 * Phase 1b: Import GoT locations and link to existing house/character nodes.
 *
 * Sources:
 *   https://raw.githubusercontent.com/jeffreylancaster/game-of-thrones/master/data/locations.json
 *
 * Creates:
 *   - Asset nodes (subtype: location) for all named regions
 *   - BASED_AT edges: House Organization → their seat location
 *
 * Run AFTER import-got-phase1.mjs.
 *
 * Usage:
 *   NEO4J_URI=... NEO4J_USER=... NEO4J_PASSWORD=... node scripts/import-got-phase1b-locations.mjs
 *   --dry-run   Print counts only, write nothing
 */

import neo4j from 'neo4j-driver';
import { createId } from '@paralleldrive/cuid2';

const DRY_RUN = process.argv.includes('--dry-run');
const LOCATIONS_URL = 'https://raw.githubusercontent.com/jeffreylancaster/game-of-thrones/master/data/locations.json';

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

// ── House seat mapping ────────────────────────────────────────────────────────
// Maps house label (as stored) → location label (as it appears in the dataset)
const HOUSE_SEATS = {
  'House Stark':      'Winterfell',
  'House Lannister':  "King's Landing",   // Casterly Rock is their seat but KL is where they operate
  'House Baratheon':  "King's Landing",
  'House Targaryen':  "King's Landing",   // Dragonstone / Red Keep
  'House Greyjoy':    'Pyke',
  'House Tully':      'Riverrun',
  'House Arryn':      'The Eyrie',
  'House Tyrell':     'Highgarden',
  'House Martell':    'Sunspear',
  'House Bolton':     'The Dreadfort',
  'House Frey':       'The Twins',
  'House Mormont':    'Bear Island',
  'House Karstark':   'Winterfell',       // Northern vassal
  'House Tarly':      'Horn Hill',
};

async function fetchLocations() {
  console.log('📥 Fetching location data…');
  const res = await fetch(LOCATIONS_URL);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const json = await res.json();
  return json.regions;
}

async function run() {
  const regions = await fetchLocations();

  // Collect all unique location names (regions + sublocations, deduplicated)
  const locationNames = new Set();
  for (const region of regions) {
    if (region.location) locationNames.add(region.location.trim());
    for (const sub of region.subLocation ?? []) {
      if (sub?.trim()) locationNames.add(sub.trim());
    }
  }
  console.log(`   Found ${locationNames.size} unique locations\n`);

  const session = driver.session();
  const now = new Date().toISOString();

  try {
    // ── Create location nodes ─────────────────────────────────────────────────
    console.log('📍 Creating location nodes…');
    const locationIds = new Map(); // name → id

    for (const name of locationNames) {
      const id = createId();
      locationIds.set(name, id);

      if (!DRY_RUN) {
        await session.run(
          `CREATE (n:Asset:_GoT {
            id: $id, label: $label, type: $type, subtype: $subtype, createdAt: $now
          })`,
          { id, label: name, type: 'Asset', subtype: 'location', now }
        );
      }
    }
    console.log(`   ✅ ${locationNames.size} locations${DRY_RUN ? ' (dry run)' : ''}`);

    // ── Link houses to their seats ────────────────────────────────────────────
    console.log('\n🏰 Linking house seats…');
    let seated = 0;
    let missing = 0;

    for (const [houseLabel, seatName] of Object.entries(HOUSE_SEATS)) {
      const seatId = locationIds.get(seatName);
      if (!seatId) {
        console.log(`   ⚠️  Location not found: "${seatName}" for ${houseLabel}`);
        missing++;
        continue;
      }

      if (!DRY_RUN) {
        const result = await session.run(
          `MATCH (h:Organization:_GoT {label: $houseLabel})
           MATCH (loc:Asset:_GoT {id: $seatId})
           CREATE (h)-[:BASED_AT { createdAt: $now }]->(loc)
           RETURN h.id`,
          { houseLabel, seatId, now }
        );
        if (result.records.length === 0) {
          console.log(`   ⚠️  House not found: "${houseLabel}"`);
          missing++;
          continue;
        }
      }
      console.log(`   ✅ ${houseLabel} → ${seatName}`);
      seated++;
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    if (!DRY_RUN) {
      const nodeResult = await session.run(
        `MATCH (n:Asset:_GoT {subtype: 'location'}) RETURN count(n) AS total`
      );
      const relResult = await session.run(
        `MATCH (:Organization:_GoT)-[r:BASED_AT]->(:Asset:_GoT) RETURN count(r) AS total`
      );
      console.log(`\n📊 Summary:`);
      console.log(`   Location nodes: ${nodeResult.records[0].get('total')}`);
      console.log(`   BASED_AT edges: ${relResult.records[0].get('total')}`);
      console.log(`   Missing/skipped: ${missing}`);
    }

    console.log(`\n✅ Phase 1b complete${DRY_RUN ? ' (DRY RUN — nothing written)' : ''}.`);

  } finally {
    await session.close();
    await driver.close();
  }
}

run().catch(err => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
