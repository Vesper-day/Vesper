// @vitest-environment node
//
// Tests for the batch block-reorder endpoint (POST /plans/date/[date]/reorder).
//
// Two suites:
//   * "Reorder validation (pure)" — ungated Zod assertions (no DB).
//   * "Reorder API (integration)" — gated on VESPER_DB_TESTS; drives reorderBlocks
//     directly against the chat-002 local-Supabase test DB so it asserts the real
//     plan-level OCC: a correct token commits ALL displayOrder updates (200); a
//     stale token returns a single 409 and changes NO rows (full rollback).
//
// To run the integration suite:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/web test -- reorder.integration
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  createDrizzleClient,
  dailyPlans,
  blocks,
  sql,
  eq,
  and,
  type Database,
} from '@vesper/db';
import { ApiError } from '@vesper/shared';
import { reorderBlocks } from './operations';
import { ReorderRequestSchema } from './schemas';

const DATE = '2026-06-01';

// --- Pure validation suite (ungated, no DB) ----------------------------------

describe('Reorder validation (pure)', () => {
  it('requires a non-empty blocks array of {uuid id, int displayOrder} + planUpdatedAt', () => {
    const ok = {
      blocks: [{ id: '11111111-1111-1111-1111-111111111111', displayOrder: 0 }],
      planUpdatedAt: '2026-06-01T09:00:00.000Z',
    };
    expect(ReorderRequestSchema.safeParse(ok).success).toBe(true);
    expect(
      ReorderRequestSchema.safeParse({ ...ok, blocks: [] }).success,
    ).toBe(false); // empty array
    expect(
      ReorderRequestSchema.safeParse({
        blocks: [{ id: 'not-a-uuid', displayOrder: 0 }],
        planUpdatedAt: ok.planUpdatedAt,
      }).success,
    ).toBe(false); // bad id
    expect(
      ReorderRequestSchema.safeParse({
        blocks: [{ id: ok.blocks[0]!.id, displayOrder: 1.5 }],
        planUpdatedAt: ok.planUpdatedAt,
      }).success,
    ).toBe(false); // non-int order
    expect(ReorderRequestSchema.safeParse({ blocks: ok.blocks }).success).toBe(false); // no token
    expect(
      ReorderRequestSchema.safeParse({ ...ok, nope: 1 }).success,
    ).toBe(false); // strict
  });
});

// --- Integration suite (gated on VESPER_DB_TESTS) ----------------------------

const TEST_DB_URL =
  process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Reorder API (integration)', () => {
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
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`ro-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  // Seed a plan + two blocks (displayOrder 0, 1). Returns the plan id, its current
  // OCC token (updated_at as an ISO string), and the two block ids.
  async function seedPlanWithBlocks(userId: string): Promise<{
    planId: string;
    token: string;
    blockA: string;
    blockB: string;
  }> {
    const [plan] = await db
      .insert(dailyPlans)
      .values({ userId, planDate: DATE })
      .returning({ id: dailyPlans.id, updatedAt: dailyPlans.updatedAt });

    const seedBlock = async (title: string, order: number): Promise<string> => {
      const [b] = await db
        .insert(blocks)
        .values({
          dailyPlanId: plan!.id,
          userId,
          startTime: new Date('2026-06-01T09:00:00Z'),
          endTime: new Date('2026-06-01T10:00:00Z'),
          blockType: 'work',
          title,
          source: 'ai_generated',
          displayOrder: order,
        })
        .returning({ id: blocks.id });
      return b!.id;
    };

    const blockA = await seedBlock('A', 0);
    const blockB = await seedBlock('B', 1);
    // Re-read the plan's updated_at: the block inserts fired the parent-touch
    // trigger, so the live token is newer than the one returned at plan insert.
    const [fresh] = await db
      .select({ updatedAt: dailyPlans.updatedAt })
      .from(dailyPlans)
      .where(eq(dailyPlans.id, plan!.id))
      .limit(1);
    return {
      planId: plan!.id,
      token: fresh!.updatedAt.toISOString(),
      blockA,
      blockB,
    };
  }

  async function orderOf(blockId: string): Promise<number> {
    const [row] = await db
      .select({ displayOrder: blocks.displayOrder })
      .from(blocks)
      .where(eq(blocks.id, blockId))
      .limit(1);
    return row!.displayOrder;
  }

  it('correct token commits ALL displayOrder updates (200) and returns a fresh token', async () => {
    const userId = await seedUser();
    const { token, blockA, blockB } = await seedPlanWithBlocks(userId);

    const res = await reorderBlocks(db, userId, DATE, {
      blocks: [
        { id: blockA, displayOrder: 1 },
        { id: blockB, displayOrder: 0 },
      ],
      planUpdatedAt: token,
    });

    expect(res.blocks).toEqual([
      { id: blockA, displayOrder: 1 },
      { id: blockB, displayOrder: 0 },
    ]);
    expect(typeof res.planUpdatedAt).toBe('string');
    expect(await orderOf(blockA)).toBe(1);
    expect(await orderOf(blockB)).toBe(0);
  });

  it('stale token returns a single 409 and changes NO rows (full rollback)', async () => {
    const userId = await seedUser();
    const { blockA, blockB } = await seedPlanWithBlocks(userId);

    const err = (await reorderBlocks(db, userId, DATE, {
      blocks: [
        { id: blockA, displayOrder: 9 },
        { id: blockB, displayOrder: 8 },
      ],
      planUpdatedAt: '2020-01-01T00:00:00.000Z', // stale
    }).catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('OPTIMISTIC_LOCK_FAILURE');
    expect(err.httpStatus).toBe(409);
    // No partial write: both blocks keep their seeded order.
    expect(await orderOf(blockA)).toBe(0);
    expect(await orderOf(blockB)).toBe(1);
  });

  it('returns 404 PLAN_NOT_FOUND when no plan exists for the date', async () => {
    const userId = await seedUser();
    const err = (await reorderBlocks(db, userId, DATE, {
      blocks: [{ id: '11111111-1111-1111-1111-111111111111', displayOrder: 0 }],
      planUpdatedAt: '2026-06-01T09:00:00.000Z',
    }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('PLAN_NOT_FOUND');
    expect(err.httpStatus).toBe(404);
  });
});
