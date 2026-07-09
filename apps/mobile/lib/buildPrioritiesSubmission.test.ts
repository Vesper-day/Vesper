// @vitest-environment node
//
// Unit tests for the mobile priority-submission builder (Chat 057). Pure — NO DOM, NO
// @testing-library, NO react-native import, NO network. Mirrors the web helper test:
// the 3–5 length invariant, the { text, source } PUT item shape (no completedAt), and
// the ai_suggested → user source flip on edit.
import { describe, it, expect } from 'vitest';
import {
  buildPrioritiesSubmission,
  editRowText,
  PriorityCountError,
  type PriorityRow,
} from './buildPrioritiesSubmission';

function rows(n: number): PriorityRow[] {
  return Array.from({ length: n }, (_, i) => ({
    text: `Priority ${i + 1}`,
    source: i % 2 === 0 ? ('user' as const) : ('ai_suggested' as const),
  }));
}

describe('buildPrioritiesSubmission', () => {
  it('rejects 2 rows and 6 rows (outside 3..5)', () => {
    expect(() => buildPrioritiesSubmission(rows(2))).toThrow(PriorityCountError);
    expect(() => buildPrioritiesSubmission(rows(6))).toThrow(PriorityCountError);
  });

  it('accepts 3, 4, and 5 rows', () => {
    expect(buildPrioritiesSubmission(rows(3))).toHaveLength(3);
    expect(buildPrioritiesSubmission(rows(4))).toHaveLength(4);
    expect(buildPrioritiesSubmission(rows(5))).toHaveLength(5);
  });

  it('drops blank/whitespace rows before counting, then re-checks the range', () => {
    const withBlanks: PriorityRow[] = [
      { text: 'a', source: 'user' },
      { text: '   ', source: 'user' },
      { text: 'b', source: 'ai_suggested' },
      { text: '', source: 'ai_suggested' },
    ];
    expect(() => buildPrioritiesSubmission(withBlanks)).toThrow(PriorityCountError);
  });

  it('emits ONLY { text, source } per item — never completedAt', () => {
    const out = buildPrioritiesSubmission(rows(3));
    for (const item of out) {
      expect(Object.keys(item).sort()).toEqual(['source', 'text']);
      expect(item).not.toHaveProperty('completedAt');
      expect(item).not.toHaveProperty('completed_at');
    }
  });

  it('trims text in the emitted items', () => {
    const out = buildPrioritiesSubmission([
      { text: '  spaced  ', source: 'user' },
      { text: 'b', source: 'user' },
      { text: 'c', source: 'user' },
    ]);
    expect(out[0]!.text).toBe('spaced');
  });
});

describe('editRowText (source flip on edit)', () => {
  it('flips ai_suggested → user when the text actually changes', () => {
    const row: PriorityRow = { text: 'Ship the beta', source: 'ai_suggested' };
    const edited = editRowText(row, 'Ship the beta by Friday');
    expect(edited).toEqual({ text: 'Ship the beta by Friday', source: 'user' });
  });

  it('keeps ai_suggested when the text is unchanged', () => {
    const row: PriorityRow = { text: 'Ship the beta', source: 'ai_suggested' };
    expect(editRowText(row, 'Ship the beta')).toEqual(row);
  });

  it('keeps user rows as user', () => {
    const row: PriorityRow = { text: 'Call the bank', source: 'user' };
    expect(editRowText(row, 'Call the credit union')).toEqual({
      text: 'Call the credit union',
      source: 'user',
    });
  });
});
