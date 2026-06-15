// Cache hit/miss observability helper (Chat 021).
//
// Thin logging helper — NO AI calls. Emits a Sentry breadcrumb and a structured
// console line per plan-cache outcome. The chat-071 cache-prewarm worker consumes
// this signal to tell warm hits from cold misses.
//
// completion_log durable insert is BLOCKED, by the same constraint that blocks
// trackCost (see cost/tracker.ts): completion_log.event_type is
// completion_event_enum NOT NULL (migration 20260601000001), whose members are
// block_completed, block_skipped, block_rescheduled, energy_logged,
// plan_generated, plan_regenerated, plan_fallback_served — there is NO cache
// hit/miss member. The columns exist (user_id, event_type, value, ...), but no
// enum value fits, and inventing one is out of scope (a migration, chat 048/071+).
// Per the chat-021 brief: do NOT invent columns/enum values — report instead.
// When a future migration adds a cache event (e.g. 'plan_cache_observed'), wire
// the INSERT here, keyed by userId, with the observation in `value`.

import * as Sentry from '@sentry/nextjs';
import type { CallType } from '../cacheConfig';

export type CacheOutcome = 'hit' | 'miss';

export interface CacheObservation {
  userId: string;
  callType: CallType;
  outcome: CacheOutcome;
  /** Anthropic-reported cache-READ input tokens (0 on a cold miss). */
  cacheReadInputTokens: number;
  planDate?: string;
}

/** A read of >0 cached input tokens means the prompt cache served the prefix. */
export function classifyCacheOutcome(cacheReadInputTokens: number): CacheOutcome {
  return cacheReadInputTokens > 0 ? 'hit' : 'miss';
}

/**
 * Record a single cache observation. Best-effort: never throws into the plan path.
 * Returns the observation so callers can chain/inspect it.
 */
export function recordCacheObservation(obs: CacheObservation): CacheObservation {
  // 1. Sentry breadcrumb. Safe no-op while the SDK is uninitialized (SENTRY_* are
  //    placeholders until Cutover; see packages/shared/src/api/route.ts).
  try {
    Sentry.addBreadcrumb({
      category: 'cache',
      level: obs.outcome === 'hit' ? 'info' : 'warning',
      message: `plan-cache ${obs.outcome}`,
      data: { ...obs },
    });
  } catch {
    // Observability must never break plan generation.
  }

  // 2. Structured log line (mirrors cost/tracker.ts; no-console is off for this pkg).
  console.log(JSON.stringify({ event: 'plan_cache', ...obs }));

  // 3. completion_log insert: deferred — see file header (enum has no cache member).

  return obs;
}
