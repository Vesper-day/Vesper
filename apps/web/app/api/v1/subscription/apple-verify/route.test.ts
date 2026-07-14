// @vitest-environment node
//
// apple-verify operation tests — the verify layer + DB are MOCKED (no real JWS, no
// live Supabase). Drives the pure `verifyAppleTransaction` builder directly with
// injected deps (mirrors the Stripe-session builder tests), asserting:
//   * verified 200 → transitionToActive called ONCE + subscription_events written;
//   * replay (ON CONFLICT) → 200 with NO re-transition;
//   * already-active → no throw, 200, no re-transition;
//   * a failed JWS verify → typed INVALID_REQUEST;
//   * the 501 NOT_IMPLEMENTED path is gone (resolves to the §9 subscription shape).
import { describe, it, expect, vi } from 'vitest';
import type { Database } from '@vesper/db';
import { verifyAppleTransaction } from '../operations';
import type { AppleTransactionPayload } from '@/lib/apple/jws';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const JWS = 'header.payload.signature';

const TXN: AppleTransactionPayload = {
  transactionId: '2000000000000001',
  originalTransactionId: '1000000000000001',
  productId: 'com.vesper.standard.monthly',
  purchaseDate: 1_752_000_000_000,
  expiresDate: 1_754_678_400_000,
};

const ACTIVE_ROW = {
  status: 'active',
  provider: 'apple',
  current_period_end: '2026-08-08T00:00:00.000Z',
  cancel_at_period_end: false,
  stripe_customer_id: null,
};

function mockDb(...responses: unknown[]): Database {
  const execute = vi.fn();
  for (const r of responses) execute.mockResolvedValueOnce(r);
  return { execute } as unknown as Database;
}

describe('verifyAppleTransaction', () => {
  it('verified: activates once, records the event, returns the §9 subscription shape', async () => {
    const db = mockDb(
      [{ id: 'evt_1' }], // subscription_events insert (new)
      [], // subscriptions upsert
      [{ status: 'trial' }], // pre-transition status read
      [], // processed_at update
      [ACTIVE_ROW], // getSubscription
    );
    const verifyJws = vi.fn().mockResolvedValue(TXN);
    const activate = vi.fn().mockResolvedValue(undefined);

    const out = await verifyAppleTransaction(
      db,
      { userId: USER_ID, jwsTransaction: JWS },
      { verifyJws, activate },
    );

    expect(verifyJws).toHaveBeenCalledWith(JWS);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith(db, USER_ID);
    // events insert + upsert + status read + processed update + getSubscription
    expect((db.execute as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(5);
    expect(out.subscription.status).toBe('active');
    expect(out.subscription.provider).toBe('apple');
  });

  it('replay of a PROCESSED event: returns state WITHOUT re-transitioning', async () => {
    const db = mockDb(
      [], // subscription_events insert → conflict, no RETURNING row
      [{ processed_at: '2026-08-08T00:00:00.000Z' }], // prior event WAS processed
      [ACTIVE_ROW], // getSubscription
    );
    const verifyJws = vi.fn().mockResolvedValue(TXN);
    const activate = vi.fn().mockResolvedValue(undefined);

    const out = await verifyAppleTransaction(
      db,
      { userId: USER_ID, jwsTransaction: JWS },
      { verifyJws, activate },
    );

    expect(activate).not.toHaveBeenCalled();
    // insert (conflict) + processed_at check + getSubscription — no upsert, no transition.
    expect((db.execute as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(3);
    expect(out.subscription.status).toBe('active');
  });

  it('recorded-but-UNPROCESSED event: re-processes (completes an interrupted activation)', async () => {
    // A prior attempt recorded the event then died before processed_at was set. The
    // retry must NOT short-circuit — it must finish activating, or the paid user is
    // stranded in trial forever.
    const db = mockDb(
      [], // subscription_events insert → conflict (row already exists)
      [{ processed_at: null }], // ...but it was never processed
      [], // subscriptions upsert
      [{ status: 'trial' }], // pre-transition status read
      [], // processed_at update
      [ACTIVE_ROW], // getSubscription
    );
    const verifyJws = vi.fn().mockResolvedValue(TXN);
    const activate = vi.fn().mockResolvedValue(undefined);

    const out = await verifyAppleTransaction(
      db,
      { userId: USER_ID, jwsTransaction: JWS },
      { verifyJws, activate },
    );

    expect(activate).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith(db, USER_ID);
    expect(out.subscription.status).toBe('active');
  });

  it('already-active: skips the transition (no throw) and returns 200 state', async () => {
    const db = mockDb(
      [{ id: 'evt_2' }], // new event row
      [], // upsert
      [{ status: 'active' }], // already in target → guard skips activate
      [], // processed_at update
      [ACTIVE_ROW], // getSubscription
    );
    const verifyJws = vi.fn().mockResolvedValue(TXN);
    const activate = vi.fn().mockResolvedValue(undefined);

    const out = await verifyAppleTransaction(
      db,
      { userId: USER_ID, jwsTransaction: JWS },
      { verifyJws, activate },
    );

    expect(activate).not.toHaveBeenCalled();
    expect(out.subscription.status).toBe('active');
  });

  it('failed JWS verify → typed INVALID_REQUEST (never a silent pass)', async () => {
    const db = mockDb();
    const verifyJws = vi.fn().mockRejectedValue(new Error('tampered'));
    const activate = vi.fn();

    await expect(
      verifyAppleTransaction(
        db,
        { userId: USER_ID, jwsTransaction: JWS },
        { verifyJws, activate },
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(activate).not.toHaveBeenCalled();
    expect((db.execute as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('501 path is gone: resolves to a subscription object, not NOT_IMPLEMENTED', async () => {
    const db = mockDb([{ id: 'evt_3' }], [], [{ status: 'trial' }], [], [ACTIVE_ROW]);
    const out = await verifyAppleTransaction(
      db,
      { userId: USER_ID, jwsTransaction: JWS },
      { verifyJws: vi.fn().mockResolvedValue(TXN), activate: vi.fn().mockResolvedValue(undefined) },
    );
    expect(out).toHaveProperty('subscription');
  });
});
