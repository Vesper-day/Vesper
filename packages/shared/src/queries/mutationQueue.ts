// Offline mutation queue + conflict resolution (build chat 038; TECHNICAL_SPEC §3,
// LAYER_3 Realtime; ARCHITECTURE_DECISIONS Decision 06).
//
// Built on TanStack Query's mutationCache (serializable state). An edit made while
// offline pauses (networkMode 'online' — the app/test toggles onlineManager), the
// UI having already applied it optimistically. On reconnect the queue FLUSHES:
//
//   - NETWORK errors  -> retried with EXPONENTIAL BACKOFF + full jitter, bounded.
//   - 4xx CLIENT errors -> NOT retried; the mutation is DROPPED. A non-OLF 4xx
//     (400/422, and the 409 CONFLICT code) is otherwise invisible, so it is
//     surfaced via the injected analytics seam + an injected drop reporter (R3).
//   - 409 OPTIMISTIC_LOCK_FAILURE -> NOT retried; instead invalidate the affected
//     plan query (refetch) + fire the coalescing conflict toast. (Distinct from
//     the other 409 code CONFLICT, which is a plain drop.)
//
// IN-ORDER FLUSH (R1): resumePausedMutations() resumes in insertion order but can
// run resumed mutations CONCURRENTLY. To guarantee in-order application on the
// wire we give every block mutation a stable TanStack `scope` (per-PLAN — see
// blockMutationScope), so the cache scheduler runs them strictly one-at-a-time,
// FIFO, within a plan. Per-plan (not per-user) because the OCC conflict signal is
// plan-level: the parent-touch trigger (migration 0004) bumps daily_plans.updated_at
// on ANY block change, so all mutations against one plan must thread its updated_at
// token in order; mutations against different plans are independent.
//
// clientMutationId (R2): minted exactly ONCE and written onto the mutation's
// variables, so it survives dehydrate -> AsyncStorage -> hydrate. Every retry and
// every post-rehydrate flush REUSES that stored id (the chat-027 route is
// idempotent on (user_id, client_mutation_id)). At each actual send we call
// selfMutationFilter.record(id) (chat 037, 60s window) so the flushed mutation's
// own Realtime broadcast is self-filtered. record() is called at SEND, not at
// enqueue, because a mutation may sit offline far longer than the 60s window.
//
// SEAMS (R6): this module references NO process.env / __DEV__ / console and imports
// NEITHER app's useUiStore. The analytics emitter (onAnalyticsEvent), the conflict
// toast (emitConflict), the drop reporter (onMutationDropped), and the persister
// storage are all INJECTED by each app's provider.
//
// PostHog taxonomy (RECORDS-ONLY — chat 096 must register these; do NOT route to
// PostHog here). Emitted through the injected guarded dev-log seam:
//   offline_queue_flush_started   { queued_mutation_count }
//   offline_queue_flush_completed { succeeded_count, conflict_count,
//                                   network_error_count, total_duration_ms }
//   offline_queue_mutation_dropped { status, code, mutation_key }   (R3 visibility)

import { dehydrate, hydrate } from '@tanstack/query-core';
import type { QueryClient, QueryKey, Mutation, MutationScope } from '@tanstack/query-core';
import { ErrorCode } from '../errors';
import {
  selfMutationFilter as defaultSelfMutationFilter,
  type SelfMutationFilter,
} from '../realtime/selfMutationFilter';

// --- Backoff parameters (OD-1) ----------------------------------------------
// base 1000 / cap 30000 matches both the realtime client (realtime/client.ts) and
// TanStack's own default retryDelay. Bounded at 5 (battery on mobile) and full
// jitter (the realtime socket had none) because many mutations flush at once on
// reconnect — jitter avoids a thundering herd against the API.
export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;
export const MAX_MUTATION_RETRIES = 5;

// --- Persistence (OD-5, mobile only) ----------------------------------------
// Our OWN key, separate from chat-013's PersistQueryClientProvider default
// (REACT_QUERY_OFFLINE_CACHE) so query persistence and mutation persistence never
// collide. Serialized shape: { version, mutations: <dehydrated paused block mutations> }.
export const OFFLINE_MUTATION_PERSIST_KEY = 'vesper.offline-mutations.v1';
export const OFFLINE_MUTATION_PERSIST_VERSION = 1;

/** mutationKey[0] for block mutations — the only mutations this queue persists/scopes. */
export const BLOCK_MUTATION_KEY_PREFIX = 'block';

/** Plan query key invalidated on a 409 and refetched on reconnect. */
export function planQueryKey(planDate: string): QueryKey {
  return ['plan', planDate];
}

/** Per-plan serialization scope (R1). All of a plan's block mutations run FIFO, 1-at-a-time. */
export function blockMutationScope(planDate: string): MutationScope {
  return { id: `offline-block-mutations:${planDate}` };
}

// --- clientMutationId minting (OD-2 / R2) -----------------------------------

/**
 * Mint a v4 UUID. crypto.randomUUID when present (web/browser, modern node);
 * else a Math.random v4 fallback — Expo SDK 52's winter runtime does NOT polyfill
 * crypto.randomUUID (same situation + pattern as apps/mobile/lib/pushTokens.ts).
 * Both forms satisfy the chat-027 route's z.string().uuid() validation. The id is
 * a non-secret, opaque idempotency key (not a token, not PII).
 */
export function mintClientMutationId(): string {
  const c: { randomUUID?: () => string } | undefined =
    typeof globalThis !== 'undefined'
      ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Mutation variables that carry the idempotency id. */
export interface ClientMutationVariables {
  clientMutationId?: string | null;
  [key: string]: unknown;
}

/**
 * Mint-ONCE: return the variables' existing clientMutationId, or mint, store, and
 * return a new one. Never re-mints for variables that already hold an id, so the
 * id is stable across retries and across a dehydrate/hydrate cold-start round trip.
 */
export function ensureClientMutationId(variables: ClientMutationVariables): string {
  if (typeof variables.clientMutationId === 'string' && variables.clientMutationId !== '') {
    return variables.clientMutationId;
  }
  const id = mintClientMutationId();
  variables.clientMutationId = id;
  return id;
}

/**
 * Call at each actual SEND (inside the mutationFn). Ensures the id (mint-once) and
 * records it in the self-mutation filter so this device drops its own echoed
 * Realtime broadcast. Returns the id. Filter is injectable for tests.
 */
export function prepareMutationSend(
  variables: ClientMutationVariables,
  filter: SelfMutationFilter = defaultSelfMutationFilter,
): string {
  const id = ensureClientMutationId(variables);
  filter.record(id);
  return id;
}

// --- Error classification ----------------------------------------------------

export type MutationErrorKind = 'conflict' | 'client' | 'network';

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const e = error as { httpStatus?: unknown; status?: unknown };
    if (typeof e.httpStatus === 'number') return e.httpStatus;
    if (typeof e.status === 'number') return e.status;
  }
  return undefined;
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown };
    if (typeof e.code === 'string') return e.code;
  }
  return undefined;
}

/**
 * 'conflict' = 409 with code OPTIMISTIC_LOCK_FAILURE ONLY (R3 — NOT the other 409
 * code CONFLICT). 'client' = any other 4xx (incl. 409 CONFLICT): dropped, no retry.
 * 'network' = everything else (no/5xx status, fetch TypeError): retried w/ backoff.
 */
export function classifyMutationError(error: unknown): MutationErrorKind {
  const status = errorStatus(error);
  const code = errorCode(error);
  if (status === 409 && code === ErrorCode.OPTIMISTIC_LOCK_FAILURE) return 'conflict';
  if (status !== undefined && status >= 400 && status < 500) return 'client';
  return 'network';
}

// --- Retry policy (OD-1) -----------------------------------------------------

/** Retry ONLY network errors, capped at MAX_MUTATION_RETRIES. 4xx/409 never retry. */
export function shouldRetryMutation(failureCount: number, error: unknown): boolean {
  return classifyMutationError(error) === 'network' && failureCount < MAX_MUTATION_RETRIES;
}

/** Exponential backoff with FULL jitter, capped at BACKOFF_MAX_MS. attemptIndex is 0-based. */
export function mutationRetryDelay(attemptIndex: number, rng: () => number = Math.random): number {
  const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attemptIndex);
  return Math.floor(rng() * ceiling);
}

/** Mutation defaultOptions for the app's QueryClient. */
export function buildMutationDefaults(rng: () => number = Math.random): {
  retry: (failureCount: number, error: unknown) => boolean;
  retryDelay: (attemptIndex: number) => number;
} {
  return {
    retry: (failureCount, error) => shouldRetryMutation(failureCount, error),
    retryDelay: (attemptIndex) => mutationRetryDelay(attemptIndex, rng),
  };
}

// --- Injected seams ----------------------------------------------------------

export type AnalyticsEmitter = (event: string, payload: Record<string, unknown>) => void;

export interface MutationDroppedInfo {
  status: number | undefined;
  code: string | undefined;
  mutation_key: unknown;
}

export interface MutationCacheConfigOptions {
  /** Late-bound — the QueryClient is built AFTER the cache it owns. */
  getQueryClient: () => QueryClient;
  /** Singleton conflict toast's notify (R5). Fired once per 409 OLF. */
  emitConflict: () => void;
  /** Guarded dev-log seam (records-only). */
  onAnalyticsEvent?: AnalyticsEmitter;
  /** Drop reporter — app wires a Sentry breadcrumb so a dropped edit is never silent (R3). */
  onMutationDropped?: (info: MutationDroppedInfo) => void;
}

interface MutationCacheConfigShape {
  onError: (
    error: unknown,
    variables: unknown,
    onMutateResult: unknown,
    mutation: Mutation<unknown, unknown, unknown>,
  ) => void;
}

/**
 * MutationCacheConfig to pass to `new MutationCache(config)` in each app. The cache
 * instance must be created with the APP's @tanstack/react-query copy and handed to
 * `new QueryClient({ mutationCache })`.
 */
export function buildMutationCacheConfig(
  options: MutationCacheConfigOptions,
): MutationCacheConfigShape {
  const { getQueryClient, emitConflict, onAnalyticsEvent, onMutationDropped } = options;
  return {
    onError: (error, _variables, _onMutateResult, mutation) => {
      const kind = classifyMutationError(error);
      if (kind === 'conflict') {
        const key = (mutation.meta as { planQueryKey?: QueryKey } | undefined)?.planQueryKey;
        if (key) void getQueryClient().invalidateQueries({ queryKey: key });
        emitConflict();
        return;
      }
      if (kind === 'client') {
        // Dropped (no retry) and counted in NONE of the three flush buckets — make
        // it visible through both injected seams so it is never truly silent (R3).
        const info: MutationDroppedInfo = {
          status: errorStatus(error),
          code: errorCode(error),
          mutation_key: mutation.options.mutationKey,
        };
        onAnalyticsEvent?.('offline_queue_mutation_dropped', { ...info });
        onMutationDropped?.(info);
      }
      // 'network': handled by the retry policy; a terminal network failure after
      // retries is tallied as network_error_count by flushQueue.
    },
  };
}

// --- Reconnect flush ---------------------------------------------------------

export interface FlushQueueOptions {
  onAnalyticsEvent?: AnalyticsEmitter;
  now?: () => number;
}

/**
 * Flush the queue on reconnect — the SINGLE flush path (R4). Emits flush_started,
 * resumes paused mutations (FIFO, serialized per scope), then tallies final states
 * and emits flush_completed. No-op (no events) when nothing is queued.
 *
 * Bucket mapping (R3): success -> succeeded_count; error+OLF -> conflict_count;
 * error+network -> network_error_count; error+other-4xx -> none (already surfaced
 * via the cache onError drop path).
 */
export async function flushQueue(
  queryClient: QueryClient,
  options: FlushQueueOptions = {},
): Promise<void> {
  const { onAnalyticsEvent, now = Date.now } = options;
  const cache = queryClient.getMutationCache();
  // Snapshot the paused set BEFORE resuming so the tally is over exactly these.
  const queued = cache.getAll().filter((m) => m.state.isPaused);
  if (queued.length === 0) return;

  onAnalyticsEvent?.('offline_queue_flush_started', { queued_mutation_count: queued.length });
  const startedAt = now();

  await queryClient.resumePausedMutations();
  // resumePausedMutations() resolves a tick BEFORE the success/error state commit
  // lands, so wait (event-driven, no sleep) until every queued mutation has left
  // the 'pending' state — otherwise the tally below under-counts.
  await new Promise<void>((resolve) => {
    const allSettled = (): boolean => queued.every((m) => m.state.status !== 'pending');
    if (allSettled()) {
      resolve();
      return;
    }
    const unsubscribe = cache.subscribe(() => {
      if (allSettled()) {
        unsubscribe();
        resolve();
      }
    });
  });

  let succeeded = 0;
  let conflict = 0;
  let networkError = 0;
  for (const mutation of queued) {
    const state = mutation.state;
    if (state.status === 'success') {
      succeeded += 1;
    } else if (state.status === 'error') {
      const kind = classifyMutationError(state.error);
      if (kind === 'conflict') conflict += 1;
      else if (kind === 'network') networkError += 1;
      // 'client' -> dropped, intentionally uncounted (surfaced via onError).
    }
  }

  onAnalyticsEvent?.('offline_queue_flush_completed', {
    succeeded_count: succeeded,
    conflict_count: conflict,
    network_error_count: networkError,
    total_duration_ms: now() - startedAt,
  });
}

// --- Mobile persistence (OD-5) ----------------------------------------------

/** Minimal AsyncStorage surface (mobile injects @react-native-async-storage/async-storage). */
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** A paused block mutation is what we persist (and re-run on cold start). */
function isPersistableBlockMutation(mutation: Mutation): boolean {
  const key = mutation.options.mutationKey;
  return (
    mutation.state.isPaused && Array.isArray(key) && key[0] === BLOCK_MUTATION_KEY_PREFIX
  );
}

export interface MutationPersister {
  /** Subscribe to the cache; writes the dehydrated paused block mutations on every event. Returns unsubscribe. */
  start(queryClient: QueryClient): () => void;
  /** Cold-start: read the persisted mutations back into the cache. */
  hydrate(queryClient: QueryClient): Promise<void>;
}

export interface MutationPersisterOptions {
  storage: AsyncStorageLike;
  key?: string;
}

/**
 * Mobile-only persister (OD-5). Web passes NO persister and never calls these, so
 * the web mutation cache is in-memory only (ARCHITECTURE_DECISIONS Decision 06).
 */
export function createMutationPersister(options: MutationPersisterOptions): MutationPersister {
  const { storage, key = OFFLINE_MUTATION_PERSIST_KEY } = options;
  return {
    start(queryClient) {
      const cache = queryClient.getMutationCache();
      const write = (): void => {
        const dehydrated = dehydrate(queryClient, {
          shouldDehydrateMutation: isPersistableBlockMutation,
          shouldDehydrateQuery: () => false,
        });
        void storage.setItem(
          key,
          JSON.stringify({
            version: OFFLINE_MUTATION_PERSIST_VERSION,
            mutations: dehydrated.mutations,
          }),
        );
      };
      // Write immediately (capture anything already queued) then on every change.
      write();
      return cache.subscribe(write);
    },
    async hydrate(queryClient) {
      const raw = await storage.getItem(key);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { version?: number; mutations?: unknown };
        if (parsed.version !== OFFLINE_MUTATION_PERSIST_VERSION) return;
        hydrate(queryClient, { mutations: parsed.mutations, queries: [] });
      } catch {
        // Corrupt payload — drop it rather than crash cold start.
        await storage.removeItem(key);
      }
    },
  };
}
