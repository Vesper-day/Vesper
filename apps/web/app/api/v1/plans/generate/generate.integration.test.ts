// @vitest-environment node
//
// Integration tests for POST /api/v1/plans/generate, driven against the chat-002
// local-Supabase test DB (and Upstash for the lock + active-cap paths). Drives
// the sibling helpers directly — commitPlan / planExists / the caps / the lock —
// without standing up Supabase Auth (mirrors energy.integration.test.ts).
//
// Gated on VESPER_DB_TESTS. The active-cap + concurrent-lock cases additionally
// need Upstash creds (UPSTASH_REDIS_REST_URL / _TOKEN); the runner sets those
// before the gated run. Pure cap/schema assertions live in generate.unit.test.ts.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  createDrizzleClient,
  blocks,
  sql,
  eq,
  type Database,
} from '@vesper/db';
import type { DailyPlan } from '@vesper/shared';
import { commitPlan, planExists } from './generatePlan';
import { checkTrialCap, checkActiveCap } from '../../../../../lib/regenerationLimits';
import { acquireLock, releaseLock } from '../../../../../lib/idempotency';

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

const TZ = 'America/New_York';
const PLAN_DATE = '2026-06-18';

// A complete plan with a normal block and a wrap-past-midnight sleep block.
const PLAN = {
  blocks: [
    {
      startTime: '09:00',
      endTime: '10:30',
      blockType: 'work',
      title: 'Focused work',
      details: { blockType: 'work' },
      source: 'ai_generated',
      displayOrder: 0,
    },
    {
      startTime: '22:30',
      endTime: '06:45',
      blockType: 'sleep',
      title: 'Sleep',
      details: { blockType: 'sleep' },
      source: 'ai_generated',
      displayOrder: 1,
    },
  ],
} as unknown as DailyPlan;

describeDb('Plan generation API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      await releaseLock(id, PLAN_DATE).catch(() => undefined);
      // Deleting auth.users cascades to public.users -> daily_plans/blocks/completion_log.
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`plan-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  async function countEvent(userId: string, eventType: string): Promise<number> {
    const rows = (await db.execute(sql`
      SELECT count(*)::int AS n FROM completion_log
      WHERE user_id = ${userId}::uuid AND event_type = ${eventType}::completion_event_enum
    `)) as unknown as Array<{ n: number }>;
    return rows[0]?.n ?? -1;
  }

  it('first generation: writes plan + blocks + a plan_generated completion_log row', async () => {
    const id = await seedUser();
    expect(await planExists(db, id, PLAN_DATE)).toBe(false);

    const r = await commitPlan(db, {
      userId: id,
      timezone: TZ,
      planDate: PLAN_DATE,
      energyScore: 7,
      plan: PLAN,
      isRegeneration: false,
      isFallback: false,
    });

    expect(r.eventType).toBe('plan_generated');
    expect(r.regenerationCount).toBe(0);
    expect(r.blockCount).toBe(2);
    expect(await planExists(db, id, PLAN_DATE)).toBe(true);
    expect(await countEvent(id, 'plan_generated')).toBe(1);

    const blockRows = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(eq(blocks.userId, id));
    expect(blockRows.length).toBe(2);
  });

  it('regeneration: increments regeneration_count, replaces blocks, logs plan_regenerated', async () => {
    const id = await seedUser();
    await commitPlan(db, {
      userId: id,
      timezone: TZ,
      planDate: PLAN_DATE,
      energyScore: 7,
      plan: PLAN,
      isRegeneration: false,
      isFallback: false,
    });

    // Regenerate with a single-block plan — the old two blocks must be replaced.
    const oneBlock = { blocks: [PLAN.blocks[0]] } as unknown as DailyPlan;
    const r2 = await commitPlan(db, {
      userId: id,
      timezone: TZ,
      planDate: PLAN_DATE,
      energyScore: 4,
      plan: oneBlock,
      isRegeneration: true,
      isFallback: false,
    });

    expect(r2.eventType).toBe('plan_regenerated');
    expect(r2.regenerationCount).toBe(1);
    expect(await countEvent(id, 'plan_generated')).toBe(1);
    expect(await countEvent(id, 'plan_regenerated')).toBe(1);

    const blockRows = await db
      .select({ id: blocks.id })
      .from(blocks)
      .where(eq(blocks.userId, id));
    expect(blockRows.length).toBe(1);
  });

  it('records source:fallback in the completion_log value when served from fallback', async () => {
    const id = await seedUser();
    await commitPlan(db, {
      userId: id,
      timezone: TZ,
      planDate: PLAN_DATE,
      energyScore: 6,
      plan: PLAN,
      isRegeneration: false,
      isFallback: true,
    });
    const rows = (await db.execute(sql`
      SELECT value FROM completion_log
      WHERE user_id = ${id}::uuid AND event_type = 'plan_generated'
    `)) as unknown as Array<{ value: { source?: string } }>;
    expect(rows[0]?.value.source).toBe('fallback');
  });

  it('trial cap: blocks the 3rd generation in a local day', async () => {
    const id = await seedUser();
    // Two prior generations today (logged_at defaults to now()).
    await db.execute(sql`
      INSERT INTO completion_log (user_id, event_type, value) VALUES
        (${id}::uuid, 'plan_generated',   '{}'::jsonb),
        (${id}::uuid, 'plan_regenerated', '{}'::jsonb)
    `);
    // The 3rd is blocked.
    await expect(checkTrialCap(db, { id, timezone: TZ })).rejects.toMatchObject({
      httpStatus: 429,
    });
  });

  it('trial cap: allows generation when under the daily cap', async () => {
    const id = await seedUser();
    await db.execute(sql`
      INSERT INTO completion_log (user_id, event_type, value)
      VALUES (${id}::uuid, 'plan_generated', '{}'::jsonb)
    `);
    await expect(checkTrialCap(db, { id, timezone: TZ })).resolves.toBeUndefined();
  });

  it('active cap: blocks the 6th generation within a rolling hour', async () => {
    const id = await seedUser();
    for (let i = 0; i < 5; i++) {
      await expect(checkActiveCap({ id, timezone: TZ })).resolves.toBeUndefined();
    }
    await expect(checkActiveCap({ id, timezone: TZ })).rejects.toMatchObject({
      httpStatus: 429,
    });
  });

  it('idempotency lock: a second concurrent acquire is refused (409 condition)', async () => {
    const id = await seedUser();
    expect(await acquireLock(id, PLAN_DATE)).toBe(true);
    expect(await acquireLock(id, PLAN_DATE)).toBe(false);
    await releaseLock(id, PLAN_DATE);
    expect(await acquireLock(id, PLAN_DATE)).toBe(true);
  });
});
