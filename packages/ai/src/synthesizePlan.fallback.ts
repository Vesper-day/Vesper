// Three-step fallback chain for daily-plan synthesis (Chat 022, §5 + LOCKED 1/2/5).
//
// Order (LOCKED Decision 1, §5 wins):
//   initial  full context, NO delay            -> fallback_step omitted on success
//   Step 1   full context, identical, 1.5s     -> fallback_step 1 on success
//   Step 2   simplified context, 3s            -> fallback_step 2 on success
//   Step 3   serve hardcoded fallback plan     -> fallback_step 3
//
// Per-user circuit breaker (LOCKED Decision 2): if it is OPEN we make NO
// Anthropic call and go straight to Step 3 with error_code 'breaker_open'.
//
// Each Anthropic attempt is streamObject + a 15s AbortController linked to the
// caller's external signal. Partials are yielded as they arrive; success is
// `await result.object` validating against DailyPlanSchema.
//
//   - EXTERNAL abort  -> propagate, discard the buffer, write nothing, emit
//     nothing (the caller cancelled; there is no plan to record).
//   - timeout / 429 / 5xx / Zod-malformed -> recordFailure(userId) for the
//     breaker, then advance to the next step.
//
// On success the plan's user-visible strings (note + block titles) pass the
// voice gate (breaker probe wired so an open breaker runs the regex floor only),
// then emitPlanCompletion(served:'generated'). All steps failing -> serveFallback.
//
// GENERATE-ONLY (LOCKED Decision 4): this writes NO plan row / blocks / partial
// state and takes no idempotency lock. The route (chat-025) persists.

import { streamObject, type DeepPartial } from 'ai';
import type { CoreMessage } from 'ai';
import {
  DailyPlanSchema,
  ArchetypeSchema,
  type DailyPlan,
} from '@vesper/shared';
import type { Database } from '@vesper/db';

import { anthropicProvider, MODELS } from './client';
import { getProviderOptions } from './cacheConfig';
import { extractCachedTokens } from './cost/tracker';
import { voiceGate } from './voiceGate';
import { getFallbackPlan } from './fallback';
import { buildUserContext } from './context/userContext';
import { recordFailure } from './synthesizePlan.circuitBreaker';
import { emitPlanCompletion } from './synthesizePlan.observability';

/** A partial DailyPlan streamed as synthesis progresses (not yet validated). */
export type DailyPlanChunk = DeepPartial<DailyPlan>;

/**
 * Gate-clean apology prepended to the fallback plan's note (LOCKED Decision 6).
 * No em-dash, no exclamation, voice-clean — passes the regex floor unchanged.
 */
export const APOLOGY_LINE =
  "Working from your usual routine today. I'll have something fresh tomorrow.";

/** §5 retry delays (LOCKED Decision 1). Injectable for offline tests. */
const STEP_1_DELAY_MS = 1_500;
const STEP_2_DELAY_MS = 3_000;
/** Per-attempt hard ceiling before the breaker counts a timeout. */
const ATTEMPT_TIMEOUT_MS = 15_000;

export interface FallbackChainParams {
  userId: string;
  /** 'YYYY-MM-DD' plan day. */
  planDate: string;
  energyScore: number | null;
  /** Full four-layer context for the initial + Step-1 attempts. */
  fullMessages: CoreMessage[];
  /** Lazily builds the trimmed Step-2 context (only assembled if we reach Step 2). */
  buildSimplifiedMessages: () => Promise<CoreMessage[]>;
  breakerOpen: boolean;
  db: Database;
  signal?: AbortSignal;
  /** Test seam: override the §5 delays / sleep so retries don't wait in tests. */
  sleep?: (ms: number) => Promise<void>;
}

interface AttemptOutcome {
  plan: DailyPlan;
  usage: { promptTokens: number; completionTokens: number } | null;
  cacheReadInputTokens: number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function classifyError(err: unknown): { errorCode: string; failureReason: string } {
  if (err instanceof Error) {
    const status = (err as { statusCode?: number }).statusCode;
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { errorCode: 'timeout', failureReason: err.message };
    }
    if (err.name === 'ZodError' || /no object generated|type validation/i.test(err.message)) {
      return { errorCode: 'schema_invalid', failureReason: err.message };
    }
    if (status === 429) return { errorCode: 'rate_limited', failureReason: err.message };
    if (typeof status === 'number' && status >= 500) {
      return { errorCode: 'server_error', failureReason: err.message };
    }
    return { errorCode: 'synthesis_failed', failureReason: err.message };
  }
  return { errorCode: 'synthesis_failed', failureReason: String(err) };
}

/**
 * One Anthropic attempt: streamObject under a 15s timeout linked to the external
 * signal. Yields partials; RETURNS the validated plan + usage on success; THROWS
 * (AbortError on external cancel, or a classified failure) otherwise.
 */
async function* runSynthesisAttempt(
  messages: CoreMessage[],
  signal: AbortSignal | undefined,
): AsyncGenerator<DailyPlanChunk, AttemptOutcome> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

  try {
    const result = streamObject({
      model: anthropicProvider(MODELS.SONNET),
      schema: DailyPlanSchema,
      messages,
      providerOptions: getProviderOptions('daily-plan'),
      abortSignal: controller.signal,
    });

    for await (const partial of result.partialObjectStream) {
      yield partial as DailyPlanChunk;
    }

    // `.object` rejects (TypeValidationError / NoObjectGeneratedError) when the
    // final object fails DailyPlanSchema — caught by the chain as a failure.
    const plan = await result.object;
    const usage = await result.usage;
    const providerMetadata = await result.providerMetadata;

    return {
      plan,
      usage: usage
        ? { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens }
        : null,
      cacheReadInputTokens: extractCachedTokens(providerMetadata),
    };
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener('abort', forwardAbort);
  }
}

/**
 * Run every user-visible string of a plan (note + block titles) through the
 * voice gate. Titles/notes are short (<30 words), so the Haiku layer is skipped
 * and this stays offline-safe; the breaker probe forces the regex floor when open.
 */
async function gatePlanStrings(plan: DailyPlan, breakerOpen: boolean): Promise<DailyPlan> {
  const probe = () => breakerOpen;
  const blocks = await Promise.all(
    plan.blocks.map(async (block) => ({
      ...block,
      title: await voiceGate(block.title, { isAnthropicCircuitOpen: probe }),
    })),
  );
  if (plan.note !== undefined) {
    const note = await voiceGate(plan.note, { isAnthropicCircuitOpen: probe });
    return { blocks, note };
  }
  return { blocks };
}

/**
 * Step 3: serve the hardcoded archetype-default plan (LOCKED Decision 4 keeps
 * this hardcoded; prior-plan substitution is deferred to the route / chat-025).
 * APOLOGY_LINE is prepended into the note, then the strings are gated.
 */
async function* serveFallback(
  params: FallbackChainParams,
  startedAt: number,
  errorCode: string,
  failureReason: string | undefined,
): AsyncGenerator<DailyPlanChunk, DailyPlan> {
  const userContext = await buildUserContext(params.userId, params.db);
  const archetype = ArchetypeSchema.parse(userContext.archetype);
  const base = getFallbackPlan(archetype, new Date(`${params.planDate}T00:00:00`));

  const note = base.note ? `${APOLOGY_LINE} ${base.note}` : APOLOGY_LINE;
  const gated = await gatePlanStrings({ ...base, note }, params.breakerOpen);

  await emitPlanCompletion({
    db: params.db,
    userId: params.userId,
    planDate: params.planDate,
    served: 'fallback',
    usage: null,
    cacheReadInputTokens: 0,
    latencyMs: Date.now() - startedAt,
    fallbackStep: 3,
    errorCode,
    ...(failureReason !== undefined ? { failureReason } : {}),
  });

  // Emit the complete plan as the final chunk so for-await consumers (the route)
  // receive it even though synthesis produced no partials.
  yield gated as DailyPlanChunk;
  return gated;
}

/**
 * The full chain. Yields partial plans as they stream and RETURNS the final
 * (gated) DailyPlan — either a synthesized one or the served fallback.
 */
export async function* runFallbackChain(
  params: FallbackChainParams,
): AsyncGenerator<DailyPlanChunk, DailyPlan> {
  const startedAt = Date.now();
  const sleep = params.sleep ?? defaultSleep;

  // Breaker OPEN: no Anthropic call, straight to Step 3 (LOCKED Decision 2).
  if (params.breakerOpen) {
    return yield* serveFallback(params, startedAt, 'breaker_open', undefined);
  }

  const steps: Array<{
    delayMs: number;
    fallbackStep?: 1 | 2;
    getMessages: () => Promise<CoreMessage[]>;
  }> = [
    { delayMs: 0, getMessages: async () => params.fullMessages },
    { delayMs: STEP_1_DELAY_MS, fallbackStep: 1, getMessages: async () => params.fullMessages },
    { delayMs: STEP_2_DELAY_MS, fallbackStep: 2, getMessages: params.buildSimplifiedMessages },
  ];

  let lastErrorCode = 'synthesis_failed';
  let lastFailureReason: string | undefined;

  for (const step of steps) {
    if (step.delayMs > 0) await sleep(step.delayMs);

    try {
      const messages = await step.getMessages();
      const outcome = yield* runSynthesisAttempt(messages, params.signal);

      const gated = await gatePlanStrings(outcome.plan, params.breakerOpen);
      await emitPlanCompletion({
        db: params.db,
        userId: params.userId,
        planDate: params.planDate,
        served: 'generated',
        usage: outcome.usage,
        cacheReadInputTokens: outcome.cacheReadInputTokens,
        latencyMs: Date.now() - startedAt,
        ...(step.fallbackStep !== undefined ? { fallbackStep: step.fallbackStep } : {}),
      });
      // Final chunk = the gated, complete, voice-clean plan.
      yield gated as DailyPlanChunk;
      return gated;
    } catch (err) {
      // External cancel: discard buffer, write nothing, emit nothing — propagate.
      if (params.signal?.aborted) throw err;

      const classified = classifyError(err);
      lastErrorCode = classified.errorCode;
      lastFailureReason = classified.failureReason;
      // Best-effort breaker bookkeeping — never let it break the chain.
      await recordFailure(params.userId).catch(() => undefined);
    }
  }

  // All synthesis attempts failed -> Step 3.
  return yield* serveFallback(params, startedAt, lastErrorCode, lastFailureReason);
}
