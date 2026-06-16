// @vitest-environment node
//
// Integration tests for POST /api/v1/energy, driven against the chat-002
// local-Supabase test DB. Asserts the raw-SQL insert writes EXACTLY ONE
// energy_logged completion_log row with value={score} and triggers NO plan
// generation (zero daily_plans rows).
//
// Gated on VESPER_DB_TESTS (see profile.integration.test.ts for run instructions).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  createDrizzleClient,
  dailyPlans,
  sql,
  eq,
  type Database,
} from '@vesper/db';
import { logEnergy } from './logEnergy';

const TEST_DB_URL =
  process.env.TEST_DB_URL ??
  'postgresql://postgres:postgres@localhost:54322/postgres';

const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Energy API (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    // Deleting the auth.users row cascades to public.users → completion_log.
    for (const id of createdUserIds.splice(0)) {
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  // Seed via auth.users so the on_auth_user_created trigger creates the matching
  // public.users row (completion_log.user_id FKs to it).
  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`energy-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  async function countEnergyRows(userId: string): Promise<number> {
    const rows = (await db.execute(sql`
      SELECT count(*)::int AS n
      FROM completion_log
      WHERE user_id = ${userId}::uuid AND event_type = 'energy_logged'
    `)) as unknown as Array<{ n: number }>;
    return rows[0]?.n ?? -1;
  }

  it('writes exactly one energy_logged row with value={score} and no daily_plans', async () => {
    const id = await seedUser();
    const res = await logEnergy(db, id, { score: 7 });

    expect(res.logged.score).toBe(7);
    expect(typeof res.logged.id).toBe('string');
    expect(typeof res.logged.loggedAt).toBe('string');

    expect(await countEnergyRows(id)).toBe(1);

    // value JSONB is exactly { "score": 7 } — no plan_date, no energy_score alias.
    const valueRows = (await db.execute(sql`
      SELECT value FROM completion_log
      WHERE user_id = ${id}::uuid AND event_type = 'energy_logged'
    `)) as unknown as Array<{ value: Record<string, unknown> }>;
    expect(valueRows[0]?.value).toEqual({ score: 7 });

    // No plan generation occurred.
    const plans = await db
      .select({ id: dailyPlans.id })
      .from(dailyPlans)
      .where(eq(dailyPlans.userId, id));
    expect(plans.length).toBe(0);
  });

  it('honours an explicit loggedAt timestamp', async () => {
    const id = await seedUser();
    const when = '2026-06-15T08:30:00.000Z';
    const res = await logEnergy(db, id, { score: 3, loggedAt: when });
    expect(new Date(res.logged.loggedAt).toISOString()).toBe(when);
    expect(await countEnergyRows(id)).toBe(1);
  });
});
