// Pure Stripe-event → subscription-transition mapping (Chat 084). NO I/O, NO
// imports — (event.type, the Stripe object's own status) → a transition descriptor.
// This is the single, offline-tested source of the dispatch decision; the worker
// (./index.ts) fetches the event, calls this, and executes the descriptor. Keeping
// the mapping pure lets every branch be asserted with fabricated inputs and no mocks
// (mirrors the 066 gcal-channel-renewal.logic split).
//
// Legal-source confirmation against packages/shared/src/subscriptionState.ts (§8):
//   active    <- trial, past_due, read_only, archived   (NOT active — renewal-while-
//                active is handled by the already-in-target guard in ./index.ts, not
//                by a transition)
//   past_due  <- active
//   read_only <- trial, active, past_due
// The `transitions` flag is true only for the three kinds that call a state-machine
// fn; `trial_reminder` (writes pending_trial_reminder) and `none` (audit-only) do not.

/** The kind of action a Stripe event maps to. */
export type TransitionKind =
  | 'active'
  | 'past_due'
  | 'read_only'
  | 'trial_reminder'
  | 'none';

/** The resolved intent of a single Stripe event (side-effect-free). */
export interface TransitionDescriptor {
  /** Which subscription action this event drives. */
  kind: TransitionKind;
  /** Set subscriptions.canceled_at on this event (the cancel / delete path). */
  setCanceledAt: boolean;
  /**
   * A real §8 state transition runs (active / past_due / read_only). False for
   * trial_reminder (flag write, no transition) and none (audit-only). Gates the
   * monotonic-ordering advance and the 5-minute reconcile enqueue.
   */
  transitions: boolean;
}

const ACTIVE: TransitionDescriptor = {
  kind: 'active',
  setCanceledAt: false,
  transitions: true,
};
const PAST_DUE: TransitionDescriptor = {
  kind: 'past_due',
  setCanceledAt: false,
  transitions: true,
};
const READ_ONLY_CANCEL: TransitionDescriptor = {
  kind: 'read_only',
  setCanceledAt: true,
  transitions: true,
};
const TRIAL_REMINDER: TransitionDescriptor = {
  kind: 'trial_reminder',
  setCanceledAt: false,
  transitions: false,
};
const NONE: TransitionDescriptor = {
  kind: 'none',
  setCanceledAt: false,
  transitions: false,
};

/**
 * Map a Stripe event to its intended subscription action.
 *
 * `objectStatus` is the Stripe object's own `status` (the subscription status for
 * customer.subscription.* events; undefined for invoice.* events). It is consulted
 * only for customer.subscription.updated, whose target is status-dependent:
 *   active           -> transitionToActive
 *   past_due         -> transitionToPastDue
 *   canceled | unpaid-> transitionToReadOnly (+ set canceled_at)
 *   anything else    -> none (audit-only; e.g. trialing / incomplete / paused)
 */
export function mapEventToTransition(
  eventType: string,
  objectStatus?: string,
): TransitionDescriptor {
  switch (eventType) {
    case 'customer.subscription.created':
      // New sub (active / trialing) — legal from the trial row (§8 active <- trial).
      return ACTIVE;

    case 'customer.subscription.updated':
      switch (objectStatus) {
        case 'active':
          return ACTIVE;
        case 'past_due':
          return PAST_DUE;
        case 'canceled':
        case 'unpaid':
          return READ_ONLY_CANCEL;
        default:
          return NONE;
      }

    case 'customer.subscription.deleted':
      // Cancellation delivered as a delete — read_only + record canceled_at.
      return READ_ONLY_CANCEL;

    case 'invoice.payment_succeeded':
      // Renewal / dunning recovery — back to active (guarded when already active).
      return ACTIVE;

    case 'invoice.payment_failed':
      // First failed charge — active -> past_due (dunning begins).
      return PAST_DUE;

    case 'customer.subscription.trial_will_end':
      // No state change — sets pending_trial_reminder as a redundancy signal (§8).
      return TRIAL_REMINDER;

    default:
      return NONE;
  }
}
