// Weekly plan generate + accept core logic (Chat 058), extracted from the route
// files (a route.ts may export only HTTP-method handlers + segment config).
//
// TWO seams:
//   runWeekGeneration — GENERATE-ONLY. Reads the target week's priorities (READ-ONLY;
//     the chat-029 API owns writes) and runs the weekly Sonnet synthesis with the
//     Step-4 transient constraints. Persists NOTHING (mirrors the daily generate-only
//     boundary); returns the reviewable seven-day week.
//   commitWeek — the ACCEPT batch-write seam. Persists the reviewed seven days by
//     REUSING the daily persist path (commitPlan + planExists) once PER DAY. Each day
//     honors the §3.3 write semantics: daily_plans UPSERT-IN-PLACE on
//     UNIQUE(user_id, plan_date), and its blocks DELETED before the new ones are
//     inserted (commitPlan does exactly this). Per-day boundaries derive from
//     start_of_local_day(timezone): commitPlan converts each block's "HH:MM" local
//     time via `(date || ' ' || time)::timestamp AT TIME ZONE tz`, and plan_date is
//     the local calendar date for that dayIndex.
//
// SHARED WRITE SEAM (dismiss-fallback reading): commitWeek is the single batch-write
// seam. The Chat-058 ENGAGED accept path is wired to it here. The PRD §3.3
// dismiss-path template-fallback regeneration (generate next week from the prior
// template + calendar when the Sunday prompt is ignored) would reuse this SAME seam;
// that trigger is NOT built or wired this chat (it remains open/unowned) — only the
// engaged path is wired.
//
// No second plan query, no second db client: reuses createDrizzleClient, commitPlan,
// planExists, and the weekly-priorities read operation.
import { z } from 'zod';
import {
  synthesizeWeeklyTemplate,
  WeeklyConstraintsSchema,
  WeeklyDaySchema,
  dateForDayIndex,
  DAYS_IN_WEEK,
  type WeeklyConstraints,
  type WeeklyTemplateResult,
} from '@vesper/ai';
import { ApiError, ErrorCode } from '@vesper/shared';
import { type Database } from '@vesper/db';
import { commitPlan, planExists } from '../generate/generatePlan';
import { getWeeklyPriorities } from '../../weekly-priorities/operations';

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'targetMonday must be a YYYY-MM-DD date');

// --- Generate ---------------------------------------------------------------

/** POST /plans/week/generate body: the target Monday + the Step-4 transient constraints. */
export const WeekGenerateRequestSchema = z
  .object({
    targetMonday: IsoDateSchema,
    constraints: WeeklyConstraintsSchema,
  })
  .strict();
export type WeekGenerateRequest = z.infer<typeof WeekGenerateRequestSchema>;

export interface WeekGenerateResponse {
  targetMonday: string;
  served: WeeklyTemplateResult['served'];
  week: WeeklyTemplateResult['week'];
}

/**
 * Run the weekly synthesis for a user. Reads the target week's priorities (READ-ONLY),
 * threads them + the transient constraints through the Sonnet call, and returns the
 * reviewable week. Persists nothing.
 */
export async function runWeekGeneration(
  db: Database,
  userId: string,
  rawBody: unknown,
): Promise<WeekGenerateResponse> {
  const parsed = WeekGenerateRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const { targetMonday, constraints } = parsed.data;

  // READ-ONLY input: the week's stored priorities (text only, threaded across days).
  const stored = await getWeeklyPriorities(db, userId, targetMonday);
  const priorities = stored.weekPriorities.priorities.map((p) => p.text);

  const result = await synthesizeWeeklyTemplate({
    userId,
    targetMonday,
    priorities,
    constraints: constraints as WeeklyConstraints,
    db,
  });

  return { targetMonday, served: result.served, week: result.week };
}

// --- Accept (batch write) ---------------------------------------------------

/** POST /plans/week/accept body: the target Monday + the reviewed seven days. */
export const AcceptWeekRequestSchema = z
  .object({
    targetMonday: IsoDateSchema,
    days: z.array(WeeklyDaySchema).length(DAYS_IN_WEEK),
  })
  .strict()
  .refine((b) => new Set(b.days.map((d) => d.dayIndex)).size === DAYS_IN_WEEK, {
    message: 'each dayIndex 0..6 must appear exactly once',
    path: ['days'],
  });
export type AcceptWeekRequest = z.infer<typeof AcceptWeekRequestSchema>;

export interface AcceptWeekResponse {
  targetMonday: string;
  /** One entry per persisted day, Monday first. */
  days: Array<{ planDate: string; planId: string; blockCount: number }>;
}

export interface CommitWeekParams {
  userId: string;
  /** IANA timezone — per-day block "HH:MM" local times convert to timestamptz in-DB. */
  timezone: string;
  targetMonday: string;
  days: AcceptWeekRequest['days'];
}

/**
 * Batch-write the reviewed week: for each of the seven days, derive the local
 * plan_date (target Monday + dayIndex) and REUSE commitPlan to upsert the daily_plans
 * row in place and replace its blocks. Each day is its own transaction (per-day
 * atomicity, matching the per-day upsert semantics); energyScore is null (a weekly
 * plan carries no per-day energy) and isFallback is false (these are reviewed,
 * accepted plans, not served fallbacks).
 */
export async function commitWeek(
  db: Database,
  params: CommitWeekParams,
): Promise<AcceptWeekResponse> {
  const { userId, timezone, targetMonday, days } = params;
  const ordered = days.slice().sort((a, b) => a.dayIndex - b.dayIndex);

  const written: AcceptWeekResponse['days'] = [];
  for (const day of ordered) {
    const planDate = dateForDayIndex(targetMonday, day.dayIndex);
    const isRegeneration = await planExists(db, userId, planDate);
    const committed = await commitPlan(db, {
      userId,
      timezone,
      planDate,
      energyScore: null,
      plan: day.plan,
      isRegeneration,
      isFallback: false,
    });
    written.push({ planDate, planId: committed.planId, blockCount: committed.blockCount });
  }

  return { targetMonday, days: written };
}

/** Validate the accept body and batch-write it. */
export async function acceptWeek(
  db: Database,
  userId: string,
  timezone: string,
  rawBody: unknown,
): Promise<AcceptWeekResponse> {
  const parsed = AcceptWeekRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  return commitWeek(db, {
    userId,
    timezone,
    targetMonday: parsed.data.targetMonday,
    days: parsed.data.days,
  });
}
