// Pure offline tests for the mid-day reflow engine (Chat 056).
// No env, no DB, no model call, no clock — `now` is injected.
import { describe, it, expect } from 'vitest';

import { reflowDisplacedChunks, type ReflowInput } from './taskReflow';
import type { CalendarEvent, PendingTask } from '../context/planContext';

const PLAN_DATE = '2026-03-10';

function task(overrides: Partial<PendingTask> & { id: string }): PendingTask {
  return {
    title: `Task ${overrides.id}`,
    estimatedMinutes: 60,
    priority: 'medium',
    deadline: null,
    ...overrides,
  };
}

/** 09:00-12:00 and 14:00-17:00 open, `now` at 09:00, nothing on the calendar. */
function baseInput(overrides: Partial<ReflowInput> = {}): ReflowInput {
  return {
    planDate: PLAN_DATE,
    now: 9 * 60,
    displacedChunks: [],
    candidateWindows: [
      { id: 'block-a', start: 9 * 60, end: 12 * 60 },
      { id: 'block-b', start: 14 * 60, end: 17 * 60 },
    ],
    calendarEvents: [],
    pendingTasks: [],
    ...overrides,
  };
}

describe('reflowDisplacedChunks — silent reshuffle', () => {
  it('reflows a displaced chunk into a later same-day window within its deadline', () => {
    const result = reflowDisplacedChunks(
      baseInput({
        // The 09:00 window is consumed by a new event; only 14:00-17:00 survives.
        candidateWindows: [{ id: 'block-b', start: 14 * 60, end: 17 * 60 }],
        displacedChunks: [{ taskId: 't1', minutes: 60 }],
        pendingTasks: [task({ id: 't1', deadline: `${PLAN_DATE}T18:00:00.000Z` })],
      }),
    );

    expect(result.resolution).toBe('silent');
    expect(result.unplaceable).toEqual([]);
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0]).toMatchObject({ taskId: 't1', minutes: 60 });
    // The window id prefixes back to the originating block.
    expect(result.placements[0]!.windowId.split('::')[0]).toBe('block-b');
  });

  it('places nothing and surfaces nothing when no chunk was displaced', () => {
    const result = reflowDisplacedChunks(
      baseInput({ pendingTasks: [task({ id: 't1' })] }),
    );

    expect(result).toEqual({ resolution: 'silent', placements: [], unplaceable: [] });
  });

  it('ignores openings that have already passed (`now` bounds the day)', () => {
    const result = reflowDisplacedChunks(
      baseInput({
        // 15:00: the 09:00-12:00 window is in the past, 14:00-17:00 has 2h left.
        now: 15 * 60,
        displacedChunks: [{ taskId: 't1', minutes: 90 }],
        pendingTasks: [task({ id: 't1', estimatedMinutes: 90 })],
      }),
    );

    expect(result.resolution).toBe('silent');
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0]!.windowId.split('::')[0]).toBe('block-b');
  });
});

describe('reflowDisplacedChunks — a deadline violation is never silent', () => {
  it('surfaces a chunk that would only fit AFTER its deadline', () => {
    const result = reflowDisplacedChunks(
      baseInput({
        // Only the afternoon window is open, but the task is due at 13:00.
        candidateWindows: [{ id: 'block-b', start: 14 * 60, end: 17 * 60 }],
        displacedChunks: [{ taskId: 't1', minutes: 60 }],
        pendingTasks: [task({ id: 't1', deadline: `${PLAN_DATE}T13:00:00.000Z` })],
      }),
    );

    expect(result.resolution).toBe('over_commit');
    expect(result.placements).toEqual([]);
    expect(result.unplaceable).toHaveLength(1);
    expect(result.unplaceable[0]).toMatchObject({
      taskId: 't1',
      displacedMinutes: 60,
      placeableMinutes: 0,
      unplacedMinutes: 60,
    });
  });

  it('bounds a task to the part of a window that precedes its deadline', () => {
    const result = reflowDisplacedChunks(
      baseInput({
        now: 9 * 60,
        candidateWindows: [{ id: 'block-a', start: 9 * 60, end: 12 * 60 }],
        // 90 minutes of work, but only 30 minutes (09:00-09:30) sit before the deadline.
        displacedChunks: [{ taskId: 't1', minutes: 90 }],
        pendingTasks: [
          task({ id: 't1', estimatedMinutes: 90, deadline: `${PLAN_DATE}T09:30:00.000Z` }),
        ],
      }),
    );

    expect(result.resolution).toBe('over_commit');
    expect(result.unplaceable[0]).toMatchObject({
      taskId: 't1',
      placeableMinutes: 30,
      unplacedMinutes: 60,
    });
  });
});

describe('reflowDisplacedChunks — over-commit surfaces the FULL set, drops nothing', () => {
  it('returns every task that cannot fit and applies no placements', () => {
    const result = reflowDisplacedChunks(
      baseInput({
        now: 16 * 60, // one hour of open time left in the day
        displacedChunks: [
          { taskId: 't1', minutes: 60 },
          { taskId: 't2', minutes: 60 },
          { taskId: 't3', minutes: 60 },
        ],
        pendingTasks: [
          task({ id: 't1', priority: 'high' }),
          task({ id: 't2', priority: 'medium' }),
          task({ id: 't3', priority: 'low' }),
        ],
      }),
    );

    expect(result.resolution).toBe('over_commit');
    // Nothing is applied: every item is held in its current state until the user chooses.
    expect(result.placements).toEqual([]);
    // 180 minutes of work, 60 minutes of room: the two that lose out BOTH surface.
    // The high-priority task wins the only opening (055's priority-DESC sort).
    expect(result.unplaceable.map((item) => item.taskId).sort()).toEqual(['t2', 't3']);
    const total = result.unplaceable.reduce((sum, item) => sum + item.unplacedMinutes, 0);
    expect(total).toBe(120);
  });

  it('conserves every displaced minute: the shortfall surfaces in full, none is dropped', () => {
    // 4 x 120 = 480 minutes of displaced work against 360 minutes of open day
    // (09:00-12:00 + 14:00-17:00). The 120-minute shortfall is exactly what must
    // surface — 055's placer would have silently dropped it at the day horizon.
    const displaced = [
      { taskId: 't1', minutes: 120 },
      { taskId: 't2', minutes: 120 },
      { taskId: 't3', minutes: 120 },
      { taskId: 't4', minutes: 120 },
    ];
    const result = reflowDisplacedChunks(
      baseInput({
        displacedChunks: displaced,
        pendingTasks: displaced.map((chunk) => task({ id: chunk.taskId, estimatedMinutes: 120 })),
      }),
    );

    expect(result.resolution).toBe('over_commit');
    // Held in their current state: the engine applies nothing until the user chooses.
    expect(result.placements).toEqual([]);

    const shortfall = result.unplaceable.reduce((sum, item) => sum + item.unplacedMinutes, 0);
    expect(shortfall).toBe(480 - 360);
    // The task that lost the last opening is the one the day cannot hold.
    expect(result.unplaceable.map((item) => item.taskId)).toEqual(['t4']);
  });

  it('surfaces a displaced id with no task metadata rather than placing it blind', () => {
    const result = reflowDisplacedChunks(
      baseInput({
        displacedChunks: [{ taskId: 'ghost', minutes: 30 }],
        pendingTasks: [],
      }),
    );

    expect(result.resolution).toBe('over_commit');
    expect(result.unplaceable[0]).toMatchObject({ taskId: 'ghost', unplacedMinutes: 30 });
  });
});

describe('reflowDisplacedChunks — split tasks group by task id', () => {
  it('sums a split task\'s chunks into ONE reflow unit keyed by its id', () => {
    const result = reflowDisplacedChunks(
      baseInput({
        candidateWindows: [{ id: 'block-b', start: 14 * 60, end: 17 * 60 }],
        // The same id in two blocks is ONE split task: 45 + 75 = 120 minutes.
        displacedChunks: [
          { taskId: 't1', minutes: 45 },
          { taskId: 't1', minutes: 75 },
        ],
        pendingTasks: [task({ id: 't1', estimatedMinutes: 120 })],
      }),
    );

    expect(result.resolution).toBe('silent');
    expect(result.placements).toHaveLength(1);
    expect(result.placements[0]).toMatchObject({ taskId: 't1', minutes: 120 });
  });

  it('reports a split task\'s displaced total once when it cannot fit', () => {
    const result = reflowDisplacedChunks(
      baseInput({
        now: 16 * 60, // 60 minutes left
        displacedChunks: [
          { taskId: 't1', minutes: 60 },
          { taskId: 't1', minutes: 60 },
        ],
        pendingTasks: [task({ id: 't1', estimatedMinutes: 120 })],
      }),
    );

    expect(result.resolution).toBe('over_commit');
    expect(result.unplaceable).toHaveLength(1);
    expect(result.unplaceable[0]).toMatchObject({
      taskId: 't1',
      displacedMinutes: 120,
      placeableMinutes: 60,
      unplacedMinutes: 60,
    });
  });
});

describe('reflowDisplacedChunks — calendar events', () => {
  it('carves a timed event out of the openings before placing', () => {
    const events: CalendarEvent[] = [
      {
        startTime: `${PLAN_DATE}T14:00:00.000Z`,
        endTime: `${PLAN_DATE}T16:30:00.000Z`,
      } as CalendarEvent,
    ];
    const result = reflowDisplacedChunks(
      baseInput({
        candidateWindows: [{ id: 'block-b', start: 14 * 60, end: 17 * 60 }],
        calendarEvents: events,
        // Only 16:30-17:00 survives the event: 30 minutes for a 60-minute task.
        displacedChunks: [{ taskId: 't1', minutes: 60 }],
        pendingTasks: [task({ id: 't1' })],
      }),
    );

    expect(result.resolution).toBe('over_commit');
    expect(result.unplaceable[0]).toMatchObject({ placeableMinutes: 30, unplacedMinutes: 30 });
  });

  it('does not blank the day for an ALL-DAY / date-only event', () => {
    const events: CalendarEvent[] = [
      { startTime: PLAN_DATE, endTime: PLAN_DATE } as CalendarEvent,
    ];
    const result = reflowDisplacedChunks(
      baseInput({
        calendarEvents: events,
        displacedChunks: [{ taskId: 't1', minutes: 60 }],
        pendingTasks: [task({ id: 't1' })],
      }),
    );

    // The all-day event carries no hours, so the openings survive and the reflow is silent.
    expect(result.resolution).toBe('silent');
    expect(result.placements).toHaveLength(1);
  });
});
