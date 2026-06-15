// Chat 023 scaffold — natural-language plan-edit command parser.
//
// Model: claude-haiku-4-5 (TECHNICAL_SPEC.md §5 — "natural-language command parsing
// (translating statements like 'move gym to 7pm' into a structured PlanEditCommand
// object)" runs on Haiku). Structured output via generateObject; NOT voice-gated
// (the output is a machine command, never user-visible copy).
//
// PRIVACY (mandatory, build-plan Chat 023): the raw user utterance is never
// persisted or forwarded. Only the parsed structural command leaves this function.
// When telemetry wants to dedupe phrasings, it receives a SHA-256 hash of the input
// — never the input string itself — via the optional onTelemetry hook.

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { BlockTypeSchema } from '@vesper/shared';
import { generateObject } from './generateObject';
import { MODELS } from './client';
import { NL_COMMAND_PROMPT, NL_COMMAND_VERSION } from './prompts/nl-command';

// A block id is a uuid; new times are ISO-8601 datetime strings (block.ts uses
// z.string().datetime() for startTime/endTime).
const BlockIdSchema = z.string().uuid();
const DateTimeSchema = z.string().datetime();

// add_block carries the shape needed to create a block. Derived from BlockSchema's
// creation fields: blockType + title + start/end times. The discriminated `details`
// payload (block-details.ts) is intentionally NOT modeled here — its Zod uses
// per-variant `.default([])`, whose input≠output type breaks the wrapper's single
// type-parameter generic. The plan synthesizer fills details downstream.
const AddBlockInputSchema = z.object({
  blockType: BlockTypeSchema,
  title: z.string().min(1),
  startTime: DateTimeSchema,
  endTime: DateTimeSchema,
});
export type AddBlockInput = z.infer<typeof AddBlockInputSchema>;

/**
 * The structured result of parsing a natural-language plan edit. Discriminated on
 * `type` with exactly seven variants. Each carries only the fields its action needs;
 * `regenerate_plan` and `unknown` carry no payload.
 */
export const PlanEditCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('reschedule_block'),
    blockId: BlockIdSchema,
    newStartTime: DateTimeSchema,
    newEndTime: DateTimeSchema.optional(),
  }),
  z.object({ type: z.literal('complete_block'), blockId: BlockIdSchema }),
  z.object({ type: z.literal('skip_block'), blockId: BlockIdSchema }),
  z.object({ type: z.literal('add_block'), block: AddBlockInputSchema }),
  z.object({ type: z.literal('remove_block'), blockId: BlockIdSchema }),
  z.object({ type: z.literal('regenerate_plan') }),
  z.object({ type: z.literal('unknown') }),
]);
export type PlanEditCommand = z.infer<typeof PlanEditCommandSchema>;

/** Telemetry payload. Carries the input HASH only — never the raw utterance. */
export type ParseTelemetry = {
  inputHash: string;
  commandType: PlanEditCommand['type'];
  promptVersion: string;
};

export type ParsePlanEditCommandOptions = {
  /**
   * Optional dedupe hook. Receives a SHA-256 hash of the input plus the parsed
   * command type and prompt version. The raw input is intentionally absent.
   */
  onTelemetry?: (event: ParseTelemetry) => void;
};

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Parse a natural-language plan edit into a structured PlanEditCommand.
 *
 * The raw `input` is used only to drive the model call and to compute a one-way
 * hash for telemetry; it is never returned or persisted by this function.
 */
export async function parsePlanEditCommand(
  input: string,
  options: ParsePlanEditCommandOptions = {},
): Promise<PlanEditCommand> {
  const { object } = await generateObject({
    schema: PlanEditCommandSchema,
    model: MODELS.HAIKU,
    callType: 'nl-command',
    system: NL_COMMAND_PROMPT,
    prompt: input,
  });

  if (options.onTelemetry) {
    options.onTelemetry({
      inputHash: sha256(input),
      commandType: object.type,
      promptVersion: NL_COMMAND_VERSION,
    });
  }

  return object;
}
