// Layer-3 template subset builder (Chat 021) — STUB.
//
// Real template seeding + filtering is chat 048's job. This file only fixes the
// type contract and returns empty lists; the daily-plan prompt tolerates empty
// workouts/recipes (see dailyPlanSynthesis.ts MODULE SCOPE / templateId rule).
//
// Intended filter contract (chat 048 implements against the real seeded tables):
//   - workouts: <= 10, filtered by modulesEnabled.fitness.{goal, equipment, level}
//   - recipes:  <= 15, filtered by modulesEnabled.nutrition.{dietTags, cookingTimeMaxMinutes}
// Any slice/index logic added later MUST guard array access
// (noUncheckedIndexedAccess is ON): length-check + ! or ?.

import type { ModulesEnabled } from '@vesper/db';
import { workoutTemplates, recipeTemplates } from '@vesper/db';

// Element types derive from the real inferred selects so chat 048 can drop in
// rows without changing the public shape.
export type WorkoutTemplate = typeof workoutTemplates.$inferSelect;
export type RecipeTemplate = typeof recipeTemplates.$inferSelect;

export interface TemplateSubset {
  workouts: WorkoutTemplate[];
  recipes: RecipeTemplate[];
}

/**
 * STUB. Returns empty workout/recipe lists. The `modulesEnabled` argument is the
 * future filter input (chat 048); it is intentionally unused while seeding is
 * pending, hence the leading underscore.
 */
export async function buildTemplateSubset(
  _modulesEnabled: ModulesEnabled,
): Promise<TemplateSubset> {
  return { workouts: [], recipes: [] };
}
