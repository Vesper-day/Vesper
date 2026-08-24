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
  WEEK_ADJUST_HEADING,
  WEEK_ADJUST_INTRO,
  WEEK_ADJUST_PAUSE_MODULE_LABEL,
  WEEK_ADJUST_RECOVERY_LABEL,
  WEEK_ADJUST_FIXED_NOTE_LABEL,
  WEEK_ADJUST_CONTINUE_LABEL,
  WEEK_ADJUST_COPY_ID,
  WEEK_REVIEW_HEADING,
  WEEK_REVIEW_INTRO,
  WEEK_REVIEW_GENERATING_LINE,
  WEEK_REVIEW_FALLBACK_LINE,
  WEEK_REVIEW_ACCEPT_LABEL,
  WEEK_REVIEW_ADJUST_BLOCK_LABEL,
  WEEK_REVIEW_ACCEPTED_LINE,
  WEEK_REVIEW_COPY_ID,
  weekDayLabel,
  NUTRITION_HEADING,
  NUTRITION_INTRO,
  NUTRITION_MODULE_OFF_LINE,
  NUTRITION_FOOD_LOG_HEADING,
  NUTRITION_FOOD_LOG_EMPTY,
  NUTRITION_FOOD_LOG_ADD_LABEL,
  NUTRITION_FOOD_LOG_ITEM_PLACEHOLDER,
  NUTRITION_FOOD_LOG_QUANTITY_PLACEHOLDER,
  NUTRITION_SEARCH_HEADING,
  NUTRITION_SEARCH_HELP,
  NUTRITION_SEARCH_PLACEHOLDER,
  NUTRITION_SEARCH_EMPTY,
  NUTRITION_MODIFY_HEADING,
  NUTRITION_MODIFY_HELP,
  NUTRITION_MODIFY_RECIPE_PLACEHOLDER,
  NUTRITION_MODIFY_REQUEST_PLACEHOLDER,
  NUTRITION_MODIFY_SUBMIT_LABEL,
  NUTRITION_DEFERRED_SLOT_LINE,
  NUTRITION_COPY_ID,
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

describe('weekly-planning Steps 4 & 5 copy (Chat 058)', () => {
  const ALL_LINES = [
    WEEK_ADJUST_HEADING,
    WEEK_ADJUST_INTRO,
    WEEK_ADJUST_PAUSE_MODULE_LABEL,
    WEEK_ADJUST_RECOVERY_LABEL,
    WEEK_ADJUST_FIXED_NOTE_LABEL,
    WEEK_ADJUST_CONTINUE_LABEL,
    WEEK_REVIEW_HEADING,
    WEEK_REVIEW_INTRO,
    WEEK_REVIEW_GENERATING_LINE,
    WEEK_REVIEW_FALLBACK_LINE,
    WEEK_REVIEW_ACCEPT_LABEL,
    WEEK_REVIEW_ADJUST_BLOCK_LABEL,
    WEEK_REVIEW_ACCEPTED_LINE,
    weekDayLabel('Monday', 'Aug 24'),
  ];

  it('states that the step-4 adjustments apply to this week only', () => {
    expect(WEEK_ADJUST_INTRO).toMatch(/this week alone/i);
  });

  it('renders a day label as "<weekday>, <date>"', () => {
    expect(weekDayLabel('Monday', 'Aug 24')).toBe('Monday, Aug 24');
    expect(weekDayLabel('Sunday', 'Aug 30')).toBe('Sunday, Aug 30');
  });

  // Static UI copy is not gated (Chat 058 determination); assert the gate's own
  // Tier-A auto-rewrite rules by hand instead. Patterns mirror voiceGate.regex.ts.
  it('satisfies the Tier A auto-rewrite rules the gate would otherwise apply', () => {
    for (const line of ALL_LINES) {
      expect(line).not.toMatch(/—/); // em-dash
      expect(line).not.toMatch(/!/); // exclamation point
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u); // emoji
      expect(line).not.toMatch(/\bAI\b/i);
      expect(line).not.toMatch(/\bartificial intelligence\b/i);
      expect(line).not.toMatch(/\bmachine learning\b/i);
      expect(line).not.toMatch(/\bgenerated\b/i);
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
    const scorekeeping = /\b(streak|score|progress|productivity|completed \d|goal|target|record|badge|points)\b/i;
    for (const line of ALL_LINES) {
      expect(line).not.toMatch(scorekeeping);
    }
  });

  it('exposes stable copy ids for later consolidation (Chat 044)', () => {
    expect(WEEK_ADJUST_COPY_ID).toBe('weekly_planning.module_adjustments');
    expect(WEEK_REVIEW_COPY_ID).toBe('weekly_planning.plan_review');
  });
});

describe('nutrition module copy (Chat ADD-B)', () => {
  const ALL_LINES = [
    NUTRITION_HEADING,
    NUTRITION_INTRO,
    NUTRITION_MODULE_OFF_LINE,
    NUTRITION_FOOD_LOG_HEADING,
    NUTRITION_FOOD_LOG_EMPTY,
    NUTRITION_FOOD_LOG_ADD_LABEL,
    NUTRITION_FOOD_LOG_ITEM_PLACEHOLDER,
    NUTRITION_FOOD_LOG_QUANTITY_PLACEHOLDER,
    NUTRITION_SEARCH_HEADING,
    NUTRITION_SEARCH_HELP,
    NUTRITION_SEARCH_PLACEHOLDER,
    NUTRITION_SEARCH_EMPTY,
    NUTRITION_MODIFY_HEADING,
    NUTRITION_MODIFY_HELP,
    NUTRITION_MODIFY_RECIPE_PLACEHOLDER,
    NUTRITION_MODIFY_REQUEST_PLACEHOLDER,
    NUTRITION_MODIFY_SUBMIT_LABEL,
    NUTRITION_DEFERRED_SLOT_LINE,
  ];

  it('names the deferred deep-engine surfaces without implying they are present', () => {
    // PRD §6.3: micronutrient / RDA / calorie internals are DEFERRED; the copy states
    // they are not in this view yet.
    expect(NUTRITION_DEFERRED_SLOT_LINE).toMatch(/not part of this view yet/i);
  });

  // Static UI copy is not gated (ADD-B determination, per Chat 056/057/058); assert the
  // gate's own Tier-A auto-rewrite rules by hand instead. Patterns mirror voiceGate.regex.ts.
  it('satisfies the Tier A auto-rewrite rules the gate would otherwise apply', () => {
    for (const line of ALL_LINES) {
      expect(line).not.toMatch(/—/); // em-dash
      expect(line).not.toMatch(/!/); // exclamation point
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u); // emoji
      expect(line).not.toMatch(/\bAI\b/i);
      expect(line).not.toMatch(/\bartificial intelligence\b/i);
      expect(line).not.toMatch(/\bmachine learning\b/i);
      expect(line).not.toMatch(/\bgenerated\b/i);
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
    const scorekeeping =
      /\b(streak|score|progress|productivity|completed \d|goal|target|record|badge|points)\b/i;
    for (const line of ALL_LINES) {
      expect(line).not.toMatch(scorekeeping);
    }
  });

  it('exposes a stable copy id for later consolidation (Chat 044)', () => {
    expect(NUTRITION_COPY_ID).toBe('nutrition.module_page');
  });
});
