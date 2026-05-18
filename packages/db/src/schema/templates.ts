import { sql } from 'drizzle-orm';
import * as t from 'drizzle-orm/pg-core';

export const workoutLevelEnum = t.pgEnum('workout_level_enum', [
  'beginner',
  'intermediate',
  'advanced',
]);

export const recipeDifficultyEnum = t.pgEnum('recipe_difficulty_enum', [
  'easy',
  'medium',
  'hard',
]);

export const workoutTemplates = t.pgTable(
  'workout_templates',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    name: t.text('name').notNull(),
    goalTags: t.text('goal_tags').array().notNull().default([]),
    equipmentTags: t.text('equipment_tags').array().notNull().default([]),
    durationMinutes: t.integer('duration_minutes').notNull(),
    level: workoutLevelEnum('level').notNull(),
    intensityScore: t.integer('intensity_score').notNull(),
    content: t.jsonb('content').notNull(),
    source: t.text('source').notNull(),
    createdAt: t
      .timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    t.index('idx_workout_templates_goal_tags').using('gin', table.goalTags),
    t.index('idx_workout_templates_equipment_tags').using('gin', table.equipmentTags),
    t
      .index('idx_workout_templates_duration_level')
      .on(table.durationMinutes, table.level),
    t.index('idx_workout_templates_intensity_score').on(table.intensityScore),
    t.check(
      'duration_minutes_valid',
      sql`${table.durationMinutes} IN (15, 30, 45, 60)`,
    ),
    t.check(
      'intensity_score_range',
      sql`${table.intensityScore} BETWEEN 1 AND 10`,
    ),
  ],
);

export const recipeTemplates = t.pgTable(
  'recipe_templates',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    name: t.text('name').notNull(),
    cuisineTags: t.text('cuisine_tags').array().notNull().default([]),
    dietTags: t.text('diet_tags').array().notNull().default([]),
    prepMinutes: t.integer('prep_minutes').notNull(),
    cookMinutes: t.integer('cook_minutes').notNull(),
    totalMinutes: t.integer('total_minutes').notNull(),
    difficulty: recipeDifficultyEnum('difficulty').notNull(),
    macros: t.jsonb('macros').notNull(),
    servings: t.integer('servings').notNull(),
    ingredients: t.jsonb('ingredients').notNull(),
    instructions: t.jsonb('instructions').notNull(),
    imageUrl: t.text('image_url'),
    source: t.text('source').notNull(),
    createdAt: t
      .timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    t.index('idx_recipe_templates_diet_tags').using('gin', table.dietTags),
    t.index('idx_recipe_templates_cuisine_tags').using('gin', table.cuisineTags),
    t.index('idx_recipe_templates_total_minutes').on(table.totalMinutes),
    t.check('prep_minutes_non_negative', sql`${table.prepMinutes} >= 0`),
    t.check('cook_minutes_non_negative', sql`${table.cookMinutes} >= 0`),
    t.check('servings_positive', sql`${table.servings} > 0`),
  ],
);
