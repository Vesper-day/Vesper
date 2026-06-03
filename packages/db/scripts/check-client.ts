// Smoke test for the canonical Drizzle client factory.
//
// Mirrors setup-test-db.ts env loading: read the relevant connection var from
// process.env, falling back to the well-known LOCAL Supabase direct connection.
// No dotenv — same source of truth as the rest of the package's scripts.
//
// We smoke-test against SUPABASE_DIRECT_URL (a direct connection), NOT the
// pooler: the LOCAL Supavisor transaction-mode pooler is not running in dev, so
// there is no local pooler URL/port. `prepare: false` is harmless on a direct
// connection. True pooler behavior is only verifiable post-Cutover against the
// cloud project.
//
// Prerequisite: local Supabase must be running (`supabase start`).
// Run via: tsx packages/db/scripts/check-client.ts

import { sql } from 'drizzle-orm';
import { createDrizzleClient } from '../src/client';

// Local Supabase direct connection (port 54322), same default as setup-test-db.ts.
const DIRECT_URL =
  process.env.SUPABASE_DIRECT_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

async function main(): Promise<void> {
  console.log(`Smoke-testing createDrizzleClient() against direct connection:`);
  console.log(`  ${DIRECT_URL.replace(/:[^:@/]+@/, ':****@')}`);

  const db = createDrizzleClient(DIRECT_URL);

  const rows = await db.execute(sql`select 1 as ok`);
  const ok = Array.isArray(rows) ? rows[0]?.ok : undefined;

  if (ok !== 1) {
    throw new Error(`SELECT 1 returned unexpected result: ${JSON.stringify(rows)}`);
  }

  console.log('SELECT 1 succeeded — client factory works against a direct connection.');
  console.log(
    'NOTE: true Supavisor transaction-mode pooler behavior (the reason for ' +
      'prepare:false) is only verifiable post-Cutover against the cloud project.',
  );

  // postgres-js holds the socket open; close it so the process can exit.
  await db.$client.end();
}

main().catch((err: unknown) => {
  console.error('check-client failed:', err);
  console.error(
    'If this is a connection error, ensure local Supabase is running (`supabase start`).',
  );
  process.exit(1);
});
