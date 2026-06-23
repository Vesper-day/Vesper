// Daily-plan synthesis entrypoint (Chat 022).
//
// Public: synthesizePlan(userId, planDate, energyScore, options) — an async
// generator that streams partial DailyPlans and runs the §5 three-step fallback
// chain. It reads the per-user breaker state ONCE (routing + the synchronous
// voice-gate probe), reads the user's pending tasks for real Layer-4 context,
// assembles the full context, and delegates to runFallbackChain.
//
// GENERATE-ONLY (LOCKED Decision 4): READS are fine (breaker, pending tasks,
// user context, daily_plans EXISTS). WRITES are forbidden here — no plan row,
// no blocks, no idempotency lock. The route (chat-025) persists. Calendar is
// passed as an empty array (no read path is built this chat — deferred + flagged
// in CHAT_022_RESOLUTION_RECORD).
//
// generatePlanFromContext is the internal single-attempt seam the eval harness
// (eval/runPlanEval.ts) drives with inline-built messages and no live DB.

import { streamObject, type CoreMessage } from 'ai';
import { DailyPlanSchema, type DailyPlan } from '@vesper/shared';
import {
  createDrizzleClient,
  withUser,
  tasks,
  eq,
  and,
  desc,
  type Database,
  type UserScopedQuery,
} from '@vesper/db';

import { anthropicProvider, MODELS } from './client';
import { getProviderOptions } from './cacheConfig';
import { buildPlanContext, type PendingTask } from './context/planContext';
import { getTodayEvents } from './integrations/googleCalendar';
import { buildSimplifiedPlanContext } from './synthesizePlan.simplifiedContext';
import { readBreakerState, type BreakerState } from './synthesizePlan.circuitBreaker';
import { runFallbackChain, type DailyPlanChunk } from './synthesizePlan.fallback';

export type { DailyPlanChunk } from './synthesizePlan.fallback';
export { APOLOGY_LINE } from './synthesizePlan.fallback';

export interface SynthesizePlanOptions {
  signal?: AbortSignal;
  /** Injected Drizzle client (tests / route). Defaults to the canonical factory. */
  db?: Database;
}

/**
 * Read the user's pending tasks for the Layer-4 plan context: pending status,
 * highest priority first, soonest deadline next. user-scoped via withUser
 * (ARCHITECTURE_DECISIONS: every @vesper/db query is routed through withUser).
 */
async function readPendingTasks(userId: string, db: Database): Promise<PendingTask[]> {
  const query: UserScopedQuery<[], PendingTask[]> = (uid) => async (client) => {
    const rows = await client
      .select({
        id: tasks.id,
        title: tasks.title,
        estimatedMinutes: tasks.estimatedMinutes,
        priority: tasks.priority,
        deadline: tasks.deadline,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, uid), eq(tasks.status, 'pending')))
      // priority desc (high>medium>low by enum order), then deadline asc (default).
      .orderBy(desc(tasks.priority), tasks.deadline);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      estimatedMinutes: row.estimatedMinutes,
      priority: row.priority,
      deadline: row.deadline ? row.deadline.toISOString() : null,
    }));
  };
  return withUser(db, userId, query);
}

/**
 * Synthesize a daily plan, streaming partials and running the §5 fallback chain.
 *
 * @param planDate 'YYYY-MM-DD' for the plan day.
 * @param energyScore the user's logged energy (1-10) or null.
 */
export async function* synthesizePlan(
  userId: string,
  planDate: string,
  energyScore: number | null,
  options?: SynthesizePlanOptions,
): AsyncIterable<DailyPlanChunk> {
  const db = options?.db ?? createDrizzleClient();

  // Read breaker state ONCE: caches the boolean for routing AND for the sync
  // voice-gate probe (gatePlanStrings forces the regex floor when open).
  const breaker: BreakerState = await readBreakerState(userId).catch(
    () => ({ open: false }) as BreakerState,
  );
  const breakerOpen = breaker.open;

  // Breaker open => straight to Step 3; the full context is never used, so skip
  // the reads. Otherwise read pending tasks + today's calendar events and assemble
  // the full context.
  //
  // Calendar (chat 064): getTodayEvents reads the google_calendar integration row,
  // refreshes the OAuth token if needed, and returns today's events as fixed
  // Layer-4 constraints. It degrades to [] (and sets the reconnect flag,
  // status='error') when the integration is absent / not connected / a refresh
  // fails, so synthesis never blocks on calendar. NOTE re LOCKED Decision 4
  // (generate-only): getTodayEvents performs calendar-sync BOOKKEEPING writes
  // (last_synced_at, and status='error' on failure) on the integrations row — this
  // is sync metadata, NOT plan persistence (no daily_plan / blocks / idempotency
  // lock is written here), so it stays within the generate-only boundary.
  const pendingTasks = breakerOpen ? [] : await readPendingTasks(userId, db);
  const calendarEvents = breakerOpen ? [] : await getTodayEvents(userId, { db });
  const fullMessages: CoreMessage[] = breakerOpen
    ? []
    : await buildPlanContext(userId, planDate, energyScore, calendarEvents, pendingTasks, db);

  yield* runFallbackChain({
    userId,
    planDate,
    energyScore,
    fullMessages,
    buildSimplifiedMessages: () =>
      buildSimplifiedPlanContext(userId, planDate, energyScore, db),
    breakerOpen,
    db,
    ...(options?.signal ? { signal: options.signal } : {}),
  });
}

/**
 * Internal single-attempt seam: stream a plan from a ready-built message array
 * and validate it. NO breaker, NO observability, NO DB — used by the eval
 * harness (and any caller that already owns the message array).
 */
export async function generatePlanFromContext(
  messages: CoreMessage[],
  options?: { signal?: AbortSignal },
): Promise<DailyPlan> {
  const result = streamObject({
    model: anthropicProvider(MODELS.SONNET),
    schema: DailyPlanSchema,
    messages,
    providerOptions: getProviderOptions('daily-plan'),
    ...(options?.signal ? { abortSignal: options.signal } : {}),
  });

  // Drain the partial stream so the request runs to completion.
  for await (const _partial of result.partialObjectStream) {
    void _partial;
  }
  return result.object;
}
