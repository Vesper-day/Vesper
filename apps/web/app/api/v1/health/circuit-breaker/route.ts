// GET /api/v1/health/circuit-breaker (Chat 022).
//
// Reports the per-user daily-plan synthesis circuit-breaker state for the
// AUTHED user only (LOCKED Decision 2 — the breaker is keyed by user_id). There
// is no admin / system-wide path: a user sees their own breaker, nothing else.
//
// READ-ONLY: readBreakerState does not prune or write. Returns
//   { open, opensAt?, closesAt? }.
import { createRoute } from '@vesper/shared';
import { readBreakerState, type BreakerState } from '@vesper/ai';

export const GET = createRoute<BreakerState>(async ({ user }) =>
  readBreakerState(user.id),
);
