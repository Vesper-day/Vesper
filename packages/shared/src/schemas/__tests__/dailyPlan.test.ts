import { describe, it, expect } from 'vitest';
import { DailyPlanSchema } from '../dailyPlan';

const samplePlan = {
  blocks: [
    {
      startTime: '06:45',
      endTime: '07:15',
      blockType: 'nutrition',
      title: 'Breakfast',
      details: {
        blockType: 'nutrition',
        mealName: 'Greek yogurt with berries and oats',
        ingredients: ['greek yogurt', 'mixed berries', 'rolled oats'],
        instructions: ['Combine in a bowl.', 'Top with berries.'],
      },
      source: 'ai_generated',
      displayOrder: 0,
    },
    {
      startTime: '09:00',
      endTime: '09:30',
      blockType: 'work',
      title: 'Team standup',
      details: { blockType: 'work', tasks: ["Share yesterday's progress"], focusMode: false },
      source: 'ai_generated',
      displayOrder: 1,
    },
    {
      startTime: '22:30',
      endTime: '06:45',
      blockType: 'sleep',
      title: 'Sleep',
      details: { blockType: 'sleep', notes: 'Eight hours.' },
      source: 'ai_generated',
      displayOrder: 2,
    },
  ],
};

describe('DailyPlanSchema', () => {
  it('validates a well-formed sample plan', () => {
    expect(DailyPlanSchema.safeParse(samplePlan).success).toBe(true);
  });

  it('validates the empty-blocks edge case with a note', () => {
    const result = DailyPlanSchema.safeParse({ blocks: [], note: 'Today is already accounted for.' });
    expect(result.success).toBe(true);
  });

  it('allows note to be omitted', () => {
    expect(DailyPlanSchema.safeParse({ blocks: [] }).success).toBe(true);
  });

  it('rejects malformed time strings', () => {
    const bad = structuredClone(samplePlan);
    bad.blocks[0]!.startTime = '6:45';
    expect(DailyPlanSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects endTime not after startTime', () => {
    const bad = structuredClone(samplePlan);
    bad.blocks[1]!.startTime = '09:30';
    bad.blocks[1]!.endTime = '09:00';
    expect(DailyPlanSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a source other than ai_generated', () => {
    const bad = structuredClone(samplePlan);
    // @ts-expect-error testing invalid source value
    bad.blocks[0].source = 'user_added';
    expect(DailyPlanSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects details that do not match the block blockType', () => {
    const bad = structuredClone(samplePlan);
    // @ts-expect-error testing mismatched discriminant
    bad.blocks[0].details = { blockType: 'work', tasks: [] };
    expect(DailyPlanSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects server-assigned fields the model must not emit', () => {
    const bad = { ...structuredClone(samplePlan), blocks: structuredClone(samplePlan.blocks) };
    // @ts-expect-error id is not part of the synthesis output contract
    bad.blocks[0].id = 'some-uuid';
    expect(DailyPlanSchema.safeParse(bad).success).toBe(false);
  });
});
