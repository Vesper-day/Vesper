// @vitest-environment node
//
// Integration tests for the Plan retrieval API group (GET /plans/today,
// GET /plans/date/[date]), driven against the chat-002 local-Supabase test DB
// (Docker, direct connection 54322). They exercise the exported DB-layer function
// getPlanForDate directly so they assert real Postgres behaviour (the user-scoped
// join, display_order ordering, effective_status derivation) without standing up
// Supabase Auth.
//
// Gated on VESPER_DB_TESTS so the default `pnpm test` / CI run (no local Supabase)
// stays green. To run:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/web test
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  createDrizzleClient,
  dailyPlans,
  blocks,
  sql,
  type Database,
} from '@vesper/db';
import { ApiError } from '@vesper/shared';
import { getPlanForDate, isValidPlanDate } from './operations';

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

const PLAN_DATE = '2026-06-15';

describeDb('Plans API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // Deleting the auth.users row cascades to public.users → daily_plans → blocks.
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  // Seed via auth.users so the on_auth_user_created trigger creates the matching
  // public.users row (daily_plans.user_id / blocks.user_id FK to it).
  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`plans-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  // Seed one plan on PLAN_DATE with two blocks deliberately inserted in REVERSE
  // display_order, so the query's orderBy(display_order) is actually exercised.
  //   block @ display_order 0 : 09:00–10:00Z, scheduled  (the "now in window" one)
  //   block @ display_order 1 : 11:00–12:00Z, scheduled
  async function seedPlanWithBlocks(userId: string): Promise<string> {
    const [plan] = await db
      .insert(dailyPlans)
      .values({
        userId,
        planDate: PLAN_DATE,
        energyScore: 7,
        regenerationCount: 0,
      })
      .returning({ id: dailyPlans.id });

    const planId = plan!.id;

    await db.insert(blocks).values([
      {
        dailyPlanId: planId,
        userId,
        startTime: new Date('2026-06-15T11:00:00.000Z'),
        endTime: new Date('2026-06-15T12:00:00.000Z'),
        blockType: 'work',
        title: 'Deep work',
        status: 'scheduled',
        source: 'ai_generated',
        displayOrder: 1,
        details: { blockType: 'work' },
      },
      {
        dailyPlanId: planId,
        userId,
        startTime: new Date('2026-06-15T09:00:00.000Z'),
        endTime: new Date('2026-06-15T10:00:00.000Z'),
        blockType: 'fitness',
        title: 'Morning gym session',
        status: 'scheduled',
        source: 'ai_generated',
        displayOrder: 0,
        details: { blockType: 'fitness' },
      },
    ]);

    return planId;
  }

  it('GET today/date returns the full §9 shape, ordered by display_order', async () => {
    const id = await seedUser();
    const planId = await seedPlanWithBlocks(id);

    // now = 09:30Z → inside the first block's window, outside the second's.
    const now = new Date('2026-06-15T09:30:00.000Z');
    const res = await getPlanForDate(db, id, PLAN_DATE, now);

    expect(res.plan.id).toBe(planId);
    expect(res.plan.planDate).toBe(PLAN_DATE);
    expect(res.plan.energyScore).toBe(7);
    expect(res.plan.regenerationCount).toBe(0);
    expect(typeof res.plan.generatedAt).toBe('string');

    expect(res.plan.blocks).toHaveLength(2);

    // Ordered by display_order (0 before 1), despite reverse insertion order.
    const [first, second] = res.plan.blocks;
    expect(first!.displayOrder).toBe(0);
    expect(first!.title).toBe('Morning gym session');
    expect(first!.startTime).toBe('2026-06-15T09:00:00.000Z');
    expect(first!.blockType).toBe('fitness');
    expect(first!.source).toBe('ai_generated');
    // effective_status: scheduled + now in [start,end) → derived in_progress.
    expect(first!.status).toBe('in_progress');

    expect(second!.displayOrder).toBe(1);
    // now is before this block's window → stays scheduled.
    expect(second!.status).toBe('scheduled');
  });

  it('GET 404s (PLAN_NOT_FOUND) when no plan exists for the date', async () => {
    const id = await seedUser();
    // No plan seeded for this user/date.
    await expect(getPlanForDate(db, id, '2026-01-01')).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(getPlanForDate(db, id, '2026-01-01')).rejects.toThrow(
      /No plan found/,
    );
  });
});

// Pure validation (no DB): the [date] route param accepts strict, real
// YYYY-MM-DD dates and rejects everything else (→ 400 in the handler).
describe('isValidPlanDate', () => {
  it('accepts a real YYYY-MM-DD date', () => {
    expect(isValidPlanDate('2026-06-15')).toBe(true);
    expect(isValidPlanDate('2026-02-28')).toBe(true);
  });

  it('rejects malformed or out-of-range dates', () => {
    expect(isValidPlanDate('2026-6-15')).toBe(false); // not zero-padded
    expect(isValidPlanDate('06-15-2026')).toBe(false); // wrong order
    expect(isValidPlanDate('2026-13-01')).toBe(false); // month overflow
    expect(isValidPlanDate('2026-02-30')).toBe(false); // day overflow
    expect(isValidPlanDate('2026-06-15T00:00:00Z')).toBe(false); // has time
    expect(isValidPlanDate('not-a-date')).toBe(false);
    expect(isValidPlanDate('')).toBe(false);
  });
});
