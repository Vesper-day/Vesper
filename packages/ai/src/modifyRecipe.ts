// AI recipe-modify applier (Chat ADD-B, Nutrition module scaffold).
//
// Model: claude-sonnet-4-6 (generateText default — freeform generative copy, the same
// tier as plan synthesis / empathy regeneration per TECHNICAL_SPEC.md §5). This REUSES
// the existing AI command infrastructure: the generateText wrapper (chat 016) records
// cost, applies the call-type cache_control, and runs the returned string through the
// chat-017 voice gate internally (whose chat-022 breaker seam falls back to regex-only
// during an Anthropic outage). We do NOT fork synthesizePlan and we register NO new
// Anthropic model row.
//
// VOICE-GATED: the output is user-visible butler copy; the gate runs inside
// generateText before this resolves, so we must not double-gate here.

import { generateText } from './generateText';
import { MODELS } from './client';
import { RECIPE_MODIFY_PROMPT, RECIPE_MODIFY_VERSION } from './prompts/recipe-modify';

export type ModifyRecipeInput = {
  /** The recipe's name (from the corpus or free-text). */
  recipeName: string;
  /** The recipe's current instructions, when available. */
  instructions?: string;
  /** The change the person asks for, e.g. "make it vegetarian". */
  request: string;
};

/** The prompt version this applier is pinned to (telemetry / observability). */
export const MODIFY_RECIPE_PROMPT_VERSION = RECIPE_MODIFY_VERSION;

/**
 * Adjust a recipe to a requested change and return the revised recipe as butler-voice
 * text. The string is voice-gated by the generateText wrapper before it is returned.
 */
export async function modifyRecipe(input: ModifyRecipeInput): Promise<string> {
  const prompt = [
    `Recipe: ${input.recipeName}`,
    input.instructions ? `Current instructions:\n${input.instructions}` : null,
    `Requested change: ${input.request}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const { text } = await generateText({
    model: MODELS.SONNET,
    callType: 'freeform',
    system: RECIPE_MODIFY_PROMPT,
    prompt,
    voiceSource: 'freeform',
  });

  return text;
}
