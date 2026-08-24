// Fitness module DB/AI-layer core logic (Chat ADD-C), shared by:
//   GET    /api/v1/fitness/workouts        -> listWorkoutSchedule
//   POST   /api/v1/fitness/tailored        -> generateTailoredWorkout
//   GET    /api/v1/fitness/lift-log        -> listTodayLiftLog
//   POST   /api/v1/fitness/lift-log        -> createLiftLogEntry
//   DELETE /api/v1/fitness/lift-log/[id]   -> deleteLiftLogEntry
//
// Mirrors nutrition/operations.ts (ADD-B): the pure functions live in this plain sibling
// module (a Next.js App Router route.ts may export only HTTP-method handlers + segment
// config). The route handlers import them; the integration test drives them directly
// against the chat-002 local-Supabase test DB.
//
// SCHEMA SOURCE: the Drizzle `liftLogEntries` model in packages/db/src/schema/modules.ts
// (migration 26). user_id ALWAYS comes from the authenticated session — NEVER from the
// request body. The boundary Zod lives in the client-safe @vesper/shared/fitness subpath
// so the web 'use client' surface and this route share one contract.
//
// TAILORED GENERATION reuses the chat-049 selection/adaptation path VERBATIM
// (buildTemplateSubset / filterWorkouts over the 047/048 workout_templates corpus +
// selectWorkoutTemplate, Haiku with a deterministic fallback). NO new engine, NO new
// prompt, NO new Anthropic model row. DEEP fitness (bronze->platinum strength-rank;
// world-standard percentile mapping) is DEFERRED (PRD §6.2) — this module ships none.
import { z } from 'zod';
import {
  liftLogEntries,
  userProfiles,
  ModulesEnabledSchema,
  eq,
  and,
  sql,
  desc,
  type Database,
} from '@vesper/db';
import { ApiError, ErrorCode } from '@vesper/shared';
import {
  PostLiftLogSchema,
  TailoredWorkoutRequestSchema,
  type LiftLogEntry,
  type LiftLogListResponse,
  type WorkoutScheduleItem,
  type WorkoutScheduleResponse,
  type TailoredWorkoutResponse,
} from '@vesper/shared/fitness';
import {
  buildTemplateSubset,
  selectWorkoutTemplate,
  type WorkoutTemplate,
} from '@vesper/ai';

// Guards the [id] path param only (bodies are validated by the boundary Zod above).
const ENTRY_UUID = z.string().uuid();

type LiftLogRow = typeof liftLogEntries.$inferSelect;

function serializeLiftLogEntry(row: LiftLogRow): LiftLogEntry {
  return {
    id: row.id,
    loggedAt: row.loggedAt.toISOString(),
    exerciseName: row.exerciseName,
    workoutTemplateId: row.workoutTemplateId ?? null,
    setNumber: row.setNumber,
    reps: row.reps ?? null,
    // numeric(7,2) comes back from postgres as a string; normalize to a number.
    weight: row.weight !== null && row.weight !== undefined ? Number(row.weight) : null,
    weightUnit: (row.weightUnit as 'kg' | 'lb' | null) ?? null,
  };
}

function serializeWorkout(w: WorkoutTemplate): WorkoutScheduleItem {
  return {
    id: w.id,
    name: w.name,
    durationMinutes: w.durationMinutes,
    level: w.level,
    intensityScore: w.intensityScore,
    goalTags: w.goalTags,
    equipmentTags: w.equipmentTags,
  };
}

// Loads the user's enabled-modules prefs, filled with schema defaults so a `{}` or
// partial jsonb is safe to hand to buildTemplateSubset (whose predicates read
// modulesEnabled.fitness / .nutrition). A missing profile row reads as all-off.
async function loadModulesEnabled(db: Database, userId: string) {
  const rows = await db
    .select({ modulesEnabled: userProfiles.modulesEnabled })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return ModulesEnabledSchema.parse(rows[0]?.modulesEnabled ?? {});
}

// --- GET /fitness/workouts ---------------------------------------------------

/**
 * The workout-schedule list: the 047/048 workout_templates corpus filtered to the user's
 * fitness prefs via the chat-049 selection path (buildTemplateSubset / filterWorkouts).
 * Returns an empty list when the fitness module is off (buildTemplateSubset issues no
 * query for a disabled module). user-scoped through the loaded prefs.
 */
export async function listWorkoutSchedule(
  db: Database,
  userId: string,
): Promise<WorkoutScheduleResponse> {
  const modulesEnabled = await loadModulesEnabled(db, userId);
  const { workouts } = await buildTemplateSubset(modulesEnabled, db);
  return { workouts: workouts.map(serializeWorkout) };
}

// --- POST /fitness/tailored --------------------------------------------------

/**
 * Tailored workout generation — REUSES the chat-049 selection/adaptation path verbatim:
 * filter the corpus to the user's fitness prefs (buildTemplateSubset) then pick the
 * single best candidate via selectWorkoutTemplate (Haiku, deterministic lowest-intensity
 * fallback). Returns `{ workout: null }` when the prefs filter the corpus to no
 * candidate. Throws {@link ApiError} 400 on a validation failure (e.g. an out-of-range
 * energyScore).
 */
export async function generateTailoredWorkout(
  db: Database,
  userId: string,
  rawBody: unknown,
): Promise<TailoredWorkoutResponse> {
  const parsed = TailoredWorkoutRequestSchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const energyScore = parsed.data.energyScore ?? null;

  const modulesEnabled = await loadModulesEnabled(db, userId);
  const { workouts } = await buildTemplateSubset(modulesEnabled, db);
  if (workouts.length === 0) {
    return { workout: null };
  }

  const fitness = modulesEnabled.fitness;
  const chosenId = await selectWorkoutTemplate({
    fitnessPrefs: {
      ...(fitness.goal !== undefined ? { goal: fitness.goal } : {}),
      equipment: fitness.equipment,
      ...(fitness.level !== undefined ? { level: fitness.level } : {}),
    },
    energyScore,
    candidates: workouts,
  });

  const chosen = workouts.find((w) => w.id === chosenId) ?? workouts[0]!;
  return { workout: serializeWorkout(chosen) };
}

// --- GET /fitness/lift-log ---------------------------------------------------

/**
 * List the user's lift-log entries for THEIR current local day, newest first. The day
 * boundary is derived by query against start_of_local_day(tz) — the SAME derivation the
 * hydration counter (migration 14) and the food-log (ADD-B) use — so "today" is the
 * user's today, not the server's. user-scoped; returns only rows owned by userId.
 */
export async function listTodayLiftLog(
  db: Database,
  userId: string,
  timezone: string,
): Promise<LiftLogListResponse> {
  const rows = await db
    .select()
    .from(liftLogEntries)
    .where(
      and(
        eq(liftLogEntries.userId, userId),
        sql`${liftLogEntries.loggedAt} >= start_of_local_day(${timezone})`,
      ),
    )
    .orderBy(desc(liftLogEntries.loggedAt));

  return { entries: rows.map(serializeLiftLogEntry) };
}

// --- POST /fitness/lift-log --------------------------------------------------

/**
 * Create a lift-log entry for the user. user_id comes from the authenticated session
 * (NEVER the body). Supplies all three NOT-NULL-no-default columns: user_id (session),
 * exercise_name and set_number (required in the body). workoutTemplateId / reps / weight
 * / weightUnit / loggedAt are optional (the DB defaults logged_at to now()). The DB
 * enforces set_number > 0, reps >= 0, weight >= 0 (CHECK constraints); the boundary Zod
 * rejects them earlier. Throws {@link ApiError} 400 on a validation failure.
 */
export async function createLiftLogEntry(
  db: Database,
  userId: string,
  rawBody: unknown,
): Promise<LiftLogEntry> {
  const parsed = PostLiftLogSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;

  const [row] = await db
    .insert(liftLogEntries)
    .values({
      userId,
      exerciseName: input.exerciseName,
      setNumber: input.setNumber,
      ...(input.workoutTemplateId !== undefined && input.workoutTemplateId !== null
        ? { workoutTemplateId: input.workoutTemplateId }
        : {}),
      ...(input.reps !== undefined && input.reps !== null ? { reps: input.reps } : {}),
      // numeric column takes a string; normalize the validated number.
      ...(input.weight !== undefined && input.weight !== null
        ? { weight: input.weight.toString() }
        : {}),
      ...(input.weightUnit !== undefined && input.weightUnit !== null
        ? { weightUnit: input.weightUnit }
        : {}),
      ...(input.loggedAt !== undefined ? { loggedAt: new Date(input.loggedAt) } : {}),
    })
    .returning();

  if (!row) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Lift-log insert returned no row.');
  }
  return serializeLiftLogEntry(row);
}

// --- DELETE /fitness/lift-log/[id] -------------------------------------------

/**
 * HARD-delete one of the user's lift-log entries. Throws {@link ApiError} 404 when the
 * row is absent or not owned by the caller.
 */
export async function deleteLiftLogEntry(
  db: Database,
  userId: string,
  entryId: unknown,
): Promise<void> {
  if (typeof entryId !== 'string' || !ENTRY_UUID.safeParse(entryId).success) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Lift-log entry not found.');
  }

  const deleted = await db
    .delete(liftLogEntries)
    .where(and(eq(liftLogEntries.id, entryId), eq(liftLogEntries.userId, userId)))
    .returning({ id: liftLogEntries.id });

  if (deleted.length === 0) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Lift-log entry not found.');
  }
}
