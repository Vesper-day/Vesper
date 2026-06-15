// Chat 023 scaffold — morning check-in question generation.
//
// Model: claude-haiku-4-5 (TECHNICAL_SPEC.md §5 — "daily check-in question
// generation (producing one or two short morning questions based on date context
// and recent energy scores)"). Freeform copy via generateText.
//
// VOICE-GATED: this output is user-visible butler copy. The generateText wrapper
// (chat 016) runs every returned string through the chat-017 voice gate internally
// before resolving, so calling it here is the gate integration point — we must not
// double-gate.

import { generateText } from './generateText';
import { MODELS } from './client';
import { CHECKIN_QUESTION_PROMPT } from './prompts/checkin-question';

export type CheckInContext = {
  /** Current date in the user's timezone, e.g. "Monday, June 15". */
  localDate: string;
  /** Most recent energy scores (1–10), newest first. May be empty. */
  recentEnergyScores: number[];
};

/**
 * Generate one or two short morning check-in questions, in butler voice.
 * The string is voice-gated by the generateText wrapper before it is returned.
 */
export async function generateCheckInQuestion(
  context: CheckInContext,
): Promise<string> {
  const energy =
    context.recentEnergyScores.length > 0
      ? context.recentEnergyScores.join(', ')
      : 'none recorded';

  const prompt = [
    `Date: ${context.localDate}`,
    `Recent energy scores (newest first): ${energy}`,
  ].join('\n');

  const { text } = await generateText({
    model: MODELS.HAIKU,
    callType: 'checkin-question',
    system: CHECKIN_QUESTION_PROMPT,
    prompt,
    voiceSource: 'freeform',
  });

  return text;
}
