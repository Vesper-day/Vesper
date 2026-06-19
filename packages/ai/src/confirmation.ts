// Butler-tone confirmation copy for natural-language plan-edit commands (§9
// POST /api/v1/ai/command). Single source of truth — mirrors the APOLOGY_LINE
// pattern: one canonical constant set, re-exported so every consumer shares the
// exact string (no duplicated magic copy).
//
// Why these are CONSTANTS, not a runtime model call: the §9 `confirmationLine`
// for the unknown branch MUST be deterministic (build-plan Chat 029 — no runtime
// Haiku/AI call for the clarification). The structured-branch lines are likewise
// fixed butler copy keyed by command type, so the route never spends a model
// call to acknowledge an edit it already parsed.
//
// VOICE GATE (authoring-time): every string below was authored through the two
// voice-gate skills (caveman + stop-slop) and verified against the regex layer
// (voiceGate.regex.ts) — no em-dash, no '!', no emoji, no PRD §5.4 "Never Says"
// term. Each is < 30 whitespace tokens, so at runtime voiceGate() applies the
// regex layer only (Haiku review is out-of-scope) and returns them unchanged
// with zero tier-B flags.

import type { PlanEditCommand } from './parsePlanEditCommand';

/**
 * Butler-tone clarification returned when a command cannot be parsed into a
 * structured operation (command.type === 'unknown'). Authored once, gate-cleared.
 */
export const UNKNOWN_COMMAND_CLARIFICATION =
  "I couldn't identify a specific change there. Could you rephrase it?";

/**
 * Fixed acknowledgement line per structured command type. Keyed exhaustively on
 * the seven-variant PlanEditCommand union (a new variant without a line is a
 * compile error). No user input is interpolated, so each line is fully
 * gate-cleared at authoring time.
 */
const STRUCTURED_CONFIRMATIONS: Record<PlanEditCommand['type'], string> = {
  reschedule_block: 'Rescheduled.',
  complete_block: 'Marked complete.',
  skip_block: 'Skipped.',
  add_block: 'Added to your plan.',
  remove_block: 'Removed from your plan.',
  regenerate_plan: 'Rebuilding your plan.',
  unknown: UNKNOWN_COMMAND_CLARIFICATION,
};

/**
 * The butler-tone `confirmationLine` for a parsed command. Returns the fixed
 * clarification for `unknown`, or the type-keyed acknowledgement otherwise.
 */
export function confirmationLineFor(command: PlanEditCommand): string {
  return STRUCTURED_CONFIRMATIONS[command.type];
}
