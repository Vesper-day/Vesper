// Chat 061 — Bills RLS verification (Finance module).
//
// Asserts, by DIRECT SQL against the live local DB, that:
//   (a) `bills` has the STRICTEST own-row RLS on ALL FOUR ops — SELECT / INSERT /
//       UPDATE / DELETE each check auth.uid() = user_id (row security enabled);
//   (b) RLS is ENFORCED live: a second user cannot SELECT, cannot UPDATE, and cannot
//       DELETE another user's bill, and cannot INSERT a row owned by another user
//       (with_check blocks it);
//   (c) the two migration-0006 indexes exist (idx_bills_user_id,
//       idx_bills_user_id_due_day);
//   (d) DETERMINE #4 — reports whether an `audit_bills_changes` trigger exists on
//       bills. Per TECHNICAL_SPEC §11/§19, bills is INTENTIONALLY EXCLUDED from audit
//       coverage (audit is scoped to medications + integrations), so the EXPECTED
//       result is ABSENT. The check REPORTS the fact and only FAILS if a trigger is
//       unexpectedly present (which would contradict the spec). This is the point the
//       PHASE_4_BUILD_PLAN §061 end-of-session checks get wrong (they claim a bills
//       audit trigger "parallel to medications").
//
// Uses the SAME postgres-js driver + SUPABASE_DIRECT_URL that packages/db/src/client.ts
// uses (psql is not installed). Run:
//   node packages/db/scripts/verify-bills-rls.mjs
// from the repo root (resolves `postgres` from packages/db/node_modules) OR from
// packages/db as `node scripts/verify-bills-rls.mjs`.
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env.local');
try {
  const envText = readFileSync(envPath, 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  // env may already be present in the shell — fall through to the check below.
}

const url = process.env.SUPABASE_DIRECT_URL;
if (!url) {
  console.error('FAIL: SUPABASE_DIRECT_URL is not set (packages/db/.env.local or shell).');
  process.exit(1);
}

const sql = postgres(url, { prepare: false });

let failures = 0;
function check(ok, label) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failures += 1;
}

const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
// auth.uid() = user_id, in either operand order.
function isOwnRow(expr) {
  const e = norm(expr).toLowerCase();
  return e === '(auth.uid() = user_id)' || e === '(user_id = auth.uid())';
}

try {
  // --- table exists (migration 0006 applied) --------------------------------
  const exists = await sql`SELECT to_regclass('public.bills') AS reg`;
  if (!exists[0]?.reg) {
    console.error(
      'FAIL: public.bills does not exist. Apply migrations first:\n' +
        '  pnpm --filter @vesper/db db:migrate   (or `supabase db push`)',
    );
    await sql.end();
    process.exit(1);
  }

  // --- (a) RLS policy definitions + row security ----------------------------
  const rls = await sql`SELECT relrowsecurity FROM pg_class WHERE relname = 'bills'`;
  check(rls[0]?.relrowsecurity === true, 'row security is ENABLED on bills');

  const policies = await sql`
    SELECT cmd, qual, with_check FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bills'`;
  const byCmd = new Map(policies.map((p) => [p.cmd, p]));

  check(isOwnRow(byCmd.get('SELECT')?.qual), 'SELECT policy is own-row (USING auth.uid() = user_id)');
  check(
    isOwnRow(byCmd.get('INSERT')?.with_check),
    'INSERT policy is own-row (WITH CHECK auth.uid() = user_id)',
  );
  check(
    isOwnRow(byCmd.get('UPDATE')?.qual) && isOwnRow(byCmd.get('UPDATE')?.with_check),
    'UPDATE policy is own-row (USING + WITH CHECK auth.uid() = user_id)',
  );
  check(isOwnRow(byCmd.get('DELETE')?.qual), 'DELETE policy is own-row (USING auth.uid() = user_id)');

  // --- (c) migration-0006 indexes present -----------------------------------
  const idx = await sql`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'bills'`;
  const idxNames = new Set(idx.map((r) => r.indexname));
  check(idxNames.has('idx_bills_user_id'), 'index idx_bills_user_id present');
  check(idxNames.has('idx_bills_user_id_due_day'), 'index idx_bills_user_id_due_day present');

  // --- (d) audit trigger — EXPECTED ABSENT (spec §19) -----------------------
  const trg = await sql`
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.bills'::regclass
      AND NOT tgisinternal AND tgname = 'audit_bills_changes'`;
  const auditPresent = trg.length > 0;
  console.log(
    `INFO: audit_bills_changes trigger on bills is ${auditPresent ? 'PRESENT' : 'ABSENT'} ` +
      `(spec §19 expects ABSENT — bills is excluded from audit coverage).`,
  );
  check(!auditPresent, 'no audit_bills_changes trigger on bills (TECHNICAL_SPEC §19 — expected absent)');

  // --- seed two users (auth.users -> on_auth_user_created -> public.users) ---
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  await sql`INSERT INTO auth.users (id, email) VALUES (${userA}::uuid, ${`billscheck-a-${userA}@example.com`})`;
  await sql`INSERT INTO auth.users (id, email) VALUES (${userB}::uuid, ${`billscheck-b-${userB}@example.com`})`;

  const [bill] = await sql`
    INSERT INTO bills (user_id, name, amount, due_day_of_month, frequency, category)
    VALUES (${userA}::uuid, 'RLS Check Bill', 12.34, 5, 'monthly'::bill_frequency_enum, 'Check')
    RETURNING id`;
  const billId = bill.id;

  // --- (b) live RLS enforcement --------------------------------------------
  // As userA: own row IS visible (sanity that the policy is not deny-all).
  await sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`;
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userA })}, true)`;
    const own = await tx`SELECT count(*)::int AS n FROM bills WHERE id = ${billId}::uuid`;
    check(own[0].n === 1, 'owner (userA) CAN SELECT their own bill under RLS');
  });

  // As userB: SELECT of userA's row returns nothing.
  await sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`;
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userB })}, true)`;
    const other = await tx`SELECT count(*)::int AS n FROM bills WHERE id = ${billId}::uuid`;
    check(other[0].n === 0, 'non-owner (userB) CANNOT SELECT another user bill under RLS');
  });

  // As userB: UPDATE of userA's row affects zero rows (invisible under RLS).
  await sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`;
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userB })}, true)`;
    const upd = await tx`UPDATE bills SET name = 'hijack' WHERE id = ${billId}::uuid RETURNING id`;
    check(upd.length === 0, 'non-owner (userB) CANNOT UPDATE another user bill under RLS');
  });

  // As userB: DELETE of userA's row affects zero rows (invisible under RLS).
  await sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`;
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userB })}, true)`;
    const del = await tx`DELETE FROM bills WHERE id = ${billId}::uuid RETURNING id`;
    check(del.length === 0, 'non-owner (userB) CANNOT DELETE another user bill under RLS');
  });

  // As userB: INSERT owned by userA is REJECTED by the WITH CHECK.
  let insertBlocked = false;
  try {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userB })}, true)`;
      await tx`
        INSERT INTO bills (user_id, name, frequency)
        VALUES (${userA}::uuid, 'Hijack', 'monthly'::bill_frequency_enum)`;
    });
  } catch {
    insertBlocked = true;
  }
  check(insertBlocked, 'non-owner (userB) CANNOT INSERT a row owned by userA (WITH CHECK blocks it)');

  // Confirm userA's row survived every hostile attempt.
  const survived = await sql`SELECT name FROM bills WHERE id = ${billId}::uuid`;
  check(
    survived.length === 1 && survived[0].name === 'RLS Check Bill',
    'userA bill is unchanged after all non-owner attempts',
  );

  // --- cleanup: delete seeded bills BEFORE seeded users ---------------------
  await sql`DELETE FROM bills WHERE user_id IN (${userA}::uuid, ${userB}::uuid)`;
  await sql`DELETE FROM auth.users WHERE id = ${userA}::uuid`;
  await sql`DELETE FROM auth.users WHERE id = ${userB}::uuid`;

  const leftover = await sql`SELECT count(*)::int AS n FROM bills WHERE id = ${billId}::uuid`;
  check(leftover[0].n === 0, 'test bill rows cleaned up');
} catch (err) {
  console.error('FAIL: unexpected error during verification:', err);
  failures += 1;
} finally {
  await sql.end();
}

console.log(failures === 0 ? '\nALL BILLS RLS CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
