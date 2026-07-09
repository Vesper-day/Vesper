// Pure priority-submission builder for the web weekly-planning surface (Chat 057).
//
// The Sunday session collects 3–5 priority rows (some pre-filled by the AI
// suggestion, overwritable). Before the PUT /weekly-priorities call the rows are
// normalised into the §9 request item shape ({ text, source } ONLY — no
// completedAt; the server persists completed_at: null) and the 3–5 length invariant
// is enforced client-side for instant feedback (the route enforces it too).
//
// DUPLICATED per surface (mobile has its own copy) — 040 duplicate-vs-share
// precedent: a tiny pure helper is copied rather than exported from @vesper/shared,
// so a 'use client' file never risks pulling the shared barrel's server code.
//
// No DOM, no network, no @vesper/shared import — unit-tested in isolation.

/** Priority provenance (§3 #6). 'ai_suggested' rows flip to 'user' once edited. */
export type PrioritySource = 'user' | 'ai_suggested';

/** A single editable row in the priority-entry step. */
export interface PriorityRow {
  text: string;
  source: PrioritySource;
}

/** The §9 PUT request item shape — text + source only. */
export interface PrioritySubmissionItem {
  text: string;
  source: PrioritySource;
}

/** Thrown when the trimmed, non-empty row count is outside the 3–5 range. */
export class PriorityCountError extends Error {
  constructor(count: number) {
    super(`Weekly priorities must have between 3 and 5 entries (got ${count}).`);
    this.name = 'PriorityCountError';
  }
}

/**
 * Apply an edit to a row's text. A pre-filled AI suggestion becomes the user's own
 * once its text actually changes — source flips 'ai_suggested' → 'user'. A 'user'
 * row stays 'user'; an unchanged 'ai_suggested' row keeps its provenance.
 */
export function editRowText(row: PriorityRow, nextText: string): PriorityRow {
  const flipped = row.source === 'ai_suggested' && nextText !== row.text;
  return { text: nextText, source: flipped ? 'user' : row.source };
}

/**
 * Normalise the entry rows into the PUT priorities array. Trims each text, drops
 * empties, enforces 3 ≤ length ≤ 5 (throws {@link PriorityCountError} otherwise),
 * and emits ONLY { text, source } per item (completedAt is never sent).
 */
export function buildPrioritiesSubmission(
  rows: readonly PriorityRow[],
): PrioritySubmissionItem[] {
  const cleaned = rows
    .map((r) => ({ text: r.text.trim(), source: r.source }))
    .filter((r) => r.text.length > 0);

  if (cleaned.length < 3 || cleaned.length > 5) {
    throw new PriorityCountError(cleaned.length);
  }

  return cleaned.map((r) => ({ text: r.text, source: r.source }));
}
