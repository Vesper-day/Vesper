// @vitest-environment node
//
// Pure dispatch-mapping tests for the ASSN V2 worker (Chat 087, part 1). No mocks, no
// I/O — fabricated (notificationType, subtype) in, transition descriptor out. Asserts
// the five §8 mappings, the two §8-over-build-plan divergences (REVOKE→read_only,
// REFUND→read_only+canceled_at), the DID_FAIL_TO_RENEW / unknown audit-only fallback,
// and subtype boundary cases.
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

describe('mapNotificationToTransition — audit-only (no transition)', () => {
  it('DID_FAIL_TO_RENEW → none (a part-2 / Chat 088 type; unmapped here)', () => {
    const d = mapNotificationToTransition('DID_FAIL_TO_RENEW');
    expect(d.kind).toBe('none');
    expect(d.transitions).toBe(false);
    expect(d.updatePeriod).toBe(false);
    expect(isMutation(d)).toBe(false);
  });

  it('an unknown notificationType → none (audit-only, 200)', () => {
    for (const t of ['GRACE_PERIOD_EXPIRED', 'PRICE_INCREASE', 'RENEWAL_EXTENDED', 'TOTALLY_UNKNOWN']) {
      const d = mapNotificationToTransition(t);
      expect(d.kind).toBe('none');
      expect(d.transitions).toBe(false);
      expect(isMutation(d)).toBe(false);
    }
  });

  it('subtype never upgrades an unmapped type into a transition', () => {
    const d = mapNotificationToTransition('DID_FAIL_TO_RENEW', 'GRACE_PERIOD');
    expect(d.kind).toBe('none');
    expect(d.transitions).toBe(false);
  });
});
