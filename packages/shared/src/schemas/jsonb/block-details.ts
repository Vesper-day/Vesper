import { z } from 'zod';

const WorkBlockDetailsSchema = z.object({
  blockType: z.literal('work'),
  tasks: z.array(z.string()).default([]),
  focusMode: z.boolean().optional(),
});

const FitnessBlockDetailsSchema = z.object({
  blockType: z.literal('fitness'),
  templateId: z.string().uuid().optional(),
  exercises: z
    .array(
      z.object({
        name: z.string(),
        sets: z.number(),
        reps: z.union([z.number(), z.string()]),
        restSeconds: z.number().optional(),
        notes: z.string().optional(),
      }),
    )
    .default([]),
});

const NutritionBlockDetailsSchema = z.object({
  blockType: z.literal('nutrition'),
  templateId: z.string().uuid().optional(),
  mealName: z.string().optional(),
  ingredients: z.array(z.string()).default([]),
  instructions: z.array(z.string()).default([]),
});

const ErrandsBlockDetailsSchema = z.object({
  blockType: z.literal('errands'),
  stops: z
    .array(
      z.object({
        title: z.string(),
        location: z.string(),
        estimatedMinutes: z.number(),
      }),
    )
    .default([]),
  routeOptimized: z.boolean().default(false),
});

const GenericBlockDetailsSchema = z.object({
  blockType: z.enum([
    'sleep',
    'medication',
    'finance',
    'focus',
    'commute',
    'custom',
  ]),
  notes: z.string().optional(),
});

export const BlockDetailsSchema = z.discriminatedUnion('blockType', [
  WorkBlockDetailsSchema,
  FitnessBlockDetailsSchema,
  NutritionBlockDetailsSchema,
  ErrandsBlockDetailsSchema,
  GenericBlockDetailsSchema,
]);

export type BlockDetails = z.infer<typeof BlockDetailsSchema>;
