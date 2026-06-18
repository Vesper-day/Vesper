// @vitest-environment node
//
// Integration tests for the Block mutation API group (PATCH /blocks/[blockId],
// POST /blocks), driven against the chat-002 local-Supabase test DB (Docker,
// direct connection 54322). They exercise the exported DB-layer functions
// patchBlock / createUserBlock directly so they assert real Postgres behaviour
// (the user-scoped lock, the plan-level OCC check via the parent-touch trigger,
// completion_log writes) without standing up Supabase Auth.
//
// This file imports ONLY @vesper/db + @vesper/shared + ./operations — no
// rate-limiting / Upstash — so it runs without UPSTASH_* env. It still needs a
// local Supabase, so it is gated on VESPER_DB_TESTS to keep the default
// `pnpm test` / CI run (no DB) green. To run:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/web test -- blocks.integration
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  createDrizzleClient,
  dailyPlans,
  blocks,
  sql,
  type Database,
} from '@vesper/db';
import { ApiError } from '@vesper/shared';
import { patchBlock, createUserBlock } from './operations';

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

const PLAN_DATE = '2026-06-15';

describeDb('Blocks API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // Deleting auth.users cascades to public.users -> daily_plans -> blocks.
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`blocks-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  async function seedPlanWithBlock(
    userId: string,
  ): Promise<{ planId: string; blockId: string }> {
    const [plan] = await db
      .insert(dailyPlans)
      .values({ userId, planDate: PLAN_DATE, energyScore: 7, regenerationCount: 0 })
      .returning({ id: dailyPlans.id });
    const planId = plan!.id;

    const [block] = await db
      .insert(blocks)
      .values({
        dailyPlanId: planId,
        userId,
        startTime: new Date('2026-06-15T09:00:00.000Z'),
        endTime: new Date('2026-06-15T10:00:00.000Z'),
        blockType: 'work',
        title: 'Deep work',
        status: 'scheduled',
        source: 'ai_generated',
        displayOrder: 0,
        details: {},
      })
      .returning({ id: blocks.id });

    return { planId, blockId: block!.id };
  }

  // The OCC token = daily_plans.updated_at AFTER the block seed (the seed insert
  // fires the parent-touch trigger, so read it last). Raw `execute` returns
  // timestamptz as a STRING (drizzle's postgres-js raw path skips the Date
  // parser), so project epoch-ms and rebuild the Date — same approach as the
  // operations module under test.
  async function planToken(planId: string): Promise<string> {
    const rows = (await db.execute(
      sql`SELECT (extract(epoch from updated_at) * 1000)::bigint AS updated_ms
          FROM daily_plans WHERE id = ${planId}::uuid`,
    )) as unknown as Array<{ updated_ms: string }>;
    return new Date(Number(rows[0]!.updated_ms)).toISOString();
  }

  // 1 — PATCH status update succeeds and logs a block_completed event.
  it('PATCH status=completed returns the block and writes completion_log', async () => {
    const userId = await seedUser();
    const { planId, blockId } = await seedPlanWithBlock(userId);
    const token = await planToken(planId);

    const res = await patchBlock(db, userId, blockId, {
      status: 'completed',
      planUpdatedAt: token,
    });

    expect(res.block.id).toBe(blockId);
    expect(res.block.status).toBe('completed');
    expect(res.block.source).toBe('ai_generated');
    // The mutation bumped the plan's updated_at -> a fresh, different token.
    expect(res.planUpdatedAt).not.toBe(token);

    const logRows = (await db.execute(sql`
      SELECT event_type, value FROM completion_log
      WHERE user_id = ${userId}::uuid AND block_id = ${blockId}::uuid
    `)) as unknown as Array<{ event_type: string; value: Record<string, unknown> }>;
    expect(logRows).toHaveLength(1);
    expect(logRows[0]!.event_type).toBe('block_completed');
    expect(logRows[0]!.value.plan_date).toBe(PLAN_DATE);
    expect(logRows[0]!.value.title).toBe('Deep work');
  });

  // 2 — PATCH with a stale OCC token -> 409 OPTIMISTIC_LOCK_FAILURE. (REQUIRED)
  it('PATCH with a stale planUpdatedAt returns 409 OPTIMISTIC_LOCK_FAILURE', async () => {
    const userId = await seedUser();
    const { blockId } = await seedPlanWithBlock(userId);
    const stale = new Date('2000-01-01T00:00:00.000Z').toISOString();

    const err = (await patchBlock(db, userId, blockId, {
      status: 'completed',
      planUpdatedAt: stale,
    }).catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('OPTIMISTIC_LOCK_FAILURE');
    expect(err.httpStatus).toBe(409);
  });

  // 3 — PATCH missing the required planUpdatedAt -> 400.
  it('PATCH without planUpdatedAt returns 400 INVALID_REQUEST', async () => {
    const userId = await seedUser();
    const { blockId } = await seedPlanWithBlock(userId);

    const err = (await patchBlock(db, userId, blockId, {
      status: 'completed',
    }).catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('INVALID_REQUEST');
    expect(err.httpStatus).toBe(400);
  });

  // 4 — PATCH a block owned by another user -> 404.
  it('PATCH a block not owned by the auth user returns 404', async () => {
    const ownerId = await seedUser();
    const otherId = await seedUser();
    const { planId, blockId } = await seedPlanWithBlock(ownerId);
    const token = await planToken(planId);

    const err = (await patchBlock(db, otherId, blockId, {
      status: 'completed',
      planUpdatedAt: token,
    }).catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });

  // 5 — POST creates a user-added block (201 semantics).
  it('POST creates a user_added block and reports created=true', async () => {
    const userId = await seedUser();
    const { planId } = await seedPlanWithBlock(userId);
    const token = await planToken(planId);

    const { response, created } = await createUserBlock(db, userId, {
      planDate: PLAN_DATE,
      startTime: '2026-06-15T14:00:00.000Z',
      endTime: '2026-06-15T15:00:00.000Z',
      blockType: 'errands',
      title: 'Grocery run',
      planUpdatedAt: token,
    });

    expect(created).toBe(true);
    expect(response.block.source).toBe('user_added');
    expect(response.block.blockType).toBe('errands');
    expect(response.block.title).toBe('Grocery run');
    expect(response.block.displayOrder).toBe(0);
  });

  // 6 — POST when no plan exists for the date -> 400 PLAN_NOT_FOUND.
  it('POST returns 400 PLAN_NOT_FOUND when no plan exists for the date', async () => {
    const userId = await seedUser();
    const token = new Date().toISOString();

    const err = (await createUserBlock(db, userId, {
      planDate: '2026-01-01',
      startTime: '2026-01-01T14:00:00.000Z',
      endTime: '2026-01-01T15:00:00.000Z',
      blockType: 'work',
      title: 'Orphan block',
      planUpdatedAt: token,
    }).catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('PLAN_NOT_FOUND');
    expect(err.httpStatus).toBe(400);
  });

  // 7 — POST with a stale OCC token -> 409 OPTIMISTIC_LOCK_FAILURE.
  it('POST with a stale planUpdatedAt returns 409 OPTIMISTIC_LOCK_FAILURE', async () => {
    const userId = await seedUser();
    await seedPlanWithBlock(userId);
    const stale = new Date('2000-01-01T00:00:00.000Z').toISOString();

    const err = (await createUserBlock(db, userId, {
      planDate: PLAN_DATE,
      startTime: '2026-06-15T14:00:00.000Z',
      endTime: '2026-06-15T15:00:00.000Z',
      blockType: 'work',
      title: 'Conflicting block',
      planUpdatedAt: stale,
    }).catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('OPTIMISTIC_LOCK_FAILURE');
    expect(err.httpStatus).toBe(409);
  });
});
