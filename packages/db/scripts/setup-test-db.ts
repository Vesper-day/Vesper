// NOTE: DB URL naming convention (SUPABASE_DB_URL vs SUPABASE_POOLER_URL) has a contradiction
// between Decision 04 and Chat 007 output — resolve in Chat 007 before wiring live env vars.
//
// This script creates an isolated test schema on the local Supabase instance and applies
// all pending migrations. Uses `supabase db push` (Supabase CLI) only — never drizzle-kit
// generate/migrate/push (Decision 01).
//
// Prerequisites: local Supabase must be running (`supabase start`).
// Run via: pnpm --filter @vesper/db setup-test-db

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const MIGRATIONS_DIR = resolve(__dirname, '../migrations');
const SUPABASE_PROJECT_ROOT = resolve(__dirname, '../../../');

// Local Supabase direct connection (not pooler, not production).
// This is the only DB URL this script ever uses.
const LOCAL_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

function run(cmd: string, opts: { cwd?: string } = {}): void {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: opts.cwd ?? SUPABASE_PROJECT_ROOT });
}

function getMigrationFiles(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort();
}

async function main(): Promise<void> {
  const migrations = getMigrationFiles();

  if (migrations.length === 0) {
    // Migrations directory exists but contains only .gitkeep (Chat 004 has not run yet).
    // This is the expected state for Chat 002. Exit 0 so CI doesn't fail.
    console.log(
      'No migration files found in packages/db/migrations/ (.gitkeep only).',
    );
    console.log(
      'Test schema setup skipped. Re-run after Chat 004 adds the first migrations.',
    );
    process.exit(0);
  }

  console.log(`Found ${migrations.length} migration file(s). Setting up test schema...`);

  // Reset local Supabase to a clean state, then apply all migrations.
  // `supabase db push` reads from the migrations path configured in supabase/config.toml
  // (packages/db/migrations/ per Decision 02), which matches MIGRATIONS_DIR above.
  //
  // This targets the local Supabase instance only — never production.
  // The local instance is the isolated test environment; there is no separate test schema
  // within the same DB because supabase db push manages migration state in the public schema.
  run('supabase db reset --local', { cwd: SUPABASE_PROJECT_ROOT });
  run('supabase db push --local', { cwd: SUPABASE_PROJECT_ROOT });

  console.log(
    'Test database ready. Local Supabase instance is in a clean migrated state.',
  );
  console.log(`Direct connection: ${LOCAL_DB_URL}`);
}

main().catch((err: unknown) => {
  console.error('setup-test-db failed:', err);
  process.exit(1);
});
