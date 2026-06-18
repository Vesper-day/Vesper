// Plan retrieval DB-layer core logic (§9), shared by GET /plans/today and
// GET /plans/date/[date].
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config, so the pure getPlanForDate function lives in this plain sibling module.
// The route handlers import it; the integration tests drive it directly against
// the chat-002 local-Supabase test DB without standing up Supabase Auth.
//
// Read-only: one user-scoped read of the daily_plans row for (user_id, plan_date)
// plus its blocks (ordered by display_order). No mutation, no synthesis.
import { ApiError, ErrorCode } from '@vesper/shared';
import {
  withUser,
  dailyPlans,
  blocks,
  eq,
  and,
  type Database,
  type UserScopedQuery,
} from '@vesper/db';
// effective_status formula lives in one place (chat 027 extraction). Until that
// file existed, chat 026 inlined the formula here; this import replaces it.
import { computeEffectiveStatus } from '@/lib/blocks/effectiveStatus';

// --- §9 GET-response contract (camelCase) -----------------------------------
// NOTE: this is deliberately NOT @vesper/shared's DailyPlanSchema — that schema
// is the synthesis-OUTPUT shape (HH:MM times, no id/status). This is the GET
// response contract from TECHNICAL_SPEC §9.

export type EffectiveBlockStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'rescheduled';

export interface PlanBlock {
  id: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  blockType:
    | 'work'
    | 'fitness'
    | 'nutrition'
    | 'sleep'
    | 'errands'
    | 'medication'
    | 'finance'
    | 'focus'
    | 'commute'
    | 'custom';
  title: string;
  status: EffectiveBlockStatus;
  source: 'ai_generated' | 'user_added' | 'google_calendar' | 'recurring';
  displayOrder: number;
  details: Record<string, unknown>;
}

export interface PlanResponse {
  plan: {
    id: string;
    planDate: string; // YYYY-MM-DD
    generatedAt: string; // ISO 8601
    energyScore: number | null;
    regenerationCount: number;
    blocks: PlanBlock[];
  };
}

// Raw rows as read from Postgres (timestamptz → Date via drizzle).
interface PlanRow {
  id: string;
  planDate: string;
  generatedAt: Date;
  energyScore: number | null;
  regenerationCount: number;
}

interface BlockRow {
  id: string;
  startTime: Date;
  endTime: Date;
  blockType: PlanBlock['blockType'];
  title: string;
  status: PlanBlock['status'];
  source: PlanBlock['source'];
  displayOrder: number;
  details: unknown;
}

/**
 * User-scoped read of the daily_plans row for (userId, planDate) and its blocks.
 * Both selects emit `eq(table.userId, userId)`, satisfying the
 * withUser/UserScopedQuery compile-time scoping contract. Blocks are ordered by
 * display_order (the §9 / client render order).
 */
const readPlanQuery: UserScopedQuery<
  [planDate: string],
  { planRow: PlanRow | undefined; blockRows: BlockRow[] }
> = (userId, planDate) => async (db) => {
  const planRows = await db
    .select({
      id: dailyPlans.id,
      planDate: dailyPlans.planDate,
      generatedAt: dailyPlans.generatedAt,
      energyScore: dailyPlans.energyScore,
      regenerationCount: dailyPlans.regenerationCount,
    })
    .from(dailyPlans)
    .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.planDate, planDate)))
    .limit(1);

  const planRow = planRows[0];
  if (!planRow) {
    return { planRow: undefined, blockRows: [] };
  }

  const blockRows = await db
    .select({
      id: blocks.id,
      startTime: blocks.startTime,
      endTime: blocks.endTime,
      blockType: blocks.blockType,
      title: blocks.title,
      status: blocks.status,
      source: blocks.source,
      displayOrder: blocks.displayOrder,
      details: blocks.details,
    })
    .from(blocks)
    .where(and(eq(blocks.userId, userId), eq(blocks.dailyPlanId, planRow.id)))
    .orderBy(blocks.displayOrder);

  return { planRow, blockRows };
};

function toPlanResponse(planRow: PlanRow, blockRows: BlockRow[], now: Date): PlanResponse {
  return {
    plan: {
      id: planRow.id,
      planDate: planRow.planDate,
      generatedAt: planRow.generatedAt.toISOString(),
      energyScore: planRow.energyScore,
      regenerationCount: planRow.regenerationCount,
      blocks: blockRows.map((b) => ({
        id: b.id,
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        blockType: b.blockType,
        title: b.title,
        status: computeEffectiveStatus(
          b.status,
          b.startTime,
          b.endTime,
          now,
        ) as EffectiveBlockStatus,
        source: b.source,
        displayOrder: b.displayOrder,
        details: (b.details ?? {}) as Record<string, unknown>,
      })),
    },
  };
}

/**
 * Fetch the authenticated user's plan for `planDate` ("YYYY-MM-DD"), serialized
 * to the §9 GET shape. Throws PLAN_NOT_FOUND (404) when no plan exists for that
 * (user, date). `now` is injectable for deterministic effective_status tests.
 */
export async function getPlanForDate(
  db: Database,
  userId: string,
  planDate: string,
  now: Date = new Date(),
): Promise<PlanResponse> {
  const { planRow, blockRows } = await withUser(db, userId, readPlanQuery, planDate);
  if (!planRow) {
    throw new ApiError(ErrorCode.PLAN_NOT_FOUND, `No plan found for ${planDate}.`);
  }
  return toPlanResponse(planRow, blockRows, now);
}

// --- [date] param validation (chat-024 convention) --------------------------
// Strict YYYY-MM-DD: format AND real calendar date (rejects 2026-13-40, 2026-02-30).

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export function isValidPlanDate(value: string): boolean {
  if (!DATE_FORMAT.test(value)) return false;
  // Round-trip through UTC to confirm the calendar date is real (no overflow).
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}
