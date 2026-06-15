// Chat 023 scaffold — single Google Calendar event classification.
//
// Model: claude-haiku-4-5 (TECHNICAL_SPEC.md §5 — "Google Calendar event
// classification (assigning a block_type_enum value to ambiguous calendar events
// during sync)"). Structured output via generateObject; NOT voice-gated.
//
// Returns one BlockTypeSchema value, or null when no confident classification
// exists. BlockTypeSchema (packages/shared/src/schemas/block.ts) is the ONLY valid
// set of return values.

import { z } from 'zod';
import { BlockTypeSchema, type BlockType } from '@vesper/shared';
import { generateObject } from './generateObject';
import { MODELS } from './client';
import { CALENDAR_CLASSIFY_PROMPT } from './prompts/calendar-classify';

/** Shared result schema: a block type, or null when classification is uncertain. */
export const CalendarClassificationSchema = z.object({
  blockType: BlockTypeSchema.nullable(),
});

/**
 * Classify a single Google Calendar event summary into one block type, or null.
 */
export async function classifyCalendarEvent(
  summary: string,
): Promise<BlockType | null> {
  const { object } = await generateObject({
    schema: CalendarClassificationSchema,
    model: MODELS.HAIKU,
    callType: 'calendar-classify',
    system: CALENDAR_CLASSIFY_PROMPT,
    prompt: summary,
  });
  return object.blockType;
}
