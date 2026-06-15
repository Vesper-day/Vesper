// Chat 023 scaffold — empathetic "what's not working?" regeneration prompt.
//
// Model: claude-sonnet-4-6 (TECHNICAL_SPEC.md §5 — "the empathetic regeneration
// prompt that fires after the user has rejected three successive plan regenerations
// for the same date"). Freeform copy via generateText.
//
// VOICE-GATED: user-visible butler copy. The generateText wrapper runs the chat-017
// voice gate internally before resolving; this is the single gate integration point.

import { generateText } from './generateText';
import { MODELS } from './client';
import { EMPATHY_REGENERATION_PROMPT } from './prompts/empathy-regeneration';

export type RegenerationContext = {
  /** Number of successive rejected regenerations (the trigger is three). */
  failedAttempts: number;
  /** Optional free-text signal about what the user disliked. */
  recentFeedback?: string;
};

/**
 * Generate the empathetic, butler-voice "what's not working?" prompt shown after
 * three failed regenerations. Voice-gated by the generateText wrapper.
 */
export async function generateRegenerationPrompt(
  context: RegenerationContext,
): Promise<string> {
  const promptLines = [
    `The user has rejected ${context.failedAttempts} successive regenerations.`,
    ...(context.recentFeedback ? [`Recent feedback: ${context.recentFeedback}`] : []),
    'Acknowledge briefly and ask one short question about what is not working.',
  ];

  const { text } = await generateText({
    model: MODELS.SONNET,
    callType: 'empathy-regeneration',
    system: EMPATHY_REGENERATION_PROMPT,
    prompt: promptLines.join('\n'),
    voiceSource: 'freeform',
  });

  return text;
}
