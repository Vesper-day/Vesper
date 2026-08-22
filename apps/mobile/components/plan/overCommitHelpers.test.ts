// Unit tests for the mobile over-commit resolution helpers (Chat 056).
//
// Pure: overCommitHelpers.ts imports no react-native (only the PlanBlock TYPE from
// ./types, which is types-only), so nothing here pulls RN's Flow source through vite's
// SSR transform and no RN mock is needed. Mirrors the web overCommitResolution suite.
import { describe, it, expect } from 'vitest';
import {
  buildOverCommitResolution,
  collectTaskBlockIds,
  type OverCommitItem,
  type ResolutionInput,
} from './overCommitHelpers';
import type { PlanBlock } from './types';

const TOKEN = '2026-03-10T12:00:00.000Z';

function item(overrides: Partial<OverCommitItem> & { taskId: string }): OverCommitItem {
  return {
    title: `Task ${overrides.taskId}`,
    unplacedMinutes: 60,
    blockIds: [`block-${overrides.taskId}`],
    ...overrides,
  };
}

function input(overrides: Partial<ResolutionInput> = {}): ResolutionInput {
  return {
    items: [item({ taskId: 't1' }), item({ taskId: 't2' })],
    selections: {},
    planUpdatedAt: TOKEN,
    ...overrides,
  };
}

function block(id: string, details: Record<string, unknown>): PlanBlock {
  return {
    id,
    startTime: '2026-03-10T09:00:00.000Z',
    endTime: '2026-03-10T10:00:00.000Z',
    blockType: 'work',
    title: 'Work',
    status: 'scheduled',
    source: 'ai_generated',
    displayOrder: 0,
    details,
  };
}

describe('buildOverCommitResolution — nothing fires until the user chooses', () => {
  it('returns no patches while every item is undecided', () => {
    expect(buildOverCommitResolution(input())).toEqual({ ok: false, reason: 'incomplete' });
  });

  it('returns no patches while even ONE item is still undecided', () => {
    expect(buildOverCommitResolution(input({ selections: { t1: 'defer' } }))).toEqual({
      ok: false,
      reason: 'incomplete',
    });
  });

  it('refuses to write without the OCC token rather than firing a blind PATCH', () => {
    expect(
      buildOverCommitResolution(
        input({ selections: { t1: 'defer', t2: 'keep' }, planUpdatedAt: null }),
      ),
    ).toEqual({ ok: false, reason: 'no-token' });
  });
});

describe('buildOverCommitResolution — selection maps to the chat-027 PATCH shape', () => {
  it('patches deferred blocks to `rescheduled` and leaves kept items alone', () => {
    expect(buildOverCommitResolution(input({ selections: { t1: 'defer', t2: 'keep' } }))).toEqual({
      ok: true,
      patches: [{ blockId: 'block-t1', body: { status: 'rescheduled', planUpdatedAt: TOKEN } }],
    });
  });

  it('writes nothing at all when the user keeps everything today', () => {
    expect(buildOverCommitResolution(input({ selections: { t1: 'keep', t2: 'keep' } }))).toEqual({
      ok: true,
      patches: [],
    });
  });

  it('defers every chunk of a split task together (one id, many blocks)', () => {
    const result = buildOverCommitResolution(
      input({
        items: [item({ taskId: 't1', blockIds: ['block-a', 'block-b'] })],
        selections: { t1: 'defer' },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.patches.map((patch) => patch.blockId)).toEqual([
      'block-a',
      'block-b',
    ]);
  });

  it('resolves an empty conflict set as a no-op', () => {
    expect(buildOverCommitResolution(input({ items: [], selections: {} }))).toEqual({
      ok: true,
      patches: [],
    });
  });
});

describe('collectTaskBlockIds — joins through details.tasks by id', () => {
  const blocks: PlanBlock[] = [
    block('b1', { blockType: 'work', tasks: ['t1', 't2'] }),
    block('b2', { blockType: 'work', tasks: ['t1'] }),
    block('b3', { blockType: 'work', tasks: ['t3'] }),
    // `focus` is a notes-only generic variant with no task array.
    block('b4', { blockType: 'focus', note: 'deep work' }),
  ];

  it('finds every block carrying the id (a split task spans several)', () => {
    expect(collectTaskBlockIds(blocks, 't1')).toEqual(['b1', 'b2']);
  });

  it('matches by id, never by title', () => {
    expect(collectTaskBlockIds(blocks, 'Task t1')).toEqual([]);
  });

  it('returns nothing for a task on no block', () => {
    expect(collectTaskBlockIds(blocks, 'absent')).toEqual([]);
  });

  it('ignores blocks whose details carry no task array', () => {
    expect(collectTaskBlockIds([block('b4', { blockType: 'focus' })], 't1')).toEqual([]);
  });
});
