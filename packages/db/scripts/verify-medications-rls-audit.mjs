// Chat 060 — Medications RLS + audit verification (breach-class surface).
//
// Asserts, by DIRECT SQL against the live local DB, that:
//   (a) `medications` has the STRICTEST own-row RLS on ALL FOUR ops — SELECT / INSERT
//       / UPDATE / DELETE each check auth.uid() = user_id (row security enabled);
//   (b) inserting / updating / deleting a test medication writes EXACTLY ONE
//       corresponding security_audit_log row each, with the correct table_name
//       ('medications'), row_id (the medication id), user_id, and operation;
//   (c) RLS is ENFORCED live: a second user cannot SELECT another user's row and
//       cannot INSERT a row owned by another user (with_check blocks it).
//
// Uses the SAME postgres-js driver + SUPABASE_DIRECT_URL that packages/db/src/client.ts
// uses (psql is not installed; audit-schema.ts is absent — do not use either). Run:
//   node packages/db/scripts/verify-medications-rls-audit.mjs
// from the repo root (resolves `postgres` from packages/db/node_modules) OR from
// packages/db as `node scripts/verify-medications-rls-audit.mjs`.
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
  // --- (a) RLS policy definitions + row security ----------------------------
  const rls = await sql`SELECT relrowsecurity FROM pg_class WHERE relname = 'medications'`;
  check(rls[0]?.relrowsecurity === true, 'row security is ENABLED on medications');

  const policies = await sql`
    SELECT cmd, qual, with_check FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'medications'`;
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

  // --- audit trigger present ------------------------------------------------
  const trg = await sql`
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.medications'::regclass
      AND NOT tgisinternal AND tgname = 'audit_medications_changes'`;
  check(trg.length === 1, 'audit_medications_changes trigger is present on medications');

  // --- seed a user (auth.users -> on_auth_user_created -> public.users) ------
  const userA = crypto.randomUUID();
  await sql`INSERT INTO auth.users (id, email) VALUES (${userA}::uuid, ${`rlscheck-a-${userA}@example.com`})`;

  // --- (b) audit trigger fires exactly once per I / U / D -------------------
  const [med] = await sql`
    INSERT INTO medications (user_id, name, dose, frequency, start_date)
    VALUES (${userA}::uuid, 'RLS Check Med', '1mg', 'daily'::medication_frequency_enum, '2026-07-01')
    RETURNING id`;
  const medId = med.id;

  let audit = await sql`
    SELECT table_name, row_id, user_id, operation, old_values, new_values
    FROM security_audit_log WHERE row_id = ${medId}::uuid ORDER BY changed_at`;
  check(audit.length === 1 && audit[0].operation === 'INSERT', 'INSERT writes exactly one audit row (INSERT)');
  check(
    audit[0]?.table_name === 'medications' &&
      audit[0]?.row_id === medId &&
      audit[0]?.user_id === userA &&
      audit[0]?.old_values === null &&
      audit[0]?.new_values !== null,
    'INSERT audit row has correct table_name/row_id/user_id + new_values only',
  );

  await sql`UPDATE medications SET dose = '2mg' WHERE id = ${medId}::uuid`;
  audit = await sql`SELECT operation, old_values, new_values FROM security_audit_log WHERE row_id = ${medId}::uuid ORDER BY changed_at`;
  check(audit.length === 2 && audit[1].operation === 'UPDATE', 'UPDATE writes exactly one more audit row (UPDATE)');
  check(
    audit[1]?.old_values !== null && audit[1]?.new_values !== null,
    'UPDATE audit row carries both old_values and new_values',
  );

  // --- (c) live RLS enforcement (second user is blocked) --------------------
  const userB = crypto.randomUUID();
  await sql`INSERT INTO auth.users (id, email) VALUES (${userB}::uuid, ${`rlscheck-b-${userB}@example.com`})`;

  // As userA: own row IS visible (sanity that the policy is not deny-all).
  await sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`;
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userA })}, true)`;
    const own = await tx`SELECT count(*)::int AS n FROM medications WHERE id = ${medId}::uuid`;
    check(own[0].n === 1, 'owner (userA) CAN SELECT their own medication under RLS');
  });

  // As userB: userA's row is INVISIBLE.
  await sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`;
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userB })}, true)`;
    const other = await tx`SELECT count(*)::int AS n FROM medications WHERE id = ${medId}::uuid`;
    check(other[0].n === 0, 'non-owner (userB) CANNOT SELECT another user medication under RLS');
  });

  // As userB: INSERT owned by userA is REJECTED by the WITH CHECK.
  let insertBlocked = false;
  try {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userB })}, true)`;
      await tx`
        INSERT INTO medications (user_id, name, dose, frequency, start_date)
        VALUES (${userA}::uuid, 'Hijack', '1mg', 'daily'::medication_frequency_enum, '2026-07-01')`;
    });
  } catch {
    insertBlocked = true;
  }
  check(insertBlocked, 'non-owner (userB) CANNOT INSERT a row owned by userA (WITH CHECK blocks it)');

  // --- DELETE audit row -----------------------------------------------------
  await sql`DELETE FROM medications WHERE id = ${medId}::uuid`;
  audit = await sql`SELECT operation, old_values, new_values FROM security_audit_log WHERE row_id = ${medId}::uuid ORDER BY changed_at`;
  check(audit.length === 3 && audit[2].operation === 'DELETE', 'DELETE writes exactly one more audit row (DELETE)');
  check(
    audit[2]?.old_values !== null && audit[2]?.new_values === null,
    'DELETE audit row carries old_values only',
  );

  // --- cleanup (cascades to public.users -> medications -> security_audit_log) ---
  await sql`DELETE FROM auth.users WHERE id = ${userA}::uuid`;
  await sql`DELETE FROM auth.users WHERE id = ${userB}::uuid`;

  const leftover = await sql`SELECT count(*)::int AS n FROM security_audit_log WHERE row_id = ${medId}::uuid`;
  check(leftover[0].n === 0, 'test audit rows cleaned up (cascade on auth.users delete)');
} catch (err) {
  console.error('FAIL: unexpected error during verification:', err);
  failures += 1;
} finally {
  await sql.end();
}

console.log(failures === 0 ? '\nALL MEDICATIONS RLS + AUDIT CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
