/**
 * import-got-phase1.mjs
 * 
 * Phase 1: Import Game of Thrones characters and standing relationships.
 * 
 * Sources:
 *   https://raw.githubusercontent.com/jeffreylancaster/game-of-thrones/master/data/characters.json
 * 
 * Creates:
 *   - Person nodes for each character
 *   - Organization nodes for each house
 *   - Relationships: MARRIED_TO, PARENT_OF, SIBLING_OF, KILLED, SERVES, IS_MEMBER_OF
 *
 * Usage:
 *   NEO4J_URI=... NEO4J_USER=... NEO4J_PASSWORD=... node scripts/import-got-phase1.mjs
 *   
 *   Optional flags:
 *   --dry-run   Print counts only, write nothing
 *   --clear     Delete all non-_System nodes before importing (fresh slate)
 */

import neo4j from 'neo4j-driver';
import { createId } from '@paralleldrive/cuid2';

const DRY_RUN = process.argv.includes('--dry-run');
const CLEAR = process.argv.includes('--clear');
const DATA_URL = 'https://raw.githubusercontent.com/jeffreylancaster/game-of-thrones/master/data/characters.json';

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

// ── Fetch source data ─────────────────────────────────────────────────────────

async function fetchData() {
  console.log('📥 Fetching character data…');
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const json = await res.json();
  return json.characters;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slug(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const characters = await fetchData();
  console.log(`   Found ${characters.length} characters\n`);

  const session = driver.session();

  try {
    if (CLEAR && !DRY_RUN) {
      console.log('🗑  Clearing non-system nodes…');
      await session.run(`MATCH (n) WHERE NOT n:_System DETACH DELETE n`);
      console.log('   Done.\n');
    }

    // ── Build lookup maps ──────────────────────────────────────────────────────

    // name → cuid2 id  (for resolving relationships)
    const personIds = new Map();
    const houseIds = new Map();
    const now = new Date().toISOString();

    // ── Pass 1: Create Person nodes ───────────────────────────────────────────

    console.log('👤 Creating Person nodes…');
    let personCount = 0;

    for (const char of characters) {
      const name = char.characterName?.trim();
      if (!name) continue;

      const id = createId();
      personIds.set(name, id);

      // Parse name into first/last
      const parts = name.split(' ');
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null;

      const props = {
        id,
        label: name,
        type: 'Person',
        firstName,
        lastName,
        aliases: char.nickname ? char.nickname : null,
        createdAt: now,
      };

      if (!DRY_RUN) {
        await session.run(
          `CREATE (n:Person:_GoT { id: $id, label: $label, type: $type,
            firstName: $firstName, lastName: $lastName,
            aliases: $aliases, createdAt: $createdAt })`,
          props
        );
      }
      personCount++;
    }
    console.log(`   ✅ ${personCount} persons${DRY_RUN ? ' (dry run)' : ''}`);

    // ── Pass 2: Create House (Organization) nodes ─────────────────────────────

    console.log('\n🏰 Creating House nodes…');
    const houseNames = new Set(
      characters.map(c => c.houseName).filter(Boolean)
    );

    for (const house of houseNames) {
      const id = createId();
      houseIds.set(house, id);

      if (!DRY_RUN) {
        await session.run(
          `CREATE (n:Organization:_GoT { id: $id, label: $label, type: $type,
            orgType: $orgType, createdAt: $createdAt })`,
          { id, label: `House ${house}`, type: 'Organization', orgType: 'family', createdAt: now }
        );
      }
    }
    console.log(`   ✅ ${houseNames.size} houses${DRY_RUN ? ' (dry run)' : ''}`);

    // ── Pass 3: Create relationships ──────────────────────────────────────────

    console.log('\n🔗 Creating relationships…');

    const stats = {
      MARRIED_TO: 0,
      PARENT_OF: 0,
      SIBLING_OF: 0,
      KILLED: 0,
      SERVES: 0,
      IS_MEMBER_OF: 0,
      stubs: 0,
      skipped: 0,
    };

    // Track created symmetric relationships to avoid duplicates
    const createdSymmetric = new Set();

    // Ensure a person node exists — creates a stub if not already in personIds
    async function ensurePerson(name) {
      const trimmed = name.trim();
      if (personIds.has(trimmed)) return personIds.get(trimmed);

      const id = createId();
      personIds.set(trimmed, id);

      const parts = trimmed.split(' ');
      if (!DRY_RUN) {
        await session.run(
          `CREATE (n:Person:_GoT { id: $id, label: $label, type: $type,
            firstName: $firstName, lastName: $lastName,
            stub: true, createdAt: $createdAt })`,
          {
            id,
            label: trimmed,
            type: 'Person',
            firstName: parts[0],
            lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
            createdAt: now,
          }
        );
      }
      stats.stubs++;
      return id;
    }

    async function createRel(fromId, toId, type) {
      if (!fromId || !toId) { stats.skipped++; return; }
      await session.run(
        `MATCH (a {id: $fromId}), (b {id: $toId})
         CREATE (a)-[:${type} { createdAt: $now }]->(b)`,
        { fromId, toId, now }
      );
    }

    for (const char of characters) {
      const name = char.characterName?.trim();
      if (!name) continue;
      const fromId = personIds.get(name);
      if (!fromId) continue;

      // MARRIED_TO (symmetric — skip if already created in other direction)
      for (const spouse of char.marriedEngaged ?? []) {
        const toId = await ensurePerson(spouse);
        const key = [fromId, toId].sort().join('__MARRIED_TO__');
        if (!createdSymmetric.has(key)) {
          createdSymmetric.add(key);
          if (!DRY_RUN) await createRel(fromId, toId, 'MARRIED_TO');
          stats.MARRIED_TO++;
        }
      }

      // PARENT_OF — use parentOf[] as authoritative source to avoid double-creating
      for (const child of char.parentOf ?? []) {
        const toId = await ensurePerson(child);
        if (!DRY_RUN) await createRel(fromId, toId, 'PARENT_OF');
        stats.PARENT_OF++;
      }

      // SIBLING_OF (symmetric — deduplicate)
      for (const sibling of char.siblings ?? []) {
        const toId = await ensurePerson(sibling);
        const key = [fromId, toId].sort().join('__SIBLING_OF__');
        if (!createdSymmetric.has(key)) {
          createdSymmetric.add(key);
          if (!DRY_RUN) await createRel(fromId, toId, 'SIBLING_OF');
          stats.SIBLING_OF++;
        }
      }

      // KILLED (directed: killer → victim)
      for (const victim of char.killed ?? []) {
        const toId = await ensurePerson(victim);
        if (!DRY_RUN) await createRel(fromId, toId, 'KILLED');
        stats.KILLED++;
      }

      // SERVES (directed: servant → lord/organization)
      for (const lord of char.serves ?? []) {
        const toId = await ensurePerson(lord);
        if (!DRY_RUN) await createRel(fromId, toId, 'SERVES');
        stats.SERVES++;
      }
      // Also handle servedBy[] on the lord's side
      for (const servant of char.servedBy ?? []) {
        const servantId = await ensurePerson(servant);
        if (!DRY_RUN) await createRel(servantId, fromId, 'SERVES');
        stats.SERVES++;
      }

      // IS_MEMBER_OF → house
      if (char.houseName) {
        const houseId = houseIds.get(char.houseName);
        if (houseId) {
          if (!DRY_RUN) await createRel(fromId, houseId, 'IS_MEMBER_OF');
          stats.IS_MEMBER_OF++;
        }
      }
    }

    console.log(`   MARRIED_TO:   ${stats.MARRIED_TO}`);
    console.log(`   PARENT_OF:    ${stats.PARENT_OF}`);
    console.log(`   SIBLING_OF:   ${stats.SIBLING_OF}`);
    console.log(`   KILLED:       ${stats.KILLED}`);
    console.log(`   SERVES:       ${stats.SERVES}`);
    console.log(`   IS_MEMBER_OF: ${stats.IS_MEMBER_OF}`);
    console.log(`   Stub nodes created: ${stats.stubs}`);
    console.log(`   Skipped (org refs, unparseable): ${stats.skipped}`);

    // ── Summary ────────────────────────────────────────────────────────────────

    if (!DRY_RUN) {
      const nodeResult = await session.run(
        `MATCH (n:_GoT) RETURN count(n) AS total`
      );
      const relResult = await session.run(
        `MATCH (:_GoT)-[r]->(:_GoT) RETURN count(r) AS total`
      );
      console.log(`\n📊 Summary:`);
      console.log(`   Nodes:         ${nodeResult.records[0].get('total')}`);
      console.log(`   Relationships: ${relResult.records[0].get('total')}`);
    }

    console.log(`\n✅ Phase 1 import complete${DRY_RUN ? ' (DRY RUN — nothing written)' : ''}.`);

  } finally {
    await session.close();
    await driver.close();
  }
}

run().catch(err => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
