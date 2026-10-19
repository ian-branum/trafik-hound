/**
 * setup-auth.mjs
 * Idempotent Neo4j setup for the Trafik-Hound auth system.
 *
 * Creates constraints/indexes on `:User` and `:AuthMeta`, and optionally
 * bootstraps an admin account.
 *
 * Run: node scripts/setup-auth.mjs
 * Optional: ADMIN_EMAIL=you@example.com node scripts/setup-auth.mjs
 */

import { randomUUID } from 'node:crypto';
import neo4j from 'neo4j-driver';

const URI = process.env.NEO4J_URI;
const USER = process.env.NEO4J_USER;
const PASSWORD = process.env.NEO4J_PASSWORD;

if (!URI || !USER || !PASSWORD) {
  console.error('❌ Missing NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD.');
  console.error('   Tip: `set -a && source .env.local && set +a && node scripts/setup-auth.mjs`');
  process.exit(1);
}

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));

const constraints = [
  {
    name: 'user_id_unique',
    cypher: `CREATE CONSTRAINT user_id_unique IF NOT EXISTS
             FOR (u:User) REQUIRE u.id IS UNIQUE`,
  },
  {
    name: 'user_email_unique',
    cypher: `CREATE CONSTRAINT user_email_unique IF NOT EXISTS
             FOR (u:User) REQUIRE u.email IS UNIQUE`,
  },
  {
    name: 'authmeta_singleton_unique',
    cypher: `CREATE CONSTRAINT authmeta_singleton_unique IF NOT EXISTS
             FOR (m:AuthMeta) REQUIRE m.id IS UNIQUE`,
  },
];

const indexes = [
  {
    name: 'user_createdAt',
    cypher: `CREATE INDEX user_createdAt IF NOT EXISTS
             FOR (u:User) ON (u.createdAt)`,
  },
  {
    name: 'user_provider_account',
    cypher: `CREATE INDEX user_provider_account IF NOT EXISTS
             FOR (u:User) ON (u.provider, u.providerAccountId)`,
  },
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

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (adminEmail) {
      console.log('');
      console.log('── Bootstrap admin ─────────────────────────────');
      const now = new Date().toISOString();
      const result = await session.run(
        `MERGE (u:User {email: $email})
         ON CREATE SET
           u.id = $id,
           u.name = $name,
           u.image = null,
           u.role = 'admin',
           u.enabled = true,
           u.provider = 'google',
           u.providerAccountId = null,
           u.emailVerified = null,
           u.createdAt = $now,
           u.lastLoginAt = null
         ON MATCH SET u.role = 'admin', u.enabled = true
         RETURN u.email AS email, u.role AS role, u.enabled AS enabled`,
        {
          email: adminEmail,
          id: randomUUID(),
          name: adminEmail.split('@')[0],
          now,
        }
      );
      const record = result.records[0];
      console.log(
        `  ✅ ${record.get('email')} → role=${record.get('role')} enabled=${record.get('enabled')}`
      );
    } else {
      console.log('');
      console.log('ℹ️  No ADMIN_EMAIL set — the first user to sign in becomes an admin.');
    }

    console.log('');
    console.log('── Verification ─────────────────────────────────');
    const users = await session.run('MATCH (u:User) RETURN count(u) AS total');
    const constraintsCount = await session.run('SHOW CONSTRAINTS');
    console.log(`  Users:              ${users.records[0].get('total')}`);
    console.log(`  Constraints active: ${constraintsCount.records.length}`);

    console.log('');
    console.log('✅ Auth database setup complete.');
  } finally {
    await session.close();
    await driver.close();
  }
}

run().catch((err) => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
