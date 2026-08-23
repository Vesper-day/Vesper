// Pure builder for the Step-4 module-adjustments payload (Chat 058, mobile twin of
// apps/web/lib/weekly-planning/weekConstraints.ts). Zero imports: no react-native, no
// @vesper/* — a plain string/array transform, so it is offline-safe under vitest with
// no RN mock needed. Turns the step-4 UI selection state into the TRANSIENT constraints
// object the weekly-synthesis request carries.
//
// TRANSIENT ONLY: the output is a request-body payload for THIS week's generation. It is
// NEVER written to modules_enabled or any persistent module preference — the builder
// emits exactly three constraint arrays (asserted in weekConstraints.test.ts).

export type ModuleType =
  | 'work'
  | 'fitness'
  | 'nutrition'
  | 'sleep'
  | 'errands'
  | 'medication'
  | 'finance'
  | 'focus'
  | 'commute'
  | 'custom';

export interface PausedModule {
  moduleType: ModuleType;
  dates: string[];
}
export interface FixedNote {
  date: string;
  note: string;
}

export interface WeekConstraints {
  pausedModules: PausedModule[];
  recoveryDates: string[];
  fixedNotes: FixedNote[];
}

export interface WeekAdjustSelections {
  pausedModules: PausedModule[];
  recoveryDates: string[];
  fixedNotes: FixedNote[];
}

function normalizeDates(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort();
}

/**
 * Build the transient constraints payload from the step-4 selections. Drops paused
 * modules with no dates, dedupes/sorts every date list, and drops blank fixed notes.
 * Returns ONLY the three constraint arrays — no persistent preference field.
 */
export function buildWeekConstraints(selections: WeekAdjustSelections): WeekConstraints {
  const pausedModules = selections.pausedModules
    .map((pm) => ({ moduleType: pm.moduleType, dates: normalizeDates(pm.dates) }))
    .filter((pm) => pm.dates.length > 0);

  const recoveryDates = normalizeDates(selections.recoveryDates);

  const fixedNotes = selections.fixedNotes
    .map((n) => ({ date: n.date.trim(), note: n.note.trim() }))
    .filter((n) => n.date.length > 0 && n.note.length > 0);

  return { pausedModules, recoveryDates, fixedNotes };
}

export const EMPTY_SELECTIONS: WeekAdjustSelections = {
  pausedModules: [],
  recoveryDates: [],
  fixedNotes: [],
};
