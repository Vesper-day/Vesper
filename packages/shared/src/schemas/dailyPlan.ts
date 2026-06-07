import { z } from 'zod';
import { BlockTypeSchema } from './block';
import { BlockDetailsSchema } from './jsonb/block-details';

/** "HH:MM" in 24h time, for the plan day (no date/timezone — that's the plan's own field). */
const TimeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM 24h time');

/**
 * One block as emitted by daily-plan synthesis. Mirrors BlockSchema (block.ts) but
 * omits server-assigned fields (id, dailyPlanId, userId, status, timestamps) and
 * per-block rationale/notes the model has no business generating: those inflate
 * output tokens without being shown to the user, and status/ids belong to the server.
 */
const DailyPlanBlockSchema = z
  .object({
    startTime: TimeOfDaySchema,
    endTime: TimeOfDaySchema,
    blockType: BlockTypeSchema,
    title: z.string(),
    details: BlockDetailsSchema,
    source: z.literal('ai_generated'),
    displayOrder: z.number().int(),
  })
  .strict()
  .refine((block) => block.blockType === block.details.blockType, {
    message: "details.blockType must match the block's blockType",
    path: ['details', 'blockType'],
  })
  .refine(
    (block) => {
      if (block.blockType === 'sleep') return block.endTime !== block.startTime; // wraps into early morning, e.g. 22:30 -> 06:45
      // "00:00" as an *end* time means end-of-day (the moment before midnight rolls
      // into tomorrow), not start-of-day — e.g. a wind-down block running 23:00 -> 00:00
      // right up to bedtime_target. Normalize it to "24:00" before comparing so that
      // case is accepted while a genuine same-day mistake (e.g. 09:30 -> 09:00) is not.
      const normalizedEnd = block.endTime === '00:00' ? '24:00' : block.endTime;
      return normalizedEnd > block.startTime;
    },
    {
      message: 'endTime must be after startTime ("00:00" counts as end-of-day; sleep blocks may wrap past midnight)',
      path: ['endTime'],
    },
  );

/**
 * Output shape for daily-plan synthesis (Layer 1 system prompt). `note` carries
 * the empty-blocks edge case (e.g. user's day is fully fixed-event) and is otherwise omitted.
 */
export const DailyPlanSchema = z.object({
  blocks: z.array(DailyPlanBlockSchema),
  note: z.string().optional(),
});
export type DailyPlan = z.infer<typeof DailyPlanSchema>;
