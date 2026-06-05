import { z } from 'zod';

const RecurringCommitmentSchema = z.object({
  title: z.string(),
  frequency: z.string(),
  time: z.string(),
  dayOfWeek: z.string().optional(),
});

const LocationBoundEventSchema = z.object({
  title: z.string(),
  location: z.string(),
  time: z.string(),
  dayOfWeek: z.string().optional(),
});

const GoalSchema = z.object({
  category: z.string(),
  description: z.string(),
});

export const BaseProfileSchema = z.object({
  workSchedulePattern: z
    .object({
      days: z.array(z.string()),
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  recurringCommitments: z.array(RecurringCommitmentSchema).default([]),
  locationBoundEvents: z.array(LocationBoundEventSchema).default([]),
  goals: z.array(GoalSchema).default([]),
  preferences: z
    .object({
      wakeTarget: z.string().optional(),
      bedtimeTarget: z.string().optional(),
    })
    .optional(),
});

export type BaseProfile = z.infer<typeof BaseProfileSchema>;
