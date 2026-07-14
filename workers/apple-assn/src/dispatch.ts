// Pure ASSN V2 notification → subscription-action mapping (Chat 087, part 1). NO I/O,
// NO imports — (notificationType, subtype) → a transition descriptor. This is the
// single, offline-tested source of the dispatch decision; the worker (./index.ts)
// verifies the JWS, calls this, and executes the descriptor. Keeping the mapping pure
// lets every branch be asserted with fabricated inputs and no mocks (mirrors the 084
// dispatch split).
//
// AUTHORITY — TECHNICAL_SPEC §8 "Handled Apple notification types" is authoritative
// over the build-plan §087 impl-notes wherever they diverge. Two known divergences,
// §8 WINNING (both flagged in the chat report):
//   * REVOKE  — build-plan said → archived; §8 says → read_only.  We map read_only.
//   * REFUND  — build-plan said → no state change; §8 says → read_only + set
//               subscriptions.canceled_at.  We map read_only + setCanceledAt.
//
// THIS WORKER (part 1) dispatches ONLY these five: SUBSCRIBED, DID_RENEW, EXPIRED,
// REVOKE, REFUND. DID_FAIL_TO_RENEW is a part-2 (Chat 088) type — here it is an
// UNMAPPED type: audit-only, NO transition. Any other/unknown notificationType is
// likewise audit-only, NO transition, 200.
//
// Legal-source confirmation against packages/shared/src/subscriptionState.ts (§8):
//   transitionToActive   <- trial | past_due | read_only | archived  (NOT active —
//        a SUBSCRIBED replay of an already-active sub is handled by the
//        already-in-target guard in ./index.ts, not by a transition)
//   transitionToReadOnly <- active | past_due | trial               (a REVOKE/REFUND
//        against an already-read_only or archived row is caught as an
//        IllegalSubscriptionTransitionError → audited 200, never a 5xx)

/** The kind of action an ASSN V2 notification maps to. */
export type AssnTransitionKind =
  | 'active' // SUBSCRIBED → transitionToActive
  | 'read_only' // EXPIRED | REVOKE | REFUND → transitionToReadOnly
  | 'renew' // DID_RENEW → period-window update only, NO transition
  | 'none'; // DID_FAIL_TO_RENEW / unknown → audit-only

/** The resolved intent of a single ASSN V2 notification (side-effect-free). */
export interface AssnTransitionDescriptor {
  /** Which subscription action this notification drives. */
  kind: AssnTransitionKind;
  /**
   * A real §8 state transition runs (active / read_only). False for `renew`
   * (period-window write, no transition) and `none` (audit-only).
   */
  transitions: boolean;
  /** Update current_period_start/current_period_end from the inner transaction (DID_RENEW). */
  updatePeriod: boolean;
  /** Set subscriptions.canceled_at on this notification (the REFUND path, §8). */
  setCanceledAt: boolean;
}

const ACTIVE: AssnTransitionDescriptor = {
  kind: 'active',
  transitions: true,
  updatePeriod: false,
  setCanceledAt: false,
};
const READ_ONLY: AssnTransitionDescriptor = {
  kind: 'read_only',
  transitions: true,
  updatePeriod: false,
  setCanceledAt: false,
};
const READ_ONLY_REFUND: AssnTransitionDescriptor = {
  kind: 'read_only',
  transitions: true,
  updatePeriod: false,
  setCanceledAt: true,
};
const RENEW: AssnTransitionDescriptor = {
  kind: 'renew',
  transitions: false,
  updatePeriod: true,
  setCanceledAt: false,
};
const NONE: AssnTransitionDescriptor = {
  kind: 'none',
  transitions: false,
  updatePeriod: false,
  setCanceledAt: false,
};

/**
 * A descriptor drives a real subscriptions mutation (advance last_event_at + enqueue
 * the 5-minute reconcile) when it either transitions state or updates the period
 * window. `none` (audit-only) does not.
 */
export function isMutation(d: AssnTransitionDescriptor): boolean {
  return d.transitions || d.updatePeriod;
}

/**
 * Map an ASSN V2 notification to its intended subscription action.
 *
 * `subtype` is consulted only where §8 makes it meaningful. EXPIRED maps to read_only
 * for EVERY subtype (BILLING_RETRY_PERIOD and VOLUNTARY are the §8-listed pair; any
 * other/absent EXPIRED subtype still means the subscription has ended → read_only —
 * build-time determination, stated in the chat report). SUBSCRIBED maps to active
 * regardless of subtype (INITIAL_BUY / RESUBSCRIBE both re-activate).
 */
export function mapNotificationToTransition(
  notificationType: string,
  _subtype?: string,
): AssnTransitionDescriptor {
  switch (notificationType) {
    case 'SUBSCRIBED':
      // New / resubscribed — transitionToActive (legal from trial/past_due/read_only/archived).
      return ACTIVE;

    case 'DID_RENEW':
      // Auto-renewal — advance the period window only, NO status transition (§8).
      return RENEW;

    case 'EXPIRED':
      // Subscription ended (billing-retry lapse or voluntary non-renewal) → read_only.
      return READ_ONLY;

    case 'REVOKE':
      // Family-sharing revoke / entitlement pulled → read_only (§8; NOT archived).
      return READ_ONLY;

    case 'REFUND':
      // App Store refund granted → read_only + set canceled_at (§8; NOT no-op).
      return READ_ONLY_REFUND;

    // DID_FAIL_TO_RENEW is a part-2 (Chat 088) type — audit-only in THIS worker.
    // Everything else is unknown → audit-only, no transition, 200.
    default:
      return NONE;
  }
}
