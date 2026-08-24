// Pure helpers + local types for the mobile fitness surface (Chat ADD-C).
//
// This file imports NO react-native, NO expo-router, and NO api client, so it is
// unit-testable in the node vitest env (mirrors lib/nutrition.ts). The fitness screen
// does its fetches through the shared apiClient directly; this module holds only the
// wire TYPES and the label helpers the screen composes.
//
// TYPES are declared LOCALLY here (not imported from @vesper/shared) per the mobile
// moduleResolution:node limitation on the package root — the same local-slice pattern
// lib/nutrition.ts uses. They mirror the web @vesper/shared/fitness contract 1:1.

/** Mirrors the serialized lift-log entry (web operations serializeLiftLogEntry). */
export interface LiftLogEntry {
  id: string;
  loggedAt: string;
  exerciseName: string;
  workoutTemplateId: string | null;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  weightUnit: 'kg' | 'lb' | null;
}

/** Mirrors one workout-schedule item (web WorkoutScheduleItem). */
export interface WorkoutScheduleItem {
  id: string;
  name: string;
  durationMinutes: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  intensityScore: number;
  goalTags: string[];
  equipmentTags: string[];
}

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
