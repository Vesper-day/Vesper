// @vitest-environment node
//
// ASSN V2 worker tests — fetch + JWS-verify + Sentry + DB all MOCKED (no real JWS, no
// live Supabase). Drives the pure `handleAppleAssn` with injected deps (mirrors the 084
// worker + 086 apple-verify builder tests), asserting per the five §8 types:
//   * a signed-payload fixture → both verifiers called, idempotent insert, the correct
//     transition invoked ONCE, reconcile enqueued;
//   * DID_RENEW → period update, NO transition, reconcile enqueued;
//   * replay (processed_at SET) → 200, no re-process, no transition;
//   * recorded-but-unprocessed → re-processes (completes an interrupted attempt);
//   * bad outer / inner signature → 400, ZERO DB writes;
//   * non-POST → 405;
//   * illegal-source mapped transition → 200 audit (never a 5xx);
//   * unresolvable user / already-in-target → 200 audit, no transition;
//   * an unexpected DB error → Sentry captured + 500.
import { describe, it, expect, vi } from 'vitest';
import type { Database } from '@vesper/db';
import { IllegalSubscriptionTransitionError } from '@vesper/shared/subscriptionState';
import worker, { handleAppleAssn, type VerifyFns, type TransitionFns } from './index';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTXN = '1000000000000001';
const SIGNED_DATE = 1_752_100_000_000;

const TXN = {
  transactionId: '2000000000000001',
  originalTransactionId: OTXN,
  productId: 'com.vesper.standard.monthly',
  purchaseDate: 1_752_000_000_000,
  expiresDate: 1_754_678_400_000,
};

function envelope(notificationType: string, subtype?: string): Record<string, unknown> {
  return {
    notificationType,
    subtype,
    notificationUUID: 'uuid-1',
    signedDate: SIGNED_DATE,
    data: { signedTransactionInfo: 'inner.jws' },
  };
}

/** A POST Request carrying `{ signedPayload }` (verify is mocked, so the value is inert). */
function post(signedPayload = 'sp'): Request {
  return new Request('https://worker.test/apple-assn', {
    method: 'POST',
    body: JSON.stringify({ signedPayload }),
  });
}

/** Sequential-response db.execute mock (mirrors the 086 route.test mockDb). */
function mockDb(...responses: unknown[]): Database {
  const execute = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) execute.mockRejectedValueOnce(r);
    else execute.mockResolvedValueOnce(r);
  }
  return { execute } as unknown as Database;
}
const calls = (db: Database) => (db.execute as ReturnType<typeof vi.fn>).mock.calls.length;

function mockVerify(env: Record<string, unknown> = envelope('SUBSCRIBED'), txn: unknown = TXN): {
  verify: VerifyFns;
  verifyEnvelope: ReturnType<typeof vi.fn>;
  verifyTransaction: ReturnType<typeof vi.fn>;
} {
  const verifyEnvelope = vi.fn().mockResolvedValue(env);
  const verifyTransaction = vi.fn().mockResolvedValue(txn);
  return { verify: { verifyEnvelope, verifyTransaction }, verifyEnvelope, verifyTransaction };
}

function mockTransitions(): {
  transitions: TransitionFns;
  transitionToActive: ReturnType<typeof vi.fn>;
  transitionToReadOnly: ReturnType<typeof vi.fn>;
} {
  const transitionToActive = vi.fn().mockResolvedValue(undefined);
  const transitionToReadOnly = vi.fn().mockResolvedValue(undefined);
  return { transitions: { transitionToActive, transitionToReadOnly }, transitionToActive, transitionToReadOnly };
}

describe('handleAppleAssn — the five §8 part-1 types', () => {
  it('SUBSCRIBED → transitionToActive once, idempotent insert, reconcile enqueued', async () => {
    const db = mockDb(
      [{ user_id: USER_ID, status: 'trial', last_event_at: null }], // sub lookup
      [{ id: 'evt_1' }], // event insert (new)
      [], // advance last_event_at
      [], // enqueue reconcile
      [], // markProcessed
    );
    const { verify, verifyEnvelope, verifyTransaction } = mockVerify(envelope('SUBSCRIBED', 'INITIAL_BUY'));
    const { transitions, transitionToActive, transitionToReadOnly } = mockTransitions();

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'ok' });
    expect(verifyEnvelope).toHaveBeenCalledTimes(1);
    expect(verifyTransaction).toHaveBeenCalledTimes(1);
    expect(transitionToActive).toHaveBeenCalledTimes(1);
    expect(transitionToActive).toHaveBeenCalledWith(db, USER_ID);
    expect(transitionToReadOnly).not.toHaveBeenCalled();
    expect(calls(db)).toBe(5); // lookup + insert + advance + reconcile + markProcessed
  });

  it('DID_RENEW → period-window update, NO transition, reconcile enqueued', async () => {
    const db = mockDb(
      [{ user_id: USER_ID, status: 'active', last_event_at: null }],
      [{ id: 'evt_2' }],
      [], // period UPDATE
      [], // advance
      [], // reconcile
      [], // markProcessed
    );
    const { verify } = mockVerify(envelope('DID_RENEW'));
    const { transitions, transitionToActive, transitionToReadOnly } = mockTransitions();

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'renew' });
    expect(transitionToActive).not.toHaveBeenCalled();
    expect(transitionToReadOnly).not.toHaveBeenCalled();
    expect(calls(db)).toBe(6); // lookup + insert + period + advance + reconcile + markProcessed
  });

  it('EXPIRED (BILLING_RETRY_PERIOD) → transitionToReadOnly once', async () => {
    const db = mockDb(
      [{ user_id: USER_ID, status: 'active', last_event_at: null }],
      [{ id: 'evt_3' }],
      [], // advance
      [], // reconcile
      [], // markProcessed
    );
    const { verify } = mockVerify(envelope('EXPIRED', 'BILLING_RETRY_PERIOD'));
    const { transitions, transitionToActive, transitionToReadOnly } = mockTransitions();

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'ok' });
    expect(transitionToReadOnly).toHaveBeenCalledTimes(1);
    expect(transitionToReadOnly).toHaveBeenCalledWith(db, USER_ID);
    expect(transitionToActive).not.toHaveBeenCalled();
    expect(calls(db)).toBe(5);
  });

  it('REVOKE → transitionToReadOnly once (§8: read_only, not archived)', async () => {
    const db = mockDb(
      [{ user_id: USER_ID, status: 'active', last_event_at: null }],
      [{ id: 'evt_4' }],
      [], [], [],
    );
    const { verify } = mockVerify(envelope('REVOKE'));
    const { transitions, transitionToReadOnly } = mockTransitions();

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(transitionToReadOnly).toHaveBeenCalledTimes(1);
    expect(calls(db)).toBe(5);
  });

  it('REFUND → transitionToReadOnly + set canceled_at (§8: read_only + canceled_at)', async () => {
    const db = mockDb(
      [{ user_id: USER_ID, status: 'active', last_event_at: null }],
      [{ id: 'evt_5' }],
      [], // advance
      [], // canceled_at UPDATE
      [], // reconcile
      [], // markProcessed
    );
    const { verify } = mockVerify(envelope('REFUND'));
    const { transitions, transitionToReadOnly } = mockTransitions();

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'ok' });
    expect(transitionToReadOnly).toHaveBeenCalledTimes(1);
    expect(calls(db)).toBe(6); // lookup + insert + advance + canceled_at + reconcile + markProcessed
  });
});

describe('handleAppleAssn — idempotency + guards', () => {
  it('replay of a PROCESSED event → 200, no re-process, no transition', async () => {
    const db = mockDb(
      [{ user_id: USER_ID, status: 'active', last_event_at: null }], // lookup
      [], // insert → conflict (no RETURNING row)
      [{ processed_at: '2026-08-08T00:00:00.000Z' }], // prior WAS processed
    );
    const { verify } = mockVerify(envelope('SUBSCRIBED'));
    const { transitions, transitionToActive } = mockTransitions();

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'duplicate' });
    expect(transitionToActive).not.toHaveBeenCalled();
    expect(calls(db)).toBe(3); // lookup + insert(conflict) + processed_at read
  });

  it('recorded-but-UNPROCESSED event → re-processes (completes an interrupted attempt)', async () => {
    const db = mockDb(
      [{ user_id: USER_ID, status: 'trial', last_event_at: null }], // lookup
      [], // insert → conflict
      [{ processed_at: null }], // ...never processed
      [], // advance
      [], // reconcile
      [], // markProcessed
    );
    const { verify } = mockVerify(envelope('SUBSCRIBED'));
    const { transitions, transitionToActive } = mockTransitions();

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'ok' });
    expect(transitionToActive).toHaveBeenCalledTimes(1);
  });

  it('unresolvable user (no apple_original_transaction_id row) → 200 audit, no transition', async () => {
    const db = mockDb(
      [], // lookup → no row
      [{ id: 'evt_6' }], // insert with NULL user_id
      [], // markProcessed
    );
    const { verify } = mockVerify(envelope('SUBSCRIBED'));
    const { transitions, transitionToActive } = mockTransitions();

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'no-user' });
    expect(transitionToActive).not.toHaveBeenCalled();
    expect(calls(db)).toBe(3);
  });

  it('already-in-target (SUBSCRIBED while active) → 200 audit, no transition', async () => {
    const db = mockDb(
      [{ user_id: USER_ID, status: 'active', last_event_at: null }],
      [{ id: 'evt_7' }],
      [], // markProcessed
    );
    const { verify } = mockVerify(envelope('SUBSCRIBED'));
    const { transitions, transitionToActive } = mockTransitions();

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'already-in-target' });
    expect(transitionToActive).not.toHaveBeenCalled();
    expect(calls(db)).toBe(3);
  });

  it('DID_FAIL_TO_RENEW (part-2 type) → 200 audit-only, no transition', async () => {
    const db = mockDb(
      [{ user_id: USER_ID, status: 'active', last_event_at: null }],
      [{ id: 'evt_8' }],
      [], // markProcessed
    );
    const { verify } = mockVerify(envelope('DID_FAIL_TO_RENEW'));
    const { transitions, transitionToActive, transitionToReadOnly } = mockTransitions();

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'no-transition' });
    expect(transitionToActive).not.toHaveBeenCalled();
    expect(transitionToReadOnly).not.toHaveBeenCalled();
    expect(calls(db)).toBe(3);
  });

  it('illegal-source mapped transition → 200 audit (never a 5xx)', async () => {
    const db = mockDb(
      [{ user_id: USER_ID, status: 'archived', last_event_at: null }], // lookup
      [{ id: 'evt_9' }], // insert
      [], // markProcessedError
    );
    const { verify } = mockVerify(envelope('REFUND'));
    const transitionToReadOnly = vi
      .fn()
      .mockRejectedValue(new IllegalSubscriptionTransitionError('archived', 'read_only'));
    const transitions: TransitionFns = {
      transitionToActive: vi.fn(),
      transitionToReadOnly,
    };

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'illegal-transition' });
    expect(transitionToReadOnly).toHaveBeenCalledTimes(1);
    expect(calls(db)).toBe(3); // lookup + insert + markProcessedError
  });

  it('monotonic-ordering guard: a stale ASSN (older than last_event_at - 24h) → 200 audit', async () => {
    const future = new Date(SIGNED_DATE + 3 * 24 * 60 * 60 * 1000).toISOString();
    const db = mockDb(
      [{ user_id: USER_ID, status: 'active', last_event_at: future }], // last_event_at far ahead
      [{ id: 'evt_10' }],
      [], // markProcessed
    );
    const { verify } = mockVerify(envelope('EXPIRED', 'VOLUNTARY'));
    const { transitions, transitionToReadOnly } = mockTransitions();

    const res = await handleAppleAssn(post(), { db, verify, transitions });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ outcome: 'stale' });
    expect(transitionToReadOnly).not.toHaveBeenCalled();
    expect(calls(db)).toBe(3);
  });
});

describe('handleAppleAssn — rejection + method paths', () => {
  it('bad OUTER signature → 400, ZERO DB writes', async () => {
    const db = mockDb();
    const verifyEnvelope = vi.fn().mockRejectedValue(new Error('tampered'));
    const verifyTransaction = vi.fn();
    const { transitions } = mockTransitions();

    const res = await handleAppleAssn(post(), {
      db,
      verify: { verifyEnvelope, verifyTransaction },
      transitions,
    });

    expect(res.status).toBe(400);
    expect(verifyTransaction).not.toHaveBeenCalled();
    expect(calls(db)).toBe(0);
  });

  it('bad INNER transaction signature → 400, ZERO DB writes', async () => {
    const db = mockDb();
    const verifyEnvelope = vi.fn().mockResolvedValue(envelope('SUBSCRIBED'));
    const verifyTransaction = vi.fn().mockRejectedValue(new Error('inner tampered'));
    const { transitions } = mockTransitions();

    const res = await handleAppleAssn(post(), {
      db,
      verify: { verifyEnvelope, verifyTransaction },
      transitions,
    });

    expect(res.status).toBe(400);
    expect(calls(db)).toBe(0);
  });

  it('missing signedPayload → 400, no verify, ZERO DB writes', async () => {
    const db = mockDb();
    const { verify, verifyEnvelope } = mockVerify();
    const req = new Request('https://worker.test/apple-assn', {
      method: 'POST',
      body: JSON.stringify({ notWhatApplePosts: true }),
    });

    const res = await handleAppleAssn(req, { db, verify });

    expect(res.status).toBe(400);
    expect(verifyEnvelope).not.toHaveBeenCalled();
    expect(calls(db)).toBe(0);
  });

  it('non-POST → 405 (worker fetch entrypoint)', async () => {
    const res = await worker.fetch(
      new Request('https://worker.test/apple-assn', { method: 'GET' }),
      {},
      { waitUntil: () => {} },
    );
    expect(res.status).toBe(405);
  });

  it('unexpected DB error → Sentry captured + 500 (Apple retries)', async () => {
    const db = mockDb(
      [{ user_id: USER_ID, status: 'trial', last_event_at: null }], // lookup ok
      new Error('connection reset'), // insert throws
    );
    const { verify } = mockVerify(envelope('SUBSCRIBED'));
    const { transitions } = mockTransitions();
    const captureException = vi.fn();

    const res = await handleAppleAssn(post(), { db, verify, transitions, captureException });

    expect(res.status).toBe(500);
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
