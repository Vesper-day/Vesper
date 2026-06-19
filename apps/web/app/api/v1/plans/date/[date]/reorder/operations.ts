// Batch block-reorder core logic (build-plan Chat 029), extracted from route.ts.
//
// POST /api/v1/plans/date/[date]/reorder — apply a set of displayOrder updates to
// the blocks of one daily plan, ALL inside ONE transaction guarded by a
// PLAN-LEVEL optimistic-concurrency check at the top. A token mismatch rolls back
// the whole transaction and returns a single 409 (never partial success).
//
// OCC PROVENANCE (build-plan Chat 029): chat 027 (blocks/operations.ts) already
// implements a PLAN-LEVEL daily_plans.updated_at check (it locks the plan row
// FOR UPDATE and compares at millisecond resolution; the parent-touch trigger
// trg_blocks_touch_daily_plan means one plan timestamp guards every block). This
// reorder REUSES that exact plan-level OCC SEMANTICS but is an EXTENSION, not a
// literal code reuse: 027 exposes no shared OCC helper, and its functions
// (patchBlock/createUserBlock) are single-block. Here the same check is applied
// once, ahead of a BATCH of updates.
//
// STALE-MODEL CHECK (build-plan Chat 029): the `daily_plans` and `blocks` Drizzle
// models (daily-planning.ts) match §3 column-for-column, so this uses the Drizzle
// query builder. Unlike 027 — which projected updated_at as an epoch-ms bigint to
// dodge the raw-`execute` timestamptz-as-string parser gap — the ORM `.select()`
// path runs the Date parser, so `updatedAt` returns a JS Date and `.getTime()` is
// safe directly. Comparison stays at millisecond resolution (the client token is a
// toISOString() value) exactly as 027 documents.
import {
  dailyPlans,
  blocks,
  sql,
  eq,
  and,
  type Database,
} from '@vesper/db';
import { ApiError, ErrorCode } from '@vesper/shared';
import { ReorderRequestSchema, type ReorderResponse } from './schemas';

export async function reorderBlocks(
  db: Database,
  userId: string,
  planDate: string,
  rawBody: unknown,
): Promise<ReorderResponse> {
  const parsed = ReorderRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const { blocks: updates, planUpdatedAt } = parsed.data;
  const tokenMs = new Date(planUpdatedAt).getTime();

  return db.transaction(async (tx) => {
    // Lock the plan row for (user, date) and read its OCC timestamp. No plan -> 404.
    const planRows = await tx
      .select({ id: dailyPlans.id, updatedAt: dailyPlans.updatedAt })
      .from(dailyPlans)
      .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.planDate, planDate)))
      .for('update')
      .limit(1);
    const plan = planRows[0];
    if (!plan) {
      throw new ApiError(
        ErrorCode.PLAN_NOT_FOUND,
        'No plan exists for this date.',
        404,
      );
    }

    // OCC check AT THE TOP (millisecond resolution). Mismatch -> throw, which rolls
    // back the whole transaction: a single 409, never a partial reorder.
    if (plan.updatedAt.getTime() !== tokenMs) {
      throw new ApiError(
        ErrorCode.OPTIMISTIC_LOCK_FAILURE,
        'Plan was modified by another device. Please refresh.',
      );
    }

    // Apply every displayOrder update on existing, in-plan, user-owned rows only.
    // No inserts; no other columns written.
    for (const u of updates) {
      await tx
        .update(blocks)
        .set({ displayOrder: u.displayOrder })
        .where(
          and(
            eq(blocks.id, u.id),
            eq(blocks.userId, userId),
            eq(blocks.dailyPlanId, plan.id),
          ),
        );
    }

    // The block UPDATEs fired the parent-touch trigger; re-read the fresh OCC token.
    const freshRows = await tx
      .select({ updatedAt: dailyPlans.updatedAt })
      .from(dailyPlans)
      .where(eq(dailyPlans.id, plan.id))
      .limit(1);
    const planUpdatedAtOut = (freshRows[0]?.updatedAt ?? plan.updatedAt).toISOString();

    return {
      planUpdatedAt: planUpdatedAtOut,
      blocks: updates.map((u) => ({ id: u.id, displayOrder: u.displayOrder })),
    };
  });
}
