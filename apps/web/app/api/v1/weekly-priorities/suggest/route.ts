// POST /api/v1/weekly-priorities/suggest (Chat 057 — DECISION B).
//
// Thin authenticated seam over @vesper/ai suggestWeeklyPriorities so BOTH surfaces
// (web + mobile) get an AI pre-suggestion for the priority-entry step without mobile
// ever importing @vesper/ai (server-only). Returns a plain 200 { suggestions } →
// createRoute (auth + version-gate + §9 error mapping). Stateless: no DB touch.
//
// Core logic lives in the sibling ./operations module (a route.ts may export only
// HTTP-method handlers + segment config).
import { createRoute } from '@vesper/shared';
import { runSuggest } from './operations';
import type { SuggestResponse } from './schemas';

export const POST = createRoute<SuggestResponse>(async ({ request }) => {
  const raw: unknown = await request.json().catch(() => null);
  return runSuggest(raw);
});
