// Unit tests for the over-commit resolution builder (Chat 056, web).
//
// The prompt's decision logic is extracted into pure helpers so it can be asserted
// without a DOM render harness (@testing-library/react is not a dependency here) —
// the 054-W TaskForm buildSubmission precedent. Coverage:
//   - selection -> chat-027 PATCH payload mapping (defer writes, keep does not)
//   - NO mutation fires until the user has chosen for every item
//   - a split task defers all of its chunks together
//   - collectTaskBlockIds joins through details.tasks by id, work blocks only
import { describe, it, expect } from 'vitest';
import {
  buildOverCommitResolution,
  collectTaskBlockIds,
  type OverCommitItem,
  type ResolutionInput,
} from './overCommitResolution';

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

describe('buildOverCommitResolution — nothing fires until the user chooses', () => {
  it('returns no patches while every item is undecided', () => {
    const result = buildOverCommitResolution(input());
    expect(result).toEqual({ ok: false, reason: 'incomplete' });
  });

  it('returns no patches while even ONE item is still undecided', () => {
    const result = buildOverCommitResolution(input({ selections: { t1: 'defer' } }));
    expect(result).toEqual({ ok: false, reason: 'incomplete' });
  });

  it('refuses to write without the OCC token rather than firing a blind PATCH', () => {
    const result = buildOverCommitResolution(
      input({ selections: { t1: 'defer', t2: 'keep' }, planUpdatedAt: null }),
    );
    expect(result).toEqual({ ok: false, reason: 'no-token' });
  });
});

describe('buildOverCommitResolution — selection maps to the chat-027 PATCH shape', () => {
  it('patches deferred blocks to `rescheduled` and leaves kept items alone', () => {
    const result = buildOverCommitResolution(
      input({ selections: { t1: 'defer', t2: 'keep' } }),
    );

    expect(result).toEqual({
      ok: true,
      patches: [{ blockId: 'block-t1', body: { status: 'rescheduled', planUpdatedAt: TOKEN } }],
    });
  });

  it('writes nothing at all when the user keeps everything today', () => {
    const result = buildOverCommitResolution(
      input({ selections: { t1: 'keep', t2: 'keep' } }),
    );
    expect(result).toEqual({ ok: true, patches: [] });
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
    const result = buildOverCommitResolution(input({ items: [], selections: {} }));
    expect(result).toEqual({ ok: true, patches: [] });
  });
});

describe('collectTaskBlockIds — joins through details.tasks by id', () => {
  const blocks = [
    { id: 'b1', details: { blockType: 'work', tasks: ['t1', 't2'] } },
    { id: 'b2', details: { blockType: 'work', tasks: ['t1'] } },
    { id: 'b3', details: { blockType: 'work', tasks: ['t3'] } },
    // `focus` is a notes-only generic variant with no task array.
    { id: 'b4', details: { blockType: 'focus', note: 'deep work' } },
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
    expect(collectTaskBlockIds([{ id: 'b4', details: { blockType: 'focus' } }], 't1')).toEqual([]);
  });
});
