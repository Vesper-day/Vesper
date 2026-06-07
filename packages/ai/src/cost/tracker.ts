import { MODELS, type Model } from '../client';

// Per-million USD rates (TECHNICAL_SPEC.md §5). Per-token rate = perMillion / 1_000_000.
//   Sonnet (claude-sonnet-4-6): input $3/M, output $15/M, cache-read $0.30/M (0.1x input)
//   Haiku  (claude-haiku-4-5):  input $1/M, output $5/M,  cache-read $0.10/M (0.1x input)
const RATES: Record<Model, { input: number; output: number; cacheRead: number }> = {
  [MODELS.SONNET]: {
    input: 3 / 1_000_000,
    output: 15 / 1_000_000,
    cacheRead: 0.3 / 1_000_000,
  },
  [MODELS.HAIKU]: {
    input: 1 / 1_000_000,
    output: 5 / 1_000_000,
    cacheRead: 0.1 / 1_000_000,
  },
};

export type CostBreakdown = {
  model: Model;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cost_usd: number;
};

/**
 * Compute and record the cost of a single AI call.
 *
 * cost_usd = inputTokens*inputRate + outputTokens*outputRate + cachedTokens*cacheReadRate
 *
 * `cachedTokens` is treated as cache-READ tokens.
 * TODO: cache-WRITE tokens (Anthropic bills these at 1.25x the input rate) are NOT
 *       distinguished by this signature and are not separately tracked this chat.
 *
 * Sanity check (TECHNICAL_SPEC.md §5): Sonnet 500 input + 7500 cache-read + 2000 output
 *   = 500*3e-6 + 2000*15e-6 + 7500*0.30e-6 = $0.03375 ≈ §5's ~$0.034.
 *
 * TODO: durable per-call cost logging to completion_log is BLOCKED. completion_log.event_type
 *       is completion_event_enum NOT NULL (TECHNICAL_SPEC.md §18) and 'ai_call' is NOT a member
 *       of that enum, so the INSERT cannot be made. Do NOT INSERT until a future migration adds
 *       'ai_call' to completion_event_enum. For now this only emits a structured console line.
 */
export function trackCost(
  model: Model,
  inputTokens: number,
  outputTokens: number,
  cachedTokens?: number,
): CostBreakdown {
  const rate = RATES[model];
  const cached = cachedTokens ?? 0;

  const cost_usd =
    inputTokens * rate.input + outputTokens * rate.output + cached * rate.cacheRead;

  const breakdown: CostBreakdown = {
    model,
    inputTokens,
    outputTokens,
    cachedTokens: cached,
    cost_usd,
  };

  // Single structured log line (no-console is disabled for this package).
  console.log(JSON.stringify({ event: 'ai_cost', ...breakdown }));

  return breakdown;
}

/**
 * Best-effort extraction of Anthropic cache-READ token count from the AI SDK's
 * providerMetadata. Returns 0 when the field is absent. Typed against `unknown`
 * so it tolerates SDK shape drift without an `any`.
 */
export function extractCachedTokens(providerMetadata: unknown): number {
  if (
    providerMetadata &&
    typeof providerMetadata === 'object' &&
    'anthropic' in providerMetadata
  ) {
    const anthropic = (providerMetadata as { anthropic?: unknown }).anthropic;
    if (
      anthropic &&
      typeof anthropic === 'object' &&
      'cacheReadInputTokens' in anthropic
    ) {
      const value = (anthropic as { cacheReadInputTokens?: unknown })
        .cacheReadInputTokens;
      if (typeof value === 'number') return value;
    }
  }
  return 0;
}
