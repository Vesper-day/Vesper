import { z } from 'zod';

export const ModulesEnabledSchema = z.object({
  work: z.object({ enabled: z.boolean() }).default({ enabled: false }),
  fitness: z
    .object({
      enabled: z.boolean(),
      goal: z
        .enum(['strength', 'cardio', 'fat_loss', 'maintenance', 'mobility'])
        .optional(),
      equipment: z.array(z.string()).default([]),
      level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    })
    .default({ enabled: false }),
  nutrition: z
    .object({
      enabled: z.boolean(),
      dietTags: z.array(z.string()).default([]),
      cookingTimeMaxMinutes: z.number().optional(),
      dislikes: z.array(z.string()).default([]),
      macroTargets: z
        .object({
          calories: z.number(),
          proteinG: z.number(),
          carbsG: z.number(),
          fatG: z.number(),
        })
        .optional(),
    })
    .default({ enabled: false }),
  // Chat 111 §5.1 — wake/bed targets removed from the sleep module. They are now
  // canonical, always-present top-level fields on BaseProfile (wakeTarget /
  // bedtimeTarget). The sleep module keeps `enabled` only; read wake/bed from
  // BaseProfile, never from here.
  sleep: z.object({ enabled: z.boolean() }).default({ enabled: false }),
  errands: z.object({ enabled: z.boolean() }).default({ enabled: false }),
  medication: z.object({ enabled: z.boolean() }).default({ enabled: false }),
  finance: z.object({ enabled: z.boolean() }).default({ enabled: false }),
});

export type ModulesEnabled = z.infer<typeof ModulesEnabledSchema>;
