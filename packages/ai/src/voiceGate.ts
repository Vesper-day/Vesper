// Butler voice gate (PRD §5, build plan Chat 017).
//
// Two layers:
//   1. Regex layer (voiceGate.regex.ts) — SYNCHRONOUS, always runs. It auto-rewrites
//      the four mechanical violations (em-dash, "!", emoji, bare AI tokens) and flags
//      the PRD §5.4 "Never Says" words. This layer is the FLOOR of voice safety: during
//      an Anthropic outage the Haiku layer is skipped and the regex output is returned
//      as-is. We never hard-fail user-visible copy just because the model is unreachable.
//   2. Haiku review layer — ASYNCHRONOUS, runs only when the text is "in scope"
//      (> 30 whitespace-delimited tokens) AND the per-source sampler selects it.
//
// DEGRADED MODE: the Chat 022 circuit breaker does NOT exist yet, so this file imports
// NOTHING from a breaker module. Instead it accepts an injected predicate
// (options.isAnthropicCircuitOpen, default () => false). When it returns true the Haiku
// layer is skipped entirely (even for freeform) and we fall through to regex-only mode.
// Chat 022 will wire this probe to the real breaker.

import { generateObject as aiGenerateObject } from 'ai';
import { z } from 'zod';
import { anthropicProvider, MODELS } from './client';
import { getProviderOptions } from './cacheConfig';
import { VOICE_GATE_REVIEW_PROMPT } from './prompts/voiceGateReview';
import { applyRegexLayer } from './voiceGate.regex';

export type VoiceSource = 'freeform' | 'constrained';

export type VoiceGateOptions = {
  /** Reserved: AI self-reference is never allowed, so this is pinned to false. */
  allowAi?: false;
  /**
   * 'freeform'  — Haiku review runs on EVERY in-scope string.
   * 'constrained' — Haiku review runs on a sampled fraction of in-scope strings.
   * Defaults to 'freeform' (max coverage) when omitted, so a caller who forgets
   * gets the safer behavior.
   */
  source?: VoiceSource;
  /** Injectable RNG for deterministic sampling tests. Defaults to Math.random. */
  rng?: () => number;
  /** Degraded-mode probe (Chat 022 seam). Defaults to () => false. */
  isAnthropicCircuitOpen?: () => boolean;
};

/**
 * Haiku-review sampling rate per source. Single source of truth so the policy is
 * configurable in one place. A string is sent to review when rng() < the source's rate.
 */
export const SAMPLE_RATES: Record<VoiceSource, number> = {
  freeform: 1.0,
  constrained: 0.2,
};

const ReviewResultSchema = z.object({
  compliant: z.boolean(),
  revision: z.string().optional(),
  issues: z.array(z.string()).optional(),
});

export type ReviewResult = z.infer<typeof ReviewResultSchema>;

/**
 * The real Haiku review call. Indirected through the exported `reviewer` object so
 * tests can spy on / stub it (vi.spyOn(reviewer, 'run')) without mocking the network,
 * while the live integration test uses the real implementation.
 */
async function defaultHaikuReview(text: string): Promise<ReviewResult> {
  const { object } = await aiGenerateObject({
    model: anthropicProvider(MODELS.HAIKU),
    schema: ReviewResultSchema,
    system: VOICE_GATE_REVIEW_PROMPT,
    prompt: text,
    providerOptions: getProviderOptions('voice-gate'),
  });
  return object;
}

/** Review indirection. Reassign `reviewer.run` in tests; production uses the default. */
export const reviewer: { run: (text: string) => Promise<ReviewResult> } = {
  run: defaultHaikuReview,
};

function wordCount(s: string): number {
  const trimmed = s.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Run the butler voice gate over a string of AI-produced text.
 *
 * @returns the regex-cleaned text when it passes review (or is out of scope, sampled
 *   out, or running degraded), or the Haiku revision when review returns
 *   compliant:false with a usable revision.
 * @throws when a tier-B "Never Says" phrase is present but the string is out of scope
 *   (no review budget to repair it), or when review returns compliant:false with no
 *   usable revision.
 */
export async function voiceGate(text: string, options: VoiceGateOptions = {}): Promise<string> {
  const {
    source = 'freeform',
    rng = Math.random,
    isAnthropicCircuitOpen = () => false,
  } = options;

  const { cleaned, flags } = applyRegexLayer(text);
  const inScope = wordCount(cleaned) > 30;

  // Degraded mode: regex layer is the floor. Skip Haiku, return cleaned text as-is.
  if (isAnthropicCircuitOpen()) return cleaned;

  if (!inScope) {
    // No review budget for short strings. A tier-B phrase here cannot be repaired,
    // so surface it rather than ship prohibited copy.
    if (flags.length > 0) {
      throw new Error(`voiceGate: prohibited phrase in out-of-scope text: ${flags.join(', ')}`);
    }
    return cleaned;
  }

  // In scope: sample per source.
  if (rng() >= SAMPLE_RATES[source]) return cleaned;

  const result = await reviewer.run(cleaned);
  if (result.compliant) return cleaned;
  if (result.revision && result.revision.trim() !== '') return result.revision;

  throw new Error(
    `voiceGate: review failed with no usable revision: ${(result.issues ?? []).join(', ')}`,
  );
}
