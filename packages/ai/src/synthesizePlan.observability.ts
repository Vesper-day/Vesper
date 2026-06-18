// Plan-completion observability sink (Chat 022, LOCKED Decision 3).
//
// NO Zod value union existed for completion_log (the cache observer and cost
// tracker both report this and INSERT nothing). So this defines a STANDALONE
// PlanCompletionLogValueSchema, validates the value object, then writes one row
// via raw parameterized SQL — mirroring apps/web/.../energy/logEnergy.ts, the
// established completion_log write pattern. event_type is one of the EXISTING
// completion_event_enum members (no migration, no new table):
//   plan_fallback_served — the fallback plan was served (Step 3).
//   plan_regenerated     — a daily_plans row already exists for (user, date).
//   plan_generated       — first plan of the day for that (user, date).
//
// FOUND DEFECT (recorded in CHAT_022_RESOLUTION_RECORD): the completionLog ORM
// model in packages/db/src/schema/analytics.ts is STALE vs the applied table
// (declares event_name/occurred_at; real columns are user_id/event_type/value/
// logged_at). We do NOT touch it — raw SQL until chat-006 drizzle-kit pull
// regenerates it, exactly as logEnergy.ts does.
//
// emitPlanCompletion is BEST-EFFORT: every failure is swallowed so observability
// can never throw into the plan path. These event names are the chat-096
// analytics contract.

import { z } from 'zod';
import { sql, type Database } from '@vesper/db';
import { MODELS } from './client';
import { classifyCacheOutcome } from './context/cacheObservability';

/**
 * The completion_log.value payload for a plan-completion event. Standalone (no
 * pre-existing union to extend). fallback_step/error_code/failure_reason ride
 * only on the degraded paths.
 */
export const PlanCompletionLogValueSchema = z.object({
  plan_date: z.string(),
  model: z.string(),
  cache_hit: z.boolean(),
  input_token_count: z.number().int().nonnegative(),
  output_token_count: z.number().int().nonnegative(),
  latency_ms: z.number().int().nonnegative(),
  fallback_step: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  error_code: z.string().optional(),
  failure_reason: z.string().optional(),
});

export type PlanCompletionLogValue = z.infer<typeof PlanCompletionLogValueSchema>;

export interface EmitPlanCompletionParams {
  db: Database;
  userId: string;
  /** 'YYYY-MM-DD' plan day. */
  planDate: string;
  /** 'generated' => synthesis succeeded; 'fallback' => Step 3 served. */
  served: 'generated' | 'fallback';
  /** Final token usage from streamObject; null on the fallback path. */
  usage: { promptTokens: number; completionTokens: number } | null;
  /** Anthropic-reported cache-READ input tokens (0 on fallback / cold miss). */
  cacheReadInputTokens: number;
  latencyMs: number;
  fallbackStep?: 1 | 2 | 3;
  errorCode?: string;
  failureReason?: string;
}

/**
 * Does a daily_plans row already exist for (user, date)? Read-only EXISTS check
 * that decides plan_generated vs plan_regenerated (LOCKED Decision 4 keeps this
 * read; the row WRITE belongs to the route / chat-025, not here).
 */
async function dailyPlanExists(
  db: Database,
  userId: string,
  planDate: string,
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM daily_plans
    WHERE user_id = ${userId}::uuid AND plan_date = ${planDate}::date
    LIMIT 1
  `);
  const rows = result as unknown as unknown[];
  return rows.length > 0;
}

/**
 * Validate + INSERT one plan-completion row. Best-effort: any error (validation,
 * DB, enum) is caught and swallowed so the plan still streams to the user.
 */
export async function emitPlanCompletion(params: EmitPlanCompletionParams): Promise<void> {
  try {
    const eventType =
      params.served === 'fallback'
        ? 'plan_fallback_served'
        : (await dailyPlanExists(params.db, params.userId, params.planDate))
          ? 'plan_regenerated'
          : 'plan_generated';

    const value: PlanCompletionLogValue = PlanCompletionLogValueSchema.parse({
      plan_date: params.planDate,
      model: MODELS.SONNET, // always "claude-sonnet-4-6"
      cache_hit: classifyCacheOutcome(params.cacheReadInputTokens) === 'hit',
      input_token_count: params.usage?.promptTokens ?? 0,
      output_token_count: params.usage?.completionTokens ?? 0,
      latency_ms: params.latencyMs,
      ...(params.fallbackStep !== undefined ? { fallback_step: params.fallbackStep } : {}),
      ...(params.errorCode !== undefined ? { error_code: params.errorCode } : {}),
      ...(params.failureReason !== undefined ? { failure_reason: params.failureReason } : {}),
    });

    const valueJson = JSON.stringify(value);

    // Raw parameterized INSERT — completionLog ORM model is stale (see header).
    await params.db.execute(sql`
      INSERT INTO completion_log (user_id, event_type, value, logged_at)
      VALUES (${params.userId}::uuid, ${eventType}::completion_event_enum, ${valueJson}::jsonb, now())
    `);
  } catch {
    // Observability must never break plan generation.
  }
}
