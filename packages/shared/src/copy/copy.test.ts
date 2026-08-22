// Pure unit test for the authored butler-line copy library (copy/index.ts).
// No env, no DB, no react-native — a plain string/template assertion.
import { describe, it, expect } from 'vitest';
import {
  billDueTomorrow,
  BILL_DUE_TOMORROW_COPY_ID,
  overCommitItemLine,
  OVER_COMMIT_COPY_ID,
  OVER_COMMIT_CONFIRM_LABEL,
  OVER_COMMIT_DEFER_LABEL,
  OVER_COMMIT_ITEMS_HEADING,
  OVER_COMMIT_KEEP_LABEL,
  OVER_COMMIT_PROMPT_LINE,
} from './index';

describe('billDueTomorrow', () => {
  it('renders "<name> is due tomorrow." with the bill name in the template slot', () => {
    expect(billDueTomorrow('Rent')).toBe('Rent is due tomorrow.');
    expect(billDueTomorrow('Car insurance')).toBe('Car insurance is due tomorrow.');
  });

  it('exposes a stable copy id for later consolidation (Chat 044/075)', () => {
    expect(BILL_DUE_TOMORROW_COPY_ID).toBe('finance.bill_due_tomorrow');
  });
});

describe('over-commit prompt copy (Chat 056)', () => {
  const ALL_LINES = [
    OVER_COMMIT_PROMPT_LINE,
    OVER_COMMIT_ITEMS_HEADING,
    OVER_COMMIT_KEEP_LABEL,
    OVER_COMMIT_DEFER_LABEL,
    OVER_COMMIT_CONFIRM_LABEL,
    overCommitItemLine('Draft the proposal', 45),
  ];

  it('asks for ONE choice and never cascades per item', () => {
    expect(OVER_COMMIT_PROMPT_LINE).toBe(
      'I cannot fit everything into what remains of today. Choose which items move to tomorrow.',
    );
    // A single confirm action settles every item at once.
    expect(OVER_COMMIT_CONFIRM_LABEL).toBe('Settle the day');
  });

  it('renders an item line as "<title>, <minutes> min"', () => {
    expect(overCommitItemLine('Draft the proposal', 45)).toBe('Draft the proposal, 45 min');
    expect(overCommitItemLine('Review the deck', 90)).toBe('Review the deck, 90 min');
  });

  // The voice gate does not cover static UI copy (Chat 056 determination), so the
  // gate's own rules are asserted here instead. Patterns mirror voiceGate.regex.ts.
  it('satisfies the Tier A auto-rewrite rules the gate would otherwise apply', () => {
    for (const line of ALL_LINES) {
      expect(line).not.toMatch(/—/); // em-dash
      expect(line).not.toMatch(/!/); // exclamation point
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u); // emoji
      expect(line).not.toMatch(/\bAI\b/i);
      expect(line).not.toMatch(/\bartificial intelligence\b/i);
      expect(line).not.toMatch(/\bmachine learning\b/i);
    }
  });

  it('uses none of the PRD §5.4 "Never Says" words', () => {
    const neverSays =
      /\b(thank you|thanks|appreciate|grateful|excited|amazing|awesome|great|fantastic|incredible|love it|crush it|smash it|you got this|let's go|keep it up|well done)\b/i;
    for (const line of ALL_LINES) {
      expect(line).not.toMatch(neverSays);
    }
  });

  it('carries no scorekeeping, streak, or progress framing', () => {
    const scorekeeping = /\b(streak|score|progress|productivity|completed \d|goal|target|record)\b/i;
    for (const line of ALL_LINES) {
      expect(line).not.toMatch(scorekeeping);
    }
  });

  it('exposes a stable copy id for later consolidation (Chat 044)', () => {
    expect(OVER_COMMIT_COPY_ID).toBe('tasks.over_commit_prompt');
  });
});
