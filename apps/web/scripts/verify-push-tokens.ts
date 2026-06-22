// Live verification for the Push Tokens flow (Chat 076) — run by hand against the
// LOCAL Supabase (Docker). It exercises the EXACT code paths the API routes use:
//   - upsertPushToken  ← POST /api/v1/push-tokens   (register on app launch)
//   - deletePushToken  ← DELETE /api/v1/push-tokens/:deviceId (sign-out)
// and prints the real push_tokens row before/after each step so you can SEE the
// INSERT and the DELETE happen. No psql, no Mac, no iPhone needed.
//
// Run it (from the repo root, in cmd):
//   pnpm --filter @vesper/web exec tsx scripts/verify-push-tokens.ts
//
// It seeds a throwaway test user, does its checks, then deletes that user (which
// cascade-deletes its push_tokens row), so it leaves your DB exactly as it found it.
import { createDrizzleClient, sql } from '@vesper/db';
import { upsertPushToken, deletePushToken } from '../app/api/v1/push-tokens/operations';

// Local Supabase direct connection (the Supabase CLI default — same as the tests).
// Override with VERIFY_DB_URL if your local port/password differ.
const DB_URL =
  process.env.VERIFY_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';

const DEVICE_ID = 'verify-device-1';

// Pretty-print the push_tokens row for this user+device (or "(no row)").
async function showRow(db: ReturnType<typeof createDrizzleClient>, userId: string, label: string) {
  const rows = (await db.execute(sql`
    SELECT device_id, platform, token, live_activity_token, last_used_at
    FROM push_tokens
    WHERE user_id = ${userId}::uuid AND device_id = ${DEVICE_ID}
  `)) as unknown as Array<Record<string, unknown>>;
  console.log(`\n${label}:`);
  console.log(rows.length === 0 ? '  (no row)' : `  ${JSON.stringify(rows[0])}`);
}

async function main() {
  const db = createDrizzleClient(DB_URL);

  // 1. Seed a throwaway auth user to own the row (push_tokens.user_id -> users(id)).
  const userId = crypto.randomUUID();
  await db.execute(
    sql`INSERT INTO auth.users (id, email) VALUES (${userId}::uuid, ${`verify-${userId}@example.com`})`,
  );
  console.log(`Seeded test user ${userId}`);

  try {
    // 2. POST path — first register (INSERT). Expect created=true and a row with
    //    both token + live_activity_token populated.
    const first = await upsertPushToken(db, userId, {
      deviceId: DEVICE_ID,
      platform: 'ios',
      token: 'apns-token-AAA',
      liveActivityToken: 'la-token-AAA',
    });
    console.log(`\nPOST #1 (register): created=${first.created}  (expect true)`);
    await showRow(db, userId, 'Row after first register');

    // 3. POST path again — same device (UPDATE via ON CONFLICT). Expect
    //    created=false, token refreshed, last_used_at advanced, NO duplicate row.
    const second = await upsertPushToken(db, userId, {
      deviceId: DEVICE_ID,
      platform: 'ios',
      token: 'apns-token-BBB',
      liveActivityToken: null,
    });
    console.log(`\nPOST #2 (re-register same device): created=${second.created}  (expect false)`);
    await showRow(db, userId, 'Row after re-register (token=BBB, live_activity_token=null)');

    // 4. DELETE path — sign-out. Expect true (a row existed), then no row.
    const removed = await deletePushToken(db, userId, DEVICE_ID);
    console.log(`\nDELETE (sign-out): removed=${removed}  (expect true)`);
    await showRow(db, userId, 'Row after sign-out');

    console.log('\n✅ Live verification complete — INSERT and DELETE both confirmed.');
  } finally {
    // 5. Clean up: deleting the user cascades to its push_tokens rows.
    await db.execute(sql`DELETE FROM auth.users WHERE id = ${userId}::uuid`);
    console.log(`\nCleaned up test user ${userId}`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
