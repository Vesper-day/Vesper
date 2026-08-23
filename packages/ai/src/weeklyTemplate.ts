// Weekly-template synthesis (Chat 058) — the Sunday session's Step-5 engine.
//
// A NEW SIBLING of the daily synthesizePlan path, NOT a fork of it. It produces
// SEVEN days of plans in one Sonnet call, with the week's priorities threaded
// consistently across the days, plus the Step-4 TRANSIENT constraints honored for
// this week only. It REUSES the live daily primitives rather than re-deriving them:
//   - readBreakerState / recordFailure   (synthesizePlan.circuitBreaker)
//   - getFallbackPlan                     (fallback) — for the safe fallback week
//   - buildUserContext / buildTemplateSubset (context) — Layer 2 / Layer 3
//   - getProviderOptions                  (cacheConfig) — the cache-shared L1 breakpoint
//   - anthropicProvider / MODELS.SONNET   (client)
//   - voiceGate                           (voiceGate) — the same string gate
//   - DailyPlanSchema                     (@vesper/shared) — each day's block schema
//
// GENERATE-ONLY (LOCKED Decision 4, mirrored): this writes NO daily_plans / blocks.
// The route runs it to produce the reviewable week; the ACCEPT path (commitWeek,
// reusing the daily commitPlan per day) persists. There is no weekly completion_log
// event in completion_event_enum, so — with no migration in scope — the weekly
// generate emits no completion_log row (FLAGGED in the resolution notes); the
// per-day ACCEPT write emits the existing plan_generated / plan_regenerated events.
//
// The Layer-1 prompt (prompts/weeklyTemplateSynthesis.ts) is a VERSIONED artifact
// (WEEKLY_TEMPLATE_SYNTHESIS_VERSION) so the chat-020 eval class can measure it.

import { streamObject } from 'ai';
import type { CoreMessage } from 'ai';
import { z } from 'zod';
import {
  DailyPlanSchema,
  ArchetypeSchema,
  BlockTypeSchema,
  type DailyPlan,
  type BlockType,
} from '@vesper/shared';
import type { Database } from '@vesper/db';

import { anthropicProvider, MODELS } from './client';
import { getProviderOptions } from './cacheConfig';
import { voiceGate } from './voiceGate';
import { getFallbackPlan } from './fallback';
import { buildUserContext } from './context/userContext';
import { buildTemplateSubset } from './context/templateSubset';
import { readBreakerState } from './synthesizePlan.circuitBreaker';
import { recordFailure } from './synthesizePlan.circuitBreaker';
import {
  WEEKLY_TEMPLATE_SYNTHESIS_PROMPT,
  WEEKLY_TEMPLATE_SYNTHESIS_VERSION,
} from './prompts/weeklyTemplateSynthesis';

// --- Output schema ----------------------------------------------------------

/** Days per generated week. Monday (index 0) through Sunday (index 6). */
export const DAYS_IN_WEEK = 7;

/** One generated day: its Monday-anchored index (0..6) and the day's plan. */
export const WeeklyDaySchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  plan: DailyPlanSchema,
});
export type WeeklyDay = z.infer<typeof WeeklyDaySchema>;

/**
 * A full generated week: exactly seven days, each dayIndex 0..6 present once.
 * The caller maps dayIndex -> calendar date via the target Monday.
 */
export const WeeklyTemplateSchema = z
  .object({ days: z.array(WeeklyDaySchema).length(DAYS_IN_WEEK) })
  .refine(
    (w) => new Set(w.days.map((d) => d.dayIndex)).size === DAYS_IN_WEEK,
    { message: 'each dayIndex 0..6 must appear exactly once', path: ['days'] },
  );
export type WeeklyTemplate = z.infer<typeof WeeklyTemplateSchema>;

// --- Step-4 transient constraints -------------------------------------------

/** A lifestyle/work module paused on specific dates of the target week only. */
export interface WeeklyPausedModule {
  /** block_type_enum value whose blocks are suppressed on the listed dates. */
  moduleType: BlockType;
  /** ISO YYYY-MM-DD dates within the target week on which the module is paused. */
  dates: string[];
}

/** A one-off fixed personal note for a given date (e.g. a dinner out Thursday). */
export interface WeeklyFixedNote {
  /** ISO YYYY-MM-DD date within the target week. */
  date: string;
  note: string;
}

/**
 * The Step-4 adjustments, applied as TRANSIENT constraints on THIS week's
 * generation only. NEVER written to modules_enabled or any persistent preference:
 * this object lives in the generate-route request body and the Layer-4 context, and
 * is enforced by applyWeeklyConstraints below. It is not persisted anywhere.
 */
export interface WeeklyConstraints {
  /** Modules paused on given dates (travel days, etc.). */
  pausedModules: WeeklyPausedModule[];
  /** Recovery days: no fitness/workout block is scheduled on these dates. */
  recoveryDates: string[];
  /** One-off fixed notes threaded into the prompt as context (not a hard filter). */
  fixedNotes: WeeklyFixedNote[];
}

/** The empty (no-adjustments) constraints object. */
export const EMPTY_WEEKLY_CONSTRAINTS: WeeklyConstraints = {
  pausedModules: [],
  recoveryDates: [],
  fixedNotes: [],
};

/** ISO YYYY-MM-DD calendar-date string. */
const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

/**
 * Runtime validator for the Step-4 transient constraints at the API boundary. The
 * moduleType is validated against the live block_type_enum (BlockTypeSchema); dates
 * are ISO calendar dates. Defaults make every field present so callers need not send
 * empty arrays. This validates the REQUEST BODY only — it never writes anything.
 */
export const WeeklyConstraintsSchema = z.object({
  pausedModules: z
    .array(z.object({ moduleType: BlockTypeSchema, dates: z.array(IsoDateSchema) }))
    .default([]),
  recoveryDates: z.array(IsoDateSchema).default([]),
  fixedNotes: z.array(z.object({ date: IsoDateSchema, note: z.string() })).default([]),
});

export interface SynthesizeWeeklyTemplateParams {
  userId: string;
  /** The target week's Monday, ISO YYYY-MM-DD (the coming Monday for a Sunday session). */
  targetMonday: string;
  /** This week's 3-5 priorities (text only), threaded across the seven days. */
  priorities: string[];
  /** The Step-4 transient constraints. */
  constraints: WeeklyConstraints;
  /** Injected Drizzle client (route/tests). */
  db?: Database;
  signal?: AbortSignal;
  /** Test seam: override the retry delay. */
  sleep?: (ms: number) => Promise<void>;
}

export interface WeeklyTemplateResult {
  week: WeeklyTemplate;
  /** 'generated' when Sonnet produced it; 'fallback' when the safe week was served. */
  served: 'generated' | 'fallback';
}

/** Retry delay before the single simplified re-attempt (mirrors the daily Step-1 wait). */
const RETRY_DELAY_MS = 1_500;
const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// --- Date helper (UTC calendar math, mirrors apps/web/lib/.../week.ts) -------

/** Shift a YYYY-MM-DD by n days (UTC), returning YYYY-MM-DD. */
export function addDaysUtc(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The calendar date (YYYY-MM-DD) for a dayIndex within the target week. */
export function dateForDayIndex(targetMonday: string, dayIndex: number): string {
  return addDaysUtc(targetMonday, dayIndex);
}

// --- Deterministic constraint enforcement (post-generation) -----------------

/**
 * Enforce the Step-4 transient constraints on a generated week deterministically,
 * regardless of model compliance (belt-and-suspenders, mirroring how the daily path
 * applies task placement as a post-process). For each day:
 *   - a recovery date drops every fitness block;
 *   - a paused module drops every block of that moduleType on its listed dates.
 * displayOrder is re-sequenced contiguously after any removal. Purely functional;
 * touches nothing persistent.
 */
export function applyWeeklyConstraints(
  week: WeeklyTemplate,
  constraints: WeeklyConstraints,
  targetMonday: string,
): WeeklyTemplate {
  const recovery = new Set(constraints.recoveryDates);
  // date -> set of paused module types on that date.
  const pausedByDate = new Map<string, Set<BlockType>>();
  for (const pm of constraints.pausedModules) {
    for (const date of pm.dates) {
      const set = pausedByDate.get(date) ?? new Set<BlockType>();
      set.add(pm.moduleType);
      pausedByDate.set(date, set);
    }
  }

  const days = week.days.map((day) => {
    const date = dateForDayIndex(targetMonday, day.dayIndex);
    const paused = pausedByDate.get(date);
    const dropFitness = recovery.has(date);

    const kept = day.plan.blocks.filter((b) => {
      if (dropFitness && b.blockType === 'fitness') return false;
      if (paused && paused.has(b.blockType)) return false;
      return true;
    });
    const reindexed = kept.map((b, i) => ({ ...b, displayOrder: i }));

    const plan: DailyPlan =
      day.plan.note !== undefined
        ? { blocks: reindexed, note: day.plan.note }
        : { blocks: reindexed };
    return { dayIndex: day.dayIndex, plan };
  });

  return { days };
}

// --- Context assembly (four-layer, mirrors planContext.ts) ------------------

/**
 * Assemble the weekly four-layer message array. Layer 1 = the cache-shared weekly
 * L1 prompt; Layer 2 = user context; Layer 3 = template subset; Layer 4 = this
 * week's volatile inputs (priorities, transient constraints, the seven dates,
 * promptVersion). ASSEMBLES ONLY — no Anthropic call here.
 */
export async function buildWeeklyContext(
  userId: string,
  targetMonday: string,
  priorities: string[],
  constraints: WeeklyConstraints,
  db?: Database,
): Promise<CoreMessage[]> {
  const userContext = await buildUserContext(userId, db);
  const templateSubset = await buildTemplateSubset(userContext.modulesEnabled);
  const cache = getProviderOptions('daily-plan');

  const systemMessage: CoreMessage = {
    role: 'system',
    content: WEEKLY_TEMPLATE_SYNTHESIS_PROMPT,
    providerOptions: cache,
  };

  const layer2 = `USER CONTEXT\n${JSON.stringify(userContext, null, 2)}`;
  const layer3 = `TEMPLATE LIBRARY SUBSET\n${JSON.stringify(templateSubset, null, 2)}`;

  // Layer 4 — volatile per-week inputs (NOT cached). The seven dates make dayIndex
  // unambiguous to the model; priorities + constraints drive threading and pauses.
  const dates = Array.from({ length: DAYS_IN_WEEK }, (_, i) => ({
    dayIndex: i,
    date: dateForDayIndex(targetMonday, i),
  }));
  const layer4 = `THIS WEEK\n${JSON.stringify(
    {
      targetMonday,
      dates,
      priorities,
      constraints,
      promptVersion: WEEKLY_TEMPLATE_SYNTHESIS_VERSION,
    },
    null,
    2,
  )}`;

  const userMessage: CoreMessage = {
    role: 'user',
    content: [
      { type: 'text', text: layer2, providerOptions: cache },
      { type: 'text', text: layer3, providerOptions: cache },
      { type: 'text', text: layer4 },
    ],
  };

  return [systemMessage, userMessage];
}

// --- Voice gate over every day's user-visible strings -----------------------

async function gateWeekStrings(
  week: WeeklyTemplate,
  breakerOpen: boolean,
): Promise<WeeklyTemplate> {
  const probe = (): boolean => breakerOpen;
  const days = await Promise.all(
    week.days.map(async (day) => {
      const blocks = await Promise.all(
        day.plan.blocks.map(async (block) => ({
          ...block,
          title: await voiceGate(block.title, { isAnthropicCircuitOpen: probe }),
        })),
      );
      const plan: DailyPlan =
        day.plan.note !== undefined
          ? { blocks, note: await voiceGate(day.plan.note, { isAnthropicCircuitOpen: probe }) }
          : { blocks };
      return { dayIndex: day.dayIndex, plan };
    }),
  );
  return { days };
}

// --- Safe fallback week -----------------------------------------------------

/**
 * Build the hardcoded fallback week: each of the seven days is the archetype-default
 * plan (reusing getFallbackPlan). Constraints are still enforced so a paused module
 * or a recovery day is honored even on the degraded path.
 */
async function serveFallbackWeek(
  userId: string,
  targetMonday: string,
  constraints: WeeklyConstraints,
  db: Database | undefined,
): Promise<WeeklyTemplate> {
  const userContext = await buildUserContext(userId, db);
  const archetype = ArchetypeSchema.parse(userContext.archetype);
  const days = Array.from({ length: DAYS_IN_WEEK }, (_, i) => ({
    dayIndex: i,
    plan: getFallbackPlan(archetype, new Date(`${dateForDayIndex(targetMonday, i)}T00:00:00`)),
  }));
  return applyWeeklyConstraints({ days }, constraints, targetMonday);
}

// --- One Sonnet attempt -----------------------------------------------------

async function runWeeklyAttempt(
  messages: CoreMessage[],
  signal: AbortSignal | undefined,
): Promise<WeeklyTemplate> {
  const result = streamObject({
    model: anthropicProvider(MODELS.SONNET),
    schema: WeeklyTemplateSchema,
    messages,
    providerOptions: getProviderOptions('daily-plan'),
    ...(signal ? { abortSignal: signal } : {}),
  });
  // Drain the partial stream so the request runs to completion.
  for await (const _partial of result.partialObjectStream) {
    void _partial;
  }
  // `.object` rejects (TypeValidationError / NoObjectGeneratedError) on a malformed
  // final object — surfaced to the caller as a failure.
  return result.object;
}

// --- Entry point ------------------------------------------------------------

/**
 * Synthesize the seven-day template for the target week. Generate-only: returns the
 * reviewable week; persistence belongs to the accept path (commitWeek).
 *
 * Flow (mirrors the daily breaker + fallback shape, leaner for the weekly call):
 *   breaker OPEN            -> serve the fallback week (no Anthropic call)
 *   initial attempt         -> success => gated + constraint-enforced generated week
 *   simplified retry (1x)   -> after a recorded failure, one identical re-attempt
 *   all attempts fail       -> serve the fallback week
 */
export async function synthesizeWeeklyTemplate(
  params: SynthesizeWeeklyTemplateParams,
): Promise<WeeklyTemplateResult> {
  const { userId, targetMonday, priorities, constraints, db, signal } = params;
  const sleep = params.sleep ?? defaultSleep;

  const breaker = await readBreakerState(userId).catch(() => ({ open: false }));
  if (breaker.open) {
    const week = await gateWeekStrings(
      await serveFallbackWeek(userId, targetMonday, constraints, db),
      true,
    );
    return { week, served: 'fallback' };
  }

  const messages = await buildWeeklyContext(userId, targetMonday, priorities, constraints, db);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);
    try {
      const raw = await runWeeklyAttempt(messages, signal);
      const enforced = applyWeeklyConstraints(raw, constraints, targetMonday);
      const gated = await gateWeekStrings(enforced, false);
      return { week: gated, served: 'generated' };
    } catch (err) {
      // External cancel: propagate, write/emit nothing.
      if (signal?.aborted) throw err;
      // Best-effort breaker bookkeeping — never let it break the chain.
      await recordFailure(userId).catch(() => undefined);
    }
  }

  const week = await gateWeekStrings(
    await serveFallbackWeek(userId, targetMonday, constraints, db),
    false,
  );
  return { week, served: 'fallback' };
}
