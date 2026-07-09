// @vitest-environment node
//
// Tests for the prior-week completion read (GET /api/v1/weekly-review core logic,
// Chat 057 — DECISION A).
//
// Two suites:
//   * "Weekly review window (pure)" — ungated mondayOf/addDays date-math assertions.
//   * "Weekly review completion (integration)" — gated on VESPER_DB_TESTS; drives
//     getPriorWeekCompletion directly against the chat-002 local-Supabase test DB,
//     seeding completion_log block events (real columns event_type/logged_at) in and
//     out of the prior-week window and asserting the computed rate + the empty state.
//
// To run the integration suite:
//   pnpm --filter @vesper/db setup-test-db   # requires `supabase start`
//   VESPER_DB_TESTS=1 pnpm --filter @vesper/web test -- weekly-review.integration
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createDrizzleClient, sql, type Database } from '@vesper/db';
import { getPriorWeekCompletion, mondayOf, addDays } from './operations';

// 2026-06-08 is a Monday → use it as the TARGET planning week's Monday. The reviewed
// prior week is then 2026-06-01 (Mon) .. 2026-06-07 (Sun).
const TARGET_MONDAY = '2026-06-08';
const PRIOR_MONDAY = '2026-06-01';

describe('Weekly review window (pure)', () => {
  it('mondayOf returns the Monday of the containing week (UTC)', () => {
    expect(mondayOf(new Date('2026-06-10T12:00:00Z'))).toBe('2026-06-08'); // Wed -> Mon
    expect(mondayOf(new Date('2026-06-08T00:00:00Z'))).toBe('2026-06-08'); // Mon -> itself
    expect(mondayOf(new Date('2026-06-14T23:59:00Z'))).toBe('2026-06-08'); // Sun -> Mon
  });

  it('addDays shifts a date string by whole UTC days', () => {
    expect(addDays(TARGET_MONDAY, -7)).toBe(PRIOR_MONDAY);
    expect(addDays(PRIOR_MONDAY, 6)).toBe('2026-06-07'); // prior-week Sunday
  });
});

const TEST_DB_URL =
  process.env.TEST_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';
const describeDb = process.env.VESPER_DB_TESTS ? describe : describe.skip;

describeDb('Weekly review completion (integration)', () => {
  let db: Database;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    db = createDrizzleClient(TEST_DB_URL);
  });

  afterEach(async () => {
    for (const id of createdUserIds.splice(0)) {
      // Deleting auth.users cascades to public.users; explicitly clear completion_log.
      await db.execute(sql`DELETE FROM completion_log WHERE user_id = ${id}::uuid`);
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    }
  });

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID();
    await db.execute(
      sql`INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${`wr-${id}@example.com`})`,
    );
    createdUserIds.push(id);
    return id;
  }

  // Insert a completion_log block event at a specific logged_at timestamp.
  // completion_log.value is NOT NULL — seed a minimal '{}' jsonb (the read ignores it).
  async function logEvent(
    userId: string,
    eventType: 'block_completed' | 'block_skipped' | 'block_rescheduled',
    loggedAt: string,
  ): Promise<void> {
    await db.execute(sql`
      INSERT INTO completion_log (user_id, event_type, value, logged_at)
      VALUES (${userId}::uuid, ${eventType}::completion_event_enum, '{}'::jsonb, ${loggedAt}::timestamptz)
    `);
  }

  it('empty prior week → rate null (nothing to review yet)', async () => {
    const userId = await seedUser();
    const res = await getPriorWeekCompletion(db, userId, TARGET_MONDAY);
    expect(res.weeklyReview.weekStartDate).toBe(TARGET_MONDAY);
    expect(res.weeklyReview.priorWeekStart).toBe(PRIOR_MONDAY);
    expect(res.weeklyReview.completed).toBe(0);
    expect(res.weeklyReview.total).toBe(0);
    expect(res.weeklyReview.rate).toBeNull();
  });

  it('counts only in-window block events and computes the actioned-share rate', async () => {
    const userId = await seedUser();

    // In-window (prior week 06-01..06-07): 3 completed, 1 skipped, 1 rescheduled.
    await logEvent(userId, 'block_completed', '2026-06-01T09:00:00Z');
    await logEvent(userId, 'block_completed', '2026-06-03T09:00:00Z');
    await logEvent(userId, 'block_completed', '2026-06-07T09:00:00Z'); // Sunday, still in-window
    await logEvent(userId, 'block_skipped', '2026-06-04T09:00:00Z');
    await logEvent(userId, 'block_rescheduled', '2026-06-05T09:00:00Z');

    // Out-of-window: one BEFORE the prior week, one AT the target Monday (excluded by <).
    await logEvent(userId, 'block_completed', '2026-05-31T09:00:00Z');
    await logEvent(userId, 'block_completed', '2026-06-08T00:00:00Z');

    // A non-block event in-window must be ignored entirely.
    await db.execute(sql`
      INSERT INTO completion_log (user_id, event_type, value, logged_at)
      VALUES (${userId}::uuid, 'energy_logged'::completion_event_enum, '{}'::jsonb, '2026-06-02T09:00:00Z'::timestamptz)
    `);

    const res = await getPriorWeekCompletion(db, userId, TARGET_MONDAY);
    expect(res.weeklyReview.completed).toBe(3);
    expect(res.weeklyReview.total).toBe(5); // 3 completed + 1 skipped + 1 rescheduled
    expect(res.weeklyReview.rate).toBeCloseTo(0.6, 5);
  });
});
