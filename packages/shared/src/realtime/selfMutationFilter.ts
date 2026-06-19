/**
 * Device self-mutation filter (build chat 037; TECHNICAL_SPEC §3, LAYER_3 Realtime).
 *
 * Every outbound block mutation the device makes mints a `client_mutation_id`
 * (one per request). The API route writes it into `blocks.client_mutation_id`,
 * and because `blocks` is REPLICA IDENTITY FULL (migration 20260601000004) the
 * Realtime broadcast echoes that column straight back to THIS device. The device
 * has already applied the change optimistically, so re-applying the echoed
 * broadcast would cause a visible flicker / double-apply. This filter records
 * each minted id in a sliding time window and drops any incoming broadcast whose
 * `client_mutation_id` is still in the window.
 *
 * WINDOW VALUE — resolved with the operator for build chat 037: 60s.
 * The spec (TECHNICAL_SPEC §3 / LAYER_3) and the DB migration comment say 30s;
 * PHASE_4_BUILD_PLAN.md raised it to 60s "to tolerate longer network stalls and
 * the mobile background→foreground refetch window". The build plan supersedes,
 * so 60s is canonical here.
 */

export const SELF_MUTATION_WINDOW_MS = 60_000;

export interface SelfMutationFilter {
  /** Record an id the device just minted for an outbound mutation. */
  record(mutationId: string): void;
  /**
   * True when this incoming id was minted locally within the window — i.e. it is
   * the device's own write echoed back and must be dropped. Falsy ids (a row with
   * no `client_mutation_id`, e.g. a genuine cross-device edit) never drop.
   */
  shouldDrop(mutationId: string | null | undefined): boolean;
  /** Test/diagnostic: number of unexpired ids currently held. */
  size(): number;
}

/**
 * Build an isolated filter. `windowMs` and `now` are injectable so unit tests can
 * advance a fake clock deterministically without real timers.
 */
export function createSelfMutationFilter(
  windowMs: number = SELF_MUTATION_WINDOW_MS,
  now: () => number = Date.now,
): SelfMutationFilter {
  // id -> epoch-ms it was recorded. A Map preserves insertion order, and because
  // record() always (re)inserts at the end with the current time, entries are
  // ordered oldest-first — so prune() can stop at the first still-live entry.
  const recent = new Map<string, number>();

  function prune(): void {
    const cutoff = now() - windowMs;
    for (const [id, ts] of recent) {
      if (ts > cutoff) break; // insertion-ordered oldest-first: the rest are fresher
      recent.delete(id);
    }
  }

  return {
    record(mutationId: string): void {
      // Delete-then-set moves a repeated id to the end, refreshing its recency
      // (an offline-queue flush may retry the same id).
      recent.delete(mutationId);
      recent.set(mutationId, now());
    },
    shouldDrop(mutationId: string | null | undefined): boolean {
      if (!mutationId) return false;
      prune();
      return recent.has(mutationId);
    },
    size(): number {
      prune();
      return recent.size;
    },
  };
}

/**
 * Process-wide singleton shared between the outbound mutation path (which calls
 * `record()` when it mints an id — wired by the block-mutation / offline-queue
 * chats 027/038) and the Realtime hook (which calls `shouldDrop()` on each
 * incoming broadcast). Tests should construct their own instance via
 * `createSelfMutationFilter()` to get an isolated, clock-injectable filter.
 */
export const selfMutationFilter = createSelfMutationFilter();
