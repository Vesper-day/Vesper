// @vitest-environment node
//
// Tests for the Subscription API group.
//
// Two suites:
//   * "Subscription validation (pure)" — ungated AppleVerify Zod assertions.
//   * "Subscription API (integration)" — gated on VESPER_DB_TESTS; drives
//     getSubscription directly against the chat-002 local-Supabase test DB (the
//     no-row trial fallback + a seeded Stripe row). Stripe-session builders are
//     NOT exercised here — they are unit-tested with a mock Stripe client (no live
//     key needed), see the "Stripe sessions (mocked)" suite below.
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import { AppleVerifyRequestSchema } from './schemas';
import {
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  verifyAppleTransaction,
} from './operations';

// --- Pure validation suite (ungated, no DB) ----------------------------------

describe('Subscription validation (pure)', () => {
  it('AppleVerifyRequestSchema requires a non-empty jwsTransaction, rejects extras', () => {
    expect(AppleVerifyRequestSchema.safeParse({ jwsTransaction: 'eyJ' }).success).toBe(true);
    expect(AppleVerifyRequestSchema.safeParse({ jwsTransaction: '' }).success).toBe(false);
    expect(AppleVerifyRequestSchema.safeParse({}).success).toBe(false);
    expect(
      AppleVerifyRequestSchema.safeParse({ jwsTransaction: 'eyJ', nope: 1 }).success,
    ).toBe(false);
  });
});

// --- Stripe session builders (mocked — DECISION: mock, no live key) -----------
//
// We MOCK the Stripe client (a plain object with the two methods we call) rather
// than hitting Stripe test-mode, so the suite needs NO STRIPE_SECRET_KEY and runs
// fully offline. The operation builders accept the client as a parameter precisely
// to make this trivial.

describe('Stripe sessions (mocked)', () => {
  it('createCheckoutSession passes the §8 params and returns the session url', async () => {
    process.env.STRIPE_PRICE_ID = 'price_test_123';
    process.env.NEXT_PUBLIC_APP_URL = 'https://vesper.test';
    const create = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/pay/cs_1' });
    const stripe = { checkout: { sessions: { create } } } as never;

    const out = await createCheckoutSession(stripe, { userId: 'u1', email: 'a@b.co' });
    expect(out).toEqual({ url: 'https://checkout.stripe.com/pay/cs_1' });

    const params = create.mock.calls[0]![0];
    expect(params.mode).toBe('subscription');
    expect(params.line_items).toEqual([{ price: 'price_test_123', quantity: 1 }]);
    expect(params.customer_email).toBe('a@b.co');
    expect(params.metadata).toEqual({ vesper_user_id: 'u1' });
    expect(params.automatic_tax).toEqual({ enabled: true });
    expect(params.subscription_data).toEqual({ trial_period_days: 0 });
    expect(params.success_url).toContain('https://vesper.test/settings/billing');
  });

  it('createCheckoutSession throws INTEGRATION_ERROR when Stripe returns no url', async () => {
    process.env.STRIPE_PRICE_ID = 'price_test_123';
    const create = vi.fn().mockResolvedValue({ url: null });
    const stripe = { checkout: { sessions: { create } } } as never;
    await expect(
      createCheckoutSession(stripe, { userId: 'u1', email: 'a@b.co' }),
    ).rejects.toMatchObject({ code: 'INTEGRATION_ERROR' });
  });

  it('createPortalSession passes the §8 params and returns the session url', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://vesper.test';
    // Mock the raw-SQL customer read: a row carrying the stripe_customer_id.
    const db = {
      execute: vi.fn().mockResolvedValue([{ stripe_customer_id: 'cus_test_123' }]),
    } as never;
    const create = vi
      .fn()
      .mockResolvedValue({ url: 'https://billing.stripe.com/session/bps_1' });
    const stripe = { billingPortal: { sessions: { create } } } as never;

    const out = await createPortalSession(stripe, db, 'u1');
    expect(out).toEqual({ url: 'https://billing.stripe.com/session/bps_1' });

    const params = create.mock.calls[0]![0];
    expect(params.customer).toBe('cus_test_123');
    expect(params.return_url).toBe('https://vesper.test/settings/billing');
  });

  it('createPortalSession 409s (mocked, no DB) when the read returns no customer', async () => {
    // No subscriptions row / null stripe_customer_id ⇒ CONFLICT before any Stripe call.
    const create = vi.fn();
    const db = { execute: vi.fn().mockResolvedValue([]) } as never;
    const stripe = { billingPortal: { sessions: { create } } } as never;
    await expect(createPortalSession(stripe, db, 'u1')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(create).not.toHaveBeenCalled();
  });
});

// --- Integration suite (gated on VESPER_DB_TESTS) ----------------------------

const TEST_DB_URL =
  process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';
const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Subscription API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      // subscription_events.user_id is ON DELETE SET NULL (not CASCADE), so deleting
      // auth.users orphans the event rows instead of removing them — and their
      // (provider, event_id) UNIQUE key would then make a later run's first insert
      // look like a replay. Delete the events explicitly (while user_id is still set)
      // BEFORE the cascade drops the subscriptions row.
      await db.execute(sql`DELETE FROM subscription_events WHERE user_id = ${id}::uuid`);
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`sub-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  it('returns the synthesized trial shape when no subscriptions row exists', async () => {
    const userId = await seedUser();
    const out = await getSubscription(db, userId);
    expect(out.subscription).toEqual({
      status: 'trial',
      provider: 'none',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  });

  it('returns the row state for a seeded active Stripe subscription', async () => {
    const userId = await seedUser();
    await db.execute(sql`
      INSERT INTO subscriptions
        (user_id, provider, status, stripe_customer_id, stripe_subscription_id,
         current_period_end, cancel_at_period_end)
      VALUES
        (${userId}::uuid, 'stripe', 'active', 'cus_test', 'sub_test',
         '2026-07-01T00:00:00Z', false)
    `);

    const out = await getSubscription(db, userId);
    expect(out.subscription.status).toBe('active');
    expect(out.subscription.provider).toBe('stripe');
    expect(out.subscription.cancelAtPeriodEnd).toBe(false);
    expect(out.subscription.currentPeriodEnd).toBe('2026-07-01T00:00:00.000Z');
  });

  it('createPortalSession 409s when the user has no Stripe customer', async () => {
    const userId = await seedUser();
    const stripe = { billingPortal: { sessions: { create: vi.fn() } } } as never;
    await expect(createPortalSession(stripe, db, userId)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  // apple-verify DB smoke: exercises the live provider='apple' CHECK branch, the
  // user_id UPSERT, the real transitionToActive, and (provider, event_id) idempotency.
  // The JWS verify layer is stubbed (no Apple key needed); everything else is live SQL.
  it('verifyAppleTransaction activates an apple subscription and is idempotent on replay', async () => {
    const userId = await seedUser();
    // Unique transaction ids per run so the (provider, event_id) UNIQUE key never
    // collides with an event row an earlier run may have orphaned. The SAME object is
    // reused for the replay below, so the event_id is stable WITHIN a run (idempotency).
    const uniq = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const txn = {
      transactionId: `2${uniq}`,
      originalTransactionId: `1${uniq}`,
      productId: 'com.vesper.standard.monthly',
      purchaseDate: 1_752_000_000_000,
      expiresDate: 1_754_678_400_000,
    };
    const verifyJws = () => Promise.resolve(txn);

    const first = await verifyAppleTransaction(
      db,
      { userId, jwsTransaction: 'jws' },
      { verifyJws },
    );
    // Assert the PERSISTED row (DB truth) as well as the returned shape.
    const persisted = (await db.execute(sql`
      SELECT status FROM subscriptions WHERE user_id = ${userId}::uuid
    `)) as unknown as Array<{ status: string }>;
    expect(persisted[0]!.status).toBe('active');
    expect(first.subscription.status).toBe('active');
    expect(first.subscription.provider).toBe('apple');

    const rows = (await db.execute(sql`
      SELECT provider, status, apple_original_transaction_id, apple_product_id,
             stripe_customer_id
      FROM subscriptions WHERE user_id = ${userId}::uuid
    `)) as unknown as Array<Record<string, unknown>>;
    expect(rows[0]!.provider).toBe('apple');
    expect(rows[0]!.status).toBe('active');
    expect(rows[0]!.apple_original_transaction_id).toBe(txn.originalTransactionId);
    expect(rows[0]!.apple_product_id).toBe(txn.productId);
    expect(rows[0]!.stripe_customer_id).toBeNull(); // CHECK: apple rows carry no stripe id

    const events = (await db.execute(sql`
      SELECT count(*)::int AS n FROM subscription_events
      WHERE provider = 'apple' AND user_id = ${userId}::uuid
    `)) as unknown as Array<{ n: number }>;
    expect(events[0]!.n).toBe(1);

    // Replay the same transaction → idempotent: still active, still exactly one event.
    const second = await verifyAppleTransaction(
      db,
      { userId, jwsTransaction: 'jws' },
      { verifyJws },
    );
    expect(second.subscription.status).toBe('active');
    const events2 = (await db.execute(sql`
      SELECT count(*)::int AS n FROM subscription_events
      WHERE provider = 'apple' AND user_id = ${userId}::uuid
    `)) as unknown as Array<{ n: number }>;
    expect(events2[0]!.n).toBe(1);
  });
});
