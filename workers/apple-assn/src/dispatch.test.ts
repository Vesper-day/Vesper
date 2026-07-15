// @vitest-environment node
//
// Pure dispatch-mapping tests for the ASSN V2 worker (Chat 087 part 1, EXTENDED by Chat
// 088 part 2). No mocks, no I/O — fabricated (notificationType, subtype) in, transition
// descriptor out. Asserts the five part-1 §8 mappings, the two §8-over-build-plan
// divergences (REVOKE→read_only, REFUND→read_only+canceled_at), the part-2 ten + TEST,
// the unknown-type audit-only fallback, and subtype boundary cases.
import { describe, it, expect } from 'vitest';
import { mapNotificationToTransition, isMutation } from './dispatch';

describe('mapNotificationToTransition — the five §8 part-1 types', () => {
  it('SUBSCRIBED → transitionToActive (any subtype)', () => {
    for (const subtype of ['INITIAL_BUY', 'RESUBSCRIBE', undefined]) {
      const d = mapNotificationToTransition('SUBSCRIBED', subtype);
      expect(d.kind).toBe('active');
      expect(d.transitions).toBe(true);
      expect(d.updatePeriod).toBe(false);
      expect(d.setCanceledAt).toBe(false);
      expect(isMutation(d)).toBe(true);
    }
  });

  it('DID_RENEW → period-window update, NO transition', () => {
    const d = mapNotificationToTransition('DID_RENEW');
    expect(d.kind).toBe('renew');
    expect(d.transitions).toBe(false);
    expect(d.updatePeriod).toBe(true);
    expect(d.setCanceledAt).toBe(false);
    expect(isMutation(d)).toBe(true); // a real mutation → advances last_event_at + reconcile
  });

  it('EXPIRED → transitionToReadOnly for BOTH §8 subtypes', () => {
    for (const subtype of ['BILLING_RETRY_PERIOD', 'VOLUNTARY']) {
      const d = mapNotificationToTransition('EXPIRED', subtype);
      expect(d.kind).toBe('read_only');
      expect(d.transitions).toBe(true);
      expect(d.setCanceledAt).toBe(false);
    }
  });

  it('EXPIRED → read_only for an unlisted/absent subtype too (subtype boundary)', () => {
    for (const subtype of ['PRODUCT_NOT_FOR_SALE', 'GRACE_PERIOD_EXPIRED', undefined]) {
      const d = mapNotificationToTransition('EXPIRED', subtype);
      expect(d.kind).toBe('read_only');
      expect(d.transitions).toBe(true);
    }
  });

  it('REVOKE → transitionToReadOnly (§8 wins over build-plan → archived)', () => {
    const d = mapNotificationToTransition('REVOKE');
    expect(d.kind).toBe('read_only');
    expect(d.transitions).toBe(true);
    expect(d.setCanceledAt).toBe(false);
  });

  it('REFUND → transitionToReadOnly + set canceled_at (§8 wins over build-plan → no-op)', () => {
    const d = mapNotificationToTransition('REFUND');
    expect(d.kind).toBe('read_only');
    expect(d.transitions).toBe(true);
    expect(d.setCanceledAt).toBe(true);
    expect(isMutation(d)).toBe(true);
  });
});

describe('mapNotificationToTransition — part-2 transitioning types', () => {
  it('DID_FAIL_TO_RENEW → transitionToPastDue (§8-TRANSCRIBED — the only one of the ten in §8)', () => {
    const d = mapNotificationToTransition('DID_FAIL_TO_RENEW');
    expect(d.kind).toBe('past_due');
    expect(d.transitions).toBe(true);
    expect(d.updatePeriod).toBe(false);
    expect(d.setCanceledAt).toBe(false);
    expect(d.clearCanceledAt).toBe(false);
    expect(d.setCancelAtPeriodEnd).toBeNull();
    expect(isMutation(d)).toBe(true);
  });

  it('GRACE_PERIOD_EXPIRED → transitionToReadOnly (Apple-docs-determined)', () => {
    const d = mapNotificationToTransition('GRACE_PERIOD_EXPIRED');
    expect(d.kind).toBe('read_only');
    expect(d.transitions).toBe(true);
    expect(d.setCanceledAt).toBe(false);
    expect(isMutation(d)).toBe(true);
  });

  it('REFUND_REVERSED → transitionToActive + CLEAR canceled_at (read_only is a legal 081 source)', () => {
    const d = mapNotificationToTransition('REFUND_REVERSED');
    expect(d.kind).toBe('active');
    expect(d.transitions).toBe(true);
    expect(d.clearCanceledAt).toBe(true);
    expect(d.setCanceledAt).toBe(false);
    expect(isMutation(d)).toBe(true);
  });
});

describe('mapNotificationToTransition — part-2 period / flag updates (no transition)', () => {
  it('RENEWAL_EXTENDED → period-window update, NO transition, IS a mutation (reconcile)', () => {
    const d = mapNotificationToTransition('RENEWAL_EXTENDED');
    expect(d.kind).toBe('renew');
    expect(d.transitions).toBe(false);
    expect(d.updatePeriod).toBe(true);
    expect(d.setCancelAtPeriodEnd).toBeNull();
    expect(isMutation(d)).toBe(true); // a real mutation → reconcile enqueued
  });

  it('DID_CHANGE_RENEWAL_STATUS/AUTO_RENEW_DISABLED → cancel_at_period_end = true, NO transition', () => {
    const d = mapNotificationToTransition('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED');
    expect(d.kind).toBe('renewal_status');
    expect(d.transitions).toBe(false);
    expect(d.updatePeriod).toBe(false);
    expect(d.setCancelAtPeriodEnd).toBe(true);
    expect(isMutation(d)).toBe(true);
  });

  it('DID_CHANGE_RENEWAL_STATUS/AUTO_RENEW_ENABLED → cancel_at_period_end = false, NO transition', () => {
    const d = mapNotificationToTransition('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_ENABLED');
    expect(d.kind).toBe('renewal_status');
    expect(d.transitions).toBe(false);
    expect(d.setCancelAtPeriodEnd).toBe(false);
    expect(isMutation(d)).toBe(true); // `false` is a MEANINGFUL write, not a no-op
  });

  it('DID_CHANGE_RENEWAL_STATUS with no/unknown subtype → audit-only (never guesses the flag)', () => {
    for (const subtype of [undefined, 'SOMETHING_ELSE']) {
      const d = mapNotificationToTransition('DID_CHANGE_RENEWAL_STATUS', subtype);
      expect(d.kind).toBe('none');
      expect(d.setCancelAtPeriodEnd).toBeNull();
      expect(isMutation(d)).toBe(false);
    }
  });
});

describe('mapNotificationToTransition — audit-only (no transition)', () => {
  it('the four audit-only part-2 types → none', () => {
    for (const t of [
      'PRICE_INCREASE', // Apple owns the consent flow
      'OFFER_REDEEMED', // state carried by the accompanying SUBSCRIBED/DID_RENEW
      'REFUND_DECLINED', // refund request declined; subscription unchanged
      'DID_CHANGE_RENEWAL_PREF', // referral_credits scope — NOT written by this worker
    ]) {
      const d = mapNotificationToTransition(t);
      expect(d.kind).toBe('none');
      expect(d.transitions).toBe(false);
      expect(d.updatePeriod).toBe(false);
      expect(d.setCancelAtPeriodEnd).toBeNull();
      expect(isMutation(d)).toBe(false);
    }
  });

  it('TEST → test kind: not a mutation (no lock, no transition, no reconcile)', () => {
    const d = mapNotificationToTransition('TEST');
    expect(d.kind).toBe('test');
    expect(d.transitions).toBe(false);
    expect(d.updatePeriod).toBe(false);
    expect(d.setCancelAtPeriodEnd).toBeNull();
    expect(isMutation(d)).toBe(false);
  });

  it('an unknown notificationType → none (audit-only, 200)', () => {
    for (const t of ['TOTALLY_UNKNOWN', 'CONSUMPTION_REQUEST', '']) {
      const d = mapNotificationToTransition(t);
      expect(d.kind).toBe('none');
      expect(d.transitions).toBe(false);
      expect(isMutation(d)).toBe(false);
    }
  });

  it('subtype never upgrades an unknown type into a transition', () => {
    const d = mapNotificationToTransition('TOTALLY_UNKNOWN', 'AUTO_RENEW_DISABLED');
    expect(d.kind).toBe('none');
    expect(d.transitions).toBe(false);
    expect(d.setCancelAtPeriodEnd).toBeNull();
  });
});
