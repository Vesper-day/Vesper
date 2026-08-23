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

// ---------------------------------------------------------------------------
// Weekly-planning Steps 4 & 5 (Chat 058) — the Sunday session.
// ---------------------------------------------------------------------------
//
// PRD §3.3 Step 4 (module adjustments) and Step 5 (plan generation + review). These
// lines are the butler's framing for the two closing steps of the Sunday session and
// are consumed by BOTH the web and mobile surfaces from the SAME client-safe
// `@vesper/shared/copy` subpath (never the bare @vesper/shared barrel, which pulls
// @vesper/db -> postgres into a client bundle).
//
// VOICE GATE (Chat 058 determination, unchanged from Chat 056/057): NOT gated. The
// live gate (packages/ai voiceGate.ts / gatePlanStrings) is a runtime call over
// GENERATED block.title + block.note only; static UI copy has no gate call to route
// through, and 057's weekly-planning lines were likewise hand-authored to the gate's
// rules, not routed through it. These lines are authored to the gate's Tier-A/Tier-B
// rules by hand and asserted against them in copy.test.ts. NO SCOREKEEPING: they set
// up the week's shape and ask for adjustments; they never count, rank, or praise.

// --- Step 4: module adjustments ---------------------------------------------

/** The step-4 heading: the butler invites one-off changes for the coming week. */
export const WEEK_ADJUST_HEADING = 'Adjustments for the week';

/** The step-4 intro: states these changes apply to this week only. */
export const WEEK_ADJUST_INTRO =
  'Note anything one-off for the coming week. These hold for this week alone and leave your usual setup untouched.';

/** Label for pausing a module on chosen days (travel days, etc.). */
export const WEEK_ADJUST_PAUSE_MODULE_LABEL = 'Pause a module on chosen days';

/** Label for flagging a recovery day where no workout is scheduled. */
export const WEEK_ADJUST_RECOVERY_LABEL = 'Recovery day, no workout';

/** Label for noting a fixed personal event on a day (a dinner out, etc.). */
export const WEEK_ADJUST_FIXED_NOTE_LABEL = 'Note a fixed plan';

/** The step-4 continue action: advances to plan generation and review. */
export const WEEK_ADJUST_CONTINUE_LABEL = 'Build the week';

/** Stable id for the step-4 copy group (Chat 044 consolidation). */
export const WEEK_ADJUST_COPY_ID = 'weekly_planning.module_adjustments' as const;

// --- Step 5: plan generation and review -------------------------------------

/** The step-5 heading over the seven-day review grid. */
export const WEEK_REVIEW_HEADING = 'The week ahead';

/** The step-5 intro: the week is drafted; the user reviews and adjusts. */
export const WEEK_REVIEW_INTRO =
  'Here is the week as I would set it. Review each day, adjust any block, and accept when it reads right.';

/** Shown while the seven-day synthesis is running. */
export const WEEK_REVIEW_GENERATING_LINE = 'Drafting the seven days.';

/** Shown when synthesis fell back to the safe template rather than a fresh draft. */
export const WEEK_REVIEW_FALLBACK_LINE =
  'Working from your usual routine this week. Adjust anything that does not fit.';

/** The accept action: batch-writes the week and returns to the day view. */
export const WEEK_REVIEW_ACCEPT_LABEL = 'Accept the week';

/** Per-block adjust action within a day. */
export const WEEK_REVIEW_ADJUST_BLOCK_LABEL = 'Adjust';

/** The closing line once the week is accepted and loaded (advances to the day view). */
export const WEEK_REVIEW_ACCEPTED_LINE = 'The week is set. I will take it from here.';

/** Stable id for the step-5 copy group (Chat 044 consolidation). */
export const WEEK_REVIEW_COPY_ID = 'weekly_planning.plan_review' as const;

/**
 * One day's label in the review grid: its weekday name and date.
 *
 * Rendered example: `weekDayLabel('Monday', 'Aug 24')` -> `"Monday, Aug 24"`
 */
export function weekDayLabel(weekday: string, date: string): string {
  return `${weekday}, ${date}`;
}
