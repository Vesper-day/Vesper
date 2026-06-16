// Zod row schemas for the template seed files.
//
// Hand-authored directly from packages/db/migrations/20260601000005_templates.sql
// (the canonical schema per ARCHITECTURE_DECISIONS Decision 01), NOT generated via
// drizzle-zod off packages/db/src/schema/templates.ts. Keys are snake_case to match the
// real table columns so the emitted JSON inserts 1:1. Columns with DB defaults
// (id, created_at) are intentionally omitted from the insertable row.
//
// CHECKs / enums enforced here mirror the .sql exactly:
//   workout_templates: duration_minutes IN (15,30,45,60); intensity_score 1..10;
//     level workout_level_enum; goal_tags/equipment_tags text[]; content jsonb NOT NULL;
//     source text NOT NULL.
//   recipe_templates: prep_minutes>=0; cook_minutes>=0; total_minutes>=0; servings>0;
//     difficulty recipe_difficulty_enum; cuisine_tags/diet_tags text[];
//     macros/ingredients/instructions jsonb NOT NULL; image_url text NULL; source NOT NULL.

import { z } from 'zod';

// Enums — sourced from 20260601000001_enums_and_extensions.sql.
export const workoutLevel = z.enum(['beginner', 'intermediate', 'advanced']);
export const recipeDifficulty = z.enum(['easy', 'medium', 'hard']);

const nonEmpty = z.string().min(1);
const tagArray = z.array(z.string().min(1));

// --- workout_templates -------------------------------------------------------

// content jsonb shape (not constrained by a CHECK; structured for downstream use).
const workoutExercise = z.object({
  name: nonEmpty,
  target: z.string(),
  bodyPart: z.string(),
  equipment: z.string(),
  sets: z.number().int().positive(),
  reps: nonEmpty,
});

const workoutContent = z.object({
  focus: nonEmpty,
  exercises: z.array(workoutExercise).min(1),
});

export const workoutTemplateRow = z
  .object({
    name: nonEmpty,
    goal_tags: tagArray,
    equipment_tags: tagArray,
    duration_minutes: z
      .number()
      .int()
      .refine((v) => [15, 30, 45, 60].includes(v), {
        message: 'duration_minutes must be one of 15, 30, 45, 60',
      }),
    level: workoutLevel,
    intensity_score: z.number().int().min(1).max(10),
    content: workoutContent,
    source: nonEmpty,
  })
  .strict();

// --- recipe_templates --------------------------------------------------------

const macros = z.object({
  calories: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
});

const ingredient = z.object({
  name: nonEmpty,
  measure: z.string(),
});

export const recipeTemplateRow = z
  .object({
    name: nonEmpty,
    cuisine_tags: tagArray,
    diet_tags: tagArray,
    prep_minutes: z.number().int().min(0),
    cook_minutes: z.number().int().min(0),
    total_minutes: z.number().int().min(0),
    difficulty: recipeDifficulty,
    macros,
    servings: z.number().int().positive(),
    ingredients: z.array(ingredient).min(1),
    instructions: z.array(nonEmpty).min(1),
    image_url: z.string().url().nullable(),
    source: nonEmpty,
  })
  .strict();

export type WorkoutTemplateRow = z.infer<typeof workoutTemplateRow>;
export type RecipeTemplateRow = z.infer<typeof recipeTemplateRow>;
