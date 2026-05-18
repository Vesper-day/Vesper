import { z } from 'zod';

export const DailyPlanSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  planDate: z.string(),
  energyScore: z.number().int().min(1).max(10).nullable(),
  regenerationCount: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DailyPlan = z.infer<typeof DailyPlanSchema>;

const WeeklyPriorityItemSchema = z.object({
  text: z.string(),
  source: z.enum(['user', 'ai_suggested']),
  completedAt: z.string().datetime().optional(),
});

export const WeeklyPrioritiesSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  weekStartDate: z.string(),
  priorities: z.array(WeeklyPriorityItemSchema).min(3).max(5),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WeeklyPriorities = z.infer<typeof WeeklyPrioritiesSchema>;
