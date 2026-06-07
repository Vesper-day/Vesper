// Butler voice gate — regex layer (PRD §5.1 / §5.4).
//
// This is the SYNCHRONOUS first layer of the voice gate and the FLOOR of voice
// safety: it always runs, including during Anthropic outages when the Haiku review
// layer is skipped. It does two things:
//
//   TIER A — replace/strip. The ONLY transforms the gate applies automatically
//            (PRD §5.1): em-dashes, exclamation points, emoji, and bare AI /
//            "artificial intelligence" / "machine learning" tokens.
//   TIER B — detect/flag. The PRD §5.4 "Never Says" list, transcribed verbatim as
//            word-bounded, case-insensitive detection patterns. Tier B is NEVER
//            auto-rewritten; a match routes the string to the Haiku review layer
//            (if in scope) or causes voiceGate to throw (if out of scope).

export type RegexRule = {
  name: string;
  pattern: RegExp;
  /** Present only for TIER A rules (the auto-rewrite tier). */
  replacement?: string;
};

/**
 * TIER A — replace/strip. Applied in order. After all replacements the caller
 * collapses runs of whitespace and trims, which is the "normalize whitespace"
 * step the AI-token removals depend on.
 */
export const TIER_A: RegexRule[] = [
  { name: 'em-dash', pattern: /—/g, replacement: '. ' },
  { name: 'exclamation-point', pattern: /!/g, replacement: '.' },
  { name: 'emoji', pattern: /\p{Extended_Pictographic}/gu, replacement: '' },
  // Word-bounded so "available", "maintain", "claim", "detail" do NOT match.
  { name: 'ai-word', pattern: /\bAI\b/gi, replacement: '' },
  { name: 'artificial-intelligence', pattern: /\bartificial intelligence\b/gi, replacement: '' },
  { name: 'machine-learning', pattern: /\bmachine learning\b/gi, replacement: '' },
];

/**
 * TIER B — detect/flag. PRD §5.4 "Never Says" list, verbatim. Every pattern is
 * \b-bounded and case-insensitive so substrings do not false-match (e.g. "level"
 * must not match inside "available"/"travel"; the tier-A ai-word rule already
 * guards "available" against the AI rule).
 */
export const TIER_B: RegexRule[] = [
  { name: 'thank-you', pattern: /\bthank you\b/i },
  { name: 'thanks', pattern: /\bthanks\b/i },
  { name: 'appreciate', pattern: /\bappreciate\b/i },
  { name: 'grateful', pattern: /\bgrateful\b/i },
  { name: 'excited', pattern: /\bexcited\b/i },
  { name: 'amazing', pattern: /\bamazing\b/i },
  { name: 'awesome', pattern: /\bawesome\b/i },
  { name: 'great', pattern: /\bgreat\b/i },
  { name: 'fantastic', pattern: /\bfantastic\b/i },
  { name: 'incredible', pattern: /\bincredible\b/i },
  { name: 'love-it', pattern: /\blove it\b/i },
  { name: 'crush-it', pattern: /\bcrush it\b/i },
  { name: 'smash-it', pattern: /\bsmash it\b/i },
  { name: 'you-got-this', pattern: /\byou got this\b/i },
  { name: 'lets-go', pattern: /\blet's go\b/i },
  { name: 'keep-it-up', pattern: /\bkeep it up\b/i },
  { name: 'well-done', pattern: /\bwell done\b/i },
  { name: 'boss', pattern: /\bboss\b/i },
  { name: 'champ', pattern: /\bchamp\b/i },
  { name: 'rockstar', pattern: /\brockstar\b/i },
  { name: 'buddy', pattern: /\bbuddy\b/i },
  { name: 'pal', pattern: /\bpal\b/i },
  { name: 'streak', pattern: /\bstreak\b/i },
  { name: 'badge', pattern: /\bbadge\b/i },
  { name: 'level', pattern: /\blevel\b/i },
  { name: 'points', pattern: /\bpoints\b/i },
  { name: 'achievement', pattern: /\bachievement\b/i },
  { name: 'milestone', pattern: /\bmilestone\b/i },
  { name: 'limited-time', pattern: /\blimited time\b/i },
  { name: 'act-now', pattern: /\bact now\b/i },
  { name: 'dont-miss-out', pattern: /\bdon't miss out\b/i },
  { name: 'only-n-left', pattern: /\bonly \d+ left\b/i },
  { name: 'powered-by', pattern: /\bpowered by\b/i },
  { name: 'generated', pattern: /\bgenerated\b/i },
  { name: 'algorithm', pattern: /\balgorithm\b/i },
  { name: 'model', pattern: /\bmodel\b/i },
  { name: 'absolutely', pattern: /\babsolutely\b/i },
  { name: 'certainly', pattern: /\bcertainly\b/i },
  { name: 'of-course', pattern: /\bof course\b/i },
  { name: 'sure-thing', pattern: /\bsure thing\b/i },
  { name: 'great-question', pattern: /\bgreat question\b/i },
  { name: 'happy-to-help', pattern: /\bhappy to help\b/i },
  { name: 'id-be-happy-to', pattern: /\bi'd be happy to\b/i },
  { name: 'no-problem', pattern: /\bno problem\b/i },
  { name: 'no-worries', pattern: /\bno worries\b/i },
];

/** Result of the regex layer: the auto-rewritten text plus any tier-B flags. */
export type RegexLayerResult = {
  /** Text after TIER A replacement, whitespace-collapsed and trimmed. */
  cleaned: string;
  /** Names of TIER B rules that matched `cleaned`. Empty when none. */
  flags: string[];
};

/**
 * Run the regex layer: apply TIER A replacements in order, normalize whitespace,
 * then detect TIER B prohibited words/phrases in the result. Pure and synchronous.
 */
export function applyRegexLayer(text: string): RegexLayerResult {
  let cleaned = text;
  for (const rule of TIER_A) {
    cleaned = cleaned.replace(rule.pattern, rule.replacement ?? '');
  }
  // Normalize whitespace introduced by the removals/replacements.
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  const flags: string[] = [];
  for (const rule of TIER_B) {
    if (rule.pattern.test(cleaned)) flags.push(rule.name);
  }

  return { cleaned, flags };
}
