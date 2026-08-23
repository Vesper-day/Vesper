// Pure unit test for the Step-4 constraints builder (web). No DOM render, no network.
import { describe, it, expect } from 'vitest';
import {
  buildWeekConstraints,
  EMPTY_SELECTIONS,
  type WeekAdjustSelections,
} from './weekConstraints';

describe('buildWeekConstraints', () => {
  it('maps selections into the transient constraints payload', () => {
    const selections: WeekAdjustSelections = {
      pausedModules: [{ moduleType: 'fitness', dates: ['2026-08-26', '2026-08-25'] }],
      recoveryDates: ['2026-08-27'],
      fixedNotes: [{ date: '2026-08-27', note: 'Dinner out.' }],
    };
    const out = buildWeekConstraints(selections);
    expect(out.pausedModules).toEqual([
      { moduleType: 'fitness', dates: ['2026-08-25', '2026-08-26'] }, // deduped + sorted
    ]);
    expect(out.recoveryDates).toEqual(['2026-08-27']);
    expect(out.fixedNotes).toEqual([{ date: '2026-08-27', note: 'Dinner out.' }]);
  });

  it('drops paused modules with no dates and blank fixed notes', () => {
    const out = buildWeekConstraints({
      pausedModules: [
        { moduleType: 'nutrition', dates: [] },
        { moduleType: 'errands', dates: ['2026-08-24', '2026-08-24'] },
      ],
      recoveryDates: ['2026-08-25', '2026-08-25'],
      fixedNotes: [
        { date: '2026-08-26', note: '   ' },
        { date: '', note: 'orphan' },
        { date: ' 2026-08-27 ', note: '  Team dinner  ' },
      ],
    });
    expect(out.pausedModules).toEqual([{ moduleType: 'errands', dates: ['2026-08-24'] }]);
    expect(out.recoveryDates).toEqual(['2026-08-25']);
    expect(out.fixedNotes).toEqual([{ date: '2026-08-27', note: 'Team dinner' }]);
  });

  it('returns an all-empty payload for no adjustments', () => {
    expect(buildWeekConstraints(EMPTY_SELECTIONS)).toEqual({
      pausedModules: [],
      recoveryDates: [],
      fixedNotes: [],
    });
  });

  it('emits ONLY the three transient constraint keys — nothing persistent', () => {
    const out = buildWeekConstraints({
      pausedModules: [{ moduleType: 'fitness', dates: ['2026-08-24'] }],
      recoveryDates: [],
      fixedNotes: [],
    });
    // The payload must never carry a persistent module-preference shape.
    expect(Object.keys(out).sort()).toEqual(['fixedNotes', 'pausedModules', 'recoveryDates']);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toMatch(/modulesEnabled/i);
    expect(serialized).not.toMatch(/"enabled"/i);
  });
});
