// Fully offline unit tests for Chat 058 weekly-template synthesis. The AI SDK
// (streamObject), @upstash/redis, and @vesper/db are mocked; the real voiceGate
// runs (short strings skip the Haiku layer, so it stays offline). buildUserContext /
// buildTemplateSubset are mocked to keep the context builders DB-free while the REAL
// buildWeeklyContext assembles the message array we assert against, and the REAL
// applyWeeklyConstraints enforces the Step-4 constraints.
//
// MODEL IS MOCKED — no live ANTHROPIC key. Constraint honoring is asserted on the
// deterministic post-filter (belt-and-suspenders), so the assertions hold regardless
// of what the mocked model returns.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreMessage } from 'ai';

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

// --- mock: @vesper/db (weeklyTemplate only needs the type; no query runs here) -
vi.mock('@vesper/db', () => ({
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
vi.mock('./context/userContext', () => ({
  buildUserContext: (...args: unknown[]) => buildUserContextMock(...args),
}));

const buildTemplateSubsetMock = vi.fn(async (..._args: unknown[]) => ({
  workouts: Array.from({ length: 8 }, (_, i) => ({ id: `w${i}` })),
  recipes: Array.from({ length: 8 }, (_, i) => ({ id: `r${i}` })),
}));
vi.mock('./context/templateSubset', () => ({
  buildTemplateSubset: (...args: unknown[]) => buildTemplateSubsetMock(...args),
}));

import {
  synthesizeWeeklyTemplate,
  applyWeeklyConstraints,
  dateForDayIndex,
  DAYS_IN_WEEK,
  EMPTY_WEEKLY_CONSTRAINTS,
  type WeeklyTemplate,
  type WeeklyConstraints,
} from './weeklyTemplate';
import {
  __setBreakerRedisForTests,
} from './synthesizePlan.circuitBreaker';

// --- helpers -----------------------------------------------------------------
async function* toAsync<T>(arr: T[]): AsyncGenerator<T> {
  for (const x of arr) yield x;
}

const TARGET_MONDAY = '2026-08-24'; // a Monday
const RECOVERY_DATE = dateForDayIndex(TARGET_MONDAY, 3); // Thursday 2026-08-27
const PAUSED_NUTRITION_DATE = dateForDayIndex(TARGET_MONDAY, 1); // Tuesday 2026-08-25

const PRIORITIES = ['Ship the roadmap', 'Rebuild the deck', 'Recover properly'];

// A single day's block, as the WeeklyTemplate schema infers it (discriminated union
// over blockType). Annotating the makeWeek block array with this lets a work day also
// receive fitness/nutrition blocks without tsc narrowing to the first pushed shape.
type PlanBlock = WeeklyTemplate['days'][number]['plan']['blocks'][number];

function workBlock(order: number) {
  return {
    startTime: '09:00',
    endTime: '11:00',
    blockType: 'work' as const,
    title: 'Deep work',
    details: { blockType: 'work' as const, tasks: ['Advance a priority'] },
    source: 'ai_generated' as const,
    displayOrder: order,
  };
}
function fitnessBlock(order: number) {
  return {
    startTime: '18:00',
    endTime: '19:00',
    blockType: 'fitness' as const,
    title: 'Strength training',
    details: { blockType: 'fitness' as const, exercises: [{ name: 'Squat', sets: 3, reps: 8 }] },
    source: 'ai_generated' as const,
    displayOrder: order,
  };
}
function nutritionBlock(order: number) {
  return {
    startTime: '12:00',
    endTime: '12:30',
    blockType: 'nutrition' as const,
    title: 'Lunch',
    details: { blockType: 'nutrition' as const, ingredients: ['salad'], instructions: ['Toss.'] },
    source: 'ai_generated' as const,
    displayOrder: order,
  };
}

/** A well-formed 7-day week: a fitness block on the recovery day, a nutrition block
 *  on the paused-nutrition day, so the post-filter has something to strip. */
function makeWeek(): WeeklyTemplate {
  const days = Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
    const blocks: PlanBlock[] = [workBlock(0)];
    if (i === 3) blocks.push(fitnessBlock(1)); // recovery day gets a fitness block
    if (i === 1) blocks.push(nutritionBlock(1)); // paused-nutrition day gets a nutrition block
    return { dayIndex: i, plan: { blocks } };
  });
  return { days };
}

function okResult(week: WeeklyTemplate = makeWeek()) {
  return {
    partialObjectStream: toAsync([{ days: [] }, week]),
    object: Promise.resolve(week),
    usage: Promise.resolve({ promptTokens: 400, completionTokens: 1200, totalTokens: 1600 }),
    providerMetadata: Promise.resolve({ anthropic: { cacheReadInputTokens: 300 } }),
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

function makeFakeRedis(initialScores: number[] = []) {
  const store = initialScores.map((s, i) => ({ score: s, member: `${s}:${i}` }));
  return {
    zadd: vi.fn(async (_k: string, e: { score: number; member: string }) => {
      store.push(e);
    }),
    zremrangebyscore: vi.fn(async () => undefined),
    pexpire: vi.fn(async () => undefined),
    zrange: vi.fn(
      async (_k: string, min: number, max: number, opts?: { withScores?: boolean }) => {
        const inWin = store.filter((e) => e.score >= min && e.score <= max).sort((a, b) => a.score - b.score);
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

const CONSTRAINTS: WeeklyConstraints = {
  pausedModules: [{ moduleType: 'nutrition', dates: [PAUSED_NUTRITION_DATE] }],
  recoveryDates: [RECOVERY_DATE],
  fixedNotes: [{ date: RECOVERY_DATE, note: 'Dinner out.' }],
};

beforeEach(() => {
  __setBreakerRedisForTests(makeFakeRedis() as never);
});
afterEach(() => {
  vi.clearAllMocks();
  streamObjectMock.mockReset();
  __setBreakerRedisForTests(undefined);
});

// --- applyWeeklyConstraints (pure) ------------------------------------------
describe('applyWeeklyConstraints', () => {
  it('drops fitness blocks on a recovery date and re-sequences displayOrder', () => {
    const enforced = applyWeeklyConstraints(makeWeek(), CONSTRAINTS, TARGET_MONDAY);
    const thursday = enforced.days.find((d) => d.dayIndex === 3)!;
    expect(thursday.plan.blocks.some((b) => b.blockType === 'fitness')).toBe(false);
    expect(thursday.plan.blocks.map((b) => b.displayOrder)).toEqual(
      thursday.plan.blocks.map((_, i) => i),
    );
  });

  it('drops the paused module type on its flagged dates only', () => {
    const enforced = applyWeeklyConstraints(makeWeek(), CONSTRAINTS, TARGET_MONDAY);
    const tuesday = enforced.days.find((d) => d.dayIndex === 1)!;
    expect(tuesday.plan.blocks.some((b) => b.blockType === 'nutrition')).toBe(false);
    // A non-flagged day keeps its blocks (Monday has just the work block).
    const monday = enforced.days.find((d) => d.dayIndex === 0)!;
    expect(monday.plan.blocks).toHaveLength(1);
  });

  it('is a no-op under EMPTY_WEEKLY_CONSTRAINTS', () => {
    const enforced = applyWeeklyConstraints(makeWeek(), EMPTY_WEEKLY_CONSTRAINTS, TARGET_MONDAY);
    const thursday = enforced.days.find((d) => d.dayIndex === 3)!;
    expect(thursday.plan.blocks.some((b) => b.blockType === 'fitness')).toBe(true);
  });
});

// --- synthesizeWeeklyTemplate ------------------------------------------------
describe('synthesizeWeeklyTemplate', () => {
  it('produces seven days and threads the priorities into the Layer-4 context', async () => {
    streamObjectMock.mockReturnValueOnce(okResult());

    const { week, served } = await synthesizeWeeklyTemplate({
      userId: 'u1',
      targetMonday: TARGET_MONDAY,
      priorities: PRIORITIES,
      constraints: CONSTRAINTS,
      sleep: async () => undefined,
    });

    expect(served).toBe('generated');
    expect(week.days).toHaveLength(DAYS_IN_WEEK);
    expect(new Set(week.days.map((d) => d.dayIndex)).size).toBe(DAYS_IN_WEEK);

    // Priority threading: the assembled Layer-4 carries every stated priority.
    const messages = (streamObjectMock.mock.calls[0]![0] as { messages: CoreMessage[] }).messages;
    const userParts = (messages[1] as { content: Array<{ text: string }> }).content;
    const layer4 = JSON.parse(userParts[2]!.text.replace(/^THIS WEEK\n/, ''));
    expect(layer4.priorities).toEqual(PRIORITIES);
    expect(layer4.constraints.recoveryDates).toContain(RECOVERY_DATE);
    expect(layer4.dates).toHaveLength(DAYS_IN_WEEK);
  });

  it('honors the Step-4 constraints on the generated week (paused module + recovery day)', async () => {
    streamObjectMock.mockReturnValueOnce(okResult());

    const { week } = await synthesizeWeeklyTemplate({
      userId: 'u1',
      targetMonday: TARGET_MONDAY,
      priorities: PRIORITIES,
      constraints: CONSTRAINTS,
      sleep: async () => undefined,
    });

    const thursday = week.days.find((d) => d.dayIndex === 3)!;
    expect(thursday.plan.blocks.some((b) => b.blockType === 'fitness')).toBe(false);
    const tuesday = week.days.find((d) => d.dayIndex === 1)!;
    expect(tuesday.plan.blocks.some((b) => b.blockType === 'nutrition')).toBe(false);
  });

  it('retries once, then succeeds on the second attempt', async () => {
    streamObjectMock.mockReturnValueOnce(failResult()).mockReturnValueOnce(okResult());

    const { week, served } = await synthesizeWeeklyTemplate({
      userId: 'u1',
      targetMonday: TARGET_MONDAY,
      priorities: PRIORITIES,
      constraints: EMPTY_WEEKLY_CONSTRAINTS,
      sleep: async () => undefined,
    });

    expect(streamObjectMock).toHaveBeenCalledTimes(2);
    expect(served).toBe('generated');
    expect(week.days).toHaveLength(DAYS_IN_WEEK);
  });

  it('serves a safe fallback week when every attempt fails', async () => {
    streamObjectMock.mockReturnValueOnce(failResult()).mockReturnValueOnce(failResult());

    const { week, served } = await synthesizeWeeklyTemplate({
      userId: 'u1',
      targetMonday: TARGET_MONDAY,
      priorities: PRIORITIES,
      constraints: CONSTRAINTS,
      sleep: async () => undefined,
    });

    expect(served).toBe('fallback');
    expect(week.days).toHaveLength(DAYS_IN_WEEK);
    // The fallback week still honors the recovery-day constraint.
    const thursday = week.days.find((d) => d.dayIndex === 3)!;
    expect(thursday.plan.blocks.some((b) => b.blockType === 'fitness')).toBe(false);
  });

  it('skips the model entirely and serves the fallback week when the breaker is open', async () => {
    const now = Date.now();
    __setBreakerRedisForTests(makeFakeRedis([now - 3000, now - 2000, now - 1000]) as never);

    const { week, served } = await synthesizeWeeklyTemplate({
      userId: 'u1',
      targetMonday: TARGET_MONDAY,
      priorities: PRIORITIES,
      constraints: EMPTY_WEEKLY_CONSTRAINTS,
      sleep: async () => undefined,
    });

    expect(streamObjectMock).not.toHaveBeenCalled();
    expect(served).toBe('fallback');
    expect(week.days).toHaveLength(DAYS_IN_WEEK);
  });
});
