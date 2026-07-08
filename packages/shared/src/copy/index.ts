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
