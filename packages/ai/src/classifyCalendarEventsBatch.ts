// Chat 023 scaffold — batched Google Calendar event classification.
//
// Model: claude-haiku-4-5 (same operation as classifyCalendarEvent). Structured
// output via generateObject; NOT voice-gated. Reuses the calendar-classify prompt.
//
// WHY BATCH: classifying N events in ONE call amortizes the system prompt + cache
// write across the whole sync, instead of paying it per event. The returned array is
// positional: classifications[i] is the block type for summaries[i] (or null).
//
// Array indexing is guarded throughout (noUncheckedIndexedAccess is ON): the model's
// returned array is normalized to exactly summaries.length entries, padding missing
// positions with null.

import { z } from 'zod';
import { BlockTypeSchema, type BlockType } from '@vesper/shared';
import { generateObject } from './generateObject';
import { MODELS } from './client';
import { CALENDAR_CLASSIFY_PROMPT } from './prompts/calendar-classify';

const BatchClassificationSchema = z.object({
  classifications: z.array(BlockTypeSchema.nullable()),
});

/**
 * Classify an array of Google Calendar event summaries in a single API call.
 * Returns one (BlockType | null) per input summary, in input order.
 */
export async function classifyCalendarEventsBatch(
  summaries: string[],
): Promise<(BlockType | null)[]> {
  if (summaries.length === 0) return [];

  const prompt = [
    'Classify each calendar event title below into one block_type value, or null.',
    'Return a "classifications" array with exactly one entry per title, in order.',
    JSON.stringify(summaries),
  ].join('\n');

  const { object } = await generateObject({
    schema: BatchClassificationSchema,
    model: MODELS.HAIKU,
    callType: 'calendar-classify',
    system: CALENDAR_CLASSIFY_PROMPT,
    prompt,
  });

  // Normalize to exactly one result per input. Guard every index access: a short
  // model response yields undefined past its end, which we coerce to null.
  const result: (BlockType | null)[] = [];
  for (let i = 0; i < summaries.length; i++) {
    result.push(object.classifications[i] ?? null);
  }
  return result;
}
