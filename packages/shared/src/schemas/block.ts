import { z } from 'zod';
import { BlockDetailsSchema } from './jsonb/block-details';

export const BlockTypeSchema = z.enum([
  'work',
  'fitness',
  'nutrition',
  'sleep',
  'errands',
  'medication',
  'finance',
  'focus',
  'commute',
  'custom',
]);
export type BlockType = z.infer<typeof BlockTypeSchema>;

export const BlockStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'skipped',
  'rescheduled',
]);
export type BlockStatus = z.infer<typeof BlockStatusSchema>;

export const BlockSchema = z.object({
  id: z.string().uuid(),
  dailyPlanId: z.string().uuid(),
  userId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  blockType: BlockTypeSchema,
  title: z.string(),
  status: BlockStatusSchema,
  details: BlockDetailsSchema,
  source: z.enum(['ai_generated', 'user_added', 'google_calendar', 'recurring']),
  displayOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Block = z.infer<typeof BlockSchema>;
