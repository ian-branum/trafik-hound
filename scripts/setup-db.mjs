/**
 * setup-db.mjs
 * Initialises Neo4j AuraDB with constraints and indexes for Trafik-Hound.
 * Run: node scripts/setup-db.mjs
 */

import neo4j from 'neo4j-driver';

const URI      = process.env.NEO4J_URI      || 'neo4j+s://154a7137.databases.neo4j.io';
const USER     = process.env.NEO4J_USERNAME || '154a7137';
const PASSWORD = process.env.NEO4J_PASSWORD || 'tj18fFihD-BdyQjrGw0-HgOh-FjiGvMiiOTeYnxVwaI';

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));

// ── Node labels ────────────────────────────────────────────────────────────────
const NODE_LABELS = [
  // Actors
  'Person', 'Organization', 'Agent',
  // Events
  'Transaction', 'Interaction',
  // Artifacts
  'Agreement', 'Record', 'Asset',
];

// ── Constraints (unique id per label) ─────────────────────────────────────────
const constraints = NODE_LABELS.map(label => ({
  name: `${label.toLowerCase()}_id_unique`,
  cypher: `CREATE CONSTRAINT ${label.toLowerCase()}_id_unique IF NOT EXISTS
           FOR (n:${label}) REQUIRE n.id IS UNIQUE`,
}));

// ── Indexes ───────────────────────────────────────────────────────────────────
const indexes = [
  // Full-text search on label field across all node types
  {
    name: 'node_label_fulltext',
    cypher: `CREATE FULLTEXT INDEX node_label_fulltext IF NOT EXISTS
             FOR (n:Person|Organization|Agent|Transaction|Interaction|Agreement|Record|Asset)
             ON EACH [n.label]`,
  },
  // Temporal lookup indexes
  {
    name: 'transaction_occurredAt',
    cypher: `CREATE INDEX transaction_occurredAt IF NOT EXISTS
             FOR (n:Transaction) ON (n.occurredAt)`,
  },
  {
    name: 'interaction_occurredAt',
    cypher: `CREATE INDEX interaction_occurredAt IF NOT EXISTS
             FOR (n:Interaction) ON (n.occurredAt)`,
  },
  {
    name: 'agreement_executedAt',
    cypher: `CREATE INDEX agreement_executedAt IF NOT EXISTS
             FOR (n:Agreement) ON (n.executedAt)`,
  },
  // Relationship temporal indexes
  {
    name: 'rel_validFrom',
    cypher: `CREATE INDEX rel_validFrom IF NOT EXISTS
             FOR ()-[r:PARTICIPATED_IN]-() ON (r.validFrom)`,
  },
  // createdAt for all nodes (useful for recent-activity queries)
  ...NODE_LABELS.map(label => ({
    name: `${label.toLowerCase()}_createdAt`,
    cypher: `CREATE INDEX ${label.toLowerCase()}_createdAt IF NOT EXISTS
             FOR (n:${label}) ON (n.createdAt)`,
  })),
];

async function run() {
  const session = driver.session();
  try {
    console.log('🔌 Connected to:', URI);
    console.log('');

    console.log('── Constraints ──────────────────────────────────');
    for (const { name, cypher } of constraints) {
      try {
        await session.run(cypher);
        console.log(`  ✅ ${name}`);
      } catch (e) {
        console.log(`  ⚠️  ${name}: ${e.message}`);
      }
    }

    console.log('');
    console.log('── Indexes ──────────────────────────────────────');
    for (const { name, cypher } of indexes) {
      try {
        await session.run(cypher);
        console.log(`  ✅ ${name}`);
      } catch (e) {
        console.log(`  ⚠️  ${name}: ${e.message}`);
      }
    }

    console.log('');
    console.log('── Verification ─────────────────────────────────');
    const constraintResult = await session.run('SHOW CONSTRAINTS');
    console.log(`  Constraints active: ${constraintResult.records.length}`);
    const indexResult = await session.run('SHOW INDEXES');
    console.log(`  Indexes active:     ${indexResult.records.length}`);

    console.log('');
    console.log('✅ Database setup complete.');
  } finally {
    await session.close();
    await driver.close();
  }
}

run().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
