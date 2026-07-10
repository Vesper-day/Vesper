// Fully offline unit tests for the Chat 055 greedy task-placement algorithm.
// No live services, no model call, no DB, no clock — pure inputs -> asserted output.

import { describe, expect, it } from 'vitest';
import type { DailyPlan } from '@vesper/shared';

import type { CalendarEvent, PendingTask } from '../context/planContext';
import {
  applyTaskPlacement,
  calendarEventsToBusy,
  carveOpenWindows,
  placeTasks,
  sortTasksForPlacement,
  type OpenWindow,
} from './taskPlacement';

function task(over: Partial<PendingTask> & { id: string }): PendingTask {
  return {
    title: over.title ?? `Task ${over.id}`,
    estimatedMinutes: over.estimatedMinutes ?? 30,
    priority: over.priority ?? 'medium',
    deadline: over.deadline ?? null,
    ...over,
  };
}

const win = (id: string, start: number, end: number): OpenWindow => ({ id, start, end });

describe('sortTasksForPlacement', () => {
  it('orders by priority DESC then deadline ASC (nulls last), stable', () => {
    const tasks = [
      task({ id: 'a', priority: 'low', deadline: null }),
      task({ id: 'b', priority: 'high', deadline: '2026-07-10T00:00:00Z' }),
      task({ id: 'c', priority: 'high', deadline: '2026-07-09T00:00:00Z' }),
      task({ id: 'd', priority: 'high', deadline: null }),
      task({ id: 'e', priority: 'medium', deadline: '2026-07-11T00:00:00Z' }),
    ];
    const ordered = sortTasksForPlacement(tasks).map((t) => t.id);
    // high(earliest-deadline c, then b, then null-deadline d) > medium(e) > low(a)
    expect(ordered).toEqual(['c', 'b', 'd', 'e', 'a']);
  });

  it('is stable for fully-tied tasks (preserves input order)', () => {
    const tasks = [
      task({ id: 'x', priority: 'medium', deadline: null }),
      task({ id: 'y', priority: 'medium', deadline: null }),
      task({ id: 'z', priority: 'medium', deadline: null }),
    ];
    expect(sortTasksForPlacement(tasks).map((t) => t.id)).toEqual(['x', 'y', 'z']);
  });
});

describe('placeTasks', () => {
  it('first-fits a task into the earliest window large enough to hold it', () => {
    const windows = [win('w1', 540, 570), win('w2', 600, 720)]; // 30min, 120min
    const chunks = placeTasks([task({ id: 't', estimatedMinutes: 90 })], windows);
    // 90 does not fit w1 (30) whole, but fits w2 (120) whole -> single chunk in w2.
    expect(chunks).toEqual([{ windowId: 'w2', taskId: 't', title: 'Task t', minutes: 90 }]);
  });

  it('places the whole task in the FIRST sufficient window even when a later one is bigger', () => {
    const windows = [win('w1', 540, 600), win('w2', 600, 900)]; // 60min, 300min
    const chunks = placeTasks([task({ id: 't', estimatedMinutes: 60 })], windows);
    expect(chunks).toEqual([{ windowId: 'w1', taskId: 't', title: 'Task t', minutes: 60 }]);
  });

  it('splits a task longer than any single window across the largest windows', () => {
    const windows = [win('w1', 0, 60), win('w2', 100, 220), win('w3', 300, 390)]; // 60,120,90
    const chunks = placeTasks([task({ id: 't', estimatedMinutes: 200 })], windows);
    // 200 fits no single window -> split largest-first: w2(120) then w3(90 -> take 80).
    expect(chunks).toEqual([
      { windowId: 'w2', taskId: 't', title: 'Task t', minutes: 120 },
      { windowId: 'w3', taskId: 't', title: 'Task t', minutes: 80 },
    ]);
    const total = chunks.reduce((s, c) => s + c.minutes, 0);
    expect(total).toBe(200);
  });

  it('carries a single-day remainder forward to the next window and never exceeds capacity', () => {
    const windows = [win('w1', 540, 600), win('w2', 660, 720)]; // 60min + 60min = 120 total
    // Two 60min tasks: first fills w1, second carries forward to w2.
    const chunks = placeTasks(
      [task({ id: 'a', estimatedMinutes: 60 }), task({ id: 'b', estimatedMinutes: 60 })],
      windows,
    );
    expect(chunks).toEqual([
      { windowId: 'w1', taskId: 'a', title: 'Task a', minutes: 60 },
      { windowId: 'w2', taskId: 'b', title: 'Task b', minutes: 60 },
    ]);
  });

  it('drops the leftover once every same-day window is full (no cross-day carry)', () => {
    const windows = [win('w1', 540, 600)]; // only 60min of capacity all day
    const chunks = placeTasks([task({ id: 'big', estimatedMinutes: 150 })], windows);
    // Fills the sole window with 60; the remaining 90 has nowhere same-day -> dropped.
    expect(chunks).toEqual([{ windowId: 'w1', taskId: 'big', title: 'Task big', minutes: 60 }]);
    const placed = chunks.reduce((s, c) => s + c.minutes, 0);
    expect(placed).toBe(60);
  });
});

describe('carveOpenWindows / calendar boundaries', () => {
  it('subtracts a bisecting busy interval, leaving two event-free pieces', () => {
    const carved = carveOpenWindows([win('b0', 540, 720)], [{ start: 600, end: 660 }]);
    expect(carved).toEqual([
      { id: 'b0::0', start: 540, end: 600 },
      { id: 'b0::1', start: 660, end: 720 },
    ]);
  });

  it('placement never overlaps a calendar-event boundary', () => {
    const busy = [{ start: 600, end: 660 }]; // 10:00-11:00 fixed event
    const carved = carveOpenWindows([win('b0', 540, 720)], busy);
    const chunks = placeTasks([task({ id: 't', estimatedMinutes: 200 })], carved);
    // Reconstruct each chunk's occupied span from its window and assert no overlap.
    const byId = new Map(carved.map((w) => [w.id, w]));
    for (const chunk of chunks) {
      const w = byId.get(chunk.windowId)!;
      for (const b of busy) {
        const overlaps = w.start < b.end && b.start < w.end;
        expect(overlaps).toBe(false);
      }
    }
    // Only 120 min of event-free capacity exists (60 before + 60 after) -> 120 placed.
    expect(chunks.reduce((s, c) => s + c.minutes, 0)).toBe(120);
  });

  it('maps timed events to busy minutes and skips all-day (date-only) events', () => {
    const events: CalendarEvent[] = [
      { id: '1', title: 'Standup', startTime: '2026-07-09T09:00:00-07:00', endTime: '2026-07-09T09:30:00-07:00' },
      { id: '2', title: 'All-day offsite', startTime: '2026-07-09', endTime: '2026-07-10' },
    ];
    expect(calendarEventsToBusy(events)).toEqual([{ start: 540, end: 570 }]);
  });
});

describe('applyTaskPlacement (DailyPlan post-process)', () => {
  const workPlan = (): DailyPlan => ({
    blocks: [
      {
        startTime: '09:00',
        endTime: '11:00', // 120 min
        blockType: 'work',
        title: 'Morning focus',
        details: { blockType: 'work', tasks: ['model-invented'], focusMode: true },
        source: 'ai_generated',
        displayOrder: 0,
      },
      {
        startTime: '11:00',
        endTime: '12:00',
        blockType: 'nutrition',
        title: 'Lunch',
        details: { blockType: 'nutrition', mealName: 'Salad', ingredients: [], instructions: [] },
        source: 'ai_generated',
        displayOrder: 1,
      },
    ],
  });

  it('writes real pending-task IDS onto the work block, replacing model output', () => {
    const plan = applyTaskPlacement(
      workPlan(),
      [task({ id: 't1', title: 'Write spec', estimatedMinutes: 60, priority: 'high' })],
      [],
    );
    const work = plan.blocks[0]!;
    // Element is the task id (join-safe), not the title.
    expect(work.details).toMatchObject({ blockType: 'work', tasks: ['t1'] });
    // Non-work block untouched.
    expect(plan.blocks[1]!.details.blockType).toBe('nutrition');
  });

  it('de-duplicates a split task to a single id within one block (event-bisected window)', () => {
    // A 09:00-11:00 work block bisected by a 09:30-10:00 event -> two sub-windows, same
    // block id. One long task splits across both pieces but must appear as ONE id.
    const events: CalendarEvent[] = [
      { id: 'e', title: 'Sync', startTime: '2026-07-09T09:30:00Z', endTime: '2026-07-09T10:00:00Z' },
    ];
    const plan = applyTaskPlacement(
      workPlan(),
      [task({ id: 't1', title: 'Deep work', estimatedMinutes: 90 })],
      events,
    );
    expect(plan.blocks[0]!.details).toMatchObject({ blockType: 'work', tasks: ['t1'] });
  });

  it('is a no-op when there are no pending tasks (leaves the model output intact)', () => {
    const original = workPlan();
    const result = applyTaskPlacement(original, [], []);
    expect(result).toBe(original);
  });

  it('does not place task time onto a work window blocked by a calendar event', () => {
    // The 09:00-11:00 work block is fully covered by a 09:00-11:00 event -> no window.
    const events: CalendarEvent[] = [
      { id: 'e', title: 'Board meeting', startTime: '2026-07-09T09:00:00Z', endTime: '2026-07-09T11:00:00Z' },
    ];
    const plan = applyTaskPlacement(
      workPlan(),
      [task({ id: 't1', title: 'Write spec', estimatedMinutes: 60 })],
      events,
    );
    // Work window carved to nothing -> tasks emptied, none placed over the event.
    expect(plan.blocks[0]!.details).toMatchObject({ blockType: 'work', tasks: [] });
  });
});
