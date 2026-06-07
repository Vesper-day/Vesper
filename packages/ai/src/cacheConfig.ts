// Cache-TTL strategy per call-type.
//
// TECHNICAL_SPEC.md §5: BOTH Sonnet daily-plan synthesis AND all Haiku operations
// use the Anthropic default 5-minute ephemeral cache (cache_control: { type: 'ephemeral' }).
// The 1-hour TTL ('ephemeral' with extended TTL) is rejected. Every call-type therefore
// resolves to the same 5-minute ephemeral default; the map exists so future per-call-type
// divergence has a single place to live.
//
// Note: src/gate.ts applies the ephemeral cache inline for the voice gate. This module
// centralizes the same default for the new SDK wrappers only and does not change gate.ts.

export type CallType =
  | 'daily-plan'
  | 'weekly-review'
  | 'template-selection'
  | 'nl-command'
  | 'calendar-classify'
  | 'checkin-question'
  | 'empathy-regeneration'
  | 'voice-gate'
  | 'freeform';

/** Anthropic cache_control object. 5-minute ephemeral is the Anthropic default TTL. */
export type CacheControl = { type: 'ephemeral' };

/** The 5-minute ephemeral default (TECHNICAL_SPEC.md §5). */
const EPHEMERAL: CacheControl = { type: 'ephemeral' };

/**
 * Per-call-type cache strategy. Every entry resolves to the 5-minute ephemeral
 * default per TECHNICAL_SPEC.md §5 (the 1-hour TTL is rejected).
 */
const CACHE_STRATEGY: Record<CallType, CacheControl> = {
  'daily-plan': EPHEMERAL,
  'weekly-review': EPHEMERAL,
  'template-selection': EPHEMERAL,
  'nl-command': EPHEMERAL,
  'calendar-classify': EPHEMERAL,
  'checkin-question': EPHEMERAL,
  'empathy-regeneration': EPHEMERAL,
  'voice-gate': EPHEMERAL,
  freeform: EPHEMERAL,
};

/** Returns the cache_control object for a given call-type. */
export function getCacheControl(callType: CallType): CacheControl {
  return CACHE_STRATEGY[callType];
}

/**
 * Returns the providerOptions.anthropic block the AI SDK wrappers spread into
 * their call options, e.g. `providerOptions: getProviderOptions('daily-plan')`.
 */
export function getProviderOptions(callType: CallType): {
  anthropic: { cacheControl: CacheControl };
} {
  return { anthropic: { cacheControl: getCacheControl(callType) } };
}
