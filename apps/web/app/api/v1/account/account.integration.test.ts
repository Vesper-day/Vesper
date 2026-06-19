// @vitest-environment node
//
// Tests for the Account API group (delete / restore), gated on VESPER_DB_TESTS.
// Drives deleteAccount / restoreAccount directly against the chat-002
// local-Supabase test DB. Stripe cancel is exercised with a mock client (the only
// branch that calls Stripe is the active-Stripe path); the Apple / no-sub paths
// pass a null client and must NOT touch Stripe.
//
// Asserts the §4 Phase-1/2 column transitions and the §9 response shape
// (deletionScheduledAt + hardDeleteAt = scheduled + 30 days). Confirms NO write to
// security_audit_log (that table is out of scope — trigger-only, §3 table 19).
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import { deleteAccount, restoreAccount } from './operations';

const TEST_DB_URL =
  process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';
const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Account API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`acct-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  async function readUser(userId: string) {
    const rows = (await db.execute(sql`
      SELECT subscription_status, deletion_requested_at
      FROM users WHERE id = ${userId}::uuid
    `)) as unknown as Array<{ subscription_status: string; deletion_requested_at: string | null }>;
    return rows[0]!;
  }

  it('delete sets deletion_scheduled + deletion_requested_at and returns +30d hardDeleteAt', async () => {
    const userId = await seedUser();
    const out = await deleteAccount(db, null, userId);

    const row = await readUser(userId);
    expect(row.subscription_status).toBe('deletion_scheduled');
    expect(row.deletion_requested_at).not.toBeNull();

    const scheduled = new Date(out.deletionScheduledAt).getTime();
    const hard = new Date(out.hardDeleteAt).getTime();
    expect(hard - scheduled).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('delete does NOT call Stripe for a non-Stripe / no-subscription user', async () => {
    const userId = await seedUser();
    const cancel = vi.fn();
    const stripe = { subscriptions: { cancel } } as never;
    await deleteAccount(db, stripe, userId);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('delete synchronously cancels an active Stripe subscription', async () => {
    const userId = await seedUser();
    await db.execute(sql`
      INSERT INTO subscriptions
        (user_id, provider, status, stripe_customer_id, stripe_subscription_id, cancel_at_period_end)
      VALUES (${userId}::uuid, 'stripe', 'active', 'cus_x', 'sub_x', false)
    `);
    const cancel = vi.fn().mockResolvedValue({});
    const stripe = { subscriptions: { cancel } } as never;

    await deleteAccount(db, stripe, userId);
    expect(cancel).toHaveBeenCalledWith('sub_x');
  });

  it('restore clears deletion_requested_at and transitions to read_only', async () => {
    const userId = await seedUser();
    await deleteAccount(db, null, userId);
    await restoreAccount(db, userId);

    const row = await readUser(userId);
    expect(row.subscription_status).toBe('read_only');
    expect(row.deletion_requested_at).toBeNull();
  });

  it('does NOT write security_audit_log (out of scope, trigger-only table)', async () => {
    const userId = await seedUser();
    await deleteAccount(db, null, userId);
    await restoreAccount(db, userId);

    const rows = (await db.execute(sql`
      SELECT count(*)::int AS n FROM security_audit_log WHERE user_id = ${userId}::uuid
    `)) as unknown as Array<{ n: number }>;
    expect(rows[0]!.n).toBe(0);
  });
});
