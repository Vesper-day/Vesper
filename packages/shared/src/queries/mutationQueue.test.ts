import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient, MutationCache, onlineManager } from '@tanstack/query-core';
import {
  classifyMutationError,
  shouldRetryMutation,
  mutationRetryDelay,
  buildMutationDefaults,
  buildMutationCacheConfig,
  flushQueue,
  createMutationPersister,
  ensureClientMutationId,
  prepareMutationSend,
  blockMutationScope,
  planQueryKey,
  MAX_MUTATION_RETRIES,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  OFFLINE_MUTATION_PERSIST_KEY,
  type AsyncStorageLike,
} from './mutationQueue';
import { createSelfMutationFilter } from '../realtime/selfMutationFilter';
import { ErrorCode } from '../errors';

// Settle pending micro/macrotasks (real timers).
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function memoryStorage(): AsyncStorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => Promise.resolve(k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
      return Promise.resolve();
    },
    removeItem: (k) => {
      delete data[k];
      return Promise.resolve();
    },
  };
}

const olf = { httpStatus: 409, code: ErrorCode.OPTIMISTIC_LOCK_FAILURE };
const plainConflict = { httpStatus: 409, code: ErrorCode.CONFLICT };
const validation = { httpStatus: 400, code: ErrorCode.INVALID_REQUEST };
const networkErr = new TypeError('Failed to fetch');

afterEach(() => {
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});

describe('classifyMutationError', () => {
  it('409 OPTIMISTIC_LOCK_FAILURE -> conflict (distinct from CONFLICT)', () => {
    expect(classifyMutationError(olf)).toBe('conflict');
    expect(classifyMutationError(plainConflict)).toBe('client');
  });
  it('other 4xx -> client; no/5xx status -> network', () => {
    expect(classifyMutationError(validation)).toBe('client');
    expect(classifyMutationError({ httpStatus: 422 })).toBe('client');
    expect(classifyMutationError(networkErr)).toBe('network');
    expect(classifyMutationError({ httpStatus: 500 })).toBe('network');
  });
});

describe('retry policy', () => {
  it('retries network errors with backoff up to the cap; never retries 4xx/409', () => {
    expect(shouldRetryMutation(0, networkErr)).toBe(true);
    expect(shouldRetryMutation(MAX_MUTATION_RETRIES - 1, networkErr)).toBe(true);
    expect(shouldRetryMutation(MAX_MUTATION_RETRIES, networkErr)).toBe(false);
    expect(shouldRetryMutation(0, validation)).toBe(false);
    expect(shouldRetryMutation(0, olf)).toBe(false);
    expect(shouldRetryMutation(0, plainConflict)).toBe(false);
  });

  it('mutationRetryDelay is exponential with full jitter, capped', () => {
    // rng=1 gives the (exclusive) ceiling: base*2^attempt, capped at max.
    expect(mutationRetryDelay(0, () => 1)).toBe(BACKOFF_BASE_MS);
    expect(mutationRetryDelay(1, () => 1)).toBe(BACKOFF_BASE_MS * 2);
    expect(mutationRetryDelay(2, () => 1)).toBe(BACKOFF_BASE_MS * 4);
    expect(mutationRetryDelay(20, () => 1)).toBe(BACKOFF_MAX_MS); // capped
    expect(mutationRetryDelay(3, () => 0)).toBe(0); // full jitter floor
  });
});

describe('409 OPTIMISTIC_LOCK_FAILURE handling', () => {
  it('does NOT retry, invalidates the affected plan query, and fires the conflict toast', async () => {
    const emitConflict = vi.fn();
    let qc!: QueryClient;
    const cache = new MutationCache(
      buildMutationCacheConfig({ getQueryClient: () => qc, emitConflict }),
    );
    qc = new QueryClient({ mutationCache: cache, defaultOptions: { mutations: buildMutationDefaults() } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined);

    const mutationFn = vi.fn().mockRejectedValue(olf);
    const mutation = cache.build(qc, {
      mutationKey: ['block', 'patch'],
      meta: { planQueryKey: planQueryKey('2026-06-23') },
      mutationFn,
    });

    await expect(mutation.execute({ clientMutationId: 'id-1' })).rejects.toBe(olf);

    expect(mutationFn).toHaveBeenCalledTimes(1); // NOT retried
    expect(emitConflict).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['plan', '2026-06-23'] });
  });

  it('a non-OLF 4xx is dropped (no retry) but surfaced via analytics + drop reporter', async () => {
    const onAnalyticsEvent = vi.fn();
    const onMutationDropped = vi.fn();
    let qc!: QueryClient;
    const cache = new MutationCache(
      buildMutationCacheConfig({
        getQueryClient: () => qc,
        emitConflict: vi.fn(),
        onAnalyticsEvent,
        onMutationDropped,
      }),
    );
    qc = new QueryClient({ mutationCache: cache, defaultOptions: { mutations: buildMutationDefaults() } });

    const mutationFn = vi.fn().mockRejectedValue(validation);
    const mutation = cache.build(qc, { mutationKey: ['block', 'patch'], mutationFn });
    await expect(mutation.execute({})).rejects.toBe(validation);

    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(onAnalyticsEvent).toHaveBeenCalledWith(
      'offline_queue_mutation_dropped',
      expect.objectContaining({ status: 400, code: ErrorCode.INVALID_REQUEST }),
    );
    expect(onMutationDropped).toHaveBeenCalledTimes(1);
  });
});

describe('in-order flush is serialized per scope (R1)', () => {
  it('the second mutation does not begin until the first resolves', async () => {
    const qc = new QueryClient();
    const cache = qc.getMutationCache();
    const order: string[] = [];
    let resolveFirst!: () => void;

    const scope = blockMutationScope('2026-06-23');
    const first = cache.build(qc, {
      scope,
      mutationKey: ['block'],
      mutationFn: () => {
        order.push('first:start');
        return new Promise<string>((resolve) => {
          resolveFirst = () => {
            order.push('first:end');
            resolve('ok');
          };
        });
      },
    });
    const second = cache.build(qc, {
      scope,
      mutationKey: ['block'],
      mutationFn: () => {
        order.push('second:start');
        return Promise.resolve('ok');
      },
    });

    const p1 = first.execute({});
    const p2 = second.execute({});
    await settle();

    // First is in flight; second must NOT have started (proves serialization,
    // not just resume order).
    expect(order).toEqual(['first:start']);

    resolveFirst();
    await Promise.all([p1, p2]);
    expect(order).toEqual(['first:start', 'first:end', 'second:start']);
  });
});

describe('flushQueue analytics + bucket mapping (R3)', () => {
  it('emits flush_started/_completed with the exact payload shapes', async () => {
    onlineManager.setOnline(false);
    const onAnalyticsEvent = vi.fn();
    const cache = new MutationCache();
    const qc = new QueryClient({ mutationCache: cache });
    qc.setMutationDefaults(['block'], { mutationFn: async () => 'ok' });

    // Queue one block mutation while offline -> it pauses.
    const m = cache.build(qc, { mutationKey: ['block'], scope: blockMutationScope('d'), mutationFn: async () => 'ok' });
    void m.execute({}).catch(() => {});
    await settle();
    expect(m.state.isPaused).toBe(true);

    onlineManager.setOnline(true);
    let t = 1000;
    await flushQueue(qc, { onAnalyticsEvent, now: () => (t += 5) });
    await settle();

    expect(onAnalyticsEvent).toHaveBeenCalledWith('offline_queue_flush_started', {
      queued_mutation_count: 1,
    });
    const completed = onAnalyticsEvent.mock.calls.find(
      (c) => c[0] === 'offline_queue_flush_completed',
    );
    expect(completed?.[1]).toEqual({
      succeeded_count: 1,
      conflict_count: 0,
      network_error_count: 0,
      total_duration_ms: expect.any(Number),
    });
  });

  it('no events when nothing is queued', async () => {
    const onAnalyticsEvent = vi.fn();
    const qc = new QueryClient();
    await flushQueue(qc, { onAnalyticsEvent });
    expect(onAnalyticsEvent).not.toHaveBeenCalled();
  });
});

describe('mobile persistence + clientMutationId reuse across cold start (R2 / OD-5)', () => {
  it('persists a paused block mutation and reuses the SAME id after rehydrate+flush', async () => {
    onlineManager.setOnline(false);
    const storage = memoryStorage();

    // --- session 1: queue offline, persist ---
    const cache1 = new MutationCache();
    const qc1 = new QueryClient({ mutationCache: cache1 });
    const stop = createMutationPersister({ storage }).start(qc1);

    const variables: { clientMutationId?: string | null } = {};
    const mintedId = ensureClientMutationId(variables); // mint-once at enqueue
    qc1.setMutationDefaults(['block'], { mutationFn: async () => 'ok' });
    const m = cache1.build(qc1, {
      mutationKey: ['block'],
      scope: blockMutationScope('2026-06-23'),
      mutationFn: async () => 'ok',
    });
    void m.execute(variables).catch(() => {});
    await settle();

    expect(m.state.isPaused).toBe(true);
    const persisted = storage.data[OFFLINE_MUTATION_PERSIST_KEY];
    expect(persisted).toBeTruthy();
    expect(persisted).toContain(mintedId); // id rode along in the dehydrated variables
    stop();

    // --- session 2: cold start, rehydrate, flush ---
    const cache2 = new MutationCache();
    const qc2 = new QueryClient({ mutationCache: cache2 });
    const filter = createSelfMutationFilter();
    const sentIds: string[] = [];
    qc2.setMutationDefaults(['block'], {
      mutationFn: async (vars: { clientMutationId?: string | null }) => {
        sentIds.push(prepareMutationSend(vars, filter)); // reuse + record at send
        return 'ok';
      },
    });

    await createMutationPersister({ storage }).hydrate(qc2);
    onlineManager.setOnline(true);
    await qc2.resumePausedMutations();
    await settle();

    expect(sentIds).toEqual([mintedId]); // SAME id, not re-minted
    expect(filter.shouldDrop(mintedId)).toBe(true); // recorded in the self-mutation filter
  });

  it('web path does NOT persist when no persister is started', async () => {
    onlineManager.setOnline(false);
    const storage = memoryStorage();
    const cache = new MutationCache();
    const qc = new QueryClient({ mutationCache: cache });
    qc.setMutationDefaults(['block'], { mutationFn: async () => 'ok' });

    const m = cache.build(qc, { mutationKey: ['block'], scope: blockMutationScope('d'), mutationFn: async () => 'ok' });
    void m.execute({ clientMutationId: 'x' }).catch(() => {});
    await settle();

    expect(m.state.isPaused).toBe(true);
    expect(Object.keys(storage.data)).toHaveLength(0); // nothing written
  });
});
