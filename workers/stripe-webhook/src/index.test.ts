import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type Stripe from 'stripe';
import type { Database } from '@vesper/db';
import { IllegalSubscriptionTransitionError } from '@vesper/shared/subscriptionState';
import {
  handleStripeWebhook,
  type TransitionFns,
  type StripeVerifier,
  type WebhookDeps,
} from './index';

// --- test doubles -------------------------------------------------------------

interface SubRow {
  user_id: string;
  status: string;
  last_event_at: string | Date | null;
}

/** Flatten a drizzle SQL object's static text chunks (params excluded) for matching. */
function staticSql(q: unknown): string {
  const chunks = (q as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks
    .map((c) => {
      if (!c) return ''; // drizzle pushes a raw null for a null-valued param.
      const v = (c as { value?: unknown }).value;
      return Array.isArray(v) ? v.join('') : '';
    })
    .join(' ');
}

/**
 * Mocked Drizzle client. Returns are keyed by the query's semantics (not call order),
 * so the mock is robust to branch-dependent call sequences:
 *   - the subscriptions lookup  -> [sub] or []
 *   - the subscription_events insert (idempotency claim) -> [{id}] or [] (duplicate)
 *   - everything else (updates / delayed_jobs / mark-processed) -> []
 */
function makeDb(opts: { sub?: SubRow | null; claimed?: boolean }): Database & {
  execute: Mock;
} {
  const execute = vi.fn((q: unknown) => {
    const t = staticSql(q);
    if (t.includes('FROM') && t.includes('subscriptions') && t.includes('user_id') &&
        t.includes('SELECT')) {
      return Promise.resolve(opts.sub ? [opts.sub] : []);
    }
    if (t.includes('INSERT INTO') && t.includes('subscription_events')) {
      return Promise.resolve(opts.claimed === false ? [] : [{ id: 'evt_row_1' }]);
    }
    return Promise.resolve([]);
  });
  return { execute } as unknown as Database & { execute: Mock };
}

function makeFns(): TransitionFns & {
  transitionToActive: Mock;
  transitionToPastDue: Mock;
  transitionToReadOnly: Mock;
} {
  return {
    transitionToActive: vi.fn().mockResolvedValue(undefined),
    transitionToPastDue: vi.fn().mockResolvedValue(undefined),
    transitionToReadOnly: vi.fn().mockResolvedValue(undefined),
  };
}

function stripeStub(result: Stripe.Event | Error): StripeVerifier {
  return {
    webhooks: {
      constructEvent: vi.fn(() => {
        if (result instanceof Error) throw result;
        return result;
      }),
    },
  } as unknown as StripeVerifier;
}

function subEvent(
  type: string,
  opts: {
    status?: string;
    id?: string;
    created?: number;
    customer?: string;
    subId?: string;
  } = {},
): Stripe.Event {
  return {
    id: opts.id ?? 'evt_1',
    type,
    created: opts.created ?? 1_700_000_000,
    data: {
      object: {
        id: opts.subId ?? 'sub_1',
        customer: opts.customer ?? 'cus_1',
        status: opts.status,
      },
    },
  } as unknown as Stripe.Event;
}

function invoiceEvent(
  type: string,
  opts: { id?: string; created?: number; customer?: string; subId?: string } = {},
): Stripe.Event {
  return {
    id: opts.id ?? 'evt_1',
    type,
    created: opts.created ?? 1_700_000_000,
    data: {
      object: {
        customer: opts.customer ?? 'cus_1',
        subscription: opts.subId ?? 'sub_1',
      },
    },
  } as unknown as Stripe.Event;
}

function req(body = '{"raw":true}', sig: string | null = 'sig_header'): Request {
  const headers: Record<string, string> = {};
  if (sig !== null) headers['stripe-signature'] = sig;
  return new Request('https://worker.test/', { method: 'POST', body, headers });
}

function deps(
  db: Database,
  stripe: StripeVerifier,
  transitions: TransitionFns,
): WebhookDeps {
  return { db, stripe, webhookSecret: 'whsec_test', transitions };
}

const executed = (db: Database & { execute: Mock }): string[] =>
  db.execute.mock.calls.map((c) => staticSql(c[0]));

beforeEach(() => vi.clearAllMocks());

// --- signature ----------------------------------------------------------------

describe('signature verification', () => {
  it('mismatch -> 400, no DB work', async () => {
    const db = makeDb({ sub: null });
    const fns = makeFns();
    const res = await handleStripeWebhook(
      req(),
      deps(db, stripeStub(new Error('bad sig')), fns),
    );
    expect(res.status).toBe(400);
    expect(db.execute).not.toHaveBeenCalled();
    expect(fns.transitionToActive).not.toHaveBeenCalled();
  });
});

// --- per-event dispatch -------------------------------------------------------

describe('valid signature dispatches the correct transition exactly once', () => {
  it('customer.subscription.created (from trial) -> transitionToActive', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'trial', last_event_at: null } });
    const fns = makeFns();
    const res = await handleStripeWebhook(
      req(),
      deps(db, stripeStub(subEvent('customer.subscription.created', { status: 'active' })), fns),
    );
    expect(res.status).toBe(200);
    expect(fns.transitionToActive).toHaveBeenCalledTimes(1);
    expect(fns.transitionToActive).toHaveBeenCalledWith(db, 'u1');
    expect(fns.transitionToPastDue).not.toHaveBeenCalled();
    expect(fns.transitionToReadOnly).not.toHaveBeenCalled();
  });

  it('invoice.payment_succeeded (from past_due) -> transitionToActive', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'past_due', last_event_at: null } });
    const fns = makeFns();
    const res = await handleStripeWebhook(
      req(),
      deps(db, stripeStub(invoiceEvent('invoice.payment_succeeded')), fns),
    );
    expect(res.status).toBe(200);
    expect(fns.transitionToActive).toHaveBeenCalledTimes(1);
  });

  it('invoice.payment_failed (from active) -> transitionToPastDue', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'active', last_event_at: null } });
    const fns = makeFns();
    await handleStripeWebhook(
      req(),
      deps(db, stripeStub(invoiceEvent('invoice.payment_failed')), fns),
    );
    expect(fns.transitionToPastDue).toHaveBeenCalledTimes(1);
    expect(fns.transitionToActive).not.toHaveBeenCalled();
  });

  it('customer.subscription.deleted -> transitionToReadOnly AND sets canceled_at', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'active', last_event_at: null } });
    const fns = makeFns();
    await handleStripeWebhook(
      req(),
      deps(db, stripeStub(subEvent('customer.subscription.deleted', { status: 'canceled' })), fns),
    );
    expect(fns.transitionToReadOnly).toHaveBeenCalledTimes(1);
    expect(executed(db).some((s) => s.includes('canceled_at'))).toBe(true);
  });

  it('customer.subscription.updated status=active -> transitionToActive', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'past_due', last_event_at: null } });
    const fns = makeFns();
    await handleStripeWebhook(
      req(),
      deps(db, stripeStub(subEvent('customer.subscription.updated', { status: 'active' })), fns),
    );
    expect(fns.transitionToActive).toHaveBeenCalledTimes(1);
  });

  it('customer.subscription.updated status=past_due -> transitionToPastDue', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'active', last_event_at: null } });
    const fns = makeFns();
    await handleStripeWebhook(
      req(),
      deps(db, stripeStub(subEvent('customer.subscription.updated', { status: 'past_due' })), fns),
    );
    expect(fns.transitionToPastDue).toHaveBeenCalledTimes(1);
  });

  it('customer.subscription.updated status=canceled -> transitionToReadOnly + canceled_at', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'active', last_event_at: null } });
    const fns = makeFns();
    await handleStripeWebhook(
      req(),
      deps(db, stripeStub(subEvent('customer.subscription.updated', { status: 'canceled' })), fns),
    );
    expect(fns.transitionToReadOnly).toHaveBeenCalledTimes(1);
    expect(executed(db).some((s) => s.includes('canceled_at'))).toBe(true);
  });
});

// --- audit / idempotency / ordering / guards ---------------------------------

describe('every processed event is written to subscription_events', () => {
  it('inserts the idempotency/audit row before dispatching', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'active', last_event_at: null } });
    const fns = makeFns();
    await handleStripeWebhook(
      req(),
      deps(db, stripeStub(invoiceEvent('invoice.payment_failed')), fns),
    );
    expect(
      executed(db).some(
        (s) => s.includes('INSERT INTO') && s.includes('subscription_events'),
      ),
    ).toBe(true);
  });
});

describe('idempotency', () => {
  it('replayed event (ON CONFLICT, zero rows) -> 200, no transition, no reconcile', async () => {
    const db = makeDb({
      sub: { user_id: 'u1', status: 'active', last_event_at: null },
      claimed: false,
    });
    const fns = makeFns();
    const res = await handleStripeWebhook(
      req(),
      deps(db, stripeStub(invoiceEvent('invoice.payment_failed')), fns),
    );
    expect(res.status).toBe(200);
    expect(fns.transitionToPastDue).not.toHaveBeenCalled();
    expect(executed(db).some((s) => s.includes('delayed_jobs'))).toBe(false);
  });
});

describe('monotonic ordering guard', () => {
  it('event older than last_event_at - 24h -> audited, transition skipped, 200', async () => {
    // last_event_at is 3 days newer than the inbound event.created.
    const lastEventAt = '2026-07-10T00:00:00.000Z';
    const staleCreated = Math.floor(new Date('2026-07-07T00:00:00.000Z').getTime() / 1000);
    const db = makeDb({
      sub: { user_id: 'u1', status: 'active', last_event_at: lastEventAt },
    });
    const fns = makeFns();
    const res = await handleStripeWebhook(
      req(),
      deps(db, stripeStub(invoiceEvent('invoice.payment_failed', { created: staleCreated })), fns),
    );
    expect(res.status).toBe(200);
    expect(fns.transitionToPastDue).not.toHaveBeenCalled();
    // Still audited (idempotency insert ran) but no reconcile enqueued.
    expect(
      executed(db).some((s) => s.includes('subscription_events')),
    ).toBe(true);
    expect(executed(db).some((s) => s.includes('delayed_jobs'))).toBe(false);
  });
});

describe('already-in-target guard (choice a)', () => {
  it('renewal while already active -> no throw, no transition, audit + 200', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'active', last_event_at: null } });
    const fns = makeFns();
    const res = await handleStripeWebhook(
      req(),
      deps(db, stripeStub(invoiceEvent('invoice.payment_succeeded')), fns),
    );
    expect(res.status).toBe(200);
    expect(fns.transitionToActive).not.toHaveBeenCalled();
    expect(executed(db).some((s) => s.includes('delayed_jobs'))).toBe(false);
  });
});

describe('genuinely illegal source', () => {
  it('IllegalSubscriptionTransitionError -> caught, processing_error recorded, 200', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'trial', last_event_at: null } });
    const fns = makeFns();
    fns.transitionToPastDue.mockRejectedValueOnce(
      new IllegalSubscriptionTransitionError('trial', 'past_due'),
    );
    const res = await handleStripeWebhook(
      req(),
      deps(db, stripeStub(invoiceEvent('invoice.payment_failed')), fns),
    );
    expect(res.status).toBe(200);
    expect(fns.transitionToPastDue).toHaveBeenCalledTimes(1);
    expect(executed(db).some((s) => s.includes('processing_error'))).toBe(true);
    expect(executed(db).some((s) => s.includes('delayed_jobs'))).toBe(false);
  });
});

// --- trial_will_end -----------------------------------------------------------

describe('customer.subscription.trial_will_end', () => {
  it('no transition; sets pending_trial_reminder; audits the event; 200', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'trial', last_event_at: null } });
    const fns = makeFns();
    const res = await handleStripeWebhook(
      req(),
      deps(db, stripeStub(subEvent('customer.subscription.trial_will_end', { status: 'trialing' })), fns),
    );
    expect(res.status).toBe(200);
    expect(fns.transitionToActive).not.toHaveBeenCalled();
    expect(fns.transitionToPastDue).not.toHaveBeenCalled();
    expect(fns.transitionToReadOnly).not.toHaveBeenCalled();
    expect(executed(db).some((s) => s.includes('pending_trial_reminder'))).toBe(true);
    expect(executed(db).some((s) => s.includes('subscription_events'))).toBe(true);
    expect(executed(db).some((s) => s.includes('delayed_jobs'))).toBe(false);
  });
});

// --- reconcile enqueue --------------------------------------------------------

describe('5-minute reconcile job', () => {
  it('a real transition enqueues the delayed_jobs reconcile row with the correct shape', async () => {
    const db = makeDb({ sub: { user_id: 'u1', status: 'active', last_event_at: null } });
    const fns = makeFns();
    await handleStripeWebhook(
      req(),
      deps(db, stripeStub(invoiceEvent('invoice.payment_failed')), fns),
    );
    const insert = executed(db).find(
      (s) => s.includes('INSERT INTO') && s.includes('delayed_jobs'),
    );
    expect(insert).toBeDefined();
    expect(insert).toContain('reconcile_subscription');
    expect(insert).toContain('jsonb_build_object');
    expect(insert).toContain("interval '5 minutes'");
  });
});

// --- unresolvable user --------------------------------------------------------

describe('unresolvable user', () => {
  it('no subscriptions row -> event audited (user_id null), no transition, 200', async () => {
    const db = makeDb({ sub: null });
    const fns = makeFns();
    const res = await handleStripeWebhook(
      req(),
      deps(db, stripeStub(invoiceEvent('invoice.payment_failed')), fns),
    );
    expect(res.status).toBe(200);
    expect(fns.transitionToPastDue).not.toHaveBeenCalled();
    expect(executed(db).some((s) => s.includes('subscription_events'))).toBe(true);
    expect(executed(db).some((s) => s.includes('delayed_jobs'))).toBe(false);
  });
});
