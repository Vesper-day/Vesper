// Subscription state-machine stub (minimal — chat 081 owns the authoritative set).
//
// SCOPE: the full subscription state machine lands chat 081 (PHASE_4_BUILD_PLAN).
// This chat ships ONLY throwing stubs so that 081/091 imports compile against a
// real module path. The ONE sourced name is `transitionToActive`
// (PHASE_4_BUILD_PLAN L457); `transitionToReadOnly` is referenced by the chat-030
// kickoff but is UNVERIFIED in project files. Do not grow this API — the
// authoritative names / signatures / path are owned by chat 081 and MUST be
// reconciled there. account/delete and account/restore do NOT call these (they
// perform their own direct `users` UPDATEs per §4); these exports exist purely as
// compile-time anchors for the downstream state-machine work.
import { ApiError, ErrorCode } from '@vesper/shared';

const NOT_IMPLEMENTED = 'Subscription state machine is not implemented until chat 081.';

/**
 * Transition a subscription to the `active` state (trial→active conversion, etc.).
 * STUB — throws until chat 081.
 */
export function transitionToActive(_userId: string): Promise<void> {
  throw new ApiError(ErrorCode.NOT_IMPLEMENTED, NOT_IMPLEMENTED);
}

/**
 * Transition a subscription to the `read_only` state (lapse / grace). STUB —
 * throws until chat 081. (Name unverified in project files; reconcile in 081.)
 */
export function transitionToReadOnly(_userId: string): Promise<void> {
  throw new ApiError(ErrorCode.NOT_IMPLEMENTED, NOT_IMPLEMENTED);
}
