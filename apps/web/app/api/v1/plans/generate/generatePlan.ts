// Plan-generation core logic (§9 SSE streaming + buffer-then-commit), extracted
// from route.ts.
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config; pure helpers (commitPlan, the SSE stream builder, request schema) are
// invalid Route exports, so they live in this plain sibling module. route.ts
// imports them; the integration test drives commitPlan/planExists directly
// against the chat-002 local-Supabase test DB without standing up Supabase Auth.
//
// THE CONTRACT (§9, chat-022 fallback chain):
//   - synthesizePlan is an async generator yielding partial DailyPlans; the LAST
//     yielded chunk is always the COMPLETE, voice-gated plan (success path OR
//     served fallback). It NEVER throws on AI failure — it serves a fallback.
//   - BUFFER-THEN-COMMIT: stream every chunk to the SSE client immediately;
//     accumulate the complete plan in memory; do NOT open a DB transaction until
//     the stream finishes. The transaction is held ~50-200ms at the end, NOT
//     across the whole generation (no Supavisor slot held during streaming).
//   - FALLBACK = 200, not 5xx (§9): a fallback plan is detected by its note
//     prefix (APOLOGY_LINE) and surfaced as source:'fallback' + fallbackNotice.
//   - EXTERNAL ABORT (client disconnect): synthesizePlan rejects; we write
//     NOTHING and emit nothing — there is no plan to record.
//
// completion_log column skew: the applied migration 20260601000010 has
// (user_id, block_id, event_type, value, logged_at). The ORM model analytics.ts
// is STALE (event_name/occurred_at) and is NOT used here — we INSERT via raw
// parameterized SQL against the real columns (the write-side analog of withUser,
// scoped by explicit user_id). Durable fix: chat-006 drizzle-kit pull.
import { z } from 'zod';
import { synthesizePlan, APOLOGY_LINE } from '@vesper/ai';
import { DailyPlanSchema, type DailyPlan } from '@vesper/shared';
import {
  withUser,
  dailyPlans,
  eq,
  and,
  sql,
  type Database,
  type UserScopedQuery,
} from '@vesper/db';
import {
  startHeartbeat,
  stopHeartbeat,
  releaseLock,
} from '../../../../../lib/idempotency';

// --- Request schema (§9, camelCase, chat-024 strict style) ------------------
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/** Strict YYYY-MM-DD: format AND a real calendar date (rejects 2026-13-40). */
function isRealCalendarDate(value: string): boolean {
  if (!DATE_FORMAT.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

export const GenerateRequestSchema = z
  .object({
    date: z.string().refine(isRealCalendarDate, {
      message: 'date must be a real YYYY-MM-DD calendar date',
    }),
    energyScore: z.number().int().min(1).max(10),
  })
  .strict();

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

// --- Pure helpers (unit-testable, no DB / network) --------------------------

/**
 * The calendar date a block's end_time lands on. Synthesis emits "HH:MM" local
 * times for the plan day. A block whose endTime is at or before its startTime
 * wraps past midnight onto the NEXT day — this covers sleep/wind-down blocks
 * (e.g. 22:30 -> 06:45) and the "00:00" end-of-day sentinel (e.g. 23:00 -> 00:00,
 * meaning the instant midnight rolls into tomorrow). Every other block ends the
 * same day. Returns 'YYYY-MM-DD'.
 */
export function endDateForBlock(
  planDate: string,
  startTime: string,
  endTime: string,
): string {
  if (endTime <= startTime) {
    const d = new Date(`${planDate}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  return planDate;
}

/** True if `note` was produced by the served-fallback path (APOLOGY_LINE prefix). */
export function isFallbackNote(note: string | undefined): boolean {
  return note !== undefined && note.startsWith(APOLOGY_LINE);
}

// --- Existence check (regeneration detection) -------------------------------

const existsQuery: UserScopedQuery<[planDate: string], boolean> =
  (userId, planDate) => async (db) => {
    const rows = await db
      .select({ id: dailyPlans.id })
      .from(dailyPlans)
      .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.planDate, planDate)))
      .limit(1);
    return rows.length > 0;
  };

/** True if a daily_plans row already exists for (user, planDate) — a regeneration. */
export async function planExists(
  db: Database,
  userId: string,
  planDate: string,
): Promise<boolean> {
  return withUser(db, userId, existsQuery, planDate);
}

// --- Atomic commit ----------------------------------------------------------

export interface CommitPlanParams {
  userId: string;
  /** IANA timezone — block "HH:MM" local times convert to timestamptz in-DB. */
  timezone: string;
  planDate: string;
  /**
   * The user's logged energy (1..10) for the day, or null when unknown. Daily
   * generation always supplies a score; the Chat-058 weekly batch-write persists
   * seven days with no per-day energy, so it passes null (energy_score is NULLABLE).
   */
  energyScore: number | null;
  plan: DailyPlan;
  /** A plan already existed for (user, date): increment + replace blocks. */
  isRegeneration: boolean;
  /** The plan was served from the fallback chain (note prefix). */
  isFallback: boolean;
}

export interface CommitResult {
  planId: string;
  regenerationCount: number;
  blockCount: number;
  eventType: 'plan_generated' | 'plan_regenerated';
}

/**
 * Persist the complete plan + blocks atomically (§9 step g/h). On regeneration:
 * UPDATE daily_plans (increment regeneration_count, refresh energy/generated_at)
 * and delete+replace its blocks. On first generation: INSERT the daily_plans row
 * (approved_at left NULL — it is a DRAFT; chat 046-W approves it, CD-flag F1).
 * Block "HH:MM" local times are converted to timestamptz IN POSTGRES via
 * `(date || ' ' || time)::timestamp AT TIME ZONE tz`, so DST is DB-correct.
 * Writes one completion_log row (real columns event_type/value) inside the same
 * transaction. The transaction is held only for these writes (~50-200ms).
 */
export async function commitPlan(
  db: Database,
  params: CommitPlanParams,
): Promise<CommitResult> {
  const {
    userId,
    timezone,
    planDate,
    energyScore,
    plan,
    isRegeneration,
    isFallback,
  } = params;
  const eventType: CommitResult['eventType'] = isRegeneration
    ? 'plan_regenerated'
    : 'plan_generated';

  return db.transaction(async (tx) => {
    let planId: string;
    let regenerationCount: number;

    if (isRegeneration) {
      const updated = (await tx.execute(sql`
        UPDATE daily_plans
        SET regeneration_count = regeneration_count + 1,
            energy_score = ${energyScore},
            generated_at = now(),
            updated_at = now()
        WHERE user_id = ${userId}::uuid AND plan_date = ${planDate}::date
        RETURNING id, regeneration_count
      `)) as unknown as Array<{ id: string; regeneration_count: number }>;
      const row = updated[0];
      if (!row) throw new Error('commitPlan: daily_plans row vanished mid-regeneration');
      planId = row.id;
      regenerationCount = row.regeneration_count;

      // Replace the prior blocks (user-scoped delete; parent-touch trigger fires).
      await tx.execute(sql`
        DELETE FROM blocks
        WHERE user_id = ${userId}::uuid AND daily_plan_id = ${planId}::uuid
      `);
    } else {
      const inserted = (await tx.execute(sql`
        INSERT INTO daily_plans (user_id, plan_date, energy_score, generated_at)
        VALUES (${userId}::uuid, ${planDate}::date, ${energyScore}, now())
        RETURNING id, regeneration_count
      `)) as unknown as Array<{ id: string; regeneration_count: number }>;
      const row = inserted[0];
      if (!row) throw new Error('commitPlan: daily_plans insert returned no row');
      planId = row.id;
      regenerationCount = row.regeneration_count;
    }

    if (plan.blocks.length > 0) {
      const rows = plan.blocks.map((b) => {
        const endDate = endDateForBlock(planDate, b.startTime, b.endTime);
        const detailsJson = JSON.stringify(b.details);
        return sql`(
          ${planId}::uuid,
          ${userId}::uuid,
          (${planDate} || ' ' || ${b.startTime})::timestamp AT TIME ZONE ${timezone},
          (${endDate} || ' ' || ${b.endTime})::timestamp AT TIME ZONE ${timezone},
          ${b.blockType}::block_type_enum,
          ${b.title},
          'scheduled'::block_status_enum,
          ${detailsJson}::jsonb,
          'ai_generated'::block_source_enum,
          ${b.displayOrder}
        )`;
      });
      await tx.execute(sql`
        INSERT INTO blocks (
          daily_plan_id, user_id, start_time, end_time, block_type, title,
          status, details, source, display_order
        )
        VALUES ${sql.join(rows, sql`, `)}
      `);
    }

    const valueJson = JSON.stringify({
      planDate,
      energyScore,
      source: isFallback ? 'fallback' : 'generated',
      blockCount: plan.blocks.length,
      regenerationCount,
    });
    await tx.execute(sql`
      INSERT INTO completion_log (user_id, event_type, value)
      VALUES (${userId}::uuid, ${eventType}::completion_event_enum, ${valueJson}::jsonb)
    `);

    return {
      planId,
      regenerationCount,
      blockCount: plan.blocks.length,
      eventType,
    };
  });
}

// --- SSE stream (§9 streaming + buffer-then-commit) -------------------------

export interface PlanStreamOptions {
  db: Database;
  userId: string;
  timezone: string;
  planDate: string;
  energyScore: number;
  isRegeneration: boolean;
  /** Client-disconnect signal (request.signal) — forwarded into synthesizePlan. */
  requestSignal: AbortSignal;
}

const encoder = new TextEncoder();

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Build the text/event-stream body. Streams each synthesis chunk as an `event:
 * plan` SSE event, buffers the complete plan, and on stream completion commits
 * it and emits a final `event: done` carrying source + persisted ids (+
 * fallbackNotice when served from fallback). The idempotency heartbeat runs for
 * the duration of streaming; the lock is released and the heartbeat stopped on
 * stream end (success OR error). Client disconnect aborts synthesis and writes
 * nothing.
 */
export function createPlanStream(opts: PlanStreamOptions): ReadableStream<Uint8Array> {
  const {
    db,
    userId,
    timezone,
    planDate,
    energyScore,
    isRegeneration,
    requestSignal,
  } = opts;

  // Wire the request's abort signal into an AbortController forwarded to
  // synthesizePlan -> Anthropic SDK, so a client disconnect closes the upstream
  // stream and stops output-token billing.
  const ac = new AbortController();
  const forwardAbort = () => ac.abort();
  if (requestSignal.aborted) ac.abort();
  else requestSignal.addEventListener('abort', forwardAbort, { once: true });

  let heartbeat: ReturnType<typeof setInterval> | undefined;

  async function cleanup(): Promise<void> {
    stopHeartbeat(heartbeat);
    requestSignal.removeEventListener('abort', forwardAbort);
    await releaseLock(userId, planDate).catch(() => undefined);
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      heartbeat = startHeartbeat(userId, planDate);
      let finalPlan: DailyPlan | undefined;

      try {
        for await (const chunk of synthesizePlan(userId, planDate, energyScore, {
          signal: ac.signal,
          db,
        })) {
          controller.enqueue(sseEvent('plan', chunk));
          // The last chunk that validates as a COMPLETE DailyPlan is the plan to
          // persist (success path and fallback both yield it as the final chunk).
          const parsed = DailyPlanSchema.safeParse(chunk);
          if (parsed.success) finalPlan = parsed.data;
        }

        if (!finalPlan) {
          // The contract guarantees a final complete chunk; reaching here means a
          // truncated stream with no fallback. Emit an SSE error (still a 200).
          controller.enqueue(
            sseEvent('error', { message: 'Plan generation produced no complete plan.' }),
          );
          controller.close();
          return;
        }

        const isFallback = isFallbackNote(finalPlan.note);
        const committed = await commitPlan(db, {
          userId,
          timezone,
          planDate,
          energyScore,
          plan: finalPlan,
          isRegeneration,
          isFallback,
        });

        controller.enqueue(
          sseEvent('done', {
            source: isFallback ? 'fallback' : 'generated',
            planId: committed.planId,
            regenerationCount: committed.regenerationCount,
            blockCount: committed.blockCount,
            ...(isFallback ? { fallbackNotice: APOLOGY_LINE } : {}),
          }),
        );
        controller.close();
      } catch {
        if (ac.signal.aborted) {
          // Client disconnected: nothing was committed; close quietly.
          try {
            controller.close();
          } catch {
            // Controller may already be torn down by the cancelled consumer.
          }
          return;
        }
        // Non-abort failure (e.g. commit error). The stream already returned 200,
        // so surface the failure as an SSE error event rather than a 5xx.
        try {
          controller.enqueue(sseEvent('error', { message: 'Plan generation failed.' }));
          controller.close();
        } catch {
          // Consumer gone — nothing more to do.
        }
      } finally {
        await cleanup();
      }
    },
    async cancel() {
      // Consumer cancelled (client disconnect): abort synthesis and release the
      // lock. start()'s finally also runs cleanup; releaseLock/del is idempotent.
      ac.abort();
      await cleanup();
    },
  });
}
