// Pure priority-submission builder for the mobile weekly-planning surface (Chat 057).
//
// Mobile twin of apps/web/lib/weekly-planning/buildPrioritiesSubmission.ts. The
// Sunday session collects 3–5 priority rows (some AI-pre-filled, overwritable); this
// normalises them into the §9 PUT item shape ({ text, source } ONLY — no completedAt)
// and enforces the 3–5 length invariant client-side for instant feedback.
//
// DUPLICATED per surface (040 duplicate-vs-share precedent) rather than exported from
// @vesper/shared: the bare @vesper/shared barrel transitively pulls server-only code
// (db → postgres) that must never reach the mobile bundle. No react-native import, so
// this is safe to unit-test under the node vitest env without an RN mock.

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
