// Layer-3 template subset builder (Chat 021 stub → Chat 048 implementation).
//
// Filters the seeded reference templates down to the slice relevant to a user's
// enabled modules, for the daily-plan prompt. Mechanism (established by the chat-021
// stub's imports + the sibling userContext.ts builder): a Drizzle read with optional
// `db?` injection. Reference data is tiny (~143 workouts + ~300 recipes), so we fetch
// the candidate rows once and apply the predicate filtering in memory via the exported
// pure helpers below — this keeps the exact predicate direction unit-testable without a
// live Postgres. The GIN/btree indexes on the tag arrays + total_minutes remain for a
// future SQL-side push-down if profiling ever warrants it.
//
// Predicate contract (real camelCase fields from ModulesEnabledSchema):
//   Workouts (fitness.enabled): template.goalTags CONTAINS user fitness.goal (scalar);
//     template.equipmentTags ⊆ user fitness.equipment (feasibility — only workouts whose
//     required equipment the user owns); template.level <= user fitness.level
//     (beginner<intermediate<advanced). Each predicate skipped when its user field is
//     undefined. Limit 10.
//   Recipes (nutrition.enabled): template.dietTags CONTAINS user nutrition.dietTags
//     (every user diet tag present on the template); template.totalMinutes <=
//     user nutrition.cookingTimeMaxMinutes (skipped if undefined). Limit 15.
//
// noUncheckedIndexedAccess is ON: the helpers use every/includes/slice only — no bare
// index access.

import type { ModulesEnabled, Database } from '@vesper/db';
import { createDrizzleClient, workoutTemplates, recipeTemplates } from '@vesper/db';

// Element types derive from the real inferred selects so the public shape matches the
// seeded rows 1:1.
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type RecipeTemplate = typeof recipeTemplates.$inferSelect;

export interface TemplateSubset {
  workouts: WorkoutTemplate[];
  recipes: RecipeTemplate[];
}

const WORKOUT_LIMIT = 10;
const RECIPE_LIMIT = 15;

type Fitness = ModulesEnabled['fitness'];
type Nutrition = ModulesEnabled['nutrition'];

// beginner < intermediate < advanced (the workout_level_enum declaration order).
const LEVEL_RANK: Record<WorkoutTemplate['level'], number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

/**
 * Pure workout filter. `fitness` is the user's fitness module prefs. Predicates whose
 * user field is undefined are skipped; the result is capped at {@link WORKOUT_LIMIT}.
 */
export function filterWorkouts(
  rows: WorkoutTemplate[],
  fitness: Fitness,
): WorkoutTemplate[] {
  let out = rows;

  // template.goalTags CONTAINS the user's scalar goal.
  const goal = fitness.goal;
  if (goal !== undefined) {
    out = out.filter((r) => r.goalTags.includes(goal));
  }

  // template.equipmentTags ⊆ user.equipment — every piece the workout needs is owned.
  // (`equipment` is always present, default []; [] keeps only no-equipment workouts.)
  const equipment = fitness.equipment;
  out = out.filter((r) => r.equipmentTags.every((tag) => equipment.includes(tag)));

  // template.level <= user.level.
  const level = fitness.level;
  if (level !== undefined) {
    const cap = LEVEL_RANK[level];
    out = out.filter((r) => LEVEL_RANK[r.level] <= cap);
  }

  return out.slice(0, WORKOUT_LIMIT);
}

/**
 * Pure recipe filter. `nutrition` is the user's nutrition module prefs. Predicates whose
 * user field is undefined are skipped; the result is capped at {@link RECIPE_LIMIT}.
 */
export function filterRecipes(
  rows: RecipeTemplate[],
  nutrition: Nutrition,
): RecipeTemplate[] {
  let out = rows;

  // template.dietTags CONTAINS the user's dietTags — every requested tag is on the
  // template. ([] is a no-op: every() over an empty array is true.)
  const dietTags = nutrition.dietTags;
  out = out.filter((r) => dietTags.every((tag) => r.dietTags.includes(tag)));

  // template.totalMinutes <= the user's cooking-time ceiling.
  const maxMinutes = nutrition.cookingTimeMaxMinutes;
  if (maxMinutes !== undefined) {
    out = out.filter((r) => r.totalMinutes <= maxMinutes);
  }

  return out.slice(0, RECIPE_LIMIT);
}

/**
 * Build the Layer-3 template subset for a plan generation call.
 *
 * @param modulesEnabled the user's enabled-modules prefs (camelCase, post-111).
 * @param db Optional Drizzle client (injected in tests). Defaults to the canonical
 *           connection-selecting factory for production/route use.
 *
 * Disabled modules issue no query and yield an empty list.
 */
export async function buildTemplateSubset(
  modulesEnabled: ModulesEnabled,
  db?: Database,
): Promise<TemplateSubset> {
  const fitness = modulesEnabled.fitness;
  const nutrition = modulesEnabled.nutrition;

  if (!fitness.enabled && !nutrition.enabled) {
    return { workouts: [], recipes: [] };
  }

  const client = db ?? createDrizzleClient();

  let workouts: WorkoutTemplate[] = [];
  if (fitness.enabled) {
    const rows = (await client
      .select()
      .from(workoutTemplates)) as WorkoutTemplate[];
    workouts = filterWorkouts(rows, fitness);
  }

  let recipes: RecipeTemplate[] = [];
  if (nutrition.enabled) {
    const rows = (await client
      .select()
      .from(recipeTemplates)) as RecipeTemplate[];
    recipes = filterRecipes(rows, nutrition);
  }

  return { workouts, recipes };
}
