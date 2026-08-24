// @vitest-environment node
//
// Tailored-generation wiring test (Chat ADD-C) — OFFLINE, no DB, Anthropic mocked.
//
// The tailored surface REUSES the chat-049 selection/adaptation path verbatim:
// buildTemplateSubset (corpus filter) + selectWorkoutTemplate (Haiku with a
// deterministic fallback). This test mocks BOTH at the @vesper/ai seam — so the
// Anthropic-backed selection call never runs — and asserts generateTailoredWorkout wires
// them: it returns the selected workout, returns { workout: null } when the corpus filters
// to no candidate, and passes energyScore through to the selection. The deeper
// generateObject-level selection behaviour is covered by packages/ai selectTemplate.test.ts.
import { afterEach, describe, it, expect, vi } from 'vitest';

const buildTemplateSubsetMock = vi.fn();
const selectWorkoutTemplateMock = vi.fn();

vi.mock('@vesper/ai', () => ({
  buildTemplateSubset: (...args: unknown[]) => buildTemplateSubsetMock(...args),
  selectWorkoutTemplate: (...args: unknown[]) => selectWorkoutTemplateMock(...args),
}));

import { generateTailoredWorkout } from './operations';

// A fake Drizzle client: generateTailoredWorkout first loads the user's modules_enabled
// via `db.select({...}).from(...).where(...).limit(1)`. We stub that chain to return an
// empty prefs object (ModulesEnabledSchema fills the defaults) — buildTemplateSubset is
// mocked, so no real query runs.
function fakeDb(modulesEnabled: unknown = {}): unknown {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ modulesEnabled }]),
        }),
      }),
    }),
  };
}

function workout(id: string, intensityScore: number) {
  return {
    id,
    name: `Workout ${id.slice(0, 4)}`,
    goalTags: ['strength'],
    equipmentTags: [],
    durationMinutes: 30,
    level: 'intermediate' as const,
    intensityScore,
    content: {},
    source: 'exercisedb',
    createdAt: new Date('2026-06-01T00:00:00Z'),
  };
}

const W1 = '11111111-1111-4111-8111-111111111111';
const W2 = '22222222-2222-4222-8222-222222222222';

afterEach(() => {
  vi.clearAllMocks();
});

describe('generateTailoredWorkout', () => {
  it('returns the workout the selection path chooses (Anthropic call mocked)', async () => {
    buildTemplateSubsetMock.mockResolvedValue({
      workouts: [workout(W1, 8), workout(W2, 3)],
      recipes: [],
    });
    selectWorkoutTemplateMock.mockResolvedValue(W2);

    const res = await generateTailoredWorkout(fakeDb() as never, 'user-1', { energyScore: 7 });

    expect(res.workout?.id).toBe(W2);
    expect(selectWorkoutTemplateMock).toHaveBeenCalledOnce();
    // energyScore is threaded through to the selection.
    expect(selectWorkoutTemplateMock.mock.calls[0]![0]).toMatchObject({ energyScore: 7 });
  });

  it('returns { workout: null } and does not call selection when the corpus filters empty', async () => {
    buildTemplateSubsetMock.mockResolvedValue({ workouts: [], recipes: [] });

    const res = await generateTailoredWorkout(fakeDb() as never, 'user-1', {});

    expect(res.workout).toBeNull();
    expect(selectWorkoutTemplateMock).not.toHaveBeenCalled();
  });

  it('passes energyScore null through when omitted', async () => {
    buildTemplateSubsetMock.mockResolvedValue({ workouts: [workout(W1, 5)], recipes: [] });
    selectWorkoutTemplateMock.mockResolvedValue(W1);

    await generateTailoredWorkout(fakeDb() as never, 'user-1', {});

    expect(selectWorkoutTemplateMock.mock.calls[0]![0]).toMatchObject({ energyScore: null });
  });

  it('rejects an out-of-range energyScore with a 400 before any selection', async () => {
    const err = await generateTailoredWorkout(fakeDb() as never, 'user-1', {
      energyScore: 99,
    }).catch((e: unknown) => e);
    expect((err as { httpStatus?: number }).httpStatus).toBe(400);
    expect(buildTemplateSubsetMock).not.toHaveBeenCalled();
  });
});
