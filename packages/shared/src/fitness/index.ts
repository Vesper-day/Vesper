// Fitness module boundary shapes (Chat ADD-C) — client-safe.
//
// LOCATION RATIONALE: this lives at the client-safe subpath `@vesper/shared/fitness`
// (never the bare `@vesper/shared` barrel, which transitively pulls @vesper/db ->
// postgres and would drag server-only code into a client bundle). It is PURE Zod +
// TypeScript types — zero imports beyond zod, no server code — so the 'use client'
// web fitness surface and the web API route both import from here. (Mobile types the
// slice locally per the moduleResolution:node exports-map limitation — see
// apps/mobile/lib/fitness.ts.)
//
// FIELD MAPPING at the API boundary (camelCase request/response <-> snake_case column):
//   exerciseName       <-> exercise_name
//   workoutTemplateId  <-> workout_template_id
//   setNumber          <-> set_number
//   weightUnit         <-> weight_unit
//   loggedAt           <-> logged_at
//   (reps, weight unchanged)
//
// SCOPE (PRD §6.2, method B): the lift-log is a scaffold. DEEP fitness columns
// (bronze->platinum strength-rank; world-standard percentile mapping) are DEFERRED and
// are NOT modelled here — the module page reserves a named layout slot and ships none.

import { z } from 'zod';

// --- Lift log: POST request --------------------------------------------------
//
// exerciseName + setNumber are REQUIRED (the NOT-NULL columns with no default; user_id,
// the other NOT-NULL-no-default column, is supplied by the route from the session and is
// NEVER in the body). setNumber is 1-based (DB CHECK set_number > 0). reps / weight are
// optional non-negative (DB CHECK reps >= 0 / weight >= 0 when present). weightUnit is
// 'kg' | 'lb' or NULL for bodyweight sets. workoutTemplateId is set when logging against
// a scheduled/selected workout; NULL/omitted for ad-hoc. loggedAt is optional (DB
// defaults to now()).
export const PostLiftLogSchema = z
  .object({
    exerciseName: z.string().trim().min(1),
    setNumber: z.number().int().positive(),
    workoutTemplateId: z.string().uuid().nullable().optional(),
    reps: z.number().int().min(0).nullable().optional(),
    weight: z.number().min(0).nullable().optional(),
    weightUnit: z.enum(['kg', 'lb']).nullable().optional(),
    loggedAt: z.string().datetime().optional(),
  })
  .strict();

export type PostLiftLogInput = z.infer<typeof PostLiftLogSchema>;

// --- Lift log: response ------------------------------------------------------
//
// loggedAt is an ISO-8601 string (timestamptz serialized). workoutTemplateId / reps /
// weight / weightUnit are null when absent. weight is serialized as a number (the DB
// numeric(7,2) comes back as a string; the boundary normalizes it).
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

export interface LiftLogListResponse {
  entries: LiftLogEntry[];
}

// --- Workout schedule (the corpus filtered to the user's fitness prefs) -------
//
// The workout-schedule list reuses the chat-049 selection path (buildTemplateSubset /
// filterWorkouts over the 047/048 workout_templates corpus). Items carry only the
// fields the schedule surface renders + the id the lift-log POST links via
// workoutTemplateId.
export interface WorkoutScheduleItem {
  id: string;
  name: string;
  durationMinutes: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  intensityScore: number;
  goalTags: string[];
  equipmentTags: string[];
}

export interface WorkoutScheduleResponse {
  workouts: WorkoutScheduleItem[];
}

// --- Tailored generation (reuses chat-049 selection/adaptation verbatim) ------
//
// The tailored-generation surface reuses the EXISTING selection path: filter the corpus
// to the user's fitness prefs (buildTemplateSubset) then pick the single best candidate
// via selectWorkoutTemplate (Haiku, deterministic fallback). NO new engine, NO new
// prompt, NO new Anthropic model row. energyScore (1-10) is the optional morning-energy
// input the selection reads; null/omitted when not captured.
export const TailoredWorkoutRequestSchema = z
  .object({
    energyScore: z.number().int().min(1).max(10).nullable().optional(),
  })
  .strict();

export type TailoredWorkoutRequest = z.infer<typeof TailoredWorkoutRequestSchema>;

// `workout` is null when the user's prefs filter the corpus down to no candidate.
export interface TailoredWorkoutResponse {
  workout: WorkoutScheduleItem | null;
}
