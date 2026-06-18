// Block-mutation DB-layer core logic (§9), shared by:
//   PATCH /api/v1/blocks/[blockId]  -> patchBlock
//   POST  /api/v1/blocks            -> createUserBlock
//
// Next.js App Router route files may export ONLY HTTP-method handlers + segment
// config, so the pure functions live in this plain sibling module. The route
// handlers import them; the integration tests drive them directly against the
// chat-002 local-Supabase test DB without standing up Supabase Auth (chat-026
// precedent).
//
// OPTIMISTIC CONCURRENCY (OCC): every mutation carries `planUpdatedAt` — the
// daily_plans.updated_at the client last observed. We lock the plan row
// (SELECT ... FOR UPDATE) and compare. A mismatch means another device mutated
// the plan; we reject with 409 OPTIMISTIC_LOCK_FAILURE. The conflict signal is
// PLAN-LEVEL (not block-level) because the parent-touch trigger
// (migration 0004, trg_blocks_touch_daily_plan) bumps daily_plans.updated_at on
// ANY block insert/update/delete — so one timestamp guards the whole plan.
//
// Comparison is at MILLISECOND resolution (Date.getTime()): the token the client
// holds is a toISOString() value (ms) while Postgres now() is microsecond, so an
// exact `::timestamptz` equality would spuriously fail. Drizzle/postgres-js
// returns timestamptz as a ms-resolution JS Date, matching the client token.
//
// completion_log column skew: the applied migration 20260601000010 has
// (user_id, block_id, event_type, value, logged_at). The ORM model analytics.ts
// is STALE (event_name/occurred_at) and is NOT used here — we INSERT via raw
// parameterized SQL against the real columns (write-side analog of withUser,
// scoped by explicit user_id). Durable fix: chat-006 drizzle-kit pull.
import { z } from 'zod';
import { sql, type Database } from '@vesper/db';
import { ApiError, ErrorCode } from '@vesper/shared';
import { computeEffectiveStatus } from '@/lib/blocks/effectiveStatus';

// --- Response contract (camelCase) ------------------------------------------

export interface BlockResponseBlock {
  id: string;
  dailyPlanId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  blockType: string;
  title: string;
  status: string; // EFFECTIVE status (computeEffectiveStatus applied)
  source: string;
  displayOrder: number;
  details: Record<string, unknown>;
  clientMutationId: string | null;
}

export interface BlockResponse {
  block: BlockResponseBlock;
  /** Fresh daily_plans.updated_at after this mutation — the next OCC token. */
  planUpdatedAt: string; // ISO 8601
}

// Raw row as read from Postgres via `tx.execute(sql...)` (snake_case columns).
interface RawBlockRow {
  id: string;
  daily_plan_id: string;
  start_time: Date;
  end_time: Date;
  block_type: string;
  title: string;
  status: string;
  source: string;
  display_order: number;
  details: unknown;
  client_mutation_id: string | null;
}

// Columns every block read/RETURNING selects (keep in one place).
const BLOCK_COLUMNS = sql`
  id, daily_plan_id, start_time, end_time, block_type, title, status,
  source, display_order, details, client_mutation_id
`;

function serializeBlock(row: RawBlockRow, planUpdatedAt: Date, now: Date): BlockResponse {
  return {
    block: {
      id: row.id,
      dailyPlanId: row.daily_plan_id,
      startTime: row.start_time.toISOString(),
      endTime: row.end_time.toISOString(),
      blockType: row.block_type,
      title: row.title,
      status: computeEffectiveStatus(row.status, row.start_time, row.end_time, now),
      source: row.source,
      displayOrder: row.display_order,
      details: (row.details ?? {}) as Record<string, unknown>,
      clientMutationId: row.client_mutation_id,
    },
    planUpdatedAt: planUpdatedAt.toISOString(),
  };
}

// --- Validation schemas ------------------------------------------------------

const ISO_DATETIME = { offset: true } as const;

export const PatchBlockSchema = z
  .object({
    status: z.enum(['completed', 'skipped', 'rescheduled', 'scheduled']).optional(),
    startTime: z.string().datetime(ISO_DATETIME).optional(),
    endTime: z.string().datetime(ISO_DATETIME).optional(),
    displayOrder: z.number().int().optional(),
    planUpdatedAt: z.string().datetime(ISO_DATETIME), // REQUIRED — OCC token
    clientMutationId: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.status !== undefined ||
      d.startTime !== undefined ||
      d.endTime !== undefined ||
      d.displayOrder !== undefined,
    { message: 'At least one of status, startTime, endTime, displayOrder is required' },
  )
  .refine((d) => (d.startTime === undefined) === (d.endTime === undefined), {
    message: 'startTime and endTime must be provided together',
  })
  .refine(
    (d) =>
      d.startTime === undefined ||
      d.endTime === undefined ||
      new Date(d.endTime).getTime() > new Date(d.startTime).getTime(),
    { message: 'endTime must be after startTime' },
  );

export type PatchBlockInput = z.infer<typeof PatchBlockSchema>;

const BLOCK_TYPES = [
  'work',
  'fitness',
  'nutrition',
  'sleep',
  'errands',
  'medication',
  'finance',
  'focus',
  'commute',
  'custom',
] as const;

export const PostBlockSchema = z
  .object({
    planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    startTime: z.string().datetime(ISO_DATETIME),
    endTime: z.string().datetime(ISO_DATETIME),
    blockType: z.enum(BLOCK_TYPES),
    title: z.string().min(1),
    details: z.record(z.unknown()).optional().default({}),
    clientMutationId: z.string().uuid().optional(),
    planUpdatedAt: z.string().datetime(ISO_DATETIME), // OCC token required here too
  })
  .strict()
  .refine((d) => new Date(d.endTime).getTime() > new Date(d.startTime).getTime(), {
    message: 'endTime must be after startTime',
  });

export type PostBlockInput = z.infer<typeof PostBlockSchema>;

/**
 * Idempotent-replay lookup: a block already carrying (user_id, client_mutation_id).
 * Runs OUTSIDE any transaction and BEFORE the OCC check so a retry that arrives
 * after the plan's updated_at advanced returns the idempotent result rather than
 * a spurious 409. Returns null when no prior mutation matches.
 */
async function findByClientMutationId(
  db: Database,
  userId: string,
  clientMutationId: string,
  now: Date,
): Promise<BlockResponse | null> {
  const rows = (await db.execute(sql`
    SELECT ${BLOCK_COLUMNS},
           (SELECT updated_at FROM daily_plans dp WHERE dp.id = b.daily_plan_id) AS plan_updated_at
    FROM blocks b
    WHERE b.user_id = ${userId}::uuid
      AND b.client_mutation_id = ${clientMutationId}::uuid
    LIMIT 1
  `)) as unknown as Array<RawBlockRow & { plan_updated_at: Date }>;
  const row = rows[0];
  return row ? serializeBlock(row, row.plan_updated_at, now) : null;
}

// completion_log event_type per status (only these three statuses log).
const STATUS_EVENT: Record<string, string | undefined> = {
  completed: 'block_completed',
  skipped: 'block_skipped',
  rescheduled: 'block_rescheduled',
};

// --- PATCH /blocks/[blockId] -------------------------------------------------

/**
 * Mutate one block (status/times/displayOrder) under a plan-level OCC check.
 * Throws {@link ApiError}: 400 (validation), 404 (block not found / not owned),
 * 409 (OPTIMISTIC_LOCK_FAILURE). Idempotent on clientMutationId: if a block with
 * that (user_id, client_mutation_id) already exists, returns it unchanged.
 */
export async function patchBlock(
  db: Database,
  userId: string,
  blockId: unknown,
  rawBody: unknown,
  now: Date = new Date(),
): Promise<BlockResponse> {
  if (typeof blockId !== 'string' || !z.string().uuid().safeParse(blockId).success) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Block not found.');
  }

  const parsed = PatchBlockSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;
  const tokenMs = new Date(input.planUpdatedAt).getTime();

  // Idempotent replay short-circuit — BEFORE the transaction and BEFORE the OCC
  // check (a retry after updated_at advanced must return 200, not 409).
  if (input.clientMutationId !== undefined) {
    const replay = await findByClientMutationId(db, userId, input.clientMutationId, now);
    if (replay) return replay;
  }

  return db.transaction(async (tx) => {
    // Target block (user-scoped). Not found / not owned -> 404.
    const blockRows = (await tx.execute(sql`
      SELECT ${BLOCK_COLUMNS}
      FROM blocks b
      WHERE b.id = ${blockId}::uuid AND b.user_id = ${userId}::uuid
      LIMIT 1
    `)) as unknown as RawBlockRow[];
    const block = blockRows[0];
    if (!block) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Block not found.');
    }

    // Lock the parent plan row and read its OCC timestamp + plan_date.
    const planRows = (await tx.execute(sql`
      SELECT updated_at, plan_date
      FROM daily_plans
      WHERE id = ${block.daily_plan_id}::uuid AND user_id = ${userId}::uuid
      FOR UPDATE
    `)) as unknown as Array<{ updated_at: Date; plan_date: string }>;
    const plan = planRows[0];
    if (!plan) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Block not found.');
    }

    // OCC check (millisecond resolution).
    if (plan.updated_at.getTime() !== tokenMs) {
      throw new ApiError(
        ErrorCode.OPTIMISTIC_LOCK_FAILURE,
        'Plan was modified by another device. Please refresh.',
      );
    }

    // Build the dynamic SET list from provided fields only.
    const sets: ReturnType<typeof sql>[] = [];
    if (input.status !== undefined) {
      sets.push(sql`status = ${input.status}::block_status_enum`);
    }
    if (input.startTime !== undefined) {
      sets.push(sql`start_time = ${input.startTime}::timestamptz`);
    }
    if (input.endTime !== undefined) {
      sets.push(sql`end_time = ${input.endTime}::timestamptz`);
    }
    if (input.displayOrder !== undefined) {
      sets.push(sql`display_order = ${input.displayOrder}`);
    }
    if (input.clientMutationId !== undefined) {
      sets.push(sql`client_mutation_id = ${input.clientMutationId}::uuid`);
    }
    sets.push(sql`updated_at = now()`);

    const updatedRows = (await tx.execute(sql`
      UPDATE blocks
      SET ${sql.join(sets, sql`, `)}
      WHERE id = ${blockId}::uuid AND user_id = ${userId}::uuid
      RETURNING ${BLOCK_COLUMNS}
    `)) as unknown as RawBlockRow[];
    const updated = updatedRows[0];
    if (!updated) {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Block not found.');
    }

    // completion_log (raw SQL, real columns) for terminal status transitions.
    const eventType = input.status ? STATUS_EVENT[input.status] : undefined;
    if (eventType) {
      const valueJson = JSON.stringify({
        block_type: updated.block_type,
        title: updated.title,
        start_time: updated.start_time.toISOString(),
        end_time: updated.end_time.toISOString(),
        plan_date: plan.plan_date,
      });
      await tx.execute(sql`
        INSERT INTO completion_log (user_id, block_id, event_type, value)
        VALUES (
          ${userId}::uuid,
          ${updated.id}::uuid,
          ${eventType}::completion_event_enum,
          ${valueJson}::jsonb
        )
      `);
    }

    // Re-read the plan's (now trigger-bumped) updated_at -> fresh OCC token.
    const freshRows = (await tx.execute(sql`
      SELECT updated_at FROM daily_plans WHERE id = ${block.daily_plan_id}::uuid
    `)) as unknown as Array<{ updated_at: Date }>;
    const planUpdatedAt = freshRows[0]?.updated_at ?? plan.updated_at;

    return serializeBlock(updated, planUpdatedAt, now);
  });
}

// --- POST /blocks ------------------------------------------------------------

export interface CreateBlockResult {
  response: BlockResponse;
  /** false when an idempotent replay returned the existing block (HTTP 200). */
  created: boolean;
}

/**
 * Create a user-added block under an existing plan, with a plan-level OCC check.
 * Throws {@link ApiError}: 400 (validation; PLAN_NOT_FOUND when no plan exists
 * for the date), 409 (OPTIMISTIC_LOCK_FAILURE). Idempotent on clientMutationId.
 */
export async function createUserBlock(
  db: Database,
  userId: string,
  rawBody: unknown,
  now: Date = new Date(),
): Promise<CreateBlockResult> {
  const parsed = PostBlockSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;
  const tokenMs = new Date(input.planUpdatedAt).getTime();

  // Idempotent replay short-circuit — BEFORE the transaction and BEFORE the OCC
  // check (a retry after updated_at advanced must return 200, not 409).
  if (input.clientMutationId !== undefined) {
    const replay = await findByClientMutationId(db, userId, input.clientMutationId, now);
    if (replay) return { response: replay, created: false };
  }

  return db.transaction(async (tx) => {
    // Find + lock the plan for (user, date). No plan -> 400 PLAN_NOT_FOUND.
    const planRows = (await tx.execute(sql`
      SELECT id, updated_at
      FROM daily_plans
      WHERE user_id = ${userId}::uuid AND plan_date = ${input.planDate}::date
      FOR UPDATE
    `)) as unknown as Array<{ id: string; updated_at: Date }>;
    const plan = planRows[0];
    if (!plan) {
      throw new ApiError(
        ErrorCode.PLAN_NOT_FOUND,
        'Plan must be generated before adding blocks.',
        400,
      );
    }

    // OCC check (millisecond resolution).
    if (plan.updated_at.getTime() !== tokenMs) {
      throw new ApiError(
        ErrorCode.OPTIMISTIC_LOCK_FAILURE,
        'Plan was modified by another device. Please refresh.',
      );
    }

    const detailsJson = JSON.stringify(input.details ?? {});
    const cmid = input.clientMutationId ?? null;

    const insertedRows = (await tx.execute(sql`
      INSERT INTO blocks (
        daily_plan_id, user_id, start_time, end_time, block_type, title,
        status, details, source, display_order, client_mutation_id
      )
      VALUES (
        ${plan.id}::uuid,
        ${userId}::uuid,
        ${input.startTime}::timestamptz,
        ${input.endTime}::timestamptz,
        ${input.blockType}::block_type_enum,
        ${input.title},
        'scheduled'::block_status_enum,
        ${detailsJson}::jsonb,
        'user_added'::block_source_enum,
        0,
        ${cmid}::uuid
      )
      RETURNING ${BLOCK_COLUMNS}
    `)) as unknown as RawBlockRow[];
    const inserted = insertedRows[0];
    if (!inserted) {
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Block insert returned no row.');
    }

    // The INSERT fired the parent-touch trigger; re-read the fresh OCC token.
    const freshRows = (await tx.execute(sql`
      SELECT updated_at FROM daily_plans WHERE id = ${plan.id}::uuid
    `)) as unknown as Array<{ updated_at: Date }>;
    const planUpdatedAt = freshRows[0]?.updated_at ?? plan.updated_at;

    return { response: serializeBlock(inserted, planUpdatedAt, now), created: true };
  });
}
