// @vitest-environment node
//
// Up/down reversibility check for the lift_log_entries migration (Chat ADD-C,
// migration 26). Gated on VESPER_DB_TESTS; runs the canonical .sql / .down.sql files
// from packages/db/migrations against the chat-002 local-Supabase test DB and asserts
// full reversibility plus the table's shape, the three CHECK constraints, the read-back
// index, and own-row RLS.
//
// To run:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/db test migrations
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import postgres from 'postgres';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(HERE, '../migrations');
const UP_SQL = readFileSync(
  resolve(MIGRATIONS_DIR, '20260824000026_lift_log_entries.sql'),
  'utf8',
);
const DOWN_SQL = readFileSync(
  resolve(MIGRATIONS_DIR, '20260824000026_lift_log_entries.down.sql'),
  'utf8',
);

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('lift_log_entries migration (up/down reversibility)', () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(TEST_DB_URL, { max: 1, onnotice: () => undefined });
  });

  afterAll(async () => {
    // Leave the table applied (setup-test-db's migrated state) for other suites, then
    // close the connection.
    await sql.unsafe(`SELECT 1`);
    await sql.end();
  });

  async function tableExists(): Promise<boolean> {
    const rows = await sql<{ reg: string | null }[]>`
      SELECT to_regclass('public.lift_log_entries')::text AS reg
    `;
    return rows[0]?.reg != null;
  }

  it('starts applied (setup-test-db migrated state)', async () => {
    expect(await tableExists()).toBe(true);
  });

  it('down drops the table cleanly, then up re-creates it', async () => {
    await sql.unsafe(DOWN_SQL);
    expect(await tableExists()).toBe(false);

    await sql.unsafe(UP_SQL);
    expect(await tableExists()).toBe(true);
  });

  it('has exactly the scaffold columns (no strength-rank / percentile columns)', async () => {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'lift_log_entries'
      ORDER BY column_name
    `;
    const columns = rows.map((r) => r.column_name).sort();
    expect(columns).toEqual(
      [
        'created_at',
        'exercise_name',
        'id',
        'logged_at',
        'reps',
        'set_number',
        'updated_at',
        'user_id',
        'weight',
        'weight_unit',
        'workout_template_id',
      ].sort(),
    );
  });

  it('carries the three CHECK constraints (set_number > 0; reps >= 0; weight >= 0)', async () => {
    const rows = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n
      FROM pg_constraint
      WHERE conrelid = 'public.lift_log_entries'::regclass AND contype = 'c'
    `;
    expect(rows[0]?.n).toBe(3);
  });

  it('carries the (user_id, logged_at) read-back index', async () => {
    const rows = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'lift_log_entries'
    `;
    expect(rows.map((r) => r.indexname)).toContain('idx_lift_log_entries_user_id_logged_at');
  });

  it('enables RLS with the four own-row policies', async () => {
    const rls = await sql<{ relrowsecurity: boolean }[]>`
      SELECT relrowsecurity FROM pg_class WHERE relname = 'lift_log_entries'
    `;
    expect(rls[0]?.relrowsecurity).toBe(true);

    const policies = await sql<{ policyname: string }[]>`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'lift_log_entries'
    `;
    expect(policies.map((p) => p.policyname).sort()).toEqual(
      [
        'lift_log_entries_delete_own',
        'lift_log_entries_insert_own',
        'lift_log_entries_select_own',
        'lift_log_entries_update_own',
      ].sort(),
    );
  });
});
