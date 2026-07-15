// Pure ASSN V2 notification → subscription-action mapping (Chat 087 part 1, EXTENDED by
// Chat 088 part 2 with the remaining ten types + TEST). NO I/O, NO imports —
// (notificationType, subtype) → a transition descriptor. This is the single,
// offline-tested source of the dispatch decision; the worker (./index.ts) verifies the
// JWS, calls this, and executes the descriptor. Keeping the mapping pure lets every
// branch be asserted with fabricated inputs and no mocks (mirrors the 084 dispatch split).
//
// AUTHORITY — TECHNICAL_SPEC §8 "Handled Apple notification types" is authoritative
// over the build-plan impl-notes wherever they diverge. Two known divergences from the
// §087 notes, §8 WINNING (both flagged in that chat's report):
//   * REVOKE  — build-plan said → archived; §8 says → read_only.  We map read_only.
//   * REFUND  — build-plan said → no state change; §8 says → read_only + set
//               subscriptions.canceled_at.  We map read_only + setCanceledAt.
// The §088 build-plan notes do NOT diverge from §8: §8 enumerates exactly ONE of the ten
// part-2 types (DID_FAIL_TO_RENEW → past_due) and the notes agree with it.
//
// PER-TYPE SOURCE (stated in the chat report):
//   §8-TRANSCRIBED (the authoritative table): SUBSCRIBED, DID_RENEW, EXPIRED, REVOKE,
//     REFUND (part 1) and DID_FAIL_TO_RENEW (part 2 — the ONLY one of the ten in §8).
//   APPLE-DOCS-DETERMINED (ASSN V2 docs + §088 impl-notes, cross-checked against the 081
//     legal-source map below): GRACE_PERIOD_EXPIRED, RENEWAL_EXTENDED,
//     DID_CHANGE_RENEWAL_STATUS, REFUND_REVERSED, PRICE_INCREASE, OFFER_REDEEMED,
//     REFUND_DECLINED, DID_CHANGE_RENEWAL_PREF, TEST.
//
// SCOPE FLAG — DID_CHANGE_RENEWAL_PREF. TECHNICAL_SPEC §Payments (referral section) links
// this type to a referral_credits row transitioning to 'applied' (applied_to_provider =
// 'apple', provider_discount_id = the offer id). That is NOT subscription state and
// referral_credits is OUTSIDE this chat's scope, so this worker records the type
// AUDIT-ONLY and does NOT write referral_credits. The spec-linked 'applied' write is left
// UNOWNED — surfaced for the operator / the referral chat to pick up.
//
// Legal-source confirmation against packages/shared/src/subscriptionState.ts (§8), read
// live in Chat 088:
//   transitionToActive   <- trial | past_due | read_only | archived  (NOT active —
//        a SUBSCRIBED replay of an already-active sub is handled by the
//        already-in-target guard in ./index.ts, not by a transition. read_only IS a
//        legal source, which is what makes REFUND_REVERSED → active dispatchable.)
//   transitionToPastDue  <- active ONLY (DID_FAIL_TO_RENEW from any other source is a
//        genuinely-illegal edge → IllegalSubscriptionTransitionError → audited 200)
//   transitionToReadOnly <- active | past_due | trial               (a REVOKE/REFUND/
//        GRACE_PERIOD_EXPIRED against an already-read_only or archived row is caught as
//        an IllegalSubscriptionTransitionError → audited 200, never a 5xx)

/** The kind of action an ASSN V2 notification maps to. */
export type AssnTransitionKind =
  | 'active' // SUBSCRIBED | REFUND_REVERSED → transitionToActive
  | 'past_due' // DID_FAIL_TO_RENEW → transitionToPastDue (§8)
  | 'read_only' // EXPIRED | REVOKE | REFUND | GRACE_PERIOD_EXPIRED → transitionToReadOnly
  | 'renew' // DID_RENEW | RENEWAL_EXTENDED → period-window update only, NO transition
  | 'renewal_status' // DID_CHANGE_RENEWAL_STATUS → cancel_at_period_end flag only
  | 'test' // TEST → 200 fast, audit-log only, no lookup/lock/reconcile
  | 'none'; // PRICE_INCREASE / OFFER_REDEEMED / … / unknown → audit-only

/** The resolved intent of a single ASSN V2 notification (side-effect-free). */
export interface AssnTransitionDescriptor {
  /** Which subscription action this notification drives. */
  kind: AssnTransitionKind;
  /**
   * A real §8 state transition runs (active / past_due / read_only). False for `renew`
   * (period-window write), `renewal_status` (flag write), `test`, and `none`.
   */
  transitions: boolean;
  /**
   * Update current_period_start/current_period_end from the inner transaction
   * (DID_RENEW and RENEWAL_EXTENDED — both carry the authoritative window on the inner
   * signed transaction, so both take the identical write).
   */
  updatePeriod: boolean;
  /** Set subscriptions.canceled_at on this notification (the REFUND path, §8). */
  setCanceledAt: boolean;
  /** Clear subscriptions.canceled_at (REFUND_REVERSED — the refund was undone). */
  clearCanceledAt: boolean;
  /**
   * Write subscriptions.cancel_at_period_end (DID_CHANGE_RENEWAL_STATUS):
   * true ⇐ AUTO_RENEW_DISABLED, false ⇐ AUTO_RENEW_ENABLED. `null` ⇒ no flag write —
   * every other type. Tri-state because `false` is a MEANINGFUL write here.
   */
  setCancelAtPeriodEnd: boolean | null;
}

/** Base: audit-only. Every descriptor below is a delta on this. */
const NONE: AssnTransitionDescriptor = {
  kind: 'none',
  transitions: false,
  updatePeriod: false,
  setCanceledAt: false,
  clearCanceledAt: false,
  setCancelAtPeriodEnd: null,
};
const ACTIVE: AssnTransitionDescriptor = { ...NONE, kind: 'active', transitions: true };
const ACTIVE_REFUND_REVERSED: AssnTransitionDescriptor = {
  ...ACTIVE,
  clearCanceledAt: true,
};
const PAST_DUE: AssnTransitionDescriptor = { ...NONE, kind: 'past_due', transitions: true };
const READ_ONLY: AssnTransitionDescriptor = { ...NONE, kind: 'read_only', transitions: true };
const READ_ONLY_REFUND: AssnTransitionDescriptor = { ...READ_ONLY, setCanceledAt: true };
const RENEW: AssnTransitionDescriptor = { ...NONE, kind: 'renew', updatePeriod: true };
const AUTO_RENEW_OFF: AssnTransitionDescriptor = {
  ...NONE,
  kind: 'renewal_status',
  setCancelAtPeriodEnd: true,
};
const AUTO_RENEW_ON: AssnTransitionDescriptor = {
  ...NONE,
  kind: 'renewal_status',
  setCancelAtPeriodEnd: false,
};
const TEST: AssnTransitionDescriptor = { ...NONE, kind: 'test' };

/**
 * A descriptor drives a real subscriptions mutation (advance last_event_at + enqueue
 * the 5-minute reconcile) when it transitions state, updates the period window, OR
 * writes the cancel_at_period_end flag. Reconcile fires on EVERY real mutation, not on
 * transitions only. `none` (audit-only) and `test` do not.
 */
export function isMutation(d: AssnTransitionDescriptor): boolean {
  return d.transitions || d.updatePeriod || d.setCancelAtPeriodEnd !== null;
}

/**
 * Map an ASSN V2 notification to its intended subscription action.
 *
 * `subtype` is consulted only where §8 / the Apple docs make it meaningful. EXPIRED maps
 * to read_only for EVERY subtype (BILLING_RETRY_PERIOD and VOLUNTARY are the §8-listed
 * pair; any other/absent EXPIRED subtype still means the subscription has ended →
 * read_only — build-time determination, stated in the chat report). SUBSCRIBED maps to
 * active regardless of subtype (INITIAL_BUY / RESUBSCRIBE both re-activate).
 * DID_CHANGE_RENEWAL_STATUS is the one type whose subtype DECIDES the write
 * (AUTO_RENEW_DISABLED / AUTO_RENEW_ENABLED); an absent/unrecognized subtype there
 * cannot be resolved to a flag value, so it degrades to audit-only rather than guessing.
 */
export function mapNotificationToTransition(
  notificationType: string,
  subtype?: string,
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

    // --- Chat 088 (part 2) — the remaining ten types + TEST --------------------

    case 'DID_FAIL_TO_RENEW':
      // §8-TRANSCRIBED VERBATIM (the ONLY one of the ten §8 enumerates):
      //   | DID_FAIL_TO_RENEW | — | Set users.subscription_status = 'past_due' |
      // Renewal attempt failed (Apple's analogue of Stripe invoice.payment_failed).
      // transitionToPastDue is legal from 'active' ONLY; any other source is a genuine
      // illegal edge → audited 200 by ./index.ts, never a 5xx.
      return PAST_DUE;

    case 'GRACE_PERIOD_EXPIRED':
      // Apple-docs-determined: the grace period after a failed renewal elapsed without
      // resolution → the subscription has lapsed → read_only. An already-read_only row
      // is caught by the already-in-target guard in ./index.ts (no illegal call).
      return READ_ONLY;

    case 'RENEWAL_EXTENDED':
      // Apple-docs-determined: Apple extended the renewal date (e.g. an outage/goodwill
      // extension). PERIOD-WINDOW UPDATE from the INNER signed transaction, NO status
      // transition — the identical write DID_RENEW takes. It IS a real mutation, so it
      // advances last_event_at and enqueues the 5-minute reconcile.
      return RENEW;

    case 'DID_CHANGE_RENEWAL_STATUS':
      // Apple-docs-determined: the user toggled auto-renew. FLAG UPDATE on
      // cancel_at_period_end only — NO status transition (the subscription stays active
      // through the paid-for period; EXPIRED arrives later if it lapses). A real
      // mutation → reconcile enqueued.
      if (subtype === 'AUTO_RENEW_DISABLED') return AUTO_RENEW_OFF;
      if (subtype === 'AUTO_RENEW_ENABLED') return AUTO_RENEW_ON;
      // Neither subtype ⇒ the flag value is unknowable — audit, do not guess.
      return NONE;

    case 'REFUND_REVERSED':
      // Apple-docs-determined: a previously-granted refund was reversed → access should
      // be restored. Dispatch-safe: the 081 map lists read_only as a LEGAL source for
      // transitionToActive (SOURCES_ACTIVE = trial|past_due|read_only|archived, read
      // live in Chat 088), so this maps to a real transition + clearing canceled_at
      // (which the paired REFUND had set) rather than degrading to audit-only.
      return ACTIVE_REFUND_REVERSED;

    case 'PRICE_INCREASE':
      // Apple-docs-determined: AUDIT-ONLY. Apple owns the user-consent flow; the
      // resulting state (accepted → DID_RENEW; declined → EXPIRED) arrives as its own
      // notification. Nothing to change now.
      return NONE;

    case 'OFFER_REDEEMED':
      // Apple-docs-determined: AUDIT-ONLY. The state change is carried by the
      // accompanying SUBSCRIBED / DID_RENEW notification; acting here would double-apply.
      return NONE;

    case 'REFUND_DECLINED':
      // Apple-docs-determined: AUDIT-ONLY. Apple declined the customer's refund request
      // — the subscription is unchanged by definition.
      return NONE;

    case 'DID_CHANGE_RENEWAL_PREF':
      // Apple-docs-determined: AUDIT-ONLY for SUBSCRIPTION STATE (a plan up/downgrade
      // takes effect at the period boundary and arrives as DID_RENEW then).
      // SCOPE FLAG: TECHNICAL_SPEC §Payments links this type to referral_credits →
      // 'applied'. That table is outside Chat 088's subscription-state scope and is
      // deliberately NOT written here — see the header note.
      return NONE;

    case 'TEST':
      // Apple-docs-determined: App Store Connect's webhook-reachability probe. MUST
      // return 200 within a short window or the URL config is rejected — so ./index.ts
      // audit-logs it and returns immediately: no user lookup, no row lock, no
      // transition, no reconcile.
      return TEST;

    // Any other/unknown notificationType → audit-only, no transition, 200 (087's
    // behavior, extended not broken).
    default:
      return NONE;
  }
}
