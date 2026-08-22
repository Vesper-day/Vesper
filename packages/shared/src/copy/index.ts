// Authored butler-line copy library (client-safe).
//
// Chat 044 (the copy library) has not landed yet, and the ButlerVoice / ButlerLine
// UI containers (apps/{web,mobile}/components/ui) hold NO authored copy — they only
// render a string in the butler register. So this module is the FIRST home for an
// authored, voice-gated butler line: the Chat 061 Finance-module "bill due tomorrow"
// reminder line, authored here for the reminder worker (Chat 075) to consume.
//
// LOCATION RATIONALE: this lives at the client-safe subpath `@vesper/shared/copy`
// (never the bare @vesper/shared barrel, which transitively pulls @vesper/db ->
// postgres and would drag server-only code into a client bundle). It is a PURE
// string/template module — zero imports, no server code — so web, mobile, and a
// Cloudflare Worker (075) can all import it. When Chat 044 lands the full copy
// library, consolidate these entries there and re-point importers.
//
// VOICE: butler register (caveman + stop-slop gate applied) — plain, exact, no
// filler. The line is a single declarative sentence with one template slot.

/**
 * The Finance module's authored reminder line, rendered the day BEFORE a bill's
 * due day. `{billName}` is the only template slot, filled with the bill's name.
 *
 * Rendered example: `billDueTomorrow('Rent')` -> `"Rent is due tomorrow."`
 *
 * 061 AUTHORS this line only. The reminder worker (075) decides WHEN to render it;
 * this module never schedules, formats a date, or touches the DB.
 */
export function billDueTomorrow(billName: string): string {
  return `${billName} is due tomorrow.`;
}

/** Stable id for this entry, so 044/075 can key/consolidate it later. */
export const BILL_DUE_TOMORROW_COPY_ID = 'finance.bill_due_tomorrow' as const;

// ---------------------------------------------------------------------------
// Over-commit prompt (Chat 056) — Tasks module.
// ---------------------------------------------------------------------------
//
// PRD §1: this prompt "is the only interruption the engine initiates for scheduling
// conflicts." ONE prompt, never a per-item cascade. PRD §6.1 / §4.1: when the day no
// longer holds enough open time for all committed task work, the engine surfaces a
// single prompt asking the user to choose which items move to tomorrow.
//
// Authored here (not inlined in two components) so the web and mobile prompts render
// the SAME strings from the SAME client-safe `@vesper/shared/copy` subpath.
//
// VOICE GATE (Chat 056 determination): NOT gated. The live gate (packages/ai
// voiceGate.ts) is a runtime Anthropic call over GENERATED strings, and gatePlanStrings
// covers only block.title and block.note. Static UI copy has no gate call to route
// through, and Chat 057's precedent is that its two PRD-transcribed lines were likewise
// not voice-gated. These lines are instead authored to the gate's rules by hand and
// asserted against them in copy.test.ts: no em-dash, no exclamation point, no emoji, no
// bare AI token (Tier A) and none of the §5.4 "Never Says" words (Tier B).
//
// NO SCOREKEEPING: a component-level prohibition, not just a voice rule. These lines
// state what the butler cannot fit and ask for a choice. They never count what the user
// finished, praise, rank, or frame the day as progress against a target.

/**
 * The single over-commit line. The butler states the constraint in the first person and
 * asks for one decision. Deliberately says nothing about how much was done today.
 */
export const OVER_COMMIT_PROMPT_LINE =
  'I cannot fit everything into what remains of today. Choose which items move to tomorrow.';

/** Header for the conflicting-items list the prompt presents. */
export const OVER_COMMIT_ITEMS_HEADING = 'Competing for the time left';

/** Action labels. Each item takes one of the two; the prompt confirms them together. */
export const OVER_COMMIT_KEEP_LABEL = 'Keep today';
export const OVER_COMMIT_DEFER_LABEL = 'Move to tomorrow';

/** The single confirm action. Inert until every listed item has a choice. */
export const OVER_COMMIT_CONFIRM_LABEL = 'Settle the day';

/**
 * One conflicting item's line: its title and the minutes the day cannot hold.
 *
 * Rendered example: `overCommitItemLine('Draft the proposal', 45)`
 *   -> `"Draft the proposal, 45 min"`
 */
export function overCommitItemLine(title: string, minutes: number): string {
  return `${title}, ${minutes} min`;
}

/** Stable id for this entry, so 044 can key/consolidate it later. */
export const OVER_COMMIT_COPY_ID = 'tasks.over_commit_prompt' as const;
