import { describe, it, expect } from 'vitest';
import { mapEventToTransition } from './dispatch';

// Pure dispatch mapping — offline, no mocks, no I/O.
describe('mapEventToTransition', () => {
  it('customer.subscription.created -> active (legal from trial), no cancel', () => {
    expect(mapEventToTransition('customer.subscription.created')).toEqual({
      kind: 'active',
      setCanceledAt: false,
      transitions: true,
    });
  });

  it('invoice.payment_succeeded -> active (renewal / dunning recovery)', () => {
    expect(mapEventToTransition('invoice.payment_succeeded')).toEqual({
      kind: 'active',
      setCanceledAt: false,
      transitions: true,
    });
  });

  it('invoice.payment_failed -> past_due', () => {
    expect(mapEventToTransition('invoice.payment_failed')).toEqual({
      kind: 'past_due',
      setCanceledAt: false,
      transitions: true,
    });
  });

  it('customer.subscription.deleted -> read_only + set canceled_at', () => {
    expect(mapEventToTransition('customer.subscription.deleted')).toEqual({
      kind: 'read_only',
      setCanceledAt: true,
      transitions: true,
    });
  });

  it('customer.subscription.trial_will_end -> trial_reminder, no transition', () => {
    expect(mapEventToTransition('customer.subscription.trial_will_end')).toEqual({
      kind: 'trial_reminder',
      setCanceledAt: false,
      transitions: false,
    });
  });

  describe('customer.subscription.updated dispatches on the object status', () => {
    it('status=active -> active', () => {
      expect(
        mapEventToTransition('customer.subscription.updated', 'active'),
      ).toEqual({ kind: 'active', setCanceledAt: false, transitions: true });
    });

    it('status=past_due -> past_due', () => {
      expect(
        mapEventToTransition('customer.subscription.updated', 'past_due'),
      ).toEqual({ kind: 'past_due', setCanceledAt: false, transitions: true });
    });

    it('status=canceled -> read_only + set canceled_at', () => {
      expect(
        mapEventToTransition('customer.subscription.updated', 'canceled'),
      ).toEqual({ kind: 'read_only', setCanceledAt: true, transitions: true });
    });

    it('status=unpaid -> read_only + set canceled_at', () => {
      expect(
        mapEventToTransition('customer.subscription.updated', 'unpaid'),
      ).toEqual({ kind: 'read_only', setCanceledAt: true, transitions: true });
    });

    it('unhandled status (e.g. trialing / incomplete) -> none, no transition', () => {
      for (const s of ['trialing', 'incomplete', 'paused', undefined]) {
        expect(
          mapEventToTransition('customer.subscription.updated', s),
        ).toEqual({ kind: 'none', setCanceledAt: false, transitions: false });
      }
    });
  });

  it('unknown event type -> none (audit-only)', () => {
    expect(mapEventToTransition('customer.subscription.paused')).toEqual({
      kind: 'none',
      setCanceledAt: false,
      transitions: false,
    });
  });

  it('every transitions=true kind is a real state-machine target', () => {
    const kinds = [
      'customer.subscription.created',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'customer.subscription.deleted',
    ].map((t) => mapEventToTransition(t));
    for (const d of kinds) {
      expect(['active', 'past_due', 'read_only']).toContain(d.kind);
      expect(d.transitions).toBe(true);
    }
  });
});
