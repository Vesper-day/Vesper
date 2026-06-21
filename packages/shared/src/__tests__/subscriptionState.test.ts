import { describe, it, expect, vi } from 'vitest';
import {
  transitionToActive,
  transitionToPastDue,
  transitionToReadOnly,
  transitionToArchived,
  transitionToDeletionScheduled,
  requestDeletion,
  IllegalSubscriptionTransitionError,
  PERSISTED_SUBSCRIPTION_STATUS,
  REFERRAL_MINT_MAX_ATTEMPTS,
  type StripeCanceler,
} from '../subscriptionState';
import type { Database } from '@vesper/db';

// --- mock DB -----------------------------------------------------------------
// The mock routes on the STATIC text of the drizzle `sql` template (the
// interpolated values are stored as raw chunks alongside the StringChunks, so we
// recover both). The mocked transaction simply invokes its callback with the same
// tx object; the nested tx.transaction models a SAVEPOINT the same way.
//
// NOTE: this mock does NOT exercise real Postgres abort semantics — a thrown
// UNIQUE violation here does not poison the surrounding transaction the way it
// would in a live database. The SAVEPOINT wrapping in mintReferralCodeIfAbsent
// exists for that real behaviour and is verified structurally (retry count), not
// by reproducing the abort.

interface ExecCall {
  text: string;
  params: unknown[];
}

function readQuery(q: unknown): ExecCall {
  const chunks = (q as { queryChunks?: unknown[] })?.queryChunks ?? [];
  const textParts: string[] = [];
  const params: unknown[] = [];
  for (const c of chunks) {
    const value = (c as { value?: unknown }).value;
    if (Array.isArray(value)) {
      textParts.push(value.join(''));
    } else {
      params.push(c);
    }
  }
  return {
    text: textParts.join(' ').replace(/\s+/g, ' ').trim(),
    params,
  };
}

interface MockDbOptions {
  /** The locked subscription row, or null to simulate no row. */
  row: {
    status: string;
    provider?: 'stripe' | 'apple';
    stripe_subscription_id?: string | null;
  } | null;
  /** Current users.referral_code (null = unminted). */
  referralCode?: string | null;
  /** Number of leading referral_code UPDATEs that throw a UNIQUE (23505) violation. */
  mintCollisions?: number;
}

function makeDb(opts: MockDbOptions) {
  const calls: ExecCall[] = [];
  let collisionsLeft = opts.mintCollisions ?? 0;

  const tx = {
    execute: vi.fn(async (q: unknown) => {
      const call = readQuery(q);
      calls.push(call);

      if (/^SELECT status/.test(call.text)) {
        if (opts.row === null) return [];
        return [
          {
            status: opts.row.status,
            provider: opts.row.provider ?? 'stripe',
            stripe_subscription_id: opts.row.stripe_subscription_id ?? null,
          },
        ];
      }
      if (/^SELECT referral_code/.test(call.text)) {
        return [{ referral_code: opts.referralCode ?? null }];
      }
      if (/UPDATE users SET referral_code/.test(call.text)) {
        if (collisionsLeft > 0) {
          collisionsLeft -= 1;
          const err: Error & { code?: string } = new Error('duplicate key');
          err.code = '23505';
          throw err;
        }
        return [];
      }
      return [];
    }),
    // nested transaction == SAVEPOINT: run the callback against the same tx.
    transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const db = {
    transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  return { db: db as unknown as Database, tx, calls };
}

function statusWrites(calls: ExecCall[]) {
  const sub = calls.find((c) => /UPDATE subscriptions SET status/.test(c.text));
  const user = calls.find((c) =>
    /UPDATE users SET subscription_status/.test(c.text),
  );
  return { sub, user };
}

// --- every legal edge succeeds ----------------------------------------------

type LegalCase = {
  name: string;
  from: string;
  to: string;
  run: (db: Database) => Promise<void>;
};

const LEGAL_CASES: LegalCase[] = [
  { name: 'trial->active', from: 'trial', to: 'active', run: (db) => transitionToActive(db, 'u1') },
  { name: 'past_due->active', from: 'past_due', to: 'active', run: (db) => transitionToActive(db, 'u1') },
  { name: 'read_only->active', from: 'read_only', to: 'active', run: (db) => transitionToActive(db, 'u1') },
  { name: 'archived->active', from: 'archived', to: 'active', run: (db) => transitionToActive(db, 'u1') },
  { name: 'active->past_due', from: 'active', to: 'past_due', run: (db) => transitionToPastDue(db, 'u1') },
  { name: 'trial->read_only', from: 'trial', to: 'read_only', run: (db) => transitionToReadOnly(db, 'u1') },
  { name: 'active->read_only', from: 'active', to: 'read_only', run: (db) => transitionToReadOnly(db, 'u1') },
  { name: 'past_due->read_only', from: 'past_due', to: 'read_only', run: (db) => transitionToReadOnly(db, 'u1') },
  { name: 'read_only->archived', from: 'read_only', to: 'archived', run: (db) => transitionToArchived(db, 'u1') },
  { name: 'archived->deletion_scheduled', from: 'archived', to: 'deletion_scheduled', run: (db) => transitionToDeletionScheduled(db, 'u1') },
];

describe('legal transitions', () => {
  for (const c of LEGAL_CASES) {
    it(`${c.name} writes status + users cache`, async () => {
      // referralCode preset so the active path skips minting (covered separately).
      const { db, calls } = makeDb({
        row: { status: c.from, provider: 'stripe', stripe_subscription_id: 'sub_1' },
        referralCode: 'EXIST1',
      });

      await expect(c.run(db)).resolves.toBeUndefined();

      const { sub, user } = statusWrites(calls);
      expect(sub).toBeDefined();
      expect(user).toBeDefined();
      expect(sub!.params).toContain(c.to);
      expect(user!.params).toContain(c.to);
    });
  }

  it('requestDeletion succeeds from a non-archived live state (explicit edge)', async () => {
    const { db, calls } = makeDb({
      row: { status: 'active', provider: 'apple', stripe_subscription_id: null },
    });
    await expect(requestDeletion(db, 'u1', 'other')).resolves.toBeUndefined();
    const { sub, user } = statusWrites(calls);
    expect(sub!.params).toContain('deletion_scheduled');
    expect(user!.params).toContain('deletion_scheduled');
  });
});

// --- every illegal edge throws ----------------------------------------------

type IllegalCase = {
  name: string;
  from: string;
  run: (db: Database) => Promise<void>;
};

const ILLEGAL_CASES: IllegalCase[] = [
  { name: 'active->active', from: 'active', run: (db) => transitionToActive(db, 'u1') },
  { name: 'deletion_scheduled->active', from: 'deletion_scheduled', run: (db) => transitionToActive(db, 'u1') },
  { name: 'trial->past_due', from: 'trial', run: (db) => transitionToPastDue(db, 'u1') },
  { name: 'read_only->past_due', from: 'read_only', run: (db) => transitionToPastDue(db, 'u1') },
  { name: 'archived->read_only', from: 'archived', run: (db) => transitionToReadOnly(db, 'u1') },
  { name: 'deletion_scheduled->read_only (restore is NOT a machine edge)', from: 'deletion_scheduled', run: (db) => transitionToReadOnly(db, 'u1') },
  { name: 'active->archived', from: 'active', run: (db) => transitionToArchived(db, 'u1') },
  { name: 'trial->archived', from: 'trial', run: (db) => transitionToArchived(db, 'u1') },
  { name: 'trial->deletion_scheduled (natural path)', from: 'trial', run: (db) => transitionToDeletionScheduled(db, 'u1') },
  { name: 'read_only->deletion_scheduled (natural path)', from: 'read_only', run: (db) => transitionToDeletionScheduled(db, 'u1') },
];

describe('illegal transitions', () => {
  for (const c of ILLEGAL_CASES) {
    it(`${c.name} throws`, async () => {
      const { db, calls } = makeDb({
        row: { status: c.from, provider: 'stripe', stripe_subscription_id: 'sub_1' },
      });
      await expect(c.run(db)).rejects.toBeInstanceOf(
        IllegalSubscriptionTransitionError,
      );
      // no status write happened.
      expect(statusWrites(calls).sub).toBeUndefined();
    });
  }

  it('throws when no subscription row exists', async () => {
    const { db } = makeDb({ row: null });
    await expect(transitionToActive(db, 'u1')).rejects.toBeInstanceOf(
      IllegalSubscriptionTransitionError,
    );
  });
});

// --- referral mint -----------------------------------------------------------

describe('referral_code mint (transitionToActive)', () => {
  it('mints on first active when none exists', async () => {
    const { db, calls } = makeDb({
      row: { status: 'trial' },
      referralCode: null,
    });
    await transitionToActive(db, 'u1');
    const mints = calls.filter((c) =>
      /UPDATE users SET referral_code/.test(c.text),
    );
    expect(mints.length).toBe(1);
  });

  it('is idempotent: a second active does not change an existing code', async () => {
    const { db, calls } = makeDb({
      row: { status: 'read_only' },
      referralCode: 'ABC123',
    });
    await transitionToActive(db, 'u1');
    const mints = calls.filter((c) =>
      /UPDATE users SET referral_code/.test(c.text),
    );
    expect(mints.length).toBe(0);
  });

  it('regenerates and retries on UNIQUE collision without throwing', async () => {
    const { db, calls } = makeDb({
      row: { status: 'trial' },
      referralCode: null,
      mintCollisions: 2,
    });
    await expect(transitionToActive(db, 'u1')).resolves.toBeUndefined();
    const mints = calls.filter((c) =>
      /UPDATE users SET referral_code/.test(c.text),
    );
    // 2 collisions + 1 success, all within the attempt bound.
    expect(mints.length).toBe(3);
  });

  it('gives up after the attempt bound is exhausted', async () => {
    const { db } = makeDb({
      row: { status: 'trial' },
      referralCode: null,
      mintCollisions: REFERRAL_MINT_MAX_ATTEMPTS,
    });
    await expect(transitionToActive(db, 'u1')).rejects.toThrow(
      /Failed to mint a unique referral_code/,
    );
  });
});

// --- 'deleted' is never persisted -------------------------------------------

describe("'deleted' is logical-only", () => {
  it('is not one of the six persisted enum values', () => {
    expect(PERSISTED_SUBSCRIPTION_STATUS).not.toContain('deleted');
    expect(PERSISTED_SUBSCRIPTION_STATUS).toHaveLength(6);
  });

  it('no legal transition writes status=deleted', async () => {
    for (const c of LEGAL_CASES) {
      const { db, calls } = makeDb({
        row: { status: c.from, provider: 'stripe', stripe_subscription_id: 'sub_1' },
        referralCode: 'EXIST1',
      });
      await c.run(db);
      for (const call of calls) {
        if (/UPDATE (subscriptions SET status|users SET subscription_status)/.test(call.text)) {
          expect(call.params).not.toContain('deleted');
        }
      }
    }
  });
});

// --- deletion provider side effects (Stripe cancel mocked) -------------------

function makeStripe(): StripeCanceler & {
  subscriptions: { cancel: ReturnType<typeof vi.fn> };
} {
  return {
    subscriptions: { cancel: vi.fn(async () => ({ status: 'canceled' })) },
  };
}

describe('deletion side effects', () => {
  it('Stripe provider: cancels the subscription after commit', async () => {
    const { db } = makeDb({
      row: {
        status: 'archived',
        provider: 'stripe',
        stripe_subscription_id: 'sub_42',
      },
    });
    const stripe = makeStripe();
    await transitionToDeletionScheduled(db, 'u1', 'other', { stripe });
    expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(1);
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_42');
  });

  it('Apple provider: no Stripe cancel, sets deletion_requested_at', async () => {
    const { db, calls } = makeDb({
      row: {
        status: 'archived',
        provider: 'apple',
        stripe_subscription_id: null,
      },
    });
    const stripe = makeStripe();
    await transitionToDeletionScheduled(db, 'u1', 'other', { stripe });
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    expect(
      calls.some((c) => /UPDATE users SET deletion_requested_at/.test(c.text)),
    ).toBe(true);
  });
});
