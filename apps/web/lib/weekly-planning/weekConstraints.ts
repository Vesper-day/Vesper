// Pure builder for the Step-4 module-adjustments payload (Chat 058, web). Client-safe:
// no @vesper/shared barrel, no @vesper/ai, no DB, no network — importable from a
// 'use client' file. Turns the step-4 UI's selection state into the TRANSIENT
// constraints object the weekly-synthesis request carries.
//
// TRANSIENT ONLY: the output is a request-body payload consumed by the weekly generate
// route for THIS week's generation. It is NEVER written to modules_enabled or any
// persistent module preference. The builder has no concept of persistence — it emits
// exactly three constraint arrays and nothing that resembles a stored preference
// (asserted in weekConstraints.test.ts).
//
// The shape mirrors @vesper/ai's WeeklyConstraints, declared locally here (the twin
// precedent: web and mobile each declare the client slice rather than importing the
// server package).

/** A block_type_enum value the user can pause for the week. */
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
  /** ISO YYYY-MM-DD dates within the target week on which the module is paused. */
  dates: string[];
}
export interface FixedNote {
  date: string;
  note: string;
}

/** The transient constraints payload (matches @vesper/ai WeeklyConstraints). */
export interface WeekConstraints {
  pausedModules: PausedModule[];
  recoveryDates: string[];
  fixedNotes: FixedNote[];
}

/** The step-4 UI selection state, before normalization. */
export interface WeekAdjustSelections {
  /** moduleType -> the dates it is paused on (as toggled in the UI). */
  pausedModules: PausedModule[];
  recoveryDates: string[];
  fixedNotes: FixedNote[];
}

/** Dedupe + sort an ISO-date list. */
function normalizeDates(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort();
}

/**
 * Build the transient constraints payload from the step-4 selections. Drops paused
 * modules with no dates, dedupes/sorts every date list, and drops fixed notes whose
 * date or text is blank. Returns ONLY the three constraint arrays — no persistent
 * module-preference field is ever produced.
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

/** The empty selections (nothing adjusted). */
export const EMPTY_SELECTIONS: WeekAdjustSelections = {
  pausedModules: [],
  recoveryDates: [],
  fixedNotes: [],
};
