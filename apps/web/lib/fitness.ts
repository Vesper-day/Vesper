// Pure, client-safe helpers for the web fitness surface (Chat ADD-C).
//
// No React, no DOM, no @vesper/shared barrel — just formatting/label logic the page
// composes, so it is unit-testable as a plain module (mirrors lib/nutrition.ts). Response
// TYPES come from the client-safe @vesper/shared/fitness subpath (never the bare barrel,
// which pulls @vesper/db -> postgres into the client bundle).
import type { LiftLogEntry, WorkoutScheduleItem } from '@vesper/shared/fitness';

/**
 * One lift-log row's label: the exercise name, then the set index and any reps / weight.
 *
 * `liftLogEntryLabel({ exerciseName: 'Bench press', setNumber: 2, reps: 8, weight: 60,
 *   weightUnit: 'kg' })` -> `"Bench press: set 2, 8 reps, 60 kg"`
 * A bodyweight set (no weight) -> `"Push-up: set 1, 12 reps"`.
 */
export function liftLogEntryLabel(
  entry: Pick<
    LiftLogEntry,
    'exerciseName' | 'setNumber' | 'reps' | 'weight' | 'weightUnit'
  >,
): string {
  const parts: string[] = [`set ${entry.setNumber}`];
  if (entry.reps !== null && entry.reps !== undefined) {
    parts.push(`${entry.reps} reps`);
  }
  if (entry.weight !== null && entry.weight !== undefined) {
    const unit = entry.weightUnit ? ` ${entry.weightUnit}` : '';
    parts.push(`${entry.weight}${unit}`);
  }
  return `${entry.exerciseName}: ${parts.join(', ')}`;
}

/**
 * One workout-schedule item's label: the name, its duration, and its level.
 *
 * `workoutScheduleItemLabel({ name: 'Full body', durationMinutes: 30, level:
 *   'intermediate' })` -> `"Full body: 30 min, intermediate"`
 */
export function workoutScheduleItemLabel(
  workout: Pick<WorkoutScheduleItem, 'name' | 'durationMinutes' | 'level'>,
): string {
  return `${workout.name}: ${workout.durationMinutes} min, ${workout.level}`;
}
