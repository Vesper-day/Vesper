// @vitest-environment node
//
// ASSN V2 worker DB integration suite — gated on VESPER_DB_TESTS, drives the real
// handleAppleAssn against the chat-002 local-Supabase test DB. The JWS verify layer is
// STUBBED (injected verifiers — no Apple key / no real signature needed); EVERYTHING
// else is live SQL: the (provider, event_id) idempotency record, the
// apple_original_transaction_id user resolution, the real §8 transitions
// (transitionToActive / transitionToReadOnly), the period-window update, the canceled_at
// write, and the delayed_jobs reconcile enqueue.
//
// CLEANUP — subscription_events.user_id is ON DELETE SET NULL (NOT CASCADE): deleting
// auth.users orphans the event rows rather than removing them, and their
// (provider, event_id) UNIQUE key would make a later run's first insert look like a
// replay. So we (a) use UNIQUE originalTransactionIds per run — event_ids never collide
// across runs — AND (b) delete the recorded event rows EXPLICITLY by event_id in
// afterEach (covering the no-user rows whose user_id is null and would be missed by a
// delete-by-user_id sweep).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import { handleAppleAssn, type VerifyFns } from './index';

const TEST_DB_URL =
  process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';
const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('apple-assn worker (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // Delete event rows FIRST (by event_id — catches null-user_id no-user rows) while
    // the FK is still SET, then the delayed_jobs, then cascade the users/subscriptions.
    for (const eid of createdEventIds.splice(0)) {
      await db.execute(
        sql`DELETE FROM subscription_events WHERE provider = 'apple'::payment_source_enum AND event_id = ${eid}`,
      );
    }
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM delayed_jobs WHERE payload->>'userId' = ${id}`);
      await db.execute(sql`DELETE FROM subscription_events WHERE user_id = ${id}::uuid`);
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`assn-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  async function seedAppleSub(userId: string, otxn: string, status: string): Promise<void> {
    await db.execute(sql`
      INSERT INTO subscriptions
        (user_id, provider, status, apple_original_transaction_id, apple_product_id,
         current_period_start, current_period_end)
      VALUES
        (${userId}::uuid, 'apple', ${status}::subscription_status_enum, ${otxn},
         'com.vesper.standard.monthly',
         '2026-06-01T00:00:00Z'::timestamptz, '2026-07-01T00:00:00Z'::timestamptz)
    `);
  }

  function uniqOtxn(): string {
    return `1${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }

  /** A POST Request carrying `{ signedPayload }` (verify is stubbed, value inert). */
  function post(): Request {
    return new Request('https://worker.test/apple-assn', {
      method: 'POST',
      body: JSON.stringify({ signedPayload: 'sp' }),
    });
  }

  /** Stubbed verifiers returning a fabricated envelope + inner transaction. */
  function stubVerify(
    notificationType: string,
    otxn: string,
    signedDate: number,
    subtype?: string,
    expiresDate = 1_754_678_400_000,
  ): { verify: VerifyFns; eventId: string } {
    const envelope = {
      notificationType,
      subtype,
      notificationUUID: crypto.randomUUID(),
      signedDate,
      data: { signedTransactionInfo: 'inner.jws' },
    };
    const txn = {
      transactionId: `2${otxn.slice(1)}`,
      originalTransactionId: otxn,
      productId: 'com.vesper.standard.monthly',
      purchaseDate: 1_752_000_000_000,
      expiresDate,
    };
    const eventId = `${otxn}_${notificationType}_${signedDate}`;
    createdEventIds.push(eventId);
    return {
      verify: {
        verifyEnvelope: () => Promise.resolve(envelope),
        verifyTransaction: () => Promise.resolve(txn),
      },
      eventId,
    };
  }

  async function statusOf(userId: string): Promise<string | undefined> {
    const rows = (await db.execute(sql`
      SELECT status FROM subscriptions WHERE user_id = ${userId}::uuid
    `)) as unknown as Array<{ status: string }>;
    return rows[0]?.status;
  }

  async function eventCount(eventId: string): Promise<number> {
    const rows = (await db.execute(sql`
      SELECT count(*)::int AS n FROM subscription_events
      WHERE provider = 'apple'::payment_source_enum AND event_id = ${eventId}
    `)) as unknown as Array<{ n: number }>;
    return rows[0]!.n;
  }

  async function reconcileCount(userId: string): Promise<number> {
    const rows = (await db.execute(sql`
      SELECT count(*)::int AS n FROM delayed_jobs
      WHERE job_type = 'reconcile_subscription' AND payload->>'userId' = ${userId}
    `)) as unknown as Array<{ n: number }>;
    return rows[0]!.n;
  }

  it('SUBSCRIBED activates a trial apple sub, records the event, enqueues reconcile — idempotent on replay', async () => {
    const userId = await seedUser();
    const otxn = uniqOtxn();
    await seedAppleSub(userId, otxn, 'trial');
    const { verify, eventId } = stubVerify('SUBSCRIBED', otxn, 1_752_100_000_000, 'INITIAL_BUY');

    const res = await handleAppleAssn(post(), { db, verify });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'ok' });
    expect(await statusOf(userId)).toBe('active');
    expect(await eventCount(eventId)).toBe(1);
    expect(await reconcileCount(userId)).toBe(1);

    // Replay the SAME notification → true replay: still active, still one event, no
    // second reconcile.
    const res2 = await handleAppleAssn(post(), { db, verify });
    expect(res2.status).toBe(200);
    expect(await res2.json()).toMatchObject({ outcome: 'duplicate' });
    expect(await statusOf(userId)).toBe('active');
    expect(await eventCount(eventId)).toBe(1);
    expect(await reconcileCount(userId)).toBe(1);
  });

  it('EXPIRED transitions an active apple sub to read_only (no canceled_at)', async () => {
    const userId = await seedUser();
    const otxn = uniqOtxn();
    await seedAppleSub(userId, otxn, 'active');
    const { verify } = stubVerify('EXPIRED', otxn, 1_752_100_000_000, 'VOLUNTARY');

    const res = await handleAppleAssn(post(), { db, verify });
    expect(res.status).toBe(200);
    expect(await statusOf(userId)).toBe('read_only');

    const rows = (await db.execute(sql`
      SELECT canceled_at FROM subscriptions WHERE user_id = ${userId}::uuid
    `)) as unknown as Array<{ canceled_at: Date | string | null }>;
    expect(rows[0]!.canceled_at).toBeNull();
  });

  it('REFUND transitions to read_only AND sets canceled_at (§8)', async () => {
    const userId = await seedUser();
    const otxn = uniqOtxn();
    await seedAppleSub(userId, otxn, 'active');
    const { verify } = stubVerify('REFUND', otxn, 1_752_100_000_000);

    const res = await handleAppleAssn(post(), { db, verify });
    expect(res.status).toBe(200);
    expect(await statusOf(userId)).toBe('read_only');

    const rows = (await db.execute(sql`
      SELECT canceled_at FROM subscriptions WHERE user_id = ${userId}::uuid
    `)) as unknown as Array<{ canceled_at: Date | string | null }>;
    expect(rows[0]!.canceled_at).not.toBeNull();
  });

  it('DID_RENEW updates the period window without changing status', async () => {
    const userId = await seedUser();
    const otxn = uniqOtxn();
    await seedAppleSub(userId, otxn, 'active');
    const newExpires = 1_760_000_000_000;
    const { verify } = stubVerify('DID_RENEW', otxn, 1_752_100_000_000, undefined, newExpires);

    const res = await handleAppleAssn(post(), { db, verify });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'renew' });
    expect(await statusOf(userId)).toBe('active'); // unchanged

    const rows = (await db.execute(sql`
      SELECT current_period_end FROM subscriptions WHERE user_id = ${userId}::uuid
    `)) as unknown as Array<{ current_period_end: Date | string }>;
    expect(new Date(rows[0]!.current_period_end).toISOString()).toBe(
      new Date(newExpires).toISOString(),
    );
    expect(await reconcileCount(userId)).toBe(1);
  });

  it('an ASSN with no matching apple_original_transaction_id records a null-user event (no-user)', async () => {
    const otxn = uniqOtxn(); // no subscriptions row seeded for this otxn
    const { verify, eventId } = stubVerify('SUBSCRIBED', otxn, 1_752_100_000_000);

    const res = await handleAppleAssn(post(), { db, verify });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'no-user' });
    // Event durably recorded with a NULL user_id (afterEach deletes it by event_id).
    expect(await eventCount(eventId)).toBe(1);
    const rows = (await db.execute(sql`
      SELECT user_id FROM subscription_events
      WHERE provider = 'apple'::payment_source_enum AND event_id = ${eventId}
    `)) as unknown as Array<{ user_id: string | null }>;
    expect(rows[0]!.user_id).toBeNull();
  });
});
