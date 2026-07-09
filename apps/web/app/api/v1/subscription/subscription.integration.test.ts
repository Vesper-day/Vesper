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
});
