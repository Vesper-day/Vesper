// Fully offline unit tests for Chat 022 synthesizePlan + the §5 fallback chain.
//
// The AI module (streamObject), @upstash/redis, and @vesper/db are mocked; the
// real voiceGate runs (short strings skip the Haiku layer, so it is offline).
// buildUserContext / buildTemplateSubset are mocked to keep the context builders
// DB-free while letting the REAL buildPlanContext / buildSimplifiedPlanContext
// assemble the message arrays we assert against.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreMessage } from 'ai';
import type { DailyPlan } from '@vesper/shared';

// --- mock: the AI SDK's streamObject -----------------------------------------
const streamObjectMock = vi.fn();
vi.mock('ai', async (orig) => ({
  ...(await orig<typeof import('ai')>()),
  streamObject: (...args: unknown[]) => streamObjectMock(...args),
}));

// --- mock: @upstash/redis (fromEnv must never run; we inject a fake client) ---
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => {
      throw new Error('Redis.fromEnv must not be called in tests');
    }),
  },
}));

// --- mock: @vesper/db (sql captures {strings, values}; withUser short-circuits)
vi.mock('@vesper/db', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings: Array.from(strings),
    values,
  }),
  eq: (...a: unknown[]) => ({ op: 'eq', a }),
  and: (...a: unknown[]) => ({ op: 'and', a }),
  desc: (a: unknown) => ({ op: 'desc', a }),
  tasks: {
    id: {}, title: {}, estimatedMinutes: {}, priority: {}, deadline: {}, userId: {}, status: {},
  },
  dailyPlans: {},
  withUser: vi.fn(async () => [] as unknown[]),
  createDrizzleClient: vi.fn(() => ({ execute: vi.fn() })),
}));

// --- mock: context builders' DB-touching leaves ------------------------------
const buildUserContextMock = vi.fn(async (..._args: unknown[]) => ({
  userId: 'u1',
  archetype: 'remote',
  timezone: 'UTC',
  location: null,
  baseProfile: {},
  modulesEnabled: {},
}));
vi.mock('../context/userContext', () => ({
  buildUserContext: (...args: unknown[]) => buildUserContextMock(...args),
}));

const buildTemplateSubsetMock = vi.fn(async (..._args: unknown[]) => ({
  workouts: Array.from({ length: 8 }, (_, i) => ({ id: `w${i}` })),
  recipes: Array.from({ length: 8 }, (_, i) => ({ id: `r${i}` })),
}));
vi.mock('../context/templateSubset', () => ({
  buildTemplateSubset: (...args: unknown[]) => buildTemplateSubsetMock(...args),
}));

import { synthesizePlan } from '../synthesizePlan';
import { runFallbackChain, APOLOGY_LINE } from '../synthesizePlan.fallback';
import { buildSimplifiedPlanContext } from '../synthesizePlan.simplifiedContext';
import {
  readBreakerState,
  recordFailure,
  __setBreakerRedisForTests,
  WINDOW_MS,
} from '../synthesizePlan.circuitBreaker';
import { voiceGate } from '../voiceGate';

// --- helpers -----------------------------------------------------------------
async function* toAsync<T>(arr: T[]): AsyncGenerator<T> {
  for (const x of arr) yield x;
}

const VALID_PLAN: DailyPlan = {
  blocks: [
    {
      startTime: '09:00',
      endTime: '10:00',
      blockType: 'work',
      title: 'Deep work',
      details: { blockType: 'work', tasks: ['Draft outline'] },
      source: 'ai_generated',
      displayOrder: 0,
    },
  ],
};

function okResult(plan: DailyPlan = VALID_PLAN, cacheReadInputTokens = 50) {
  return {
    partialObjectStream: toAsync([{ blocks: [] }, plan]),
    object: Promise.resolve(plan),
    usage: Promise.resolve({ promptTokens: 120, completionTokens: 340, totalTokens: 460 }),
    providerMetadata: Promise.resolve({ anthropic: { cacheReadInputTokens } }),
  };
}

function failResult() {
  return {
    partialObjectStream: toAsync<unknown>([]),
    object: Promise.reject(new Error('no object generated: schema mismatch')),
    usage: Promise.resolve({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
    providerMetadata: Promise.resolve(undefined),
  };
}

function abortingResult(controller: AbortController, plan: DailyPlan = VALID_PLAN) {
  return {
    partialObjectStream: (async function* () {
      yield { blocks: [] };
      controller.abort();
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    })(),
    object: Promise.resolve(plan),
    usage: Promise.resolve({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
    providerMetadata: Promise.resolve(undefined),
  };
}

interface DrainResult {
  partials: unknown[];
  result: DailyPlan | undefined;
}
async function drain(
  gen: AsyncGenerator<unknown, DailyPlan>,
): Promise<DrainResult> {
  const partials: unknown[] = [];
  for (;;) {
    const step = await gen.next();
    if (step.done) return { partials, result: step.value };
    partials.push(step.value);
  }
}

function makeDb(existsRows: unknown[] = []) {
  const execute = vi.fn();
  // First call in the 'generated' path is the daily_plans EXISTS check.
  execute.mockResolvedValue(existsRows);
  return { db: { execute } as never, execute };
}

function makeFakeRedis(initialScores: number[] = []) {
  const store = initialScores.map((s, i) => ({ score: s, member: `${s}:${i}` }));
  return {
    zadd: vi.fn(async (_k: string, e: { score: number; member: string }) => {
      store.push(e);
    }),
    zremrangebyscore: vi.fn(async (_k: string, min: number, max: number) => {
      for (let i = store.length - 1; i >= 0; i--) {
        if (store[i]!.score >= min && store[i]!.score <= max) store.splice(i, 1);
      }
    }),
    pexpire: vi.fn(async () => undefined),
    zrange: vi.fn(
      async (
        _k: string,
        min: number,
        max: number,
        opts?: { byScore?: boolean; withScores?: boolean },
      ) => {
        const inWin = store
          .filter((e) => e.score >= min && e.score <= max)
          .sort((a, b) => a.score - b.score);
        if (opts?.withScores) {
          const flat: Array<string | number> = [];
          for (const e of inWin) flat.push(e.member, e.score);
          return flat;
        }
        return inWin.map((e) => e.member);
      },
    ),
  };
}

const baseChainParams = (db: never) => ({
  userId: 'u1',
  planDate: '2026-06-17',
  energyScore: 6,
  fullMessages: [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'full' },
  ] as CoreMessage[],
  buildSimplifiedMessages: () => buildSimplifiedPlanContext('u1', '2026-06-17', 6, db),
  breakerOpen: false,
  db,
  sleep: async () => undefined, // §5 delays mocked out
});

beforeEach(() => {
  __setBreakerRedisForTests(makeFakeRedis() as never);
});

afterEach(() => {
  vi.clearAllMocks();
  streamObjectMock.mockReset();
  __setBreakerRedisForTests(undefined);
});

// --- circuit breaker ---------------------------------------------------------
describe('circuit breaker', () => {
  it('opens when THRESHOLD failures fall inside the window', async () => {
    const now = Date.now();
    __setBreakerRedisForTests(
      makeFakeRedis([now - 3000, now - 2000, now - 1000]) as never,
    );
    const state = await readBreakerState('u1');
    expect(state.open).toBe(true);
    expect(state.opensAt).toBeDefined();
    expect(state.closesAt).toBeDefined();
  });

  it('stays closed once the failures age past the window', async () => {
    const now = Date.now();
    __setBreakerRedisForTests(
      makeFakeRedis([now - WINDOW_MS - 5000, now - WINDOW_MS - 4000, now - WINDOW_MS - 3000]) as never,
    );
    const state = await readBreakerState('u1');
    expect(state.open).toBe(false);
  });

  it('recordFailure writes, prunes, and sets a TTL', async () => {
    const redis = makeFakeRedis();
    __setBreakerRedisForTests(redis as never);
    await recordFailure('u1');
    expect(redis.zadd).toHaveBeenCalledTimes(1);
    expect(redis.zremrangebyscore).toHaveBeenCalledTimes(1);
    expect(redis.pexpire).toHaveBeenCalledTimes(1);
  });
});

// --- fallback chain ----------------------------------------------------------
describe('runFallbackChain', () => {
  it('initial success emits plan_generated (no fallback_step)', async () => {
    streamObjectMock.mockReturnValueOnce(okResult());
    const { db, execute } = makeDb([]); // EXISTS -> none

    const { result } = await drain(runFallbackChain(baseChainParams(db)));

    expect(streamObjectMock).toHaveBeenCalledTimes(1);
    expect(result?.blocks[0]?.title).toBe('Deep work');
    // execute[0] = EXISTS check, execute[1] = INSERT.
    const insert = execute.mock.calls[1]![0] as { values: unknown[] };
    expect(insert.values[1]).toBe('plan_generated');
    const value = JSON.parse(insert.values[2] as string);
    expect(value.fallback_step).toBeUndefined();
    expect(value.model).toBe('claude-sonnet-4-6');
    expect(value.cache_hit).toBe(true);
  });

  it('emits plan_regenerated when a daily_plans row already exists', async () => {
    streamObjectMock.mockReturnValueOnce(okResult());
    const { db, execute } = makeDb([{ exists: 1 }]); // EXISTS -> present

    await drain(runFallbackChain(baseChainParams(db)));

    const insert = execute.mock.calls[1]![0] as { values: unknown[] };
    expect(insert.values[1]).toBe('plan_regenerated');
  });

  it('succeeds on the Step-1 retry (fallback_step 1)', async () => {
    streamObjectMock.mockReturnValueOnce(failResult()).mockReturnValueOnce(okResult());
    const { db, execute } = makeDb([]);

    const { result } = await drain(runFallbackChain(baseChainParams(db)));

    expect(streamObjectMock).toHaveBeenCalledTimes(2);
    // Step 1 retries with the identical full context.
    expect(streamObjectMock.mock.calls[0]![0]).toMatchObject({});
    expect(result?.blocks).toHaveLength(1);
    const insert = execute.mock.calls[1]![0] as { values: unknown[] };
    const value = JSON.parse(insert.values[2] as string);
    expect(value.fallback_step).toBe(1);
  });

  it('succeeds on the Step-2 simplified retry (fallback_step 2, 5+5, reduced Layer 4)', async () => {
    streamObjectMock
      .mockReturnValueOnce(failResult())
      .mockReturnValueOnce(failResult())
      .mockReturnValueOnce(okResult());
    const { db, execute } = makeDb([]);

    const { result } = await drain(runFallbackChain(baseChainParams(db)));

    expect(streamObjectMock).toHaveBeenCalledTimes(3);
    const step2Messages = (streamObjectMock.mock.calls[2]![0] as { messages: CoreMessage[] })
      .messages;
    const userParts = (step2Messages[1] as { content: Array<{ text: string }> }).content;
    const layer3 = JSON.parse(userParts[1]!.text.replace(/^TEMPLATE LIBRARY SUBSET\n/, ''));
    const layer4 = JSON.parse(userParts[2]!.text.replace(/^TODAY\n/, ''));
    expect(layer3.workouts).toHaveLength(5);
    expect(layer3.recipes).toHaveLength(5);
    expect(layer4.pendingTasks).toBeUndefined();
    expect(layer4.calendarEvents).toBeUndefined();
    expect(result?.blocks).toHaveLength(1);
    const insert = execute.mock.calls[1]![0] as { values: unknown[] };
    expect(JSON.parse(insert.values[2] as string).fallback_step).toBe(2);
  });

  it('serves the fallback when every attempt fails (plan_fallback_served + failure_reason)', async () => {
    streamObjectMock
      .mockReturnValueOnce(failResult())
      .mockReturnValueOnce(failResult())
      .mockReturnValueOnce(failResult());
    const { db, execute } = makeDb();

    const { result } = await drain(runFallbackChain(baseChainParams(db)));

    expect(streamObjectMock).toHaveBeenCalledTimes(3);
    // Fallback path has no EXISTS check: the only execute call is the INSERT.
    const insert = execute.mock.calls[0]![0] as { values: unknown[] };
    expect(insert.values[1]).toBe('plan_fallback_served');
    const value = JSON.parse(insert.values[2] as string);
    expect(value.fallback_step).toBe(3);
    expect(value.error_code).toBe('schema_invalid');
    expect(value.failure_reason).toContain('no object generated');
    expect(result?.note?.startsWith(APOLOGY_LINE)).toBe(true);
  });

  it('propagates an external abort: discards the buffer, writes/emits nothing', async () => {
    const controller = new AbortController();
    streamObjectMock.mockReturnValueOnce(abortingResult(controller));
    const redis = makeFakeRedis();
    __setBreakerRedisForTests(redis as never);
    const { db, execute } = makeDb();

    const params = { ...baseChainParams(db), signal: controller.signal };
    await expect(drain(runFallbackChain(params))).rejects.toThrow(/abort/i);

    expect(execute).not.toHaveBeenCalled(); // nothing emitted
    expect(redis.zadd).not.toHaveBeenCalled(); // no failure recorded
  });
});

// --- synthesizePlan routing --------------------------------------------------
describe('synthesizePlan', () => {
  it('skips straight to Step 3 when the breaker is open', async () => {
    const now = Date.now();
    __setBreakerRedisForTests(
      makeFakeRedis([now - 3000, now - 2000, now - 1000]) as never,
    );
    const { db, execute } = makeDb();

    const partials: unknown[] = [];
    for await (const chunk of synthesizePlan('u1', '2026-06-17', 6, { db })) {
      partials.push(chunk);
    }

    expect(streamObjectMock).not.toHaveBeenCalled(); // no Anthropic call
    const insert = execute.mock.calls[0]![0] as { values: unknown[] };
    expect(insert.values[1]).toBe('plan_fallback_served');
    expect(JSON.parse(insert.values[2] as string).error_code).toBe('breaker_open');
    expect(partials).toHaveLength(1); // final fallback plan emitted as one chunk
  });
});

// --- voice gate idempotency --------------------------------------------------
describe('APOLOGY_LINE', () => {
  it('passes the voice gate unchanged and is idempotent (Layer 1 floor)', async () => {
    const once = await voiceGate(APOLOGY_LINE, { isAnthropicCircuitOpen: () => true });
    expect(once).toBe(APOLOGY_LINE);
    const twice = await voiceGate(once, { isAnthropicCircuitOpen: () => true });
    expect(twice).toBe(APOLOGY_LINE);
  });
});
